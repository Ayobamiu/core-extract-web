/**
 * Tiny dot/bracket JSON path helpers for applying a QA finding's `expected`
 * value back into a result record. Paths look like
 * "spt_intervals[0].n_value" or "site_identification.county".
 */

function parsePath(path: string): Array<string | number> {
  const out: Array<string | number> = [];
  path
    .replace(/\[(\d+)\]/g, ".$1")
    .split(".")
    .filter(Boolean)
    .forEach((seg) => out.push(/^\d+$/.test(seg) ? Number(seg) : seg));
  return out;
}

export function getByPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const seg of parsePath(path)) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string | number, unknown>)[seg];
  }
  return cur;
}

/**
 * Immutably set a value at a dot/bracket path. Intermediate objects/arrays are
 * created as needed (so a previously-null `missing_value` field can be filled).
 */
export function setByPath<T>(obj: T, path: string, value: unknown): T {
  const segs = parsePath(path);
  if (segs.length === 0) return obj;
  const clone: any = structuredClone(obj);
  let cur: any = clone;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    const nextIsIndex = typeof segs[i + 1] === "number";
    if (cur[seg] == null || typeof cur[seg] !== "object") {
      cur[seg] = nextIsIndex ? [] : {};
    }
    cur = cur[seg];
  }
  cur[segs[segs.length - 1]] = value;
  return clone;
}

/**
 * Coerce a finding's `expected` string to the right JS type for the target
 * field — based on the field's current value, falling back to inferring from
 * the string. Empty/placeholder → null.
 */
export function coerceExpected(
  expected: string | null,
  currentValue: unknown,
): unknown {
  if (expected == null) return null;
  const s = String(expected).trim();
  if (s === "" || /^(null|n\/a|none)$/i.test(s)) return null;

  if (typeof currentValue === "number") {
    const n = Number(s.replace(/,/g, ""));
    return Number.isNaN(n) ? s : n;
  }
  if (typeof currentValue === "boolean") return /^(true|yes)$/i.test(s);

  if (currentValue == null) {
    // Infer from the string when there's no existing typed value to match.
    if (/^-?\d+(\.\d+)?$/.test(s.replace(/,/g, ""))) return Number(s.replace(/,/g, ""));
    if (/^(true|false)$/i.test(s)) return /^true$/i.test(s);
  }
  return s;
}

/** Issue types whose `expected` maps to a single field value we can inject. */
export const APPLYABLE_ISSUE_TYPES = new Set([
  "wrong_value",
  "missing_value",
  "extra_value",
  "formatting",
  "add_row",
  "update_row",
  "delete_row",
]);

/**
 * Immutably insert `value` into the array at `arrayPath`, at `index` (or
 * appended at the end when `index` is null/undefined/out of range). Used for
 * add_row findings — distinct from setByPath, which overwrites a single slot
 * rather than shifting subsequent items.
 */
export function insertAtPath<T>(
  obj: T,
  arrayPath: string,
  index: number | null | undefined,
  value: unknown,
): T {
  const clone: any = structuredClone(obj);
  const segs = parsePath(arrayPath);
  let cur: any = clone;
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i];
    if (cur[seg] == null || typeof cur[seg] !== "object") cur[seg] = [];
    cur = cur[seg];
  }
  const lastSeg = segs[segs.length - 1];
  if (!Array.isArray(cur[lastSeg])) cur[lastSeg] = [];
  const arr = cur[lastSeg] as unknown[];
  const insertAt =
    index == null || index < 0 || index > arr.length ? arr.length : index;
  arr.splice(insertAt, 0, value);
  return clone;
}

/**
 * Immutably remove the item at `index` from the array at `arrayPath`. Used
 * for delete_row findings. No-op (returns an unmodified clone) if the target
 * isn't an array or the index is out of range — callers should already have
 * verified the index server-side, but this stays defensive against a stale
 * client-side tree.
 */
export function removeAtPath<T>(obj: T, arrayPath: string, index: number): T {
  const clone: any = structuredClone(obj);
  const arr = getByPath(clone, arrayPath);
  if (!Array.isArray(arr) || index < 0 || index >= arr.length) return clone;
  arr.splice(index, 1);
  return clone;
}

/**
 * Order-independent deep equality over JSON values (objects compared by
 * key set, arrays by position). Used to match a QA finding's row anchor
 * against the live array — key order can differ between the QA-time
 * stringification and the client-side JSON round trip.
 */
export function deepJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (a === null || b === null) return a === b;
  if (typeof a !== typeof b) return false;
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((v, i) => deepJsonEqual(v, b[i]));
  }
  if (typeof a === "object") {
    const ka = Object.keys(a as object);
    const kb = Object.keys(b as object);
    if (ka.length !== kb.length) return false;
    return ka.every((k) => deepJsonEqual((a as any)[k], (b as any)[k]));
  }
  return false;
}

/**
 * Resolve where a row-op finding should apply in the CURRENT array, using the
 * row snapshot the server froze into `finding.actual` at QA time (verifier's
 * `toActualString`: JSON.stringify for objects, String() otherwise).
 *
 * Row indices go stale the moment any earlier structural op (delete/insert)
 * is applied — that's how "delete row 6 then update row 7" corrupted the
 * original row 8 in production. The anchor makes each op order-independent:
 *
 *  - 'match'      row at the stored index still has the QA-time content
 *  - 'relocated'  content found at exactly one OTHER index → apply there
 *  - 'not_found'  content is gone (already applied, edited, or deleted)
 *  - 'ambiguous'  content appears at several indices — do not guess
 *  - 'no_anchor'  finding predates anchors (no `actual`) — caller decides
 */
export function resolveRowAnchor(
  arr: unknown[],
  rowIndex: number,
  anchor: string | null | undefined,
):
  | { status: "match" | "no_anchor"; index: number }
  | { status: "relocated"; index: number }
  | { status: "not_found" | "ambiguous"; index: null } {
  if (anchor == null || anchor === "") return { status: "no_anchor", index: rowIndex };

  let anchorVal: unknown = anchor;
  try {
    anchorVal = JSON.parse(anchor);
  } catch {
    // primitive rows are stored via String(); compare as-is below
  }
  const matches = (row: unknown) =>
    deepJsonEqual(row, anchorVal) ||
    (typeof row !== "object" && String(row) === anchor);

  if (rowIndex >= 0 && rowIndex < arr.length && matches(arr[rowIndex])) {
    return { status: "match", index: rowIndex };
  }
  const hits: number[] = [];
  for (let i = 0; i < arr.length; i++) if (matches(arr[i])) hits.push(i);
  if (hits.length === 1) return { status: "relocated", index: hits[0] };
  return { status: hits.length === 0 ? "not_found" : "ambiguous", index: null };
}

// ── Bulk apply (one review instead of N micro-approvals) ────────────────────

/** Minimal finding shape computeBulkApply needs (subset of api.QAFinding). */
export interface BulkFinding {
  id: string;
  issue_type: string;
  field_path: string;
  expected: string | null;
  actual: string | null;
  // Directed group re-extraction can stage a whole-group fill-in whose
  // corrected_value is the full array/object; setByPath applies it as-is.
  corrected_value?:
    | string
    | number
    | boolean
    | Record<string, unknown>
    | unknown[]
    | null;
  row_index?: number | null;
  row_value?: unknown;
}

export interface BulkOutcome {
  findingId: string;
  issue_type: string;
  /** Human-readable target, e.g. "lithology_intervals[3]" or a scalar path. */
  label: string;
  status: "applied" | "relocated" | "skipped";
  /** Why it was skipped / where it was relocated. */
  note?: string;
  before?: unknown;
  after?: unknown;
}

const parseRowValue = (rv: unknown): unknown => {
  if (rv == null) return null;
  if (typeof rv !== "string") return rv; // jsonb already gives an object
  try {
    return JSON.parse(rv);
  } catch {
    return rv;
  }
};

/**
 * Apply a set of open findings to `doc` in one pass, in an order that keeps
 * row indices meaningful, and report per-finding outcomes for a review UI.
 *
 * Order: scalars first (their bracket paths assume the QA-time array shape),
 * then update_row and delete_row (anchored to row content via
 * resolveRowAnchor, so they survive shifts from each other), then add_row
 * last (its row_index is only an insertion hint). Nothing here mutates
 * `doc`; nothing is saved — the caller writes the result into the editable
 * JSON and the user still reviews + Saves.
 */
export function computeBulkApply(
  doc: unknown,
  findings: BulkFinding[],
): { result: unknown; outcomes: BulkOutcome[] } {
  const ROW_ORDER: Record<string, number> = {
    update_row: 1,
    delete_row: 2,
    add_row: 3,
  };
  const sorted = [...findings].sort(
    (a, b) => (ROW_ORDER[a.issue_type] || 0) - (ROW_ORDER[b.issue_type] || 0),
  );

  let cur: unknown = structuredClone(doc);
  const outcomes: BulkOutcome[] = [];

  for (const f of sorted) {
    const push = (o: Omit<BulkOutcome, "findingId" | "issue_type">) =>
      outcomes.push({ findingId: f.id, issue_type: f.issue_type, ...o });

    if (f.issue_type === "add_row") {
      const row = parseRowValue(f.row_value);
      if (row == null) {
        push({ label: f.field_path, status: "skipped", note: "no row_value" });
        continue;
      }
      const arr = getByPath(cur, f.field_path);
      if (Array.isArray(arr) && arr.some((r) => deepJsonEqual(r, row))) {
        push({ label: f.field_path, status: "skipped", note: "identical row already present" });
        continue;
      }
      cur = insertAtPath(cur, f.field_path, f.row_index ?? null, row);
      push({ label: f.field_path, status: "applied", after: row });
      continue;
    }

    if (f.issue_type === "update_row" || f.issue_type === "delete_row") {
      const arr = getByPath(cur, f.field_path);
      if (!Array.isArray(arr)) {
        push({ label: f.field_path, status: "skipped", note: "target is not an array" });
        continue;
      }
      const anchor = resolveRowAnchor(arr, f.row_index ?? -1, f.actual);
      if (anchor.status === "not_found" || anchor.status === "ambiguous") {
        push({
          label: `${f.field_path}[${f.row_index}]`,
          status: "skipped",
          note:
            anchor.status === "not_found"
              ? "row changed since QA ran (may already be applied)"
              : "several identical rows — won't guess",
        });
        continue;
      }
      const idx = anchor.index;
      if (idx == null || idx < 0 || idx >= arr.length) {
        push({ label: `${f.field_path}[${f.row_index}]`, status: "skipped", note: "index out of range" });
        continue;
      }
      const before = arr[idx];
      const relocated = anchor.status === "relocated";
      if (f.issue_type === "delete_row") {
        cur = removeAtPath(cur, f.field_path, idx);
        push({
          label: `${f.field_path}[${idx}]`,
          status: relocated ? "relocated" : "applied",
          note: relocated ? `row moved from ${f.row_index} to ${idx}` : undefined,
          before,
        });
      } else {
        const row = parseRowValue(f.row_value);
        if (row == null) {
          push({ label: `${f.field_path}[${idx}]`, status: "skipped", note: "no row_value" });
          continue;
        }
        cur = setByPath(cur, `${f.field_path}[${idx}]`, row);
        push({
          label: `${f.field_path}[${idx}]`,
          status: relocated ? "relocated" : "applied",
          note: relocated ? `row moved from ${f.row_index} to ${idx}` : undefined,
          before,
          after: row,
        });
      }
      continue;
    }

    // Scalar findings (wrong_value / missing_value / formatting / extra_value)
    const before = getByPath(cur, f.field_path);
    const hasCorrected = f.corrected_value !== undefined && f.corrected_value !== null;
    const after =
      f.issue_type === "extra_value"
        ? null
        : hasCorrected
          ? f.corrected_value
          : coerceExpected(f.expected, before);
    if (deepJsonEqual(before, after)) {
      push({ label: f.field_path, status: "skipped", note: "already has this value" });
      continue;
    }
    cur = setByPath(cur, f.field_path, after);
    push({ label: f.field_path, status: "applied", before, after });
  }

  return { result: cur, outcomes };
}
