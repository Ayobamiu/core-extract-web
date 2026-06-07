"use client";

import React from "react";
import { Loader2, CheckCircle2, XCircle, CircleSlash, Clock } from "lucide-react";
import type { JobFile, ProcessingEvent } from "@/lib/api";

/**
 * Compact, always-visible live status for a file row. Prefers the latest
 * processing event (granular: "Classifying…", "AI 4/7") and falls back to the
 * row's coarse extraction/processing status when no live event exists yet.
 */

type Tone = "blue" | "green" | "red" | "amber" | "gray";

const TONE: Record<Tone, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200",
  green: "bg-green-50 text-green-700 border-green-200",
  red: "bg-red-50 text-red-700 border-red-200",
  amber: "bg-amber-50 text-amber-800 border-amber-200",
  gray: "bg-gray-50 text-gray-500 border-gray-200",
};

const PHASE_VERB: Record<string, string> = {
  classifying: "Classifying…",
  extracting: "Extracting…",
  ai_extraction: "Extracting data",
  post_processing: "Finalizing…",
};

function derive(
  file: JobFile,
  event?: ProcessingEvent,
): { tone: Tone; label: string; spin?: boolean; icon?: "check" | "x" | "slash" | "clock"; current?: number; total?: number } {
  // Live event wins (most granular), unless it's terminal — then fall through
  // to the row status so the chip matches the persisted final state.
  if (event && !["done", "failed", "skipped"].includes(event.phase)) {
    const total = event.progress?.total ?? event.progress_total ?? undefined;
    const current = event.progress?.current ?? event.progress_current ?? undefined;
    if (event.phase === "ai_extraction" && total) {
      return { tone: "blue", label: "AI", spin: false, current, total };
    }
    return {
      tone: event.level === "warning" ? "amber" : "blue",
      label: PHASE_VERB[event.phase] ?? "Processing…",
      spin: true,
    };
  }

  // Fallbacks from coarse row status.
  const ps = file.processing_status;
  const es = file.extraction_status;
  const skipped =
    (file.processing_metadata as Record<string, unknown> | undefined)?.skipped_reason;

  if (ps === "completed") {
    if (skipped || !((file as any).has_result ?? file.result)) {
      return { tone: "amber", label: "No content", icon: "slash" };
    }
    return { tone: "green", label: "Completed", icon: "check" };
  }
  if (ps === "failed" || es === "failed") {
    return { tone: "red", label: "Failed", icon: "x" };
  }
  if (ps === "processing") {
    return { tone: "blue", label: "Processing…", spin: true };
  }
  if (es === "processing") {
    return { tone: "blue", label: "Extracting…", spin: true };
  }
  return { tone: "gray", label: "Queued", icon: "clock" };
}

export default function ProcessingStatusChip({
  file,
  event,
}: {
  file: JobFile;
  event?: ProcessingEvent;
}) {
  const d = derive(file, event);

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[11px] font-medium whitespace-nowrap ${TONE[d.tone]}`}
      title={event?.message || d.label}
    >
      {d.spin && <Loader2 className="w-3 h-3 animate-spin" />}
      {d.icon === "check" && <CheckCircle2 className="w-3 h-3" />}
      {d.icon === "x" && <XCircle className="w-3 h-3" />}
      {d.icon === "slash" && <CircleSlash className="w-3 h-3" />}
      {d.icon === "clock" && <Clock className="w-3 h-3" />}
      <span>{d.label}</span>
      {d.total != null && (
        <>
          <span className="tabular-nums">
            {d.current ?? 0}/{d.total}
          </span>
          <span className="h-1 w-8 rounded-full bg-blue-100 overflow-hidden">
            <span
              className="block h-full bg-blue-500"
              style={{ width: `${Math.min(100, ((d.current ?? 0) / d.total) * 100)}%` }}
            />
          </span>
        </>
      )}
    </span>
  );
}
