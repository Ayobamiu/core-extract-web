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
    // Phase 1: skinny list fields (replace heavy columns in list view)
    has_result?: boolean;
    record_count?: number;
    // Per-section verification tallies (explicit rows only; sections never
    // verified have no row, so displayed pending = record_count - the rest)
    section_review_counts?: {
        approved: number;
        rejected: number;
        in_review: number;
        pending: number;
    };
    extraction_method?: string;
    flags?: Array<{
        name: string;
        passed: boolean;
        message: string;
        severity: 'error' | 'warning' | 'info' | 'critical';
        emphasis?: 'county' | 'default';
        details?: any;
    }>;
    previews?: Array<{
        id: string;
        name: string;
        slug?: string;
        created_at?: string;
    }>;
    comments?: Array<{
        id: string;
        userId: string;
        userEmail: string;
        text: string;
        createdAt: string;
    }>;
    section_verifications?: SectionVerification[];
}

export interface ProcessingConfig {
    extraction: {
        method: 'extendai' | 'paddleocr';
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
    usePerSectionExtraction?: boolean;
    documentTypeSlugs?: string[];
    // Per-job post-processing overrides (auto-run services like geocoding).
    // Each entry overrides the document-type default for that service. Resolution
    // at processing time: enabled = jobOverride.enabled ?? slugDefault.enabled ?? false.
    postProcessing?: PostProcessingOverride[];
}

/** A per-job post-processing service toggle (jobs.processing_config.postProcessing). */
export interface PostProcessingOverride {
    name: string;
    enabled?: boolean;
    options?: Record<string, unknown>;
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
    has_qa_hints: boolean;
    /** Ordered identifier dot-paths for this type (e.g.
     *  ["site_identification.boring_well_id"]); empty → heuristic fallback. */
    identifier_fields?: string[] | null;
}

// Admin schema registry (GET /registry/...)
export interface RegistryDocumentTypeDetail {
    slug: string;
    display_name: string;
    description?: string | null;
    default_extractor: string;
    routing_confidence_threshold: number;
    status: string;
    classifier_hints?: Record<string, unknown> | null;
    qa_hints?: Record<string, unknown> | null;
    post_processing_defaults?: PostProcessingOverride[] | null;
    identifier_fields?: string[] | null;
    created_at?: string;
    updated_at?: string;
    current_schema_version_id?: string | null;
    current_schema_version?: number | null;
    current_schema_name?: string | null;
    current_schema_row_status?: string | null;
    version_count?: number;
}

export interface RegistrySchemaVersionSummary {
    id: string;
    version: number;
    schema_name: string | null;
    status: string;
    notes: string | null;
    created_at: string;
    is_current: boolean;
}

export interface RegistrySchemaVersionFull {
    schemaId: string;
    version: number;
    schemaName: string;
    status: string;
    schema: Record<string, unknown>;
    promptHints: Record<string, unknown>;
    documentTypeSlug: string;
    defaultExtractor?: string | null;
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
    record_id?: string | null;
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
    /** Stable link to the extraction record in the V2 envelope. Null when the
     *  section needs (re-)extraction (set by split/merge/slug-change). */
    section_result_id?: string | null;
    /** section_result_id of the canonical duplicate (e.g. the updated version
     *  of the same well). A superseded section keeps its entry here for
     *  provenance, but its record leaves the result envelope on Save and it
     *  is excluded from extraction, review counts and QA. */
    superseded_by?: string | null;
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
    edits?: Array<{ kind: string; ts: string; [k: string]: unknown }>;
}

// ── Section QA findings ──────────────────────────────────────────────

export type QAIssueType = 'wrong_value' | 'missing_value' | 'extra_value' | 'missing_rows' | 'extra_rows' | 'wrong_count' | 'formatting' | 'add_row' | 'update_row' | 'delete_row';
export type QASeverity = 'error' | 'warning' | 'info';
export type QAFindingStatus = 'open' | 'accepted' | 'dismissed';
export type QAOverallQuality = 'perfect' | 'good' | 'acceptable' | 'poor';

export interface QAFinding {
    id: string;
    file_id: string;
    section_result_id: string;
    field_path: string;
    issue_type: QAIssueType;
    severity: QASeverity;
    expected: string | null;
    actual: string | null;
    /**
     * Typed replacement value for `actual` (string/number/boolean/null),
     * distinct from `expected` which is a verbatim evidence quote and may not
     * be directly injectable (e.g. a boolean field's evidence is often a
     * marker/note, not the literal word "true"/"false"). Absent (undefined)
     * on findings saved before this field existed — fall back to
     * coerceExpected(expected, ...) in that case.
     */
    corrected_value?: string | number | boolean | null;
    /**
     * 0-indexed position within the target array (which must itself be
     * `field_path`). Required for delete_row/update_row; optional insertion
     * position for add_row (null/undefined = append). Null/undefined for
     * every other issue_type.
     */
    row_index?: number | null;
    /**
     * Full row object for add_row/update_row, matching the target array's
     * item shape. Null/undefined for delete_row and every other issue_type.
     */
    row_value?: Record<string, unknown> | null;
    explanation: string;
    status: QAFindingStatus;
    overall_quality: QAOverallQuality | null;
    qa_model: string | null;
    created_at: string;
    updated_at: string;
}

/** A record that QA ran on a section (present even for clean, zero-finding runs). */
export interface QARun {
    section_result_id: string;
    overall_quality: QAOverallQuality | null;
    summary: string | null;
    findings_count: number;
    qa_model: string | null;
    last_qa_at: string;
}

// ── Processing timeline (curated, frontend-facing progress events) ──
export type ProcessingPhase =
    | 'queued' | 'classifying' | 'extracting' | 'ai_extraction'
    | 'post_processing' | 'done' | 'failed' | 'skipped';
export type ProcessingEventStatus = 'active' | 'done' | 'failed' | 'info';
export type ProcessingEventLevel = 'info' | 'warning' | 'error';

export interface ProcessingEvent {
    id?: string;
    seq?: number;
    file_id?: string;
    fileId?: string; // socket payload uses camelCase
    job_id?: string | null;
    jobId?: string | null;
    phase: ProcessingPhase;
    step?: string | null;
    status: ProcessingEventStatus;
    progress_current?: number | null;
    progress_total?: number | null;
    progress?: { current: number; total: number }; // socket payload shape
    message?: string | null;
    level?: ProcessingEventLevel;
    data?: Record<string, unknown> | null;
    created_at?: string;
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
    section_result_id?: string;
    section_index: number;
    slug: string;
    record_id?: string | null;
    page_range: [number | null, number | null];
    extraction_pages: number[];
    status: SectionResultStatus;
    error?: string;
    duration_ms?: number;
    ai_metadata?: Record<string, unknown>;
}

// ── Section-level verification ──
export type SectionVerificationStatus = 'pending' | 'approved' | 'rejected' | 'in_review';

export interface SectionVerification {
    id: string;
    file_id: string;
    section_result_id: string;
    status: SectionVerificationStatus;
    verified_by: string | null;
    verified_by_email: string | null;
    verified_at: string | null;
    notes: string | null;
    created_at: string;
    updated_at: string;
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

// ── Section monitoring (large section guardrails) ──
export interface MonitoringSection {
    file_id: string;
    filename: string;
    job_id: string;
    job_name: string;
    page_count: number | null;
    slug: string;
    record_id: string | null;
    page_range: [number | null, number | null];
    extraction_pages: number[];
    status: string;
    error: string | null;
    duration_ms: number | null;
    estimated_input_tokens: number | null;
    content_length: number | null;
    large_section: boolean;
    response_truncated: boolean;
    section_page_count: number;
    created_at: string;
}

export interface MonitoringSummary {
    total_sections: number;
    large_sections: number;
    truncated: number;
    failed: number;
    avg_estimated_tokens: number;
    max_estimated_tokens: number;
}

/** Result of a post-processing service run (dry-run or apply). */
export interface RunServiceResult {
    apply: boolean;
    filesScanned: number;
    filesUpdated: number;
    recordsMatched: number;
    summary: Record<string, { applied: number; skipped: number; error: number }>;
    sideEffects: number;
    /** Present for the geocoder: count by precision tier. */
    precisionTiers?: Record<string, number>;
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

/**
 * One entry in a preview's record-type distribution (the rail). `identifier_fields`
 * is the document type's configured ordered dot-paths for labeling a record row in
 * the ID column (null for untyped / unconfigured types → frontend heuristic fallback).
 */
export interface PreviewSlugCount {
    slug: string | null;
    count: number;
    identifier_fields?: string[] | null;
}

export interface PreviewJobFile {
    /** Unique row id — the record's section_result_id (or a synthetic fallback). */
    id: string;
    filename: string;
    result: any;
    processing_status: string;
    created_at: string;
    job_name: string;
    admin_verified?: boolean;
    review_status?: 'pending' | 'in_review' | 'reviewed' | 'approved' | 'rejected';
    /** V2: the originating file id (multiple records can share one file). */
    file_id?: string;
    /** V2: the record's document type. */
    slug?: string | null;
    section_result_id?: string | null;
    /**
     * 1-based PDF page this record was extracted from (V2 per-section records),
     * resolved from the file's detected_sections. null for V1 whole-doc records
     * — the side-by-side viewer opens page 1 in that case.
     */
    source_page?: number | null;
}

export interface PreviewAnalyticsReport {
    preview: { id: string; name: string };
    periodDays: number;
    since: string;
    summary: {
        uniqueSessions: number;
        previewVisits: number;
        wellViews: number;
        wellboreEvents: number;
        uniqueWellsViewed: number;
        sessionsUsingWellbore: number;
        wellboreAdoptionRate: number;
    };
    wellboreBreakdown: Array<{ event_type: string; count: number }>;
    topWells: Array<{
        well_label: string;
        job_file_id: string | null;
        view_count: number;
        unique_sessions: number;
        last_viewed_at: string;
    }>;
    sessions: Array<{
        id: string;
        client_session_id: string;
        ip_address: string | null;
        country_code: string | null;
        region: string | null;
        user_agent: string | null;
        first_seen_at: string;
        last_seen_at: string;
        event_count: number;
        wellbore_event_count: number;
    }>;
    recentEvents: Array<{
        id: string;
        event_type: string;
        job_file_id: string | null;
        well_label: string | null;
        metadata: Record<string, unknown>;
        created_at: string;
        ip_address: string | null;
        country_code: string | null;
    }>;
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
        } catch (error: any) {
            if (error.name !== 'AbortError') {
                console.error(`API request failed: ${endpoint}`, error);
            }
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
            total_records?: number;
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

    /** Active JSON schema for a document type (read-only) — powers field
     *  descriptions in the result viewer. */
    async getDocumentTypeSchema(
        slug: string,
    ): Promise<ApiResponse<{ slug: string; version: number; json_schema: Record<string, unknown> }>> {
        return this.request(`/document-types/${encodeURIComponent(slug)}/schema`);
    }

    // ── Schema registry admin (admin JWT only) ───────────────────────────
    async registryGetDocumentTypeDetail(
        slug: string
    ): Promise<
        ApiResponse<{
            documentType: RegistryDocumentTypeDetail;
            schemaVersions: RegistrySchemaVersionSummary[];
        }>
    > {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}/detail`);
    }

    async registryGetSchemaVersion(
        slug: string,
        version: number
    ): Promise<ApiResponse<{ schema: RegistrySchemaVersionFull }>> {
        return this.request(
            `/registry/document-types/${encodeURIComponent(slug)}/schemas/${version}`
        );
    }

    async registryCreateDocumentType(body: {
        slug: string;
        displayName: string;
        description?: string | null;
        defaultExtractor?: string;
        routingConfidenceThreshold?: number;
        initialSchema?: {
            jsonSchema: Record<string, unknown>;
            schemaName?: string | null;
            setActive?: boolean;
            notes?: string | null;
        } | null;
    }): Promise<ApiResponse<{ documentType: RegistryDocumentTypeDetail; initialSchemaRegistered: unknown }>> {
        console.log({ body });
        return this.request(`/registry/document-types`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async registryPatchDocumentType(
        slug: string,
        patch: {
            displayName?: string;
            description?: string | null;
            defaultExtractor?: string;
            routingConfidenceThreshold?: number;
            status?: 'active' | 'deprecated';
        }
    ): Promise<
        ApiResponse<{
            documentType: Partial<RegistryDocumentTypeDetail> & Record<string, unknown>;
        }>
    > {
        console.log({ patch, slug });
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}`, {
            method: 'PATCH',
            body: JSON.stringify(patch),
        });
    }

    async registryDeleteDocumentType(slug: string): Promise<ApiResponse<{ deleted: { slug: string; id: string } }>> {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}`, {
            method: 'DELETE',
        });
    }

    async registryPutClassifierHints(
        slug: string,
        hints: Record<string, unknown> | null
    ): Promise<ApiResponse<{ classifier_hints: unknown; updated_at: string }>> {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}/classifier-hints`, {
            method: 'PUT',
            body: JSON.stringify({ hints }),
        });
    }

    /** Per-field-group QA review priority/ignore guidance, keyed by top-level schema property name. null clears. */
    async registryPutQAHints(
        slug: string,
        hints: Record<string, unknown> | null
    ): Promise<ApiResponse<{ qa_hints: unknown; updated_at: string }>> {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}/qa-hints`, {
            method: 'PUT',
            body: JSON.stringify({ hints }),
        });
    }

    /** Replace a document type's identifier dot-paths (preview ID column label). [] clears. */
    async registryPutIdentifierFields(
        slug: string,
        fields: string[]
    ): Promise<ApiResponse<{ identifier_fields: string[]; updated_at: string }>> {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}/identifier-fields`, {
            method: 'PUT',
            body: JSON.stringify({ fields }),
        });
    }

    /** List registered post-processing services (for the document-type defaults tab). */
    async registryGetServices(): Promise<ApiResponse<{ services: { name: string; version: string }[] }>> {
        return this.request('/registry/services');
    }

    /** Replace a document type's post-processing defaults (services that auto-run for this slug). */
    async registryPutPostProcessingDefaults(
        slug: string,
        defaults: PostProcessingOverride[]
    ): Promise<ApiResponse<{ post_processing_defaults: PostProcessingOverride[]; updated_at: string }>> {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}/post-processing-defaults`, {
            method: 'PUT',
            body: JSON.stringify({ defaults }),
        });
    }

    async registryRegisterSchemaVersion(
        slug: string,
        body: {
            jsonSchema: Record<string, unknown>;
            schemaName?: string | null;
            setActive?: boolean;
            notes?: string | null;
        }
    ): Promise<ApiResponse<{ schema: Record<string, unknown> }>> {
        return this.request(`/registry/document-types/${encodeURIComponent(slug)}/schemas`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async registryPromoteSchemaVersion(
        slug: string,
        version: number
    ): Promise<ApiResponse<{ promoted: Record<string, unknown> }>> {
        return this.request(
            `/registry/document-types/${encodeURIComponent(slug)}/schemas/${version}/promote`,
            { method: 'POST' }
        );
    }

    // ── Routing review writes (Phase 1, item #4) ─────────────────────────
    // All three return the new `detected_sections` blob so callers can
    // refresh local state without re-fetching the whole file.
    async routingApproveSection(
        fileId: string,
        sectionIndex: number,
    ): Promise<ApiResponse<{ detected_sections: DetectedSections }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/${sectionIndex}/approve`,
            { method: 'POST' },
        );
    }

    async routingChangeSectionSlug(
        fileId: string,
        sectionIndex: number,
        slug: string,
    ): Promise<ApiResponse<{ detected_sections: DetectedSections }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/${sectionIndex}/change-slug`,
            {
                method: 'POST',
                body: JSON.stringify({ slug }),
            },
        );
    }

    async routingSplitSection(
        fileId: string,
        sectionIndex: number,
        atPage: number,
    ): Promise<ApiResponse<{ detected_sections: DetectedSections }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/${sectionIndex}/split`,
            {
                method: 'POST',
                body: JSON.stringify({ atPage }),
            },
        );
    }

    async routingMergeSections(
        fileId: string,
        indexA: number,
        indexB: number,
        slug?: string,
    ): Promise<ApiResponse<{ detected_sections: DetectedSections }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/merge`,
            {
                method: 'POST',
                body: JSON.stringify({ indexA, indexB, ...(slug ? { slug } : {}) }),
            },
        );
    }

    async saveAndReextractSections(
        fileId: string,
        detectedSections: DetectedSections,
    ): Promise<ApiResponse<{ detected_sections?: DetectedSections; sectionResults?: unknown[]; pages_without_text?: number[] }>> {
        // Send only the edited `sections` array — the server preserves all other
        // classifier metadata (pages, page_summaries, …). This keeps the body
        // small (avoids PayloadTooLargeError on large files).
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/save-and-reextract`,
            {
                method: 'POST',
                body: JSON.stringify({ sections: detectedSections.sections }),
            },
        );
    }

    async reextractSections(
        fileId: string,
        sectionIndices: number[],
    ): Promise<ApiResponse<{ sectionResults: unknown[]; detected_sections?: DetectedSections }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/reextract-sections`,
            {
                method: 'POST',
                body: JSON.stringify({ sectionIndices }),
            },
        );
    }

    /**
     * Reprocess a SINGLE section: re-extract its text (re-OCR its pages),
     * re-run AI on it, or both. At least one of the two must be true.
     */
    async reprocessSection(
        fileId: string,
        sectionResultId: string,
        opts: { reExtractText: boolean; reProcessAi: boolean },
    ): Promise<ApiResponse<{
        sectionResultId: string;
        reExtractText: boolean;
        reProcessAi: boolean;
        result?: unknown;
        detected_sections?: DetectedSections;
    }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/${encodeURIComponent(sectionResultId)}/reprocess`,
            { method: 'POST', body: JSON.stringify(opts) },
        );
    }

    /** Get one section's source markdown (sliced from the file's page text). */
    async getSectionMarkdown(
        fileId: string,
        sectionResultId: string,
    ): Promise<ApiResponse<{
        sectionResultId: string;
        extraction_pages: number[];
        markdown: string;
        pages: { page_number: number; markdown: string }[];
    }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/${encodeURIComponent(sectionResultId)}/markdown`,
        );
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

    // Section monitoring (large section guardrails)
    async getMonitoringSections(opts?: { limit?: number; jobId?: string }): Promise<ApiResponse<{
        sections: MonitoringSection[];
        summary: MonitoringSummary;
    }>> {
        const params = new URLSearchParams();
        if (opts?.limit) params.set('limit', String(opts.limit));
        if (opts?.jobId) params.set('jobId', opts.jobId);
        const qs = params.toString();
        return this.request(`/monitoring/sections${qs ? `?${qs}` : ''}`);
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

    /**
     * Preview-scoped signed PDF URL — works on the PUBLIC preview page (no auth
     * token). Backed by GET /previews/:id/files/:fileId/download, which
     * authorizes by preview membership instead of a user token. Used by the
     * side-by-side compare viewer in the record drawer.
     */
    async getPreviewFilePdfUrl(previewId: string, fileId: string): Promise<string> {
        const res = await fetch(
            `${this.baseURL}/previews/${previewId}/files/${fileId}/download?format=json`,
            { headers: { Accept: 'application/json' } },
        );
        if (!res.ok) {
            throw new Error(`Failed to load PDF URL: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        return data.url as string;
    }

    async getPreviewDataPaginated(
        id: string,
        page: number = 1,
        pageSize: number = 20,
        search?: string,
        opts?: { slug?: string | null; fileId?: string | null }
    ): Promise<ApiResponse<{
        preview: PreviewDataTable;
        jobFiles: PreviewJobFile[];
        slugs?: PreviewSlugCount[];
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
        if (opts?.slug) params.append('slug', opts.slug);
        if (opts?.fileId) params.append('fileId', opts.fileId);
        return this.request(`/previews/${id}/data?${params.toString()}`);
    }

    /** "By file" lens: files with a by-type record summary + review status. */
    async getPreviewFiles(
        id: string,
        page: number = 1,
        pageSize: number = 20,
        search?: string
    ): Promise<ApiResponse<{
        preview: PreviewDataTable;
        files: Array<{
            id: string;
            filename: string;
            job_name: string;
            created_at: string;
            processing_status: string;
            admin_verified?: boolean;
            review_status?: string;
            total_records: number;
            by_type: Array<{ slug: string | null; count: number }>;
        }>;
        pagination: { total: number; page: number; pageSize: number; totalPages: number };
    }>> {
        const params = new URLSearchParams({
            page: page.toString(),
            pageSize: pageSize.toString(),
        });
        if (search && search.trim()) params.append('search', search.trim());
        return this.request(`/previews/${id}/files?${params.toString()}`);
    }

    /**
     * Direct URL for the GIS-ready CSV export of one document type across a
     * preview (all records of that type). Use as an anchor href to stream the
     * download; the endpoint is unauthenticated like the other preview reads.
     */
    getPreviewGisExportUrl(id: string, slug: string): string {
        const params = new URLSearchParams({ slug, format: "csv" });
        return `${this.baseURL}/previews/${id}/export?${params.toString()}`;
    }

    /**
     * Direct URL for the Wellogic-format multi-tab Excel export (Wells +
     * linked Lithology) of one document type across a preview. Anchor href.
     */
    getPreviewWellogicExportUrl(id: string, slug: string): string {
        const params = new URLSearchParams({ slug });
        return `${this.baseURL}/previews/${id}/export-wellogic?${params.toString()}`;
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

    async recordPreviewAnalyticsEvents(
        previewId: string,
        body: {
            clientSessionId: string;
            events: Array<{
                type: string;
                jobFileId?: string;
                wellLabel?: string;
                metadata?: Record<string, unknown>;
            }>;
        },
    ): Promise<ApiResponse<{ sessionId: string; inserted: number }>> {
        return this.request(`/previews/${previewId}/analytics/events`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async getPreviewAnalytics(
        previewId: string,
        params?: { days?: number; sessionLimit?: number; eventLimit?: number },
    ): Promise<ApiResponse<PreviewAnalyticsReport>> {
        const qs = new URLSearchParams();
        if (params?.days != null) qs.set('days', String(params.days));
        if (params?.sessionLimit != null) {
            qs.set('sessionLimit', String(params.sessionLimit));
        }
        if (params?.eventLimit != null) {
            qs.set('eventLimit', String(params.eventLimit));
        }
        const query = qs.toString();
        return this.request(
            `/previews/${previewId}/analytics${query ? `?${query}` : ''}`,
        );
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

    async getAllFiles(
        limit: number = 50,
        offset: number = 0,
        status?: string,
        jobId?: string,
        signal?: AbortSignal,
        /** Phase 6: server-side search, filter & sort */
        filters?: {
            search?: string;
            extractionStatus?: string;
            processingStatus?: string;
            reviewStatus?: string;
            hasResult?: boolean;
            sortField?: string;
            sortOrder?: 'ascend' | 'descend';
        },
    ): Promise<ApiResponse<{
        files: JobFile[];
        total: number;
        filteredTotal?: number;
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

        // Phase 6 params
        if (filters?.search) params.append('search', filters.search);
        if (filters?.extractionStatus) params.append('extractionStatus', filters.extractionStatus);
        if (filters?.processingStatus) params.append('processingStatus', filters.processingStatus);
        if (filters?.reviewStatus) params.append('reviewStatus', filters.reviewStatus);
        if (filters?.hasResult != null) params.append('hasResult', String(filters.hasResult));
        if (filters?.sortField) params.append('sortField', filters.sortField);
        if (filters?.sortOrder) params.append('sortOrder', filters.sortOrder);

        return this.request(`/files?${params.toString()}`, { signal });
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

    async getMgsCountiesByPermits(
        permitNumbers: string[]
    ): Promise<ApiResponse<{ counties: Record<string, string> }>> {
        return this.request('/mgs/counties-by-permit', {
            method: 'POST',
            body: JSON.stringify({ permitNumbers }),
        });
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

    /**
     * List the registered post-processing services, for the job settings
     * activation UI. Job-scoped (access-checked) — post-processing is an
     * operator/pipeline concern configured per job, not a client preview control.
     */
    async getJobServices(jobId: string): Promise<ApiResponse<{ services: { name: string; version: string }[] }>> {
        return this.request(`/jobs/${jobId}/services`);
    }

    /**
     * Run a post-processing service (backfill) over a job's completed files.
     * The "run now" trigger lives on the job settings page. apply=false (default)
     * is a dry-run: services execute and counts are returned, nothing persists.
     */
    async runJobService(
        jobId: string,
        body: { name: string; slug: string; options?: Record<string, unknown>; apply?: boolean; force?: boolean },
    ): Promise<ApiResponse<RunServiceResult>> {
        return this.request(`/jobs/${jobId}/run-service`, {
            method: 'POST',
            body: JSON.stringify(body),
        });
    }

    async updateJobSchema(jobId: string, schema: any): Promise<ApiResponse<{ jobId: string; schema: any }>> {
        return this.request(`/jobs/${jobId}/schema`, {
            method: 'PUT',
            body: JSON.stringify({ schema }),
        });
    }

    // ── Section QA ─────────────────────────────────────────────────────

    /** Run VLM QA on a single section. */
    async runSectionQA(
        fileId: string,
        sectionResultId: string,
    ): Promise<ApiResponse<{ sectionResultId: string; overall_quality: QAOverallQuality; summary: string; findings: QAFinding[] }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/sections/${encodeURIComponent(sectionResultId)}/qa`,
            { method: 'POST' },
        );
    }

    /**
     * Run VLM QA on a file's sections. `scope: 'remaining'` QAs only the
     * sections that haven't been QA'd yet (decided server-side); omit for all.
     */
    async runFileQA(
        fileId: string,
        scope?: 'remaining',
    ): Promise<ApiResponse<{ totalSections: number; totalFindings: number; results: unknown[] }>> {
        const qs = scope ? `?scope=${scope}` : '';
        return this.request(
            `/files/${encodeURIComponent(fileId)}/qa${qs}`,
            { method: 'POST' },
        );
    }

    /** Get all QA findings for a file, grouped by section_result_id. */
    async getQAFindings(
        fileId: string,
    ): Promise<ApiResponse<{ findings: Record<string, QAFinding[]>; qaRuns?: Record<string, QARun> }>> {
        return this.request(`/files/${encodeURIComponent(fileId)}/qa-findings`);
    }

    /** Get the curated processing timeline for a file (for hydration). */
    async getProcessingEvents(
        fileId: string,
    ): Promise<ApiResponse<{ events: ProcessingEvent[] }>> {
        return this.request(`/files/${encodeURIComponent(fileId)}/processing-events`);
    }

    /** Update a finding's status (accepted or dismissed). */
    async updateQAFindingStatus(
        fileId: string,
        findingId: string,
        status: 'accepted' | 'dismissed',
    ): Promise<ApiResponse<{ finding: QAFinding }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/qa-findings/${encodeURIComponent(findingId)}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ status }),
            },
        );
    }

    /** Patch a single record in a V2 envelope by section_result_id. */
    async patchResultRecord(
        fileId: string,
        sectionResultId: string,
        data: Record<string, unknown>,
    ): Promise<ApiResponse<{ fileId: string; filename: string; sectionResultId: string }>> {
        return this.request(
            `/files/${encodeURIComponent(fileId)}/result/${encodeURIComponent(sectionResultId)}`,
            {
                method: 'PATCH',
                body: JSON.stringify({ data }),
            },
        );
    }

    async updateFileResults(fileId: string, results: any): Promise<ApiResponse<{ fileId: string; filename: string; results: any; flags?: any[] }>> {
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

    // ── Section-level verification ──

    async getSectionVerifications(fileId: string): Promise<ApiResponse<SectionVerification[]>> {
        return this.request(`/files/${fileId}/section-verifications`);
    }

    async updateSectionVerification(
        fileId: string,
        sectionResultId: string,
        status: SectionVerificationStatus,
        notes?: string,
    ): Promise<ApiResponse<SectionVerification & { file_review_status: string }>> {
        return this.request(`/files/${fileId}/section-verifications/${sectionResultId}`, {
            method: 'PUT',
            body: JSON.stringify({ status, notes }),
        });
    }

    async bulkUpdateSectionVerifications(
        fileId: string,
        sectionResultIds: string[],
        status: SectionVerificationStatus,
        notes?: string,
    ): Promise<ApiResponse<SectionVerification[]>> {
        return this.request(`/files/${fileId}/section-verifications-bulk`, {
            method: 'PUT',
            body: JSON.stringify({ sectionResultIds, status, notes }),
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
