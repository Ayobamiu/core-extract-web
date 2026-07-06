"use client";

import React from "react";
import { WellboreDiagram, MGSWellData } from "@/components/well/WellboreDiagram";

/**
 * mgs_well_log hero — compact wellbore diagram for the record drawer. Tabular
 * data (formations, casing, pluggings, …) stays in the generic RecordBody below.
 */
export function MgsWellLogHero({ data }: { data: Record<string, unknown> }) {
  const well = data as unknown as MGSWellData;
  const hasGeometry =
    typeof well.true_depth === "number" ||
    (Array.isArray(well.formations) && well.formations.length > 0) ||
    (Array.isArray(well.casing) && well.casing.length > 0);
  if (!hasGeometry) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      <WellboreDiagram
        data={well}
        size="medium"
        layout="embedded"
        showSummary={false}
      />
    </section>
  );
}
