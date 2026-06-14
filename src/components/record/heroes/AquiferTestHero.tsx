"use client";

import React from "react";
import {
  Chart as ChartJS,
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
} from "chart.js";
import { Scatter } from "react-chartjs-2";
import { formatScalar, humanizeKey } from "../recordSchema";

ChartJS.register(
  LinearScale,
  LogarithmicScale,
  PointElement,
  LineElement,
  Tooltip,
  Legend,
);

const SERIES = [
  { key: "drawdown_ft", label: "Drawdown (ft)", color: "#2563eb" },
  { key: "recovery_ft", label: "Recovery (ft)", color: "#16a34a" },
  { key: "water_level_ft", label: "Water level (ft)", color: "#0891b2" },
];

const PARAM_KEYS = [
  "aquifer_type",
  "analysis_method",
  "transmissivity_ft2_day",
  "storativity",
  "specific_capacity_gpm_ft",
  "well_efficiency_percent",
];

/**
 * aquifer_test hero — elapsed-time vs drawdown/recovery on a log-time axis, plus
 * a calculated-parameters summary. The generic body still shows the full
 * readings table below.
 */
export function AquiferTestHero({ data }: { data: Record<string, unknown> }) {
  const readings = Array.isArray(data.time_series_readings)
    ? (data.time_series_readings as Array<Record<string, unknown>>)
    : [];

  const datasets = SERIES.map((s) => {
    const points = readings
      .map((r) => ({ x: r.elapsed_time, y: r[s.key] }))
      .filter(
        (p) =>
          typeof p.x === "number" && p.x > 0 && typeof p.y === "number",
      ) as Array<{ x: number; y: number }>;
    return { ...s, points };
  }).filter((s) => s.points.length >= 2);

  const params = (data.calculated_parameters ?? {}) as Record<string, unknown>;
  const paramEntries = PARAM_KEYS.filter(
    (k) => params[k] !== null && params[k] !== undefined && params[k] !== "",
  );

  if (datasets.length === 0 && paramEntries.length === 0) return null;

  const chartData = {
    datasets: datasets.map((s) => ({
      label: s.label,
      data: s.points,
      borderColor: s.color,
      backgroundColor: s.color,
      showLine: true,
      pointRadius: 2,
      borderWidth: 1.5,
      tension: 0.2,
    })),
  };

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 flex flex-col gap-4">
      <h3 className="text-[13px] font-semibold tracking-wide text-gray-700 uppercase">
        Test Response
      </h3>

      {datasets.length > 0 && (
        <div style={{ height: 320 }}>
          <Scatter
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              interaction: { mode: "nearest", intersect: false },
              scales: {
                x: {
                  type: "logarithmic",
                  title: { display: true, text: "Elapsed time (min)" },
                },
                y: { title: { display: true, text: "Feet" } },
              },
              plugins: { legend: { position: "bottom" } },
            }}
          />
        </div>
      )}

      {paramEntries.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {paramEntries.map((k) => (
            <div
              key={k}
              className="rounded-lg bg-gray-50 border border-gray-100 px-3 py-2"
            >
              <div className="text-[11px] text-gray-500">{humanizeKey(k)}</div>
              <div className="text-[14px] font-medium text-gray-900 tabular-nums">
                {formatScalar(k, params[k])}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
