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
