"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  CircleSlash,
  ChevronDown,
} from "lucide-react";
import { apiClient, type ProcessingEvent } from "@/lib/api";
import { useSocket } from "@/hooks/useSocket";

// ── Normalized event (reconciles REST vs socket payload shapes) ──
type Evt = {
  seq: number;
  phase: ProcessingEvent["phase"];
  status: ProcessingEvent["status"];
  level: NonNullable<ProcessingEvent["level"]>;
  message: string;
  current?: number;
  total?: number;
  ts: number;
};

function normalize(raw: ProcessingEvent, fallbackSeq: number): Evt {
  return {
    seq: typeof raw.seq === "number" ? raw.seq : fallbackSeq,
    phase: raw.phase,
    status: raw.status,
    level: (raw.level ?? "info") as Evt["level"],
    message: raw.message ?? "",
    current: raw.progress?.current ?? raw.progress_current ?? undefined,
    total: raw.progress?.total ?? raw.progress_total ?? undefined,
    ts: raw.created_at ? new Date(raw.created_at).getTime() : Date.now(),
  };
}

const PHASE_LABEL: Record<string, string> = {
  queued: "Queued",
  classifying: "Classifying pages",
  extracting: "Extracting text",
  ai_extraction: "Extracting structured data",
  post_processing: "Finalizing",
};

const TERMINAL = new Set(["done", "failed", "skipped"]);
const PHASE_ORDER = [
  "queued",
  "classifying",
  "extracting",
  "ai_extraction",
  "post_processing",
];

function fmtDuration(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s`;
}

export default function ProcessingTimeline({
  fileId,
  jobId,
}: {
  fileId: string;
  jobId?: string;
}) {
  const [events, setEvents] = useState<Evt[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [now, setNow] = useState(Date.now());
  const seqRef = useRef(-1);

  // Hydrate from the persisted timeline.
  useEffect(() => {
    let cancelled = false;
    if (!fileId) return;
    apiClient
      .getProcessingEvents(fileId)
      .then((res) => {
        if (cancelled || res.status !== "success" || !res.events) return;
        setEvents(
          (res.events as ProcessingEvent[]).map((e, i) => normalize(e, i)),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [fileId]);

  // Live updates — append events for this file.
  useSocket(jobId, {
    onFileProcessingEvent: (data: ProcessingEvent) => {
      const evtFileId = (data as any).fileId ?? (data as any).file_id;
      if (evtFileId !== fileId) return;
      setEvents((prev) => {
        const e = normalize(data, (prev[prev.length - 1]?.seq ?? -1) + 1);
        // de-dupe by seq
        if (prev.some((p) => p.seq === e.seq)) return prev;
        return [...prev, e].sort((a, b) => a.seq - b.seq);
      });
    },
  });

  const last = events[events.length - 1];
  const isTerminal = last ? TERMINAL.has(last.phase) : false;

  // Tick while the run is in flight so elapsed/ETA update live.
  useEffect(() => {
    if (isTerminal || events.length === 0) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isTerminal, events.length]);

  const steps = useMemo(() => {
    const present = [
      ...new Set(events.filter((e) => !TERMINAL.has(e.phase)).map((e) => e.phase)),
    ].sort((a, b) => PHASE_ORDER.indexOf(a) - PHASE_ORDER.indexOf(b));

    return present.map((phase) => {
      const evs = events.filter((e) => e.phase === phase);
      const latest = evs[evs.length - 1];
      const startTs = evs[0]?.ts ?? latest.ts;

      let state: "done" | "active" | "failed";
      if (evs.some((e) => e.level === "error" || e.status === "failed")) {
        state = "failed";
      } else if (!isTerminal && last?.phase === phase && latest.status === "active") {
        state = "active";
      } else {
        state = "done";
      }

      // ETA for determinate, in-flight phases.
      let eta: number | null = null;
      if (state === "active" && latest.current && latest.total && latest.current > 0) {
        const elapsed = now - startTs;
        const per = elapsed / latest.current;
        eta = Math.max(0, per * (latest.total - latest.current));
      }

      const endTs = state === "active" ? now : latest.ts;
      return { phase, latest, state, startTs, durationMs: endTs - startTs, eta };
    });
  }, [events, isTerminal, last?.phase, now]);

  // Inline warnings (e.g. "stopped extracting early") worth surfacing prominently.
  const warnings = useMemo(
    () => events.filter((e) => e.level === "warning"),
    [events],
  );

  if (events.length === 0) {
    return (
      <div className="text-xs text-gray-400 italic px-1 py-2">
        No processing activity recorded yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Stepper */}
      <ol className="space-y-2.5">
        {steps.map(({ phase, latest, state, durationMs, eta }) => (
          <li key={phase} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex-shrink-0">
              {state === "active" && (
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
              )}
              {state === "done" && (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              )}
              {state === "failed" && (
                <XCircle className="w-4 h-4 text-red-500" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-2">
                <span
                  className={`text-sm font-medium ${
                    state === "failed" ? "text-red-700" : "text-gray-800"
                  }`}
                >
                  {PHASE_LABEL[phase] ?? phase}
                </span>
                <span className="text-[11px] text-gray-400 tabular-nums whitespace-nowrap">
                  {state === "active" && eta != null
                    ? `~${fmtDuration(eta)} left`
                    : fmtDuration(durationMs)}
                </span>
              </div>
              {latest.message && (
                <p
                  className={`text-xs mt-0.5 ${
                    latest.level === "warning"
                      ? "text-amber-600"
                      : "text-gray-500"
                  }`}
                >
                  {latest.message}
                </p>
              )}
              {/* Determinate progress bar */}
              {latest.total && latest.total > 0 && (
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-100 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        state === "failed" ? "bg-red-400" : "bg-blue-500"
                      }`}
                      style={{
                        width: `${Math.min(100, ((latest.current ?? 0) / latest.total) * 100)}%`,
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {latest.current ?? 0}/{latest.total}
                  </span>
                </div>
              )}
            </div>
          </li>
        ))}
      </ol>

      {/* Terminal banner */}
      {last && TERMINAL.has(last.phase) && (
        <div
          className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm ${
            last.phase === "failed"
              ? "bg-red-50 text-red-700"
              : last.phase === "skipped"
                ? "bg-amber-50 text-amber-800"
                : "bg-green-50 text-green-700"
          }`}
        >
          {last.phase === "failed" ? (
            <XCircle className="w-4 h-4" />
          ) : last.phase === "skipped" ? (
            <CircleSlash className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4" />
          )}
          <span className="font-medium">{last.message}</span>
        </div>
      )}

      {/* Prominent warnings */}
      {warnings.length > 0 && !showActivity && (
        <div className="space-y-1">
          {warnings.map((w) => (
            <div
              key={w.seq}
              className="flex items-start gap-1.5 text-xs text-amber-700"
            >
              <AlertTriangle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
              <span>{w.message}</span>
            </div>
          ))}
        </div>
      )}

      {/* Collapsible activity log */}
      <div>
        <button
          onClick={() => setShowActivity((v) => !v)}
          className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600"
        >
          <ChevronDown
            className={`w-3 h-3 transition-transform ${showActivity ? "rotate-180" : ""}`}
          />
          {showActivity ? "Hide activity" : `Activity log (${events.length})`}
        </button>
        {showActivity && (
          <div className="mt-1.5 max-h-48 overflow-y-auto rounded border border-gray-100 bg-gray-50 p-2 space-y-0.5 font-mono text-[11px]">
            {events.map((e) => (
              <div
                key={e.seq}
                className={`flex gap-2 ${
                  e.level === "error"
                    ? "text-red-600"
                    : e.level === "warning"
                      ? "text-amber-600"
                      : "text-gray-600"
                }`}
              >
                <span className="text-gray-300 tabular-nums flex-shrink-0">
                  {new Date(e.ts).toLocaleTimeString()}
                </span>
                <span className="text-gray-400 flex-shrink-0">[{e.phase}]</span>
                <span className="min-w-0">{e.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
