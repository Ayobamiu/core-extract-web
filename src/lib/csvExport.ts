// CSV Export Utility
// Converts JSON results to CSV format based on schema structure

export interface CsvExportOptions {
    filename?: string;
    includeHeaders?: boolean;
    flattenNested?: boolean;
}

/**
 * Converts a JSON object to CSV format
 * Handles nested objects and arrays intelligently
 */
export function jsonToCsv(
    data: unknown,
    options: CsvExportOptions = {}
): string {
    const {
        includeHeaders = true,
        flattenNested = true
    } = options;

    if (!data || typeof data !== 'object') {
        return '';
    }

    // Handle array of objects
    if (Array.isArray(data)) {
        if (data.length === 0) return '';
        return arrayToCsv(data, includeHeaders, flattenNested);
    }

    // Handle single object
    return objectToCsv(data as Record<string, unknown>, includeHeaders, flattenNested);
}

/**
 * Converts an array of objects to CSV
 */
function arrayToCsv(
    data: unknown[],
    includeHeaders: boolean,
    flattenNested: boolean
): string {
    if (data.length === 0) return '';

    // Get all unique keys from all objects
    const allKeys = new Set<string>();
    data.forEach(item => {
        if (typeof item === 'object' && item !== null) {
            Object.keys(item as Record<string, unknown>).forEach(key => {
                allKeys.add(key);
            });
        }
    });

    const headers = Array.from(allKeys);
    const csvRows: string[] = [];

    // Add headers
    if (includeHeaders) {
        csvRows.push(headers.map(escapeCsvField).join(','));
    }

    // Add data rows
    data.forEach(item => {
        const row = headers.map(header => {
            const value = getNestedValue(item, header);
            return escapeCsvField(formatValue(value, flattenNested));
        });
        csvRows.push(row.join(','));
    });

    return csvRows.join('\n');
}

/**
 * Converts a single object to CSV
 */
function objectToCsv(
    data: Record<string, unknown>,
    includeHeaders: boolean,
    flattenNested: boolean
): string {
    const entries = Object.entries(data);
    const csvRows: string[] = [];

    // Add headers
    if (includeHeaders) {
        csvRows.push(entries.map(([key]) => escapeCsvField(key)).join(','));
    }

    // Add data row
    const row = entries.map(([, value]) =>
        escapeCsvField(formatValue(value, flattenNested))
    );
    csvRows.push(row.join(','));

    return csvRows.join('\n');
}

/**
 * Gets nested value from object using dot notation
 */
function getNestedValue(obj: unknown, path: string): unknown {
    return path.split('.').reduce((current, key) => {
        return current && typeof current === 'object' && current !== null && key in current
            ? (current as Record<string, unknown>)[key]
            : '';
    }, obj);
}

/**
 * Formats a value for CSV export
 */
function formatValue(value: unknown, flattenNested: boolean): string {
    if (value === null || value === undefined) {
        return '';
    }

    if (typeof value === 'string') {
        return value;
    }

    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }

    if (Array.isArray(value)) {
        if (flattenNested) {
            // Flatten arrays into comma-separated values
            return value.map(item =>
                typeof item === 'object' ? JSON.stringify(item) : String(item)
            ).join('; ');
        } else {
            return JSON.stringify(value);
        }
    }

    if (typeof value === 'object') {
        if (flattenNested) {
            // Flatten objects into key-value pairs
            return Object.entries(value as Record<string, unknown>)
                .map(([k, v]) => `${k}: ${v}`)
                .join('; ');
        } else {
            return JSON.stringify(value);
        }
    }

    return String(value);
}

/**
 * Escapes CSV field values
 */
function escapeCsvField(field: string): string {
    if (typeof field !== 'string') {
        field = String(field);
    }

    // If field contains comma, newline, or quote, wrap in quotes and escape quotes
    if (field.includes(',') || field.includes('\n') || field.includes('"')) {
        return `"${field.replace(/"/g, '""')}"`;
    }

    return field;
}

/**
 * Downloads CSV content as a file
 */
export function downloadCsv(
    csvContent: string,
    filename: string = 'export.csv'
): void {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');

    if (link.download !== undefined) {
        const url = URL.createObjectURL(blob);
        link.setAttribute('href', url);
        link.setAttribute('download', filename);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }
}

/**
 * Exports JSON data as CSV file
 */
export function exportJsonAsCsv(
    data: unknown,
    filename: string = 'export.csv',
    options: CsvExportOptions = {}
): void {
    const csvContent = jsonToCsv(data, { ...options, filename });
    downloadCsv(csvContent, filename);
}

/**
 * Smart CSV export that handles common extraction schemas
 */
export function smartCsvExport(
    data: unknown,
    filename: string,
    schema?: unknown
): void {
    let csvContent: string;

    // If data is an array, use array export
    if (Array.isArray(data)) {
        csvContent = arrayToCsv(data, true, true);
    } else {
        // For single objects, try to detect if it should be flattened
        const shouldFlatten = detectIfShouldFlatten(data, schema);
        csvContent = objectToCsv(data as Record<string, unknown>, true, shouldFlatten);
    }

    downloadCsv(csvContent, filename);
}

/**
 * Detects if an object should be flattened based on schema
 */
function detectIfShouldFlatten(data: unknown, schema?: unknown): boolean {
    if (!schema || !data) return true;

    // If schema has array properties, don't flatten
    if (typeof schema === 'object' && schema !== null && 'properties' in schema) {
        const schemaObj = schema as Record<string, unknown>;
        if (schemaObj.properties && typeof schemaObj.properties === 'object') {
            const properties = schemaObj.properties as Record<string, unknown>;
            const hasArrayProps = Object.values(properties).some((prop: unknown) =>
                typeof prop === 'object' && prop !== null && 'type' in prop && (prop as Record<string, unknown>).type === 'array'
            );
            if (hasArrayProps) return false;
        }
    }

    return true;
}
