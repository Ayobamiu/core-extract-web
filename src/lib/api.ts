// API Client for Document Extractor Dashboard
// Grade A SaaS API integration

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export interface ApiResponse<T = any> {
    status: 'success' | 'error';
    message?: string;
    data?: T;
    [key: string]: any;
}

export interface QueueStats {
    queueSize: number;
    processingCount: number;
    nextFiles: any[];
    processingFiles: any[];
    maxRetries: number;
    retryDelay: number;
    metrics: {
        avgWaitTimeMs: number;
        oldestItemAge: number;
        queueHealth: {
            score: number;
            status: 'healthy' | 'warning' | 'critical';
        };
    };
}

export interface QueueAnalytics {
    queueSize: number;
    processingCount: number;
    avgProcessingTimeMs: number;
    processingFiles: number;
    queueUtilization: number;
    timestamp: number;
}

export interface Job {
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    summary?: any;
    created_at: string;
    updated_at: string;
    file_count: string;
}

export interface File {
    id: string;
    filename: string;
    size: number;
    s3_key?: string;
    file_hash?: string;
    extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    extracted_text?: string;
    extracted_tables?: any;
    result?: any;
    extraction_error?: string;
    processing_error?: string;
    created_at: string;
    processed_at?: string;
}

export interface JobDetails extends Job {
    files: File[];
    schema_data: {
        schema: string;
        schemaName: string;
    };
}

export interface QueueStatus {
    paused: boolean;
    status: 'paused' | 'running';
}

class ApiClient {
    private baseURL: string;
    private accessToken: string | null = null;

    constructor(baseURL: string = API_BASE_URL) {
        this.baseURL = baseURL;
        // Initialize token from localStorage
        if (typeof window !== 'undefined') {
            const storedTokens = localStorage.getItem('auth_tokens');
            if (storedTokens) {
                try {
                    const tokens = JSON.parse(storedTokens);
                    this.accessToken = tokens.accessToken;
                } catch (error) {
                    console.error('Failed to parse stored tokens:', error);
                }
            }
        }
    }

    // Set access token
    setAccessToken(token: string | null) {
        this.accessToken = token;
    }

    // Get access token
    getAccessToken(): string | null {
        return this.accessToken;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<ApiResponse<T>> {
        const url = `${this.baseURL}${endpoint}`;

        // Don't set default Content-Type for FormData requests
        const defaultHeaders = options.body instanceof FormData
            ? {}
            : { 'Content-Type': 'application/json' };

        // Add authorization header if token is available
        const authHeaders = this.accessToken
            ? { 'Authorization': `Bearer ${this.accessToken}` }
            : {};

        const config: RequestInit = {
            ...options,
            headers: {
                ...defaultHeaders,
                ...authHeaders,
                ...options.headers,
            } as HeadersInit,
        };

        try {
            const response = await fetch(url, config);
            const data = await response.json();

            if (!response.ok) {
                // Handle authentication errors
                if (response.status === 401) {
                    // Clear stored tokens and redirect to login
                    if (typeof window !== 'undefined') {
                        localStorage.removeItem('auth_tokens');
                        localStorage.removeItem('auth_user');
                        this.accessToken = null;
                        window.location.href = '/login';
                    }
                }
                throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
            }

            return data;
        } catch (error) {
            console.error(`API request failed: ${endpoint}`, error);
            throw error;
        }
    }

    // Health Check
    async getHealth(): Promise<ApiResponse> {
        return this.request('/health');
    }

    // Authentication Methods
    async login(email: string, password: string): Promise<ApiResponse> {
        const response = await this.request('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });

        if (response.success && (response.data as any)?.tokens?.accessToken) {
            this.setAccessToken((response.data as any).tokens.accessToken);
        }

        return response;
    }

    async register(email: string, password: string, name: string): Promise<ApiResponse> {
        const response = await this.request('/auth/register', {
            method: 'POST',
            body: JSON.stringify({ email, password, name }),
        });

        if (response.success && (response.data as any)?.tokens?.accessToken) {
            this.setAccessToken((response.data as any).tokens.accessToken);
        }

        return response;
    }

    async logout(refreshToken?: string): Promise<ApiResponse> {
        const response = await this.request('/auth/logout', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        });

        this.setAccessToken(null);
        return response;
    }

    async refreshToken(refreshToken: string): Promise<ApiResponse> {
        const response = await this.request('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        });

        if (response.success && (response.data as any)?.accessToken) {
            this.setAccessToken((response.data as any).accessToken);
        }

        return response;
    }

    async getCurrentUser(): Promise<ApiResponse> {
        return this.request('/auth/me');
    }

    async updateProfile(userData: { name?: string; email?: string }): Promise<ApiResponse> {
        return this.request('/auth/profile', {
            method: 'PUT',
            body: JSON.stringify(userData),
        });
    }

    async getUserStats(): Promise<ApiResponse> {
        return this.request('/auth/stats');
    }

    // Queue Management
    async getQueueStats(): Promise<ApiResponse<QueueStats>> {
        return this.request('/queue-stats');
    }

    async getQueueAnalytics(): Promise<ApiResponse<QueueAnalytics>> {
        return this.request('/queue-analytics');
    }

    async getQueueStatus(): Promise<ApiResponse<{ queueStatus: QueueStatus }>> {
        return this.request('/queue/status');
    }

    async pauseQueue(): Promise<ApiResponse> {
        return this.request('/queue/pause', { method: 'POST' });
    }

    async resumeQueue(): Promise<ApiResponse> {
        return this.request('/queue/resume', { method: 'POST' });
    }

    async clearQueue(): Promise<ApiResponse> {
        return this.request('/queue/clear', { method: 'POST' });
    }

    async removeFileFromQueue(fileId: string): Promise<ApiResponse> {
        return this.request(`/queue/files/${fileId}`, { method: 'DELETE' });
    }

    // Job Management
    async getJobs(limit: number = 10, offset: number = 0): Promise<ApiResponse<{ jobs: Job[] }>> {
        return this.request(`/jobs?limit=${limit}&offset=${offset}`);
    }

    async getJob(jobId: string): Promise<ApiResponse<{ job: JobDetails }>> {
        return this.request(`/jobs/${jobId}`);
    }

    async getFileResult(fileId: string): Promise<ApiResponse<{ file: File }>> {
        return this.request(`/files/${fileId}/result`);
    }

    async extract(schemaData: { schema: any; schemaName: string }, file: File): Promise<ApiResponse> {
        const formData = new FormData();

        // Add schema data
        formData.append('schema', JSON.stringify(schemaData.schema));
        formData.append('schemaName', schemaData.schemaName);
        formData.append('jobName', `Job ${new Date().toISOString()}`);

        // Add single file with "files" field name (backend expects "files" even for single file)
        formData.append('files', file as unknown as Blob);

        return this.request('/extract', {
            method: 'POST',
            body: formData,
        });
    }

    async extractMultiple(schemaData: { schema: any; schemaName: string }, files: File[]): Promise<ApiResponse> {
        const formData = new FormData();

        // Add schema data
        formData.append('schema', JSON.stringify(schemaData.schema));
        formData.append('schemaName', schemaData.schemaName);
        formData.append('jobName', `Job ${new Date().toISOString()}`);

        // Add multiple files
        files.forEach((file) => {
            formData.append('files', file as unknown as Blob);
        });

        return this.request('/extract', {
            method: 'POST',
            body: formData,
        });
    }

    async addFilesToJob(jobId: string, files: FileList): Promise<ApiResponse> {
        const formData = new FormData();

        Array.from(files).forEach((file) => {
            formData.append('files', file);
        });

        return this.request(`/jobs/${jobId}/files`, {
            method: 'POST',
            headers: {}, // Remove Content-Type to let browser set it with boundary
            body: formData,
        });
    }

    // System Statistics
    async getSystemStats(): Promise<ApiResponse> {
        return this.request('/system-stats');
    }

    // Test Connections
    async testDatabase(): Promise<ApiResponse> {
        return this.request('/test-db');
    }

    async testRedis(): Promise<ApiResponse> {
        return this.request('/test-redis');
    }

    async testS3(): Promise<ApiResponse> {
        return this.request('/test-s3');
    }

    async getStorageStats(): Promise<ApiResponse> {
        return this.request('/storage-stats');
    }
}

// Create singleton instance
export const apiClient = new ApiClient();
