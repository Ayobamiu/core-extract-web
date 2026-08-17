"use client";

import React, { useMemo } from "react";
import { buildFieldDescriptionMap } from "@/lib/schemaDescriptions";
import { JsonSchemaNode } from "./recordSchema";
import { RecordBody } from "./RecordBody";
import { RecordTrustHeader, RecordTrust } from "./RecordTrustHeader";
import { heroForSlug, HeroComponent } from "./heroes";
import type { RenderCtx } from "./renderers";

/**
 * Customer-facing record viewer. Renders any record from its data (+ optional
 * JSON Schema) as a human-readable report: a trust header, an optional tailored
 * "hero" visualization, then the schema-driven body. No raw keys/JSON.
 */
export function RecordView({
  data,
  schema,
  slug,
  fieldDescriptions,
  trust,
  hero,
  identifierFields,
  emptyLabel,
  compact = false,
}: {
  data: Record<string, unknown>;
  schema?: JsonSchemaNode;
  slug?: string;
  fieldDescriptions?: Record<string, string>;
  trust?: RecordTrust;
  /** Override the registry hero (e.g. for testing). */
  hero?: HeroComponent | null;
  /** Per-type identifier dot-paths for the header title (preview ID config). */
  identifierFields?: string[] | null;
  /** Empty-field label. Demo uses "—"; product default is "Not recorded". */
  emptyLabel?: string;
  compact?: boolean;
}) {
  const descMap = useMemo<Record<string, string>>(
    () => fieldDescriptions ?? (schema ? buildFieldDescriptionMap(schema) : {}),
    [fieldDescriptions, schema],
  );
  const ctx: RenderCtx = { descMap, emptyLabel };

  const Hero = hero !== undefined ? hero : heroForSlug(slug);

  if (!data || typeof data !== "object") {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Nothing to display for this record.
      </div>
    );
  }

  return (
    <div className={compact ? "" : "mx-auto max-w-5xl px-1 py-2"}>
      <RecordTrustHeader
        data={data}
        slug={slug}
        trust={trust}
        identifierFields={identifierFields}
        compact={compact}
      />
      {Hero && (
        <div className={compact ? "mb-3" : "mb-5"}>
          <Hero data={data} />
        </div>
      )}
      <RecordBody data={data} schema={schema} ctx={ctx} />
    </div>
  );
}

export default RecordView;
