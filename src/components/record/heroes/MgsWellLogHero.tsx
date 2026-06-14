"use client";

import React from "react";
import { WellboreDiagram, MGSWellData } from "@/components/well/WellboreDiagram";

/**
 * mgs_well_log hero — the existing wellbore construction diagram. The record IS
 * the MGSWellData shape the diagram consumes. The generic body still renders the
 * formations/casing/pluggings tables below (complementary data view).
 */
export function MgsWellLogHero({ data }: { data: Record<string, unknown> }) {
  const well = data as unknown as MGSWellData;
  const hasGeometry =
    typeof well.true_depth === "number" ||
    (Array.isArray(well.formations) && well.formations.length > 0) ||
    (Array.isArray(well.casing) && well.casing.length > 0);
  if (!hasGeometry) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 overflow-x-auto">
      <h3 className="text-[13px] font-semibold tracking-wide text-gray-700 uppercase mb-3">
        Wellbore Diagram
      </h3>
      <div className="flex justify-center">
        <WellboreDiagram data={well} size="large" />
      </div>
    </section>
  );
}
