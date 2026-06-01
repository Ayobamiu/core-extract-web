"use client";

import React from "react";
import type { JobFile } from "@/lib/api";
import { buildFileProcessingSummary } from "@/lib/fileProcessingMeta";

interface FileViewerMetaChipsProps {
  file: JobFile;
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center px-1.5 py-0.5 rounded border border-gray-200 bg-gray-50 text-[11px] text-gray-600 font-mono">
      {children}
    </span>
  );
}

export default function FileViewerMetaChips({ file }: FileViewerMetaChipsProps) {
  const summary = buildFileProcessingSummary(file);
  const chips: string[] = [];

  if (summary.extractionMethod) chips.push(summary.extractionMethod);
  if (summary.model) chips.push(summary.model);
  if (summary.resultEnvelope) chips.push(summary.resultEnvelope);
  if (summary.documentTypeSlugs.length > 0) {
    chips.push(
      summary.documentTypeSlugs.length === 1
        ? summary.documentTypeSlugs[0]
        : `${summary.documentTypeSlugs.length} doc types`,
    );
  }
  if (summary.routingStatus) chips.push(`routing: ${summary.routingStatus}`);
  const recordCount = (file as any).record_count ?? file.detected_sections?.sections?.length;
  if (recordCount != null && recordCount > 0) {
    chips.push(`${recordCount} record${recordCount === 1 ? "" : "s"}`);
  }
  if (file.review_status === "reviewed") chips.push("reviewed");
  if (file.admin_verified) chips.push("verified");

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 min-w-0">
      {chips.map((label) => (
        <Chip key={label}>{label}</Chip>
      ))}
    </div>
  );
}
