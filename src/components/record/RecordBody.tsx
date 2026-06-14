"use client";

import React from "react";
import {
  JsonSchemaNode,
  classifyValue,
  isProseField,
  labelForField,
  normalizeSchemaNode,
  orderedKeys,
} from "./recordSchema";
import {
  AttributeCard,
  ChipList,
  FieldBlock,
  RecordTable,
  RenderCtx,
  ScalarValue,
} from "./renderers";

const childSchema = (
  node: JsonSchemaNode | undefined,
  key: string,
): JsonSchemaNode | undefined => normalizeSchemaNode(node?.properties?.[key]).node;

/**
 * Generic body: lays out a record's top-level fields. Loose scalars are grouped
 * into a "Details" card; objects become attribute cards; arrays of objects
 * become full-width tables. Order follows the schema, then data-only extras.
 */
export function RecordBody({
  data,
  schema,
  ctx,
}: {
  data: Record<string, unknown>;
  schema?: JsonSchemaNode;
  ctx: RenderCtx;
}) {
  const keys = orderedKeys(data, schema);

  const looseScalars = keys.filter((k) => {
    const t = classifyValue(data[k]);
    return (t === "scalar" || t === "empty") && !isProseField(k, data[k]);
  });
  const rest = keys.filter((k) => !looseScalars.includes(k));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {looseScalars.length > 0 && (
        <DetailsCard data={data} schema={schema} keys={looseScalars} />
      )}

      {rest.map((k) => {
        const t = classifyValue(data[k]);
        const fullWidth = t === "objectArray" || isProseField(k, data[k]);
        return (
          <div key={k} className={fullWidth ? "lg:col-span-2" : ""}>
            <FieldBlock
              fieldKey={k}
              value={data[k]}
              schema={childSchema(schema, k)}
              path={[k]}
              ctx={ctx}
            />
          </div>
        );
      })}
    </div>
  );
}

// A "Details" card collecting all loose top-level scalar fields.
function DetailsCard({
  data,
  schema,
  keys,
}: {
  data: Record<string, unknown>;
  schema?: JsonSchemaNode;
  keys: string[];
}) {
  return (
    <section className="rounded-xl border border-gray-200 bg-white">
      <header className="px-4 pt-3 pb-2 border-b border-gray-100">
        <h3 className="text-[13px] font-semibold tracking-wide text-gray-700 uppercase">
          Details
        </h3>
      </header>
      <div className="p-4">
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
          {keys.map((k) => (
            <div key={k} className="flex flex-col gap-0.5 min-w-0">
              <span className="text-[13px] text-gray-500">
                {labelForField(k, childSchema(schema, k))}
              </span>
              <dd className="m-0 break-words">
                {classifyValue(data[k]) === "scalarArray" ? (
                  <ChipList values={data[k] as unknown[]} />
                ) : (
                  <ScalarValue fieldKey={k} value={data[k]} />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}

// Re-export so RecordView can pull both from one module if desired.
export { AttributeCard, RecordTable };
