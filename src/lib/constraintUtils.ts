// Constraint utility functions for frontend
import { JobFile } from '@/lib/api';

/**
 * Extract permit number from filename
 * Supports various patterns like:
 * - PERMIT12345.pdf
 * - permit_12345.pdf
 * - 12345_permit.pdf
 * - permit-12345.pdf
 */
export function extractPermitFromFilename(filename: string): string | null {
    if (!filename) return null;

    const patterns = [
        /(\d+)/,                    // Any number
        /permit[_-]?(\d+)/i,        // permit123, permit_123, permit-123
        /(\d+)[_-]?permit/i,        // 123permit, 123_permit, 123-permit
        /permit[_-]?(\d+)[_-]?/i,   // permit_123_, permit-123-
        /[_-](\d+)[_-]?permit/i,    // _123_permit, -123-permit
    ];

    for (const pattern of patterns) {
        const match = filename.match(pattern);
        if (match) {
            return match[1];
        }
    }

    return null;
}

/**
 * Extract permit number from file result data
 */
export function extractPermitFromData(result: any): string | null {
    if (!result) return null;

    // Try common field names for permit numbers
    const permitFields = [
        'permit_number',
        'permitNumber',
        'permit_no',
        'permitNo',
        'permit',
        'permit_id',
        'permitId',
        'well_permit',
        'wellPermit',
        'drilling_permit',
        'drillingPermit'
    ];

    for (const field of permitFields) {
        if (result[field] && typeof result[field] === 'string') {
            // Clean up the permit number (remove spaces, special chars)
            const cleaned = result[field].replace(/[^\d]/g, '');
            if (cleaned.length > 0) {
                return cleaned;
            }
        }
    }

    return null;
}

/**
 * Check if permit numbers match between filename and extracted data
 */
export function checkPermitNumberMatch(file: JobFile): {
    hasViolation: boolean;
    filenamePermit: string | null;
    dataPermit: string | null;
    message: string;
} {
    const filenamePermit = extractPermitFromFilename(file.filename);
    const dataPermit = extractPermitFromData(file.result);

    if (!filenamePermit || !dataPermit) {
        return {
            hasViolation: true,
            filenamePermit,
            dataPermit,
            message: 'Cannot compare permit numbers - missing data'
        };
    }

    // Normalize by removing leading zeros and converting to lowercase
    const normalizePermitNumber = (permit: string): string => {
        return permit.trim().replace(/^0+/, '') || '0'; // Handle case where all digits are zeros
    };

    const normalizedFilename = normalizePermitNumber(filenamePermit);
    const normalizedData = normalizePermitNumber(dataPermit);

    const hasViolation = normalizedFilename !== normalizedData;

    return {
        hasViolation,
        filenamePermit,
        dataPermit,
        message: hasViolation
            ? `Permit number mismatch: filename has "${filenamePermit}" but data shows "${dataPermit}"`
            : 'Permit numbers match'
    };
}

/**
 * Get violation severity color
 */
export function getViolationSeverityColor(severity: string): string {
    switch (severity) {
        case 'critical':
            return '#dc2626'; // red-600
        case 'error':
            return '#dc2626'; // red-600
        case 'warning':
            return '#d97706'; // amber-600
        case 'info':
            return '#2563eb'; // blue-600
        default:
            return '#6b7280'; // gray-500
    }
}

/**
 * Get violation severity icon
 */
export function getViolationSeverityIcon(severity: string): string {
    switch (severity) {
        case 'critical':
            return '🚨';
        case 'error':
            return '❌';
        case 'warning':
            return '⚠️';
        case 'info':
            return 'ℹ️';
        default:
            return '🔍';
    }
}
