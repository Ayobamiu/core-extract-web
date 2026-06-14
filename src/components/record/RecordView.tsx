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
}: {
  data: Record<string, unknown>;
  schema?: JsonSchemaNode;
  slug?: string;
  fieldDescriptions?: Record<string, string>;
  trust?: RecordTrust;
  /** Override the registry hero (e.g. for testing). */
  hero?: HeroComponent | null;
}) {
  const descMap = useMemo<Record<string, string>>(
    () => fieldDescriptions ?? (schema ? buildFieldDescriptionMap(schema) : {}),
    [fieldDescriptions, schema],
  );
  const ctx: RenderCtx = { descMap };

  const Hero = hero !== undefined ? hero : heroForSlug(slug);

  if (!data || typeof data !== "object") {
    return (
      <div className="p-8 text-center text-gray-400 text-sm">
        Nothing to display for this record.
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-1 py-2">
      <RecordTrustHeader data={data} slug={slug} trust={trust} />
      {Hero && (
        <div className="mb-5">
          <Hero data={data} />
        </div>
      )}
      <RecordBody data={data} schema={schema} ctx={ctx} />
    </div>
  );
}

export default RecordView;
