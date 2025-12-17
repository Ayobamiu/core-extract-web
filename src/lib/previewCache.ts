/**
 * Preview Data Cache Utility
 * Manages client-side caching of preview data using localStorage
 */

export interface CachedPreviewData {
  preview: any;
  jobFiles: any[];
  pagination: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
  timestamp: number;
  searchTerm?: string;
}

const CACHE_PREFIX = 'preview_cache_';
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes in milliseconds
const MAX_CACHE_SIZE = 50 * 1024 * 1024; // 50MB max cache size

/**
 * Generate cache key for a preview page
 */
function getCacheKey(previewId: string, page: number, pageSize: number, searchTerm?: string): string {
  const searchHash = searchTerm ? `_${hashString(searchTerm)}` : '';
  return `${CACHE_PREFIX}${previewId}_page${page}_size${pageSize}${searchHash}`;
}

/**
 * Simple string hash function for search term
 */
function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Get cached preview data
 */
export function getCachedPreviewData(
  previewId: string,
  page: number,
  pageSize: number,
  searchTerm?: string
): CachedPreviewData | null {
  if (typeof window === 'undefined') return null;

  try {
    const cacheKey = getCacheKey(previewId, page, pageSize, searchTerm);
    const cached = localStorage.getItem(cacheKey);

    if (!cached) return null;

    const data: CachedPreviewData = JSON.parse(cached);
    const now = Date.now();

    // Check if cache is expired
    if (now - data.timestamp > CACHE_DURATION) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    return data;
  } catch (error) {
    console.error('Error reading from cache:', error);
    return null;
  }
}

/**
 * Set cached preview data
 */
export function setCachedPreviewData(
  previewId: string,
  page: number,
  pageSize: number,
  data: Omit<CachedPreviewData, 'timestamp'>,
  searchTerm?: string
): void {
  if (typeof window === 'undefined') return;

  try {
    const cacheKey = getCacheKey(previewId, page, pageSize, searchTerm);
    const cacheData: CachedPreviewData = {
      ...data,
      timestamp: Date.now(),
      searchTerm: searchTerm || undefined,
    };

    // Check cache size before storing
    const cacheSize = new Blob([JSON.stringify(cacheData)]).size;
    if (cacheSize > MAX_CACHE_SIZE) {
      console.warn('Cache entry too large, skipping cache');
      return;
    }

    localStorage.setItem(cacheKey, JSON.stringify(cacheData));
  } catch (error) {
    // Handle quota exceeded error
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('LocalStorage quota exceeded, clearing old cache entries');
      clearOldCacheEntries();
      // Try again after clearing
      try {
        const cacheKey = getCacheKey(previewId, page, pageSize, searchTerm);
        const cacheData: CachedPreviewData = {
          ...data,
          timestamp: Date.now(),
          searchTerm: searchTerm || undefined,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheData));
      } catch (retryError) {
        console.error('Failed to cache after clearing old entries:', retryError);
      }
    } else {
      console.error('Error writing to cache:', error);
    }
  }
}

/**
 * Clear old cache entries to free up space
 */
function clearOldCacheEntries(): void {
  if (typeof window === 'undefined') return;

  try {
    const keys: Array<{ key: string; timestamp: number }> = [];

    // Collect all cache keys with timestamps
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          if (data.timestamp) {
            keys.push({ key, timestamp: data.timestamp });
          }
        } catch {
          // Invalid cache entry, remove it
          if (key) localStorage.removeItem(key);
        }
      }
    }

    // Sort by timestamp (oldest first)
    keys.sort((a, b) => a.timestamp - b.timestamp);

    // Remove oldest 50% of entries
    const toRemove = Math.floor(keys.length / 2);
    for (let i = 0; i < toRemove; i++) {
      localStorage.removeItem(keys[i].key);
    }
  } catch (error) {
    console.error('Error clearing old cache entries:', error);
  }
}

/**
 * Clear all cache entries for a specific preview
 */
export function clearPreviewCache(previewId: string): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(`${CACHE_PREFIX}${previewId}_`)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing preview cache:', error);
  }
}

/**
 * Clear all preview cache entries
 */
export function clearAllPreviewCache(): void {
  if (typeof window === 'undefined') return;

  try {
    const keysToRemove: string[] = [];

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        keysToRemove.push(key);
      }
    }

    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error('Error clearing all preview cache:', error);
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats(): {
  totalEntries: number;
  totalSize: number;
  oldestEntry: number | null;
  newestEntry: number | null;
} {
  if (typeof window === 'undefined') {
    return { totalEntries: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
  }

  try {
    let totalEntries = 0;
    let totalSize = 0;
    let oldestTimestamp: number | null = null;
    let newestTimestamp: number | null = null;

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(CACHE_PREFIX)) {
        try {
          const data = localStorage.getItem(key);
          if (data) {
            totalEntries++;
            totalSize += new Blob([data]).size;
            const parsed = JSON.parse(data);
            if (parsed.timestamp) {
              if (oldestTimestamp === null || parsed.timestamp < oldestTimestamp) {
                oldestTimestamp = parsed.timestamp;
              }
              if (newestTimestamp === null || parsed.timestamp > newestTimestamp) {
                newestTimestamp = parsed.timestamp;
              }
            }
          }
        } catch {
          // Skip invalid entries
        }
      }
    }

    return {
      totalEntries,
      totalSize,
      oldestEntry: oldestTimestamp,
      newestEntry: newestTimestamp,
    };
  } catch (error) {
    console.error('Error getting cache stats:', error);
    return { totalEntries: 0, totalSize: 0, oldestEntry: null, newestEntry: null };
  }
}

