/**
 * Record identifier resolution — shared by the preview data table (ID column)
 * and the routing panel's duplicate-section detection.
 *
 * A record's identifier (e.g. a borehole_log's boring_well_id) is resolved
 * from the document type's configured `identifier_fields` dot-paths when
 * present; otherwise a global heuristic searches a prioritized list of
 * id-ish field names across the record root and common container objects.
 *
 * Extracted from src/app/preview/[id]/page.tsx — same logic, same output.
 */

// Higher priority = more specific identifier (a boring/well id beats a
// sample/location id), so a record with several id-ish fields gets labeled
// by the best one.
export const ID_FIELD_PRIORITY = [
  "boring_well_id",
  "boring_well_id_full",
  "boring_well_no",
  "boring_id",
  "borehole_no",
  "boring_no",
  "well_number",
  "well_no",
  "well_id",
  "monitoring_well_id",
  "well_name",
  "api_number",
  "location_id",
  "station_id",
  "site_id",
  "sample_id",
];

// Objects (besides the record root) that commonly hold the identifier.
export const ID_CONTAINERS: Array<string | null> = [
  null, // the record root itself (flat records)
  "document_metadata",
  "site_identification",
  "site_and_location",
  "boring_identification",
  "test_setup",
  "sample_collection",
  "well_information",
  "project_information",
  "general_information",
];

function scalarField(obj: unknown, key: string): string | null {
  if (!obj || typeof obj !== "object") return null;
  const v = (obj as Record<string, unknown>)[key];
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
}

/** Resolve a dot-path (e.g. "site_identification.boring_well_id") to a scalar. */
export function resolveDotPath(record: unknown, path: string): string | null {
  const parts = path.split(".");
  let cur: unknown = record;
  for (let i = 0; i < parts.length - 1; i++) {
    if (!cur || typeof cur !== "object") return null;
    cur = (cur as Record<string, unknown>)[parts[i]];
  }
  return scalarField(cur, parts[parts.length - 1]);
}

/**
 * Resolve the identifier value used to label a record, or null if none.
 *
 * `configuredFields` is the record's document type's per-type dot-paths (from
 * the backend, keyed by slug). When present they win — exact, vendor-specific,
 * in priority order. With no config we fall back to the global heuristic.
 */
export function recordIdentifier(
  record: unknown,
  configuredFields?: string[] | null,
): string | null {
  if (!record || typeof record !== "object") return null;
  const rec = record as Record<string, unknown>;

  // 1. Configured dot-paths for this record's type (preferred).
  if (Array.isArray(configuredFields)) {
    for (const path of configuredFields) {
      const v = resolveDotPath(rec, path);
      if (v) return v;
    }
  }

  // 2. Heuristic fallback for unconfigured types.
  for (const field of ID_FIELD_PRIORITY) {
    for (const container of ID_CONTAINERS) {
      const obj = container ? rec[container] : rec;
      const v = scalarField(obj, field);
      if (v) return v;
    }
  }
  return null;
}
