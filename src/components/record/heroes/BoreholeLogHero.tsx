"use client";

import React from "react";

interface Interval {
  depth_from_ft?: number | null;
  depth_to_ft?: number | null;
  primary_material?: string | null;
  uscs_symbol?: string | null;
  color_description?: string | null;
  description_raw?: string | null;
}

// Material → fill colour (USGS-ish, soft so text stays readable).
const MATERIAL_COLORS: Array<{ test: RegExp; bg: string; fg: string }> = [
  { test: /topsoil|organic/i, bg: "#5b4636", fg: "#fff" },
  { test: /fill/i, bg: "#8d6e63", fg: "#fff" },
  { test: /clay/i, bg: "#9fb0c3", fg: "#1f2937" },
  { test: /silt/i, bg: "#cdb892", fg: "#1f2937" },
  { test: /sand/i, bg: "#f4d58d", fg: "#3a2f0b" },
  { test: /gravel|cobble/i, bg: "#e7a35a", fg: "#3a2f0b" },
  { test: /till/i, bg: "#a3a86b", fg: "#1f2937" },
  { test: /lime|dolomite|bedrock|rock|shale|sandstone/i, bg: "#9ca3af", fg: "#111827" },
  { test: /peat/i, bg: "#6b4f2a", fg: "#fff" },
];
const colorFor = (m?: string | null) =>
  (m && MATERIAL_COLORS.find((c) => c.test.test(m))) || {
    bg: "#e5e7eb",
    fg: "#374151",
  };

const COLUMN_HEIGHT = 520;
const MIN_BAND = 30;

/**
 * borehole_log hero — a lithology depth column. Stratigraphic bands down a depth
 * axis, coloured by material, labelled with material / USCS / depth. The generic
 * body still renders the full interval table below.
 */
export function BoreholeLogHero({ data }: { data: Record<string, unknown> }) {
  const intervals = (
    Array.isArray(data.lithology_intervals)
      ? (data.lithology_intervals as Interval[])
      : []
  ).filter((i) => typeof i.depth_from_ft === "number");

  if (intervals.length === 0) return null;

  const totalDepthField = (
    data.drilling_and_personnel as Record<string, unknown> | undefined
  )?.total_depth_ft;
  const maxDepth = Math.max(
    ...intervals.map((i) => i.depth_to_ft ?? i.depth_from_ft ?? 0),
    typeof totalDepthField === "number" ? totalDepthField : 0,
  );
  const minDepth = Math.min(...intervals.map((i) => i.depth_from_ft ?? 0));
  const span = Math.max(maxDepth - minDepth, 1);
  const pxPerFt = COLUMN_HEIGHT / span;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4">
      <h3 className="text-[13px] font-semibold tracking-wide text-gray-700 uppercase mb-3">
        Lithology Profile
      </h3>
      <div className="flex gap-2" style={{ minHeight: COLUMN_HEIGHT }}>
        {/* depth axis */}
        <div
          className="relative w-12 shrink-0 text-right pr-1"
          style={{ height: COLUMN_HEIGHT }}
        >
          {intervals.map((iv, idx) => {
            const top = ((iv.depth_from_ft ?? 0) - minDepth) * pxPerFt;
            return (
              <div
                key={idx}
                className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400 tabular-nums"
                style={{ top }}
              >
                {iv.depth_from_ft}
              </div>
            );
          })}
          <div
            className="absolute right-1 -translate-y-1/2 text-[10px] text-gray-400 tabular-nums"
            style={{ top: COLUMN_HEIGHT }}
          >
            {maxDepth}
          </div>
          <div className="absolute -left-1 top-1/2 -translate-y-1/2 -rotate-90 text-[9px] uppercase tracking-wide text-gray-300">
            Depth (ft)
          </div>
        </div>

        {/* column */}
        <div
          className="relative flex-1 rounded-md overflow-hidden border border-gray-200"
          style={{ height: COLUMN_HEIGHT }}
        >
          {intervals.map((iv, idx) => {
            const from = iv.depth_from_ft ?? 0;
            const to = iv.depth_to_ft ?? from;
            const rawH = Math.max((to - from) * pxPerFt, MIN_BAND);
            const top = (from - minDepth) * pxPerFt;
            const c = colorFor(iv.primary_material);
            const label =
              iv.uscs_symbol ||
              iv.primary_material ||
              (iv.description_raw || "").slice(0, 28);
            return (
              <div
                key={idx}
                className="absolute left-0 right-0 px-2 flex items-center overflow-hidden border-b border-black/10"
                style={{ top, height: rawH, background: c.bg, color: c.fg }}
                title={iv.description_raw || undefined}
              >
                <span className="text-[11px] font-medium truncate capitalize">
                  {label}
                  {iv.color_description ? (
                    <span className="opacity-70"> · {iv.color_description}</span>
                  ) : null}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
