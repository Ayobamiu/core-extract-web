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
    processingFiles: number;
    completedJobs: number;
    failedJobs: number;
    nextFiles: any[];
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
    schema_data?: {
        schema: any;
        schemaName: string;
    };
    schema_data_array?: Array<{
        schema: any;
        schemaName: string;
    }>;
    created_at: string;
    updated_at: string;
    file_count: string;
    files?: JobFile[];
    collaborators?: Array<{
        email: string;
        role: string;
    }>;
}

export interface JobFile {
    id: string;
    filename: string;
    size: number;
    s3_key?: string;
    file_hash?: string;
    job_id?: string;
    job_extraction_mode?: 'full_extraction' | 'text_only';
    extraction_status: 'pending' | 'processing' | 'completed' | 'failed';
    processing_status: 'pending' | 'processing' | 'completed' | 'failed';
    upload_status?: 'pending' | 'success' | 'failed' | 'retrying';
    upload_error?: string;
    storage_type?: 's3' | 'local';
    retry_count?: number;
    extracted_text?: string;
    extracted_tables?: any;
    markdown?: string;
    result?: any;
    pages?: number | any[]; // Can be a number (count) or array of page objects from raw_data
    page_count?: number;
    selected_pages?: number[]; // Array of selected page numbers (1-indexed)
    actual_result?: any;
    extraction_error?: string;
    processing_error?: string;
    admin_verified?: boolean;
    customer_verified?: boolean;
    review_status?: 'pending' | 'in_review' | 'reviewed' | 'approved' | 'rejected';
    reviewed_by?: string;
    reviewed_at?: string;
    review_notes?: string;
    detected_sections?: DetectedSections | null;
    created_at: string;
    processed_at?: string;
    extraction_time_seconds?: number;
    ai_processing_time_seconds?: number;
    processing_metadata?: {
        processing_time?: string;
        text_length?: number;
        processing_method?: string;
        model?: string;
        [key: string]: any;
    };
    extraction_metadata?: {
        extraction_method?: string;
        extraction_time_seconds?: number;
        // Per-section extraction (v2 envelope) provenance. Populated when
        // the visual classifier ran and produced ≥1 section with extractable
        // pages. When this is present and result_envelope === 'v2',
        // file.result is shaped as V2ResultEnvelope (per-slug arrays).
        result_envelope?: 'v1' | 'v2';
        section_results?: SectionResult[];
        schemas_used?: Record<string, { version: number; schemaId: string }>;
        per_section_extraction?: {
            section_count: number;
            success_count: number;
            failed_count: number;
            skipped_count: number;
            total_ai_time_seconds?: number;
        };
        [key: string]: any;
    };
    previews?: Array<{
        id: string;
        name: string;
        created_at: string;
    }>;
    comments?: Array<{
        id: string;
        userId: string;
        userEmail: string;
        text: string;
        createdAt: string;
    }>;
}

export interface ProcessingConfig {
    extraction: {
        method: 'mineru' | 'documentai' | 'extendai' | 'paddleocr';
        options: Record<string, any>;
    };
    processing: {
        method: 'openai' | 'qwen';
        model: string; // Dynamic based on method
        options: Record<string, any>;
    };
    reprocess?: {
        reExtract?: boolean;
        reProcess?: boolean;
        forceExtraction?: boolean;
        preview?: boolean;
    };
    usePageDetection?: boolean; // Enable/disable page detection filtering (default: true)
    // Visual Page Classifier (Phase 1, item #2). When true the worker runs
    // the classifier BEFORE extraction and narrows the page set passed to
    // the extractor to the union of every section's `extraction_pages`.
    // documentTypeSlugs (optional) restricts the classifier's candidate set
    // to specific registered types — empty/undefined means "consider all".
    useVisualClassifier?: boolean;
    documentTypeSlugs?: string[];
}

// Document type registry (GET /document-types).
export interface DocumentTypeInfo {
    id: string;
    slug: string;
    display_name: string;
    description?: string | null;
    default_extractor?: string | null;
    routing_confidence_threshold?: number | null;
    status: 'active' | 'deprecated' | string;
    has_classifier_hints: boolean;
}

// Visual Page Classifier output, persisted on job_files.detected_sections.
export interface DetectedPage {
    page_number: number;
    document_type_slug: string; // 'none' for boilerplate/empty pages
    page_role?: 'first' | 'middle' | 'last' | 'standalone' | 'none' | null;
    page_purpose?: 'data' | 'reference' | 'boilerplate' | 'cover' | 'blank' | 'attachment' | 'unknown';
    confidence: number;
    duplicate_of?: number | null;
    dupe_signature?: string | null;
}

export interface DetectedSectionSkippedPage {
    page_number: number;
    reason: 'duplicate' | 'reference' | 'boilerplate' | 'cover' | 'blank' | 'attachment' | 'unknown' | string;
    duplicate_of?: number | null;
    page_purpose?: string;
}

export interface DetectedSection {
    document_type_slug: string;
    page_range: [number, number];
    page_count: number;
    extraction_pages: number[];
    skipped_pages: DetectedSectionSkippedPage[];
    page_roles: (string | null)[];
    page_purposes: string[];
    confidence: number;
    min_page_confidence: number;
    status: 'auto_approved' | 'pending_review' | 'approved' | string;
    threshold_used: number;
}

export interface DetectedSections {
    classifier?: {
        provider?: string;
        model?: string;
        version?: number;
        [k: string]: any;
    };
    grouper?: {
        strategy?: string;
        version?: number;
    };
    candidate_slugs?: string[];
    pages: DetectedPage[];
    sections: DetectedSection[];
    status: 'auto_approved' | 'pending_review' | 'skipped' | string;
}

// Per-section extraction (Phase 1, item #3 — v2 envelope).
//
// When the visual classifier is on AND it produces ≥1 section with extractable
// pages, the worker fans out one AI call per section using registry-resolved
// schemas. The result is stored as a v2 envelope: top-level keys are document
// type slugs, values are ALWAYS arrays (even with a single section per slug)
// so downstream consumers don't have to type-check.
//
// Detection: `extraction_metadata.result_envelope === 'v2'` (preferred) OR
// shape inspection (top-level keys match `extraction_metadata.section_results[*].slug`).
export type V2ResultEnvelope = Record<string, Array<Record<string, unknown>>>;

export type SectionResultStatus =
    | 'success'
    | 'failed'
    | 'skipped_no_schema'
    | 'skipped_no_content'
    | 'skipped_no_pages';

export interface SectionResult {
    section_index: number;
    slug: string;
    page_range: [number | null, number | null];
    extraction_pages: number[];
    status: SectionResultStatus;
    error?: string;
    duration_ms?: number;
    ai_metadata?: Record<string, unknown>;
}

/**
 * Returns true when `result` is a v2 envelope. Checks the explicit marker
 * first (preferred), falls back to a shape-based heuristic when callers
 * don't have the metadata available (e.g., realtime websocket events).
 */
export function isV2ResultEnvelope(
    result: unknown,
    metadata?: { result_envelope?: 'v1' | 'v2'; section_results?: SectionResult[] }
): result is V2ResultEnvelope {
    if (!result || typeof result !== 'object' || Array.isArray(result)) return false;
    if (metadata?.result_envelope === 'v2') return true;
    if (metadata?.result_envelope === 'v1') return false;

    // Heuristic: every top-level key maps to an array of objects, AND there's
    // at least one such key. This rules out v1 results which are flat field
    // bags ({ name: '...', depth: 100 }) since their top-level values are
    // primitives or single objects, not arrays-of-objects.
    const entries = Object.entries(result as Record<string, unknown>);
    if (entries.length === 0) return false;
    return entries.every(([_, v]) =>
        Array.isArray(v) && v.every((x) => x && typeof x === 'object' && !Array.isArray(x))
    );
}

export interface JobDetails extends Job {
    files: JobFile[];
    schema_data: {
        schema: string;
        schemaName: string;
    };
    processing_config?: ProcessingConfig;
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
    admin_verified?: boolean;
    review_status?: 'pending' | 'in_review' | 'reviewed' | 'approved' | 'rejected';
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

            // Try to parse JSON, but handle non-JSON responses gracefully
            let data;
            const contentType = response.headers.get('content-type');
            const responseClone = response.clone(); // Clone for potential text reading

            if (contentType && contentType.includes('application/json')) {
                try {
                    data = await response.json();
                } catch (jsonError) {
                    // If JSON parsing fails, try to read as text from clone
                    try {
                        const text = await responseClone.text();
                        return {
                            status: 'error',
                            success: false,
                            message: `Invalid JSON response: ${text.substring(0, 100)}`,
                            error: 'Invalid JSON response'
                        };
                    } catch (textError) {
                        return {
                            status: 'error',
                            success: false,
                            message: 'Failed to parse response',
                            error: 'Response parsing failed'
                        };
                    }
                }
            } else {
                // Non-JSON response
                const text = await response.text();
                data = { message: text };
            }

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

            // Normalize response to include success property for consistency
            // Handle different response formats:
            // 1. { status: 'success', ... } -> { status: 'success', success: true, ... }
            // 2. { success: true, ... } -> keep as is
            // 3. Other formats -> assume success if response.ok
            const normalizedResponse = {
                ...data,
                success: data.status === 'success' || data.success === true || (data.status !== 'error' && response.ok)
            };

            return normalizedResponse;
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

    async getJobDetails(jobId: string): Promise<ApiResponse<{
        job: Omit<JobDetails, 'files' | 'summary'>;
        summary: {
            total: number;
            extraction_pending: number;
            extraction_processing: number;
            extraction_completed: number;
            extraction_failed: number;
            processing_pending: number;
            processing_processing: number;
            processing_completed: number;
            processing_failed: number;
            processing: number; // extraction_status = 'processing' OR processing_status = 'processing'
            pending: number; // extraction_status = 'pending' AND processing_status = 'pending'
        };
    }>> {
        return this.request(`/jobs/${jobId}/details`);
    }

    async getJobStatus(jobId: string): Promise<ApiResponse<JobDetails>> {
        return this.request(`/jobs/${jobId}`);
    }

    async getJobFileStats(jobId: string): Promise<ApiResponse<{
        jobId: string;
        stats: {
            total: number;
            processed: number;
            processing: number;
            pending: number;
        };
    }>> {
        return this.request(`/jobs/${jobId}/files/stats`);
    }

    async getJobFilesByStatus(
        jobId: string,
        status: 'processed' | 'processing' | 'pending',
        limit: number = 50,
        offset: number = 0
    ): Promise<ApiResponse<{
        jobId: string;
        status: string;
        files: JobFile[];
        total: number;
        limit: number;
        offset: number;
        pagination: {
            current: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });

        return this.request(`/jobs/${jobId}/files/${status}?${params.toString()}`);
    }

    async getFileResult(fileId: string): Promise<ApiResponse<{ file: JobFile }>> {
        return this.request(`/files/${fileId}/result`);
    }

    // List active document types from the schema registry. Powers the
    // "restrict classifier to" multi-select on job creation/config.
    async getDocumentTypes(opts?: { includeDeprecated?: boolean }): Promise<ApiResponse<{ documentTypes: DocumentTypeInfo[] }>> {
        const params = new URLSearchParams();
        if (opts?.includeDeprecated) params.set('includeDeprecated', 'true');
        const qs = params.toString();
        return this.request(`/document-types${qs ? `?${qs}` : ''}`);
    }

    // Fetch a rasterised JPEG of a single PDF page and return a blob URL
    // ready to drop into <img src>. Caller is responsible for revoking the
    // URL when the consumer unmounts (URL.revokeObjectURL).
    async getFilePageThumbnail(
        fileId: string,
        pageNumber: number,
        opts?: { width?: number; quality?: number; signal?: AbortSignal }
    ): Promise<string> {
        const params = new URLSearchParams();
        if (opts?.width) params.set('width', String(opts.width));
        if (opts?.quality) params.set('q', String(opts.quality));
        const qs = params.toString();
        const url = `${this.baseURL}/files/${fileId}/pages/${pageNumber}/thumbnail.jpg${qs ? `?${qs}` : ''}`;

        const res = await fetch(url, {
            signal: opts?.signal,
            headers: this.accessToken ? { Authorization: `Bearer ${this.accessToken}` } : {},
        });
        if (!res.ok) {
            throw new Error(`Thumbnail fetch failed: ${res.status} ${res.statusText}`);
        }
        const blob = await res.blob();
        return URL.createObjectURL(blob);
    }

    async getFilePdfUrl(fileId: string): Promise<string> {
        const baseURL = this.baseURL;
        try {
            // Request JSON format to get the signed URL for iframe embedding
            const response = await fetch(
                `${baseURL}/files/${fileId}/download?format=json`,
                {
                    headers: {
                        Authorization: `Bearer ${this.getAccessToken()}`,
                        Accept: "application/json",
                    },
                }
            );

            if (response.ok) {
                const data = await response.json();
                return data.url; // Return the signed S3 URL
            } else {
                // Fallback to direct URL if JSON request fails
                return `${baseURL}/files/${fileId}/download`;
            }
        } catch (error) {
            console.error("Error getting file URL:", error);
            // Fallback to direct URL
            return `${baseURL}/files/${fileId}/download`;
        }
    }

    async extract(schemaData: { schema: any; schemaName: string; jobName?: string }, file: JobFile): Promise<ApiResponse> {
        const formData = new FormData();

        // Add schema data
        formData.append('schema', JSON.stringify(schemaData.schema));
        formData.append('schemaName', schemaData.schemaName);

        // Only append jobName if explicitly provided - let Groq generate it if not provided
        if (schemaData.jobName && schemaData.jobName.trim() !== '') {
            formData.append('jobName', schemaData.jobName);
        }

        // Add single file with "files" field name (backend expects "files" even for single file)
        formData.append('files', file as unknown as Blob);

        return this.request('/extract', {
            method: 'POST',
            body: formData,
        });
    }

    async extractMultiple(schemaData: { schema: any; schemaName: string; extractionMode?: string; jobName?: string }, files: JobFile[], processingConfig?: ProcessingConfig, selectedPages?: Record<string, number[]>): Promise<ApiResponse> {
        const formData = new FormData();

        // Add schema data
        formData.append('schema', JSON.stringify(schemaData.schema));
        formData.append('schemaName', schemaData.schemaName);

        // Only append jobName if explicitly provided - let Groq generate it if not provided
        if (schemaData.jobName && schemaData.jobName.trim() !== '') {
            formData.append('jobName', schemaData.jobName);
        }

        // Add extraction mode (default to full_extraction if not provided)
        formData.append('extractionMode', schemaData.extractionMode || 'full_extraction');

        // Add processing config if provided
        if (processingConfig) {
            formData.append('processingConfig', JSON.stringify(processingConfig));
            // Also add extraction_method for Flask service compatibility
            formData.append('extraction_method', processingConfig.extraction.method);
        }

        // Add selected_pages if provided
        if (selectedPages && Object.keys(selectedPages).length > 0) {
            formData.append('selected_pages', JSON.stringify(selectedPages));
        }

        // Add multiple files
        files.forEach((file) => {
            formData.append('files', file as unknown as Blob);
        });

        return this.request('/extract', {
            method: 'POST',
            body: formData,
        });
    }

    async addFilesToJob(jobId: string, files: FileList, selectedPages?: Record<string, number[]>): Promise<ApiResponse> {
        const formData = new FormData();

        Array.from(files).forEach((file) => {
            formData.append('files', file);
        });

        // Add selected_pages if provided
        if (selectedPages && Object.keys(selectedPages).length > 0) {
            formData.append('selected_pages', JSON.stringify(selectedPages));
        }

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

    async getPreviewDataPaginated(
        id: string,
        page: number = 1,
        pageSize: number = 20,
        search?: string
    ): Promise<ApiResponse<{
        preview: PreviewDataTable;
        jobFiles: PreviewJobFile[];
        pagination: {
            total: number;
            page: number;
            pageSize: number;
            totalPages: number;
        };
    }>> {
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString(),
        });
        if (search && search.trim()) {
            params.append('search', search.trim());
        }
        return this.request(`/previews/${id}/data?${params.toString()}`);
    }

    async getPreviewStatistics(id: string): Promise<ApiResponse<{
        total: number;
        humanVerified: number;
        reviewed: number;
        approved: number;
        inReview: number;
        pending: number;
        rejected: number;
        humanVerifiedPercentage: number;
        qualityScore: number;
        allVerified: boolean;
    }>> {
        return this.request(`/previews/${id}/statistics`);
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

    async getAllFiles(limit: number = 50, offset: number = 0, status?: string, jobId?: string): Promise<ApiResponse<{
        files: JobFile[];
        total: number;
        stats: {
            total: number;
            completed: number;
            processing: number;
            failed: number;
            pending: number;
        };
        limit: number;
        offset: number;
        pagination: {
            current: number;
            pageSize: number;
            total: number;
            totalPages: number;
        };
    }>> {
        const params = new URLSearchParams({
            limit: limit.toString(),
            offset: offset.toString(),
        });

        if (status) params.append('status', status);
        if (jobId) params.append('jobId', jobId);

        return this.request(`/files?${params.toString()}`);
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

    async updateJobConfig(
        jobId: string,
        updates: {
            name?: string;
            extraction_mode?: 'full_extraction' | 'text_only';
            processing_config?: Partial<ProcessingConfig>;
        }
    ): Promise<ApiResponse<{
        jobId: string;
        name: string;
        extraction_mode: string;
        processing_config: ProcessingConfig;
    }>> {
        return this.request(`/jobs/${jobId}/config`, {
            method: 'PUT',
            body: JSON.stringify(updates),
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

    async verifyFile(fileId: string, adminVerified?: boolean, customerVerified?: boolean): Promise<ApiResponse<{ id: string; filename: string; admin_verified: boolean; customer_verified: boolean }>> {
        return this.request(`/files/${fileId}/verify`, {
            method: 'PUT',
            body: JSON.stringify({ adminVerified, customerVerified }),
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

    async getFileComments(fileId: string): Promise<ApiResponse<{
        comments: Array<{
            id: string;
            userId: string;
            userEmail: string;
            text: string;
            createdAt: string;
        }>;
    }>> {
        return this.request(`/files/${fileId}/comments`);
    }

    async addFileComment(fileId: string, text: string): Promise<ApiResponse<{
        comment: {
            id: string;
            userId: string;
            userEmail: string;
            text: string;
            createdAt: string;
        };
    }>> {
        return this.request(`/files/${fileId}/comments`, {
            method: 'POST',
            body: JSON.stringify({ text }),
        });
    }

    async updateFileReviewStatus(
        fileId: string,
        reviewStatus: 'pending' | 'in_review' | 'reviewed' | 'approved' | 'rejected',
        reviewNotes?: string
    ): Promise<ApiResponse<{
        id: string;
        filename: string;
        review_status: string;
        reviewed_by: string;
        reviewed_at: string;
        review_notes?: string;
    }>> {
        return this.request(`/files/${fileId}/review`, {
            method: 'PUT',
            body: JSON.stringify({ reviewStatus, reviewNotes }),
        });
    }

    async bulkUpdateFileReviewStatus(
        fileIds: string[],
        reviewStatus: 'pending' | 'in_review' | 'reviewed' | 'approved' | 'rejected',
        reviewNotes?: string
    ): Promise<ApiResponse<{
        updated: Array<{
            id: string;
            filename: string;
            review_status: string;
            reviewed_by: string;
            reviewed_at: string;
            review_notes?: string;
            job_id: string;
        }>;
        denied?: Array<{ fileId: string; error: string }>;
    }>> {
        return this.request('/files/bulk/review', {
            method: 'PUT',
            body: JSON.stringify({ fileIds, reviewStatus, reviewNotes }),
        });
    }

    async bulkVerifyFiles(
        fileIds: string[],
        adminVerified?: boolean,
        customerVerified?: boolean
    ): Promise<ApiResponse<{
        updated: Array<{
            id: string;
            filename: string;
            admin_verified: boolean;
            customer_verified: boolean;
            job_id: string;
        }>;
        denied?: Array<{ fileId: string; error: string }>;
    }>> {
        return this.request('/files/bulk/verify', {
            method: 'PUT',
            body: JSON.stringify({ fileIds, adminVerified, customerVerified }),
        });
    }

    async bulkReviewAndVerifyFiles(
        fileIds: string[],
        reviewStatus: 'pending' | 'in_review' | 'reviewed' | 'approved' | 'rejected',
        adminVerified: boolean,
        reviewNotes?: string
    ): Promise<ApiResponse<{
        updated: Array<{
            id: string;
            filename: string;
            review_status: string;
            reviewed_by: string;
            reviewed_at: string;
            admin_verified: boolean;
            customer_verified: boolean;
            job_id: string;
        }>;
        denied?: Array<{ fileId: string; error: string }>;
    }>> {
        return this.request('/files/bulk/review-and-verify', {
            method: 'PUT',
            body: JSON.stringify({ fileIds, reviewStatus, adminVerified, reviewNotes }),
        });
    }

    async reprocessFiles(fileIds: string[], priority: number = 0, processingConfig?: ProcessingConfig): Promise<ApiResponse<{
        queuedFiles?: Array<{
            fileId: string;
            filename: string;
            jobId: string;
            mode?: string;
            operations?: {
                willExtract: boolean;
                willProcess: boolean;
            };
        }>;
        preview?: Array<{
            fileId: string;
            filename: string;
            jobId: string;
            currentStatus: {
                extraction: string;
                processing: string;
            };
            operations: {
                willExtract: boolean;
                willProcess: boolean;
                hasExtractedText: boolean;
            };
        }>;
        skippedFiles?: Array<{
            fileId: string;
            reason: string;
        }>;
        errors?: Array<{
            fileId: string;
            error: string;
        }>;
        summary?: {
            total: number;
            queued?: number;
            preview?: number;
            skipped: number;
            errors: number;
        };
        options?: {
            reExtract: boolean;
            reProcess: boolean;
            forceExtraction: boolean;
        };
    }>> {
        return this.request('/files/reprocess', {
            method: 'POST',
            body: JSON.stringify({ fileIds, priority, processingConfig }),
        });
    }
}

// Create singleton instance
export const apiClient = new ApiClient();
