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
    if (file.job_id !== '5667fe82-63e1-47fa-a640-b182b5c5d034') {
        return {
            hasViolation: false,
            filenamePermit: null,
            dataPermit: null,
            message: 'Not applicable'
        };
    }
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

/**
 * Constraint validation result
 */
export interface ConstraintCheck {
    name: string;
    passed: boolean;
    message: string;
    severity: 'error' | 'warning' | 'info';
    details?: any;
}

/**
 * Check if formations are continuous (no gaps between them)
 * Formations are continuous if each formation's 'from' matches the previous formation's 'to'
 */
export function checkFormationContinuity(formations: any[]): {
    isContinuous: boolean;
    gaps: Array<{ from: number; to: number; gap: number }>;
    message: string;
} {
    if (!formations || formations.length === 0) {
        return {
            isContinuous: true,
            gaps: [],
            message: 'No formations to check',
        };
    }

    if (formations.length === 1) {
        return {
            isContinuous: true,
            gaps: [],
            message: 'Only one formation - continuity check not applicable',
        };
    }

    // Filter out formations with missing from/to values and sort by 'from' depth
    const validFormations = formations
        .filter(f => f.from != null && f.to != null && typeof f.from === 'number' && typeof f.to === 'number')
        .sort((a, b) => a.from - b.from);

    if (validFormations.length < 2) {
        return {
            isContinuous: true,
            gaps: [],
            message: 'Not enough valid formations to check continuity',
        };
    }

    const gaps: Array<{ from: number; to: number; gap: number }> = [];

    // Check continuity between consecutive formations
    for (let i = 1; i < validFormations.length; i++) {
        const previous = validFormations[i - 1];
        const current = validFormations[i];

        // Check if there's a gap (current.from !== previous.to)
        if (current.from !== previous.to) {
            const gap = Math.abs(current.from - previous.to);
            gaps.push({
                from: previous.to,
                to: current.from,
                gap: gap,
            });
        }
    }

    const isContinuous = gaps.length === 0;

    return {
        isContinuous,
        gaps,
        message: isContinuous
            ? 'Formations are continuous'
            : `Found ${gaps.length} gap(s) in formations`,
    };
}

/**
 * Check all constraints for a file (same logic as in FileTable Constraints column)
 */
export function checkFileConstraints(file: JobFile): ConstraintCheck[] {
    const checks: ConstraintCheck[] = [];

    // Only check constraints for specific job and completed files
    if (
        file.processing_status !== 'completed' ||
        file.job_id !== '5667fe82-63e1-47fa-a640-b182b5c5d034' ||
        !file.result
    ) {
        return checks;
    }

    // 1. Permit number mismatch check
    const permitCheck = checkPermitNumberMatch(file);
    if (permitCheck.hasViolation) {
        checks.push({
            name: 'Permit Number Match',
            passed: false,
            message: permitCheck.message,
            severity: 'warning',
            details: {
                filenamePermit: permitCheck.filenamePermit,
                dataPermit: permitCheck.dataPermit,
            },
        });
    } else if (permitCheck.filenamePermit && permitCheck.dataPermit) {
        checks.push({
            name: 'Permit Number Match',
            passed: true,
            message: 'Permit numbers match',
            severity: 'info',
            details: {
                filenamePermit: permitCheck.filenamePermit,
                dataPermit: permitCheck.dataPermit,
            },
        });
    }

    // 2. API number check
    const hasApiNumber = !!file.result?.api_number;
    if (!hasApiNumber) {
        checks.push({
            name: 'API Number',
            passed: false,
            message: 'API number not found in extracted data',
            severity: 'error',
        });
    } else {
        checks.push({
            name: 'API Number',
            passed: true,
            message: `API number: ${file.result.api_number}`,
            severity: 'info',
        });
    }

    // 3. Elevation check
    const elevation = file.result?.elevation;
    const correctElevation = elevation && elevation > 100;
    if (!correctElevation) {
        checks.push({
            name: 'Elevation',
            passed: false,
            message: elevation
                ? `Elevation (${elevation}) is too low or missing. Expected > 100`
                : 'Elevation is missing',
            severity: 'error',
            details: {
                elevation: elevation || null,
            },
        });
    } else {
        checks.push({
            name: 'Elevation',
            passed: true,
            message: `Elevation: ${elevation}`,
            severity: 'info',
        });
    }

    // 4. Formation count check
    const formationCount = file.result?.formations?.length || 0;
    const correctFormationCount = formationCount >= 10;
    if (!correctFormationCount) {
        checks.push({
            name: 'Formation Count',
            passed: false,
            message: `Formation count (${formationCount}) is too low. Expected >= 10`,
            severity: 'error',
            details: {
                count: formationCount,
            },
        });
    } else {
        checks.push({
            name: 'Formation Count',
            passed: true,
            message: `Formation count: ${formationCount}`,
            severity: 'info',
        });
    }

    // 5. Measured depth vs last formation depth check
    const measuredDepth = file.result?.measured_depth;
    const formations = file.result?.formations || [];

    if (measuredDepth != null && formations.length > 0) {
        // Find the last formation (the one with the deepest 'to' depth)
        // Sort formations by 'to' depth descending to get the deepest one
        const sortedFormations = [...formations]
            .filter(f => f.to != null)
            .sort((a, b) => (b.to || 0) - (a.to || 0));
        console.log('sortedFormations', sortedFormations);
        const lastFormation = sortedFormations[0];

        if (lastFormation && lastFormation.to != null) {
            const depthDifference = Math.abs(measuredDepth - lastFormation.to);
            const isWithinLimit = depthDifference <= 10;

            if (!isWithinLimit) {
                checks.push({
                    name: 'Formation Depth Coverage',
                    passed: false,
                    message: `Difference between measured depth (${measuredDepth}) and last formation depth (${lastFormation.to}) is ${depthDifference.toFixed(1)}. Expected <= 10. Formations may not be captured well.`,
                    severity: 'error',
                    details: {
                        measuredDepth,
                        lastFormationDepth: lastFormation.to,
                        lastFormationName: lastFormation.name,
                        difference: depthDifference,
                    },
                });
            } else {
                checks.push({
                    name: 'Formation Depth Coverage',
                    passed: true,
                    message: `Measured depth (${measuredDepth}) and last formation depth (${lastFormation.to}) difference: ${depthDifference.toFixed(1)}`,
                    severity: 'info',
                    details: {
                        measuredDepth,
                        lastFormationDepth: lastFormation.to,
                        lastFormationName: lastFormation.name,
                        difference: depthDifference,
                    },
                });
            }
        }
    } else if (measuredDepth == null) {
        checks.push({
            name: 'Formation Depth Coverage',
            passed: false,
            message: 'Cannot check formation depth coverage - measured depth is missing',
            severity: 'warning',
        });
    } else if (formations.length === 0) {
        checks.push({
            name: 'Formation Depth Coverage',
            passed: false,
            message: 'Cannot check formation depth coverage - no formations found',
            severity: 'warning',
        });
    }

    // 6. Formation continuity check
    if (formations.length > 0) {
        const continuityCheck = checkFormationContinuity(formations);
        if (!continuityCheck.isContinuous) {
            const gapDetails = continuityCheck.gaps.map(g =>
                `Gap of ${g.gap} between depth ${g.from} and ${g.to}`
            ).join('; ');

            checks.push({
                name: 'Formation Continuity',
                passed: false,
                message: `Formations are not continuous: ${gapDetails}`,
                severity: 'warning',
                details: {
                    gaps: continuityCheck.gaps,
                    gapCount: continuityCheck.gaps.length,
                },
            });
        } else {
            checks.push({
                name: 'Formation Continuity',
                passed: true,
                message: continuityCheck.message,
                severity: 'info',
            });
        }
    }

    // 7. Perforation intervals check
    const perforationIntervals = file.result?.perforation_intervals || [];
    const hasPerforationIntervals = Array.isArray(perforationIntervals) && perforationIntervals.length > 0;
    if (!hasPerforationIntervals) {
        checks.push({
            name: 'Perforation Intervals',
            passed: false,
            message: 'Perforation intervals not found or empty',
            severity: 'error',
            details: {
                count: perforationIntervals.length || 0,
            },
        });
    } else {
        checks.push({
            name: 'Perforation Intervals',
            passed: true,
            message: `Perforation intervals: ${perforationIntervals.length}`,
            severity: 'info',
        });
    }

    // 8. Pluggings check
    const pluggings = file.result?.pluggings || [];
    const hasPluggings = Array.isArray(pluggings) && pluggings.length > 0;
    if (!hasPluggings) {
        checks.push({
            name: 'Pluggings',
            passed: false,
            message: 'Pluggings not found or empty',
            severity: 'error',
            details: {
                count: pluggings.length || 0,
            },
        });
    } else {
        checks.push({
            name: 'Pluggings',
            passed: true,
            message: `Pluggings: ${pluggings.length}`,
            severity: 'info',
        });
    }

    // 9. Shows depths check
    const showsDepths = file.result?.shows_depths || [];
    const hasShowsDepths = Array.isArray(showsDepths) && showsDepths.length > 0;
    if (!hasShowsDepths) {
        checks.push({
            name: 'Shows Depths',
            passed: false,
            message: 'Shows depths not found or empty',
            severity: 'error',
            details: {
                count: showsDepths.length || 0,
            },
        });
    } else {
        checks.push({
            name: 'Shows Depths',
            passed: true,
            message: `Shows depths: ${showsDepths.length}`,
            severity: 'info',
        });
    }

    // 10. Shows casing check
    const casing = file.result?.casing || [];
    const hasCasing = Array.isArray(casing) && casing.length > 0;
    if (!hasCasing) {
        checks.push({
            name: 'Casing',
            passed: false,
            message: 'Casing not found or empty',
            severity: 'error',
            details: {
                count: casing.length || 0,
            },
        });
    } else {
        checks.push({
            name: 'Casing',
            passed: true,
            message: `Casing: ${casing.length}`,
            severity: 'info',
        });
    }

    return checks;
}
