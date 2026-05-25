/**
 * Phase 8: Event coalescing hook.
 *
 * Collects rapid socket patches into a buffer and flushes them as a single
 * batch update, reducing React re-renders from N (one per event) to 1.
 *
 * Also debounces the summary refresh call so at most one API request fires
 * per flush window rather than one per socket event.
 */
import { useRef, useCallback, useEffect } from "react";

export interface PatchEvent {
  fileId: string;
  patch: Record<string, any>;
  version: string;
}

interface UsePatchCoalescerOptions {
  /** Milliseconds to buffer before flushing (default: 200ms) */
  flushInterval?: number;
  /** Called once per flush with all buffered patches */
  onFlush: (patches: PatchEvent[]) => void;
  /** Called at most once per flush to refresh summary (debounced) */
  onSummaryRefresh?: () => void;
}

export function usePatchCoalescer({
  flushInterval = 200,
  onFlush,
  onSummaryRefresh,
}: UsePatchCoalescerOptions) {
  const bufferRef = useRef<PatchEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const summaryScheduledRef = useRef(false);

  // Store latest callbacks without re-creating the push function
  const onFlushRef = useRef(onFlush);
  const onSummaryRefreshRef = useRef(onSummaryRefresh);
  useEffect(() => {
    onFlushRef.current = onFlush;
  }, [onFlush]);
  useEffect(() => {
    onSummaryRefreshRef.current = onSummaryRefresh;
  }, [onSummaryRefresh]);

  const flush = useCallback(() => {
    const patches = bufferRef.current;
    bufferRef.current = [];
    timerRef.current = null;
    summaryScheduledRef.current = false;

    if (patches.length === 0) return;

    // Deduplicate: keep the latest patch per fileId (highest version)
    const byFile = new Map<string, PatchEvent>();
    for (const p of patches) {
      const existing = byFile.get(p.fileId);
      if (!existing || p.version > existing.version) {
        // Merge patches for the same file
        byFile.set(p.fileId, existing
          ? { fileId: p.fileId, patch: { ...existing.patch, ...p.patch }, version: p.version }
          : p
        );
      }
    }

    onFlushRef.current(Array.from(byFile.values()));
    onSummaryRefreshRef.current?.();
  }, []);

  /** Push a patch into the buffer. Flushes after the interval expires. */
  const push = useCallback(
    (event: PatchEvent) => {
      bufferRef.current.push(event);

      if (!timerRef.current) {
        timerRef.current = setTimeout(flush, flushInterval);
      }
    },
    [flush, flushInterval],
  );

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        // Flush remaining patches on unmount
        flush();
      }
    };
  }, [flush]);

  return { push };
}
