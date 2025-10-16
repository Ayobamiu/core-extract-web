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

export interface Organization {
    id: string;
    name: string;
    slug: string;
    domain?: string;
    plan: string;
    created_at: string;
    updated_at: string;
    user_role?: string;
}

export interface OrganizationMember {
    id: string;
    email: string;
    name: string;
    role: string;
    email_verified: boolean;
    created_at: string;
    last_login_at?: string;
    login_count: number;
    invited_by_name?: string;
}

export interface OrganizationInvitation {
    id: string;
    email: string;
    role: string;
    token: string;
    expires_at: string;
    accepted_at?: string;
    created_at: string;
    invited_by_name?: string;
}

export interface OrganizationStats {
    total_members: number;
    total_jobs: number;
    total_files: number;
    owners_count: number;
    admins_count: number;
    members_count: number;
    viewers_count: number;
    completed_jobs: number;
    processing_jobs: number;
    failed_jobs: number;
    total_storage_bytes: number;
}

export interface Job {
    id: string;
    name: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    summary?: any;
    extraction_mode?: 'full_extraction' | 'text_only';
    created_at: string;
    updated_at: string;
    file_count: string;
}

export interface JobFile {
    id: string;
    filename: string;
    size: number;
    s3_key?: string;
    file_hash?: string;
    extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    upload_status?: 'pending' | 'success' | 'failed' | 'retrying';
    upload_error?: string;
    storage_type?: 's3' | 'local';
    retry_count?: number;
    extracted_text?: string;
    extracted_tables?: any;
    result?: any;
    extraction_error?: string;
    processing_error?: string;
    created_at: string;
    processed_at?: string;
    processing_metadata?: {
        processing_time?: string;
        text_length?: number;
    };
}

export interface JobDetails extends Job {
    files: JobFile[];
    schema_data: {
        schema: string;
        schemaName: string;
    };
}

export interface QueueStatus {
    paused: boolean;
    status: 'paused' | 'running';
}

export interface PreviewDataTable {
    id: string;
    name: string;
    schema: any;
    logo?: string;
    items_ids: string[];
    created_at: string;
    updated_at: string;
    item_count?: number;
}

export interface PreviewJobFile {
    id: string;
    filename: string;
    result: any;
    processing_status: string;
    created_at: string;
    job_name: string;
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

                // Return the error response instead of throwing
                return {
                    status: 'error',
                    success: false,
                    message: data.message || data.error || `HTTP error! status: ${response.status}`,
                    error: data.error || data.message
                };
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

    async getFileResult(fileId: string): Promise<ApiResponse<{ file: JobFile }>> {
        return this.request(`/files/${fileId}/result`);
    }

    async extract(schemaData: { schema: any; schemaName: string }, file: JobFile): Promise<ApiResponse> {
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

    async extractMultiple(schemaData: { schema: any; schemaName: string; extractionMode?: string }, files: JobFile[]): Promise<ApiResponse> {
        const formData = new FormData();

        // Add schema data
        formData.append('schema', JSON.stringify(schemaData.schema));
        formData.append('schemaName', schemaData.schemaName);
        formData.append('jobName', `Job ${new Date().toISOString()}`);

        // Add extraction mode (default to full_extraction if not provided)
        formData.append('extractionMode', schemaData.extractionMode || 'full_extraction');

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

    // Organization Management
    async getOrganizations(): Promise<ApiResponse<{ organizations: Organization[] }>> {
        return this.request('/organizations');
    }

    async getOrganization(organizationId: string): Promise<ApiResponse<{ organization: Organization }>> {
        return this.request(`/organizations/${organizationId}`);
    }

    async createOrganization(data: { name: string; domain?: string }): Promise<ApiResponse<{ organization: Organization }>> {
        return this.request('/organizations', {
            method: 'POST',
            body: JSON.stringify(data),
        });
    }

    async updateOrganization(organizationId: string, data: Partial<Organization>): Promise<ApiResponse<{ organization: Organization }>> {
        return this.request(`/organizations/${organizationId}`, {
            method: 'PUT',
            body: JSON.stringify(data),
        });
    }

    async deleteOrganization(organizationId: string): Promise<ApiResponse<{ organization: Organization }>> {
        return this.request(`/organizations/${organizationId}`, {
            method: 'DELETE',
        });
    }

    // Organization Members
    async getOrganizationMembers(organizationId: string): Promise<ApiResponse<{ members: OrganizationMember[] }>> {
        return this.request(`/organizations/${organizationId}/members`);
    }

    async updateMemberRole(organizationId: string, userId: string, role: string): Promise<ApiResponse<{ member: OrganizationMember }>> {
        return this.request(`/organizations/${organizationId}/members/${userId}`, {
            method: 'PUT',
            body: JSON.stringify({ role }),
        });
    }

    async removeMember(organizationId: string, userId: string): Promise<ApiResponse<{ member: OrganizationMember }>> {
        return this.request(`/organizations/${organizationId}/members/${userId}`, {
            method: 'DELETE',
        });
    }

    // Organization Invitations
    async inviteMember(organizationId: string, email: string, role: string): Promise<ApiResponse<{ invitation: OrganizationInvitation }>> {
        return this.request(`/organizations/${organizationId}/invite`, {
            method: 'POST',
            body: JSON.stringify({ email, role }),
        });
    }

    async getOrganizationInvitations(organizationId: string): Promise<ApiResponse<{ invitations: OrganizationInvitation[] }>> {
        return this.request(`/organizations/${organizationId}/invitations`);
    }

    async cancelInvitation(organizationId: string, invitationId: string): Promise<ApiResponse<{ invitation: OrganizationInvitation }>> {
        return this.request(`/organizations/${organizationId}/invitations/${invitationId}`, {
            method: 'DELETE',
        });
    }

    async acceptInvitation(token: string): Promise<ApiResponse<{ organizationId: string; organizationName: string; role: string }>> {
        return this.request(`/organizations/invitations/${token}/accept`, {
            method: 'POST',
        });
    }

    async getInvitationDetails(token: string): Promise<ApiResponse<{ invitation: OrganizationInvitation }>> {
        return this.request(`/organizations/invitations/${token}`);
    }

    // Organization Statistics
    async getOrganizationStats(organizationId: string): Promise<ApiResponse<{ stats: OrganizationStats }>> {
        return this.request(`/organizations/${organizationId}/stats`);
    }

    // Preview Data Table Methods
    async getPreviews(): Promise<ApiResponse<PreviewDataTable[]>> {
        return this.request('/previews');
    }

    async getPreview(id: string): Promise<ApiResponse<PreviewDataTable>> {
        return this.request(`/previews/${id}`);
    }

    async getPreviewData(id: string): Promise<ApiResponse<{ preview: PreviewDataTable; jobFiles: PreviewJobFile[] }>> {
        return this.request(`/previews/${id}/data`);
    }

    async createPreview(name: string, schema: any, logo?: string): Promise<ApiResponse<PreviewDataTable>> {
        return this.request('/previews', {
            method: 'POST',
            body: JSON.stringify({ name, schema, logo }),
        });
    }

    async updatePreview(id: string, updates: Partial<PreviewDataTable>): Promise<ApiResponse<PreviewDataTable>> {
        return this.request(`/previews/${id}`, {
            method: 'PUT',
            body: JSON.stringify(updates),
        });
    }

    async deletePreview(id: string): Promise<ApiResponse<{ id: string; name: string }>> {
        return this.request(`/previews/${id}`, {
            method: 'DELETE',
        });
    }

    async addItemsToPreview(id: string, itemIds: string[]): Promise<ApiResponse<PreviewDataTable>> {
        return this.request(`/previews/${id}/items`, {
            method: 'POST',
            body: JSON.stringify({ itemIds }),
        });
    }

    async removeItemFromPreview(id: string, itemId: string): Promise<ApiResponse<PreviewDataTable>> {
        return this.request(`/previews/${id}/items/${itemId}`, {
            method: 'DELETE',
        });
    }

    async getAvailableFiles(limit: number = 50): Promise<ApiResponse<PreviewJobFile[]>> {
        return this.request(`/previews/available-files?limit=${limit}`);
    }

    async getPreviewsForFile(fileId: string): Promise<ApiResponse<PreviewDataTable[]>> {
        return this.request(`/previews/file/${fileId}`);
    }

    async isFileInPreview(fileId: string, previewId: string): Promise<ApiResponse<{ exists: boolean }>> {
        return this.request(`/previews/${previewId}/contains/${fileId}`);
    }

    async getFileSchema(fileId: string): Promise<ApiResponse<{ schema: any; schemaName: string }>> {
        return this.request(`/previews/file/${fileId}/schema`);
    }

    async enrichFileWithMGSData(fileId: string): Promise<ApiResponse<{ fileId: string; mgsData: any; message: string }>> {
        return this.request(`/previews/file/${fileId}/enrich-with-mgs`, {
            method: 'POST',
        });
    }

    async updateJobSchema(jobId: string, schema: any): Promise<ApiResponse<{ jobId: string; schema: any }>> {
        return this.request(`/jobs/${jobId}/schema`, {
            method: 'PUT',
            body: JSON.stringify({ schema }),
        });
    }

    async updateFileResults(fileId: string, results: any): Promise<ApiResponse<{ fileId: string; filename: string; results: any }>> {
        return this.request(`/files/${fileId}/results`, {
            method: 'PUT',
            body: JSON.stringify({ results }),
        });
    }

    async deleteFile(fileId: string): Promise<ApiResponse<{
        fileId: string;
        filename: string;
        jobId: string;
    }>> {
        return this.request(`/files/${fileId}`, {
            method: 'DELETE',
        });
    }

    async deleteFiles(fileIds: string[]): Promise<ApiResponse<{
        deletedFiles: Array<{
            fileId: string;
            filename: string;
            jobId: string;
        }>;
        errors?: Array<{
            fileId: string;
            error: string;
        }>;
    }>> {
        return this.request('/files', {
            method: 'DELETE',
            body: JSON.stringify({ fileIds }),
        });
    }

    async retryFileUpload(fileId: string, file?: File): Promise<ApiResponse<{
        fileId: string;
        retryCount: number;
        newFile?: {
            originalName: string;
            size: number;
            s3Key?: string;
        };
    }>> {
        const formData = new FormData();
        if (file) {
            formData.append('file', file);
        }

        return this.request(`/files/${fileId}/retry-upload`, {
            method: 'POST',
            body: formData,
        });
    }

    async bulkEnrichFilesWithMGSData(fileIds: string[]): Promise<ApiResponse<{
        results: Array<{
            fileId: string;
            filename?: string;
            success: boolean;
            skipped?: boolean;
            reason?: string;
            mgsData?: any;
            error?: string;
        }>;
        summary: {
            total: number;
            successful: number;
            failed: number;
            skipped: number;
        };
    }>> {
        return this.request('/previews/files/bulk/enrich-with-mgs', {
            method: 'POST',
            body: JSON.stringify({ fileIds }),
        });
    }
}

// Create singleton instance
export const apiClient = new ApiClient();
