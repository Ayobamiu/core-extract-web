/**
 * Pure helpers for the schema-driven record renderer. No React here.
 *
 * The engine is schema-AWARE but data-SAFE: it uses the JSON Schema for field
 * order, labels, and units when available, and falls back to the data shape
 * otherwise — so any record renders, registered schema or not.
 */

export type JsonSchemaNode = {
  type?: string | string[];
  title?: string;
  description?: string;
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  anyOf?: JsonSchemaNode[];
  oneOf?: JsonSchemaNode[];
  enum?: unknown[];
  format?: string;
  [k: string]: unknown;
};

export type FieldType =
  | "scalar"
  | "object"
  | "objectArray"
  | "scalarArray"
  | "empty";

// Keys that belong in the header / are internal plumbing — never in the body.
export const INTERNAL_KEYS = new Set([
  "section_result_id",
  "record_id",
  "extraction_metadata",
  "source_locations",
]);

const ACRONYMS = new Set([
  "id",
  "uscs",
  "spt",
  "pid",
  "voc",
  "api",
  "toc",
  "swl",
  "h2s",
  "gw",
  "n",
  "ph",
  "tvd",
  "md",
  "eob",
]);

// Unit suffixes, longest first so `_ft2_day` wins over `_ft`. `label` is the
// human unit; matching suffix is stripped from the field name for the label.
const UNIT_SUFFIXES: Array<{ suffix: string; label: string }> = [
  { suffix: "_ft2_day", label: "ft²/day" },
  { suffix: "_gpm_ft", label: "gpm/ft" },
  { suffix: "_percent", label: "%" },
  { suffix: "_ppm", label: "ppm" },
  { suffix: "_ppb", label: "ppb" },
  { suffix: "_gpm", label: "gpm" },
  { suffix: "_tsf", label: "tsf" },
  { suffix: "_dd", label: "°" },
  { suffix: "_ft", label: "ft" },
  { suffix: "_in", label: "in" },
  { suffix: "_lb", label: "lb" },
];

/** Resolve `anyOf: [{type:X},{type:null}]` (and string[] types) → base + nullable. */
export function normalizeSchemaNode(node?: JsonSchemaNode): {
  type?: string;
  nullable: boolean;
  node?: JsonSchemaNode;
} {
  if (!node) return { nullable: true };
  const variants = node.anyOf || node.oneOf;
  if (Array.isArray(variants)) {
    let nullable = false;
    let base: JsonSchemaNode | undefined;
    for (const v of variants) {
      if (v?.type === "null") nullable = true;
      else if (!base) base = v;
    }
    const merged = { ...(base || {}), description: node.description ?? base?.description, title: node.title ?? base?.title };
    return { type: typeof merged.type === "string" ? merged.type : undefined, nullable, node: merged };
  }
  if (Array.isArray(node.type)) {
    const t = node.type.filter((x) => x !== "null");
    return { type: t[0], nullable: node.type.includes("null"), node };
  }
  return { type: node.type, nullable: false, node };
}

/** snake_case / camelCase → "Title Case", with known acronyms upper-cased. */
export function humanizeKey(key: string): string {
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) =>
      ACRONYMS.has(w.toLowerCase())
        ? w.toUpperCase()
        : w.charAt(0).toUpperCase() + w.slice(1),
    )
    .join(" ");
}

/** Derive a display unit from a field name, returning the de-suffixed base. */
export function unitForField(key: string): { unit?: string; base: string } {
  for (const { suffix, label } of UNIT_SUFFIXES) {
    if (key.toLowerCase().endsWith(suffix)) {
      return { unit: label, base: key.slice(0, key.length - suffix.length) };
    }
  }
  return { base: key };
}

/** Human label for a field: schema `title` wins; else humanized (de-unit) key. */
export function labelForField(key: string, node?: JsonSchemaNode): string {
  if (node?.title && node.title.trim()) return node.title.trim();
  const { base } = unitForField(key);
  return humanizeKey(base);
}

export function isEmptyValue(v: unknown): boolean {
  return (
    v === null ||
    v === undefined ||
    (typeof v === "string" && v.trim() === "") ||
    (Array.isArray(v) && v.length === 0)
  );
}

export function classifyValue(v: unknown): FieldType {
  if (isEmptyValue(v)) return "empty";
  if (Array.isArray(v)) {
    return v.some((x) => x && typeof x === "object" && !Array.isArray(x))
      ? "objectArray"
      : "scalarArray";
  }
  if (typeof v === "object") return "object";
  return "scalar";
}

/** Body field order: schema property order first, then any data-only keys. */
export function orderedKeys(
  data: Record<string, unknown>,
  schema?: JsonSchemaNode,
): string[] {
  const dataKeys = Object.keys(data).filter((k) => !INTERNAL_KEYS.has(k));
  const props = schema?.properties;
  if (!props) return dataKeys;
  const schemaOrder = Object.keys(props).filter(
    (k) => k in data && !INTERNAL_KEYS.has(k),
  );
  const extras = dataKeys.filter((k) => !schemaOrder.includes(k));
  return [...schemaOrder, ...extras];
}

/** Union of column keys across table rows, schema order first. */
export function tableColumns(
  rows: Array<Record<string, unknown>>,
  itemSchema?: JsonSchemaNode,
): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  const push = (k: string) => {
    if (!seen.has(k) && !INTERNAL_KEYS.has(k)) {
      seen.add(k);
      order.push(k);
    }
  };
  if (itemSchema?.properties) Object.keys(itemSchema.properties).forEach(push);
  for (const r of rows) Object.keys(r || {}).forEach(push);
  // Drop columns that are empty across every row — keeps tables readable.
  return order.filter((k) => rows.some((r) => !isEmptyValue(r?.[k])));
}

// ── value formatting ────────────────────────────────────────────────
const PROSE_KEYS = /(remarks|notes|description|analysis_notes|screening_notes|comment|summary)/i;

export function isProseField(key: string, value: unknown): boolean {
  if (typeof value !== "string") return false;
  return PROSE_KEYS.test(key) || value.length > 120 || value.includes("\n");
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2})?/;

export function formatScalar(key: string, value: unknown): string {
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "number") {
    const { unit } = unitForField(key);
    const num = Number.isInteger(value)
      ? value.toLocaleString()
      : // up to 6 dp for coords, trim trailing zeros otherwise
        parseFloat(value.toFixed(6)).toLocaleString(undefined, {
          maximumFractionDigits: 6,
        });
    return unit ? `${num} ${unit}` : num;
  }
  if (typeof value === "string") {
    if (ISO_DATE.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime())) {
        return d.toLocaleDateString(undefined, {
          year: "numeric",
          month: "short",
          day: "numeric",
        });
      }
    }
    return value;
  }
  return String(value);
}

/**
 * Schema descriptions are extraction-prompt text full of internal jargon
 * ("GWSI C1 SITE_ID", "verbatim OCR", "Null only for EOB"). Never show that to
 * end users. Strip leading codes; suppress anything still instruction-like.
 */
export function sanitizeDescription(desc?: string): string | undefined {
  if (!desc) return undefined;
  let s = desc.trim();
  // Strip leading registry codes like "GWSI C1 SITE_ID." / "GWPD 11." / "GWSI C12 STATION_NAME —"
  s = s.replace(/^(GW(SI|PD)\b[^.—]*[.—]\s*)+/i, "").trim();
  if (/\b(OCR|verbatim|GWSI|GWPD|null only|regardless of|preserve|normaliz|extractor)\b/i.test(s)) {
    return undefined;
  }
  return s.length >= 8 ? s : undefined;
}
