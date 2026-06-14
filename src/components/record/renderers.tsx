"use client";

import React from "react";
import { Tooltip } from "antd";
import { descriptionForPath } from "@/lib/schemaDescriptions";
import {
  JsonSchemaNode,
  classifyValue,
  formatScalar,
  humanizeKey,
  isEmptyValue,
  isProseField,
  labelForField,
  normalizeSchemaNode,
  orderedKeys,
  sanitizeDescription,
  tableColumns,
} from "./recordSchema";

export interface RenderCtx {
  descMap: Record<string, string>;
}

const childSchema = (
  node: JsonSchemaNode | undefined,
  key: string,
): JsonSchemaNode | undefined => normalizeSchemaNode(node?.properties?.[key]).node;

// ── Field label with optional plain-language helper ──────────────────
function FieldLabel({
  label,
  path,
  ctx,
}: {
  label: string;
  path: Array<string | number>;
  ctx: RenderCtx;
}) {
  const help = sanitizeDescription(descriptionForPath(path, ctx.descMap));
  return (
    <span className="inline-flex items-center gap-1 text-[13px] text-gray-500">
      {label}
      {help && (
        <Tooltip title={help}>
          <span className="cursor-help text-gray-300 text-[11px] leading-none">
            ⓘ
          </span>
        </Tooltip>
      )}
    </span>
  );
}

// ── A single scalar value, typed + humanized ─────────────────────────
export function ScalarValue({
  fieldKey,
  value,
  muted = "Not recorded",
}: {
  fieldKey: string;
  value: unknown;
  muted?: string;
}) {
  if (isEmptyValue(value)) {
    return <span className="text-gray-300 italic">{muted}</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${
          value
            ? "bg-green-50 text-green-700"
            : "bg-gray-100 text-gray-500"
        }`}
      >
        {value ? "Yes" : "No"}
      </span>
    );
  }
  return (
    <span className="text-[13.5px] text-gray-900 tabular-nums">
      {formatScalar(fieldKey, value)}
    </span>
  );
}

// ── Prose (remarks / long text) ──────────────────────────────────────
function ProseBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[13px] text-gray-500 mb-1">{label}</div>
      <p className="text-[13.5px] leading-relaxed text-gray-800 whitespace-pre-wrap">
        {value}
      </p>
    </div>
  );
}

// ── Chip list (array of scalars) ─────────────────────────────────────
export function ChipList({ values }: { values: unknown[] }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {values.map((v, i) => (
        <span
          key={i}
          className="inline-flex items-center rounded-md bg-gray-100 px-2 py-0.5 text-[12px] text-gray-700"
        >
          {String(v)}
        </span>
      ))}
    </div>
  );
}

// ── Card shell ───────────────────────────────────────────────────────
function Card({
  title,
  className = "",
  children,
}: {
  title?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-xl border border-gray-200 bg-white ${className}`}
    >
      {title && (
        <header className="px-4 pt-3 pb-2 border-b border-gray-100">
          <h3 className="text-[13px] font-semibold tracking-wide text-gray-700 uppercase">
            {title}
          </h3>
        </header>
      )}
      <div className="p-4">{children}</div>
    </section>
  );
}

// ── Attribute card: an object's scalar fields as label/value rows ────
export function AttributeCard({
  title,
  data,
  schema,
  path,
  ctx,
}: {
  title: string;
  data: Record<string, unknown>;
  schema?: JsonSchemaNode;
  path: Array<string | number>;
  ctx: RenderCtx;
}) {
  const keys = orderedKeys(data, schema);
  const scalars = keys.filter((k) => {
    const t = classifyValue(data[k]);
    return (t === "scalar" || t === "empty") && !isProseField(k, data[k]);
  });
  const prose = keys.filter((k) => isProseField(k, data[k]));
  const nestedObjects = keys.filter((k) => classifyValue(data[k]) === "object");
  const nestedArrays = keys.filter((k) => {
    const t = classifyValue(data[k]);
    return t === "objectArray" || t === "scalarArray";
  });

  return (
    <Card title={title}>
      <div className="flex flex-col gap-3">
        {scalars.length > 0 && (
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2.5">
            {scalars.map((k) => (
              <div key={k} className="flex flex-col gap-0.5 min-w-0">
                <FieldLabel
                  label={labelForField(k, childSchema(schema, k))}
                  path={[...path, k]}
                  ctx={ctx}
                />
                <dd className="m-0 break-words">
                  <ScalarValue fieldKey={k} value={data[k]} />
                </dd>
              </div>
            ))}
          </dl>
        )}

        {prose.map((k) => (
          <ProseBlock
            key={k}
            label={labelForField(k, childSchema(schema, k))}
            value={String(data[k])}
          />
        ))}

        {nestedObjects.map((k) => (
          <div key={k} className="rounded-lg bg-gray-50/70 p-3">
            <div className="text-[12px] font-semibold text-gray-600 mb-2">
              {labelForField(k, childSchema(schema, k))}
            </div>
            <NestedObject
              data={data[k] as Record<string, unknown>}
              schema={childSchema(schema, k)}
              path={[...path, k]}
              ctx={ctx}
            />
          </div>
        ))}

        {nestedArrays.map((k) => (
          <FieldBlock
            key={k}
            fieldKey={k}
            value={data[k]}
            schema={childSchema(schema, k)}
            path={[...path, k]}
            ctx={ctx}
          />
        ))}
      </div>
    </Card>
  );
}

// Nested object inside a card — flat label/value grid, no extra chrome.
function NestedObject({
  data,
  schema,
  path,
  ctx,
}: {
  data: Record<string, unknown>;
  schema?: JsonSchemaNode;
  path: Array<string | number>;
  ctx: RenderCtx;
}) {
  const keys = orderedKeys(data, schema);
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2">
      {keys.map((k) => (
        <div key={k} className="flex flex-col gap-0.5 min-w-0">
          <FieldLabel
            label={labelForField(k, childSchema(schema, k))}
            path={[...path, k]}
            ctx={ctx}
          />
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
  );
}

// ── Record table: array of objects ───────────────────────────────────
export function RecordTable({
  title,
  rows,
  itemSchema,
  path,
  ctx,
}: {
  title: string;
  rows: Array<Record<string, unknown>>;
  itemSchema?: JsonSchemaNode;
  path: Array<string | number>;
  ctx: RenderCtx;
}) {
  const cols = tableColumns(rows, itemSchema);
  const isNumeric = (k: string) =>
    rows.some((r) => typeof r?.[k] === "number");

  return (
    <Card title={`${title} · ${rows.length}`} className="overflow-hidden">
      <div className="overflow-x-auto -mx-4 -mb-4">
        <table className="min-w-full text-[13px] border-collapse">
          <thead>
            <tr className="border-b border-gray-200">
              {cols.map((k) => (
                <th
                  key={k}
                  className={`px-3 py-2 font-medium text-gray-500 whitespace-nowrap ${
                    isNumeric(k) ? "text-right" : "text-left"
                  }`}
                >
                  <Tooltip
                    title={sanitizeDescription(
                      descriptionForPath([...path, k], ctx.descMap),
                    )}
                  >
                    {labelForField(k, childSchema(itemSchema, k))}
                  </Tooltip>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr
                key={i}
                className="border-b border-gray-100 last:border-0 hover:bg-gray-50/60"
              >
                {cols.map((k) => (
                  <td
                    key={k}
                    className={`px-3 py-2 align-top ${
                      isNumeric(k)
                        ? "text-right tabular-nums whitespace-nowrap"
                        : "text-left"
                    }`}
                  >
                    {isEmptyValue(r?.[k]) ? (
                      <span className="text-gray-300">—</span>
                    ) : classifyValue(r?.[k]) === "scalarArray" ? (
                      <ChipList values={r[k] as unknown[]} />
                    ) : typeof r?.[k] === "object" ? (
                      <span className="text-gray-400 italic">(details)</span>
                    ) : (
                      <ScalarValue
                        fieldKey={k}
                        value={r?.[k]}
                        muted="—"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

// ── Dispatch for one top-level (or nested-array) field ───────────────
export function FieldBlock({
  fieldKey,
  value,
  schema,
  path,
  ctx,
}: {
  fieldKey: string;
  value: unknown;
  schema?: JsonSchemaNode;
  path: Array<string | number>;
  ctx: RenderCtx;
}) {
  const label = labelForField(fieldKey, schema);
  const type = classifyValue(value);

  if (type === "object") {
    return (
      <AttributeCard
        title={label}
        data={value as Record<string, unknown>}
        schema={schema}
        path={path}
        ctx={ctx}
      />
    );
  }
  if (type === "objectArray") {
    return (
      <RecordTable
        title={label}
        rows={value as Array<Record<string, unknown>>}
        itemSchema={normalizeSchemaNode(schema?.items).node}
        path={path}
        ctx={ctx}
      />
    );
  }
  if (type === "scalarArray") {
    return (
      <Card title={label}>
        <ChipList values={value as unknown[]} />
      </Card>
    );
  }
  // empty array/object/scalar at top level
  return (
    <Card title={label}>
      <span className="text-gray-300 italic text-[13.5px]">
        {humanizeKey(fieldKey)} — Not recorded
      </span>
    </Card>
  );
}
