"use client";

import React from "react";
import type {
  QAOverallQuality,
  SectionVerificationStatus,
} from "@/lib/api";
import { humanizeKey } from "./recordSchema";

export interface RecordTrust {
  verification?: SectionVerificationStatus | null;
  qa?: { quality: QAOverallQuality | null; openFindings: number } | null;
}

// Friendly document-type names (fallback humanizes the slug).
const SLUG_NAMES: Record<string, string> = {
  mgs_well_log: "Well Log",
  borehole_log: "Boring Log",
  aquifer_test: "Aquifer Test",
  analytical_results: "Analytical Results",
  well_coordinate_table: "Well Coordinates",
  field_sampling_forms: "Field Sampling",
};

type Tone = "good" | "warn" | "bad" | "neutral";
const TONE: Record<Tone, string> = {
  good: "bg-green-50 text-green-700 ring-green-600/15",
  warn: "bg-amber-50 text-amber-700 ring-amber-600/15",
  bad: "bg-red-50 text-red-700 ring-red-600/15",
  neutral: "bg-gray-100 text-gray-600 ring-gray-500/10",
};

function Chip({
  tone,
  icon,
  children,
}: {
  tone: Tone;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[12px] font-medium ring-1 ring-inset ${TONE[tone]}`}
    >
      {icon && <span className="text-[11px] leading-none">{icon}</span>}
      {children}
    </span>
  );
}

function pick(obj: unknown, path: string[]): unknown {
  let cur: unknown = obj;
  for (const p of path) {
    if (cur && typeof cur === "object" && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else return undefined;
  }
  return cur;
}

function recordTitle(data: Record<string, unknown>): string | null {
  const candidates: Array<unknown> = [
    pick(data, ["site_identification", "boring_well_id"]),
    pick(data, ["site_identification", "boring_well_id_full"]),
    pick(data, ["test_setup", "well_number"]),
    data["well_number"],
    data["api_number"],
    data["boring_well_id"],
    data["location_id"],
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.trim()) return c.trim();
    if (typeof c === "number") return String(c);
  }
  return null;
}

function confidenceChip(conf: unknown): React.ReactNode {
  if (typeof conf !== "number") return null;
  const pct = conf <= 1 ? conf : conf / 100;
  const tone: Tone = pct >= 0.85 ? "good" : pct >= 0.6 ? "warn" : "bad";
  const label =
    pct >= 0.85 ? "High confidence" : pct >= 0.6 ? "Medium confidence" : "Low confidence";
  return (
    <Chip tone={tone} icon="◆">
      {label}
    </Chip>
  );
}

function qaChip(qa: RecordTrust["qa"]): React.ReactNode {
  if (!qa) return null;
  if (qa.openFindings > 0) {
    return (
      <Chip tone="warn" icon="!">
        {qa.openFindings} item{qa.openFindings === 1 ? "" : "s"} to review
      </Chip>
    );
  }
  if (qa.quality === "poor") return <Chip tone="bad" icon="!">Quality concerns</Chip>;
  if (qa.quality) return <Chip tone="good" icon="✓">No issues</Chip>;
  return <Chip tone="neutral">Not checked</Chip>;
}

function verificationChip(
  status: RecordTrust["verification"],
): React.ReactNode {
  switch (status) {
    case "approved":
      return <Chip tone="good" icon="✓">Verified</Chip>;
    case "rejected":
      return <Chip tone="bad" icon="✕">Rejected</Chip>;
    case "in_review":
      return <Chip tone="warn">In review</Chip>;
    default:
      return <Chip tone="neutral">Needs review</Chip>;
  }
}

export function RecordTrustHeader({
  data,
  slug,
  trust,
}: {
  data: Record<string, unknown>;
  slug?: string;
  trust?: RecordTrust;
}) {
  const docName = slug ? SLUG_NAMES[slug] ?? humanizeKey(slug) : "Record";
  const title = recordTitle(data);

  const meta = (data["extraction_metadata"] ?? {}) as Record<string, unknown>;
  const rawSource =
    typeof meta.source_file === "string" ? meta.source_file.trim() : "";
  const sourceFile =
    rawSource && rawSource.toLowerCase() !== "unknown" ? rawSource : null;
  const pages = Array.isArray(meta.source_pages)
    ? (meta.source_pages as number[]).filter((n) => typeof n === "number")
    : [];
  const pageLabel =
    pages.length === 1
      ? `Page ${pages[0]}`
      : pages.length > 1
        ? `Pages ${Math.min(...pages)}–${Math.max(...pages)}`
        : null;

  // Only surface scan quality when it signals a problem (a clean scan needs no
  // note). Avoid double "scan" when the value already contains the word.
  const scanRaw =
    typeof meta.scan_quality === "string" ? meta.scan_quality : null;
  const scanConcern =
    scanRaw && /poor|fair|low|illegible|degraded|faint|light|blurr|skew/i.test(scanRaw)
      ? /scan/i.test(scanRaw)
        ? humanizeKey(scanRaw)
        : `${humanizeKey(scanRaw)} scan`
      : null;
  const handwritten = meta.handwritten === true;

  return (
    <header className="flex flex-col gap-3 pb-4 mb-4 border-b border-gray-200">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-blue-600">
            {docName}
          </div>
          <h2 className="text-xl font-semibold text-gray-900 truncate">
            {title ?? docName}
          </h2>
          {(sourceFile || pageLabel) && (
            <div className="text-[12.5px] text-gray-400 mt-0.5 truncate">
              {[sourceFile, pageLabel].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {confidenceChip(meta.extraction_confidence)}
          {qaChip(trust?.qa)}
          {verificationChip(trust?.verification)}
        </div>
      </div>

      {scanConcern || handwritten ? (
        <div className="flex items-center gap-2 flex-wrap">
          {handwritten && (
            <span className="text-[11px] text-gray-500 bg-gray-100 rounded px-1.5 py-0.5">
              Handwritten source
            </span>
          )}
          {scanConcern && (
            <span className="text-[11px] text-amber-700 bg-amber-50 rounded px-1.5 py-0.5">
              {scanConcern}
            </span>
          )}
        </div>
      ) : null}
    </header>
  );
}
