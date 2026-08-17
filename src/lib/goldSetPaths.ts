/**
 * The canonical gold-set field path — a literal port of the backend's
 * `ai/src/utils/goldSetPaths.mjs`.
 *
 *   well_construction.screen_to_ft
 *   lithology_intervals[0].depth_from_ft
 *
 * This is the join between a seeded `gold_labels.field_path` and the JSON tree
 * node under the reviewer's cursor. If the two implementations disagree the
 * failure is silent and nasty: seeded fields render as if they were never
 * sampled, the reviewer sees no checklist, and nothing anywhere looks broken.
 *
 * The case table in `ai/src/utils/__tests__/goldSetPaths.test.ts` is the spec.
 * This repo has no test runner, so that suite is the only automated guard —
 * port any change there first, then mirror it here.
 */

/**
 * Build a canonical path from a react-json-view key array. Numeric keys are
 * array indices — that is the only signal the tree gives that a level is an
 * array rather than an object with numeric-looking keys.
 */
export function joinFieldPath(keys: Array<string | number>): string {
  let out = "";
  for (const key of keys ?? []) {
    if (typeof key === "number" || /^\d+$/.test(String(key))) {
      out += `[${Number(key)}]`;
    } else {
      out += out ? `.${key}` : String(key);
    }
  }
  return out;
}

/**
 * Collapse array indices so every row of a table aggregates under one field:
 * `lithology_intervals[3].depth_to_ft` → `lithology_intervals[].depth_to_ft`.
 */
export function aggregateFieldPath(path: string): string {
  return String(path ?? "").replace(/\[\d+\]/g, "[]");
}

/** Split a canonical path into keys; indices come back as numbers. */
export function splitFieldPath(path: string): Array<string | number> {
  const keys: Array<string | number> = [];
  const re = /([^.[\]]+)|\[(\d+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(String(path ?? ""))) !== null) {
    keys.push(m[2] !== undefined ? Number(m[2]) : m[1]);
  }
  return keys;
}

/** Read the value at a canonical path; undefined for any missing link. */
export function getAtFieldPath(obj: unknown, path: string): unknown {
  let cur: unknown = obj;
  for (const key of splitFieldPath(path)) {
    if (cur == null) return undefined;
    cur = (cur as Record<string | number, unknown>)[key];
  }
  return cur;
}

/**
 * Paths of every seeded leaf at or beneath `path`.
 *
 * This is what makes "the whole `well_construction` block is right" one click:
 * it expands to a real verdict on each seeded leaf underneath, so the row
 * count — and therefore the denominator — is unchanged from judging them one
 * at a time. A single verdict stored against the container would collapse
 * several observations into one and could not be scored per field.
 */
export function seededLeavesUnder(
  path: string,
  seededPaths: Iterable<string>,
): string[] {
  const prefix = path === "" ? "" : path;
  const out: string[] = [];
  for (const candidate of seededPaths) {
    if (prefix === "") {
      out.push(candidate);
    } else if (
      candidate === prefix ||
      candidate.startsWith(`${prefix}.`) ||
      candidate.startsWith(`${prefix}[`)
    ) {
      out.push(candidate);
    }
  }
  return out.sort();
}

/** A blank extraction — which is frequently the CORRECT answer, not a defect. */
export function isBlankValue(value: string | null | undefined): boolean {
  return value === null || value === undefined || String(value).trim() === "";
}
