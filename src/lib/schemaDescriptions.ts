/**
 * Flatten a JSON Schema into a `dot.path -> description` map for the result
 * viewer's field tooltips. Array indices are NOT part of the path — array item
 * fields are keyed by the array name + field (e.g. `spt_intervals.n_value`),
 * matching what you get after stripping `[i]` from a runtime path.
 */

type JsonSchemaNode = {
  description?: string;
  type?: string | string[];
  properties?: Record<string, JsonSchemaNode>;
  items?: JsonSchemaNode;
  [k: string]: unknown;
};

function isObj(v: unknown): v is JsonSchemaNode {
  return !!v && typeof v === "object";
}

export function buildFieldDescriptionMap(
  jsonSchema: unknown,
): Record<string, string> {
  const out: Record<string, string> = {};
  const root = isObj(jsonSchema) ? jsonSchema : null;
  if (!root?.properties) return out;

  const walk = (props: Record<string, JsonSchemaNode>, prefix: string) => {
    for (const [key, def] of Object.entries(props)) {
      if (!isObj(def)) continue;
      const path = prefix ? `${prefix}.${key}` : key;
      if (typeof def.description === "string" && def.description.trim()) {
        out[path] = def.description.trim();
      }
      // Nested object
      if (def.properties) {
        walk(def.properties, path);
      }
      // Array of objects → item fields keyed under the array name (no index)
      if (def.items?.properties) {
        walk(def.items.properties, path);
      }
    }
  };

  walk(root.properties, "");
  return out;
}

/**
 * Resolve a runtime node path (which may contain numeric array indices) to a
 * schema description. Strips numeric segments before lookup.
 *
 * @param path  array of keys/indices, e.g. ["spt_intervals", 2, "n_value"]
 */
export function descriptionForPath(
  path: Array<string | number>,
  map: Record<string, string>,
): string | undefined {
  if (!path?.length) return undefined;
  const normalized = path
    .filter((seg) => typeof seg === "string" || !Number.isInteger(seg))
    .map((seg) => String(seg))
    .filter((seg) => seg !== "" && !/^\d+$/.test(seg))
    .join(".");
  return map[normalized];
}
