"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, useDragControls } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { jsonToCsv } from "@/lib/csvExport";
import { buildFieldDescriptionMap } from "@/lib/schemaDescriptions";
import {
  getByPath,
  setByPath,
  coerceExpected,
  insertAtPath,
  removeAtPath,
  resolveRowAnchor,
  APPLYABLE_ISSUE_TYPES,
  computeBulkApply,
  type BulkOutcome,
} from "@/lib/jsonPath";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  GripVertical,
  Loader2,
  LocateFixed,
  MessageSquare,
  MoreHorizontal,
  X,
  XCircle,
} from "lucide-react";
import {
  App,
  Button,
  Checkbox,
  Dropdown,
  Input,
  Modal,
  Popconfirm,
  Select,
  Splitter,
  Typography,
} from "antd";
import type { MenuProps } from "antd";
import { JsonViewer } from "@/components/json";
import {
  apiClient,
  isV2ResultEnvelope,
  type QAJobScope,
  type QAProgressEvent,
  type SectionResult,
  type SectionVerification,
  type SectionVerificationStatus,
  type V2ResultEnvelope,
} from "@/lib/api";
import type { ViewerResultTab } from "@/lib/jobViewUrlState";
import { useSocket } from "@/hooks/useSocket";

const { TextArea } = Input;
const { Text } = Typography;

/**
 * rehype-raw turns angle-bracket markup in markdown into custom element names.
 * React only accepts known HTML intrinsics; map non-standard tags to spans.
 */
const markdownRehypeRawPassthrough: Record<string, React.ComponentType<any>> = {
  signature: ({ node, ...props }) => (
    <span data-rehype-custom-tag="signature" className="inline" {...props} />
  ),
};

interface TabbedDataViewerProps {
  data: unknown;
  filename: string;
  schema?: unknown;
  className?: string;
  onUpdate?: (updatedData: unknown) => void;
  editable?: boolean;
  markdown?: string;
  actual_result?: any;
  pages?: any; // Pages data from raw_data (array of page objects with markdown and sourceBlocks)
  // Comments props
  comments?: Array<{
    id: string;
    userId: string;
    userEmail: string;
    text: string;
    createdAt: string;
  }>;
  onAddComment?: (text: string) => Promise<void>;
  fileId?: string; // File ID for fetching comments if not provided
  // Job ID — required for live QA progress (the socket room is per-job).
  jobId?: string;
  // Per-section extraction (v2 envelope) metadata. When provided AND `data`
  // is a v2 envelope, the viewer renders a section picker above the existing
  // tab strip and scopes the data-shaped tabs (Preview/JSON/CSV/Edit) to the
  // selected section. Markdown/Compare/Comments stay file-level.
  resultEnvelope?: "v1" | "v2";
  sectionResults?: SectionResult[];
  // Classifier sections — used as fallback for record_id and page_range when
  // section_results is missing (older extractions, extraction-only runs, etc.)
  detectedSections?: {
    sections?: Array<{
      document_type_slug: string;
      record_id?: string | null;
      page_range?: [number, number];
      member_pages?: number[];
      extraction_pages?: number[];
    }>;
  } | null;
  // Per-section verification
  sectionVerifications?: SectionVerification[];
  onSectionVerify?: (
    sectionResultId: string,
    status: SectionVerificationStatus,
    notes?: string,
  ) => Promise<void>;
  onBulkSectionVerify?: (
    sectionResultIds: string[],
    status: SectionVerificationStatus,
  ) => Promise<void>;
  selectedSectionResultId?: string | null;
  onSelectedSectionResultIdChange?: (sectionResultId: string | null) => void;
  activeResultTab?: ViewerResultTab | null;
  onActiveResultTabChange?: (tab: ViewerResultTab) => void;
  // ── QA side-column (3-segment layout) ──────────────────────────────────
  // When the host layout provides a container element, the QA findings /
  // review panel is PORTALED into it (a full-height third column beside the
  // PDF and the result) instead of being stacked under the JSON. All QA
  // state stays here — the host only supplies the slot.
  qaPanelContainer?: HTMLElement | null;
  // Tells the host whether the QA column has content to show (findings exist
  // and the results tab is active) so it can mount/unmount the third pane.
  onQaPanelActiveChange?: (active: boolean) => void;
  /** Scroll the left-hand PDF pane to a 1-based page (file details modal). */
  onNavigateToPdfPage?: (pageNumber: number) => void;
}

// One discoverable "row" in the section picker. We derive these from the
// envelope rather than relying solely on section_results so the viewer keeps
// working even when section_results is missing (older results, etc.).
interface SectionPickerEntry {
  slug: string;
  sectionResultId?: string;
  recordId?: string | null;
  instanceIndex: number; // 0-based index within slug
  globalIndex: number; // unique selection key
  data: Record<string, unknown>;
  fieldCount: number;
  // From section_results (when available) — gives extra context to the user.
  pageRange?: [number | null, number | null];
  /** Explicit page list (member/extraction pages). Preferred over pageRange
   *  for labels: a non-contiguous section's [min, max] span would claim
   *  pages that belong to other sections. */
  pages?: number[];
  status?: string;
}

/** "2–3, 7" from [2,3,7] — collapse contiguous runs for display. */
function formatPagesList(pages: number[]): string {
  const sorted = [...pages].sort((a, b) => a - b);
  const runs: string[] = [];
  let runStart = sorted[0];
  let prev = sorted[0];
  for (const p of sorted.slice(1)) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    runs.push(runStart === prev ? `${runStart}` : `${runStart}–${prev}`);
    runStart = p;
    prev = p;
  }
  runs.push(runStart === prev ? `${runStart}` : `${runStart}–${prev}`);
  return runs.join(", ");
}

function buildSectionPickerEntries(
  envelope: V2ResultEnvelope,
  sectionResults?: SectionResult[],
  detectedSections?: {
    sections?: Array<{
      document_type_slug: string;
      record_id?: string | null;
      page_range?: [number, number];
      member_pages?: number[];
      extraction_pages?: number[];
    }>;
  } | null,
): SectionPickerEntry[] {
  // Walk the envelope first (it's the ground truth for what data exists),
  // then enrich each entry with the matching section_results row when we can.
  // The envelope is keyed by slug; values are arrays in document order. We
  // pair them with the section_results for the same slug, in order.
  const entries: SectionPickerEntry[] = [];
  const sectionsBySlug = new Map<string, SectionResult[]>();
  if (Array.isArray(sectionResults)) {
    for (const s of sectionResults) {
      if (!s || s.status !== "success") continue;
      const arr = sectionsBySlug.get(s.slug) ?? [];
      arr.push(s);
      sectionsBySlug.set(s.slug, arr);
    }
  }

  // Fallback: use detected_sections for record_id and page_range when
  // section_results is missing (older extractions, extraction-only runs).
  // Group by slug in document order to match envelope ordering.
  const detectedBySlug = new Map<
    string,
    Array<{
      record_id?: string | null;
      page_range?: [number, number];
      member_pages?: number[];
      extraction_pages?: number[];
    }>
  >();
  if (detectedSections?.sections) {
    for (const ds of detectedSections.sections) {
      if (!ds.document_type_slug || ds.document_type_slug === "none") continue;
      const arr = detectedBySlug.get(ds.document_type_slug) ?? [];
      arr.push({
        record_id: ds.record_id,
        page_range: ds.page_range,
        member_pages: ds.member_pages,
        extraction_pages: ds.extraction_pages,
      });
      detectedBySlug.set(ds.document_type_slug, arr);
    }
  }

  let globalIndex = 0;
  for (const [slug, instances] of Object.entries(envelope)) {
    if (!Array.isArray(instances)) continue;
    const matching = sectionsBySlug.get(slug) ?? [];
    const detectedMatching = detectedBySlug.get(slug) ?? [];
    instances.forEach((data, instanceIndex) => {
      const sr = matching[instanceIndex];
      const ds = detectedMatching[instanceIndex];
      const dataObj = data as Record<string, unknown>;
      entries.push({
        slug,
        sectionResultId:
          (dataObj?.section_result_id as string) ?? sr?.section_result_id,
        recordId: sr?.record_id ?? ds?.record_id ?? null,
        instanceIndex,
        globalIndex: globalIndex++,
        data: dataObj,
        fieldCount:
          dataObj && typeof dataObj === "object"
            ? Object.keys(dataObj).length
            : 0,
        pageRange: sr?.page_range ?? ds?.page_range,
        pages:
          ds?.member_pages ??
          (Array.isArray(sr?.extraction_pages) && sr.extraction_pages.length > 0
            ? sr.extraction_pages
            : ds?.extraction_pages),
        status: sr?.status,
      });
    });
  }
  return entries;
}

function formatSectionLabel(entry: SectionPickerEntry): string {
  const range = entry.pageRange;
  const pageBit =
    entry.pages && entry.pages.length > 0
      ? `p${formatPagesList(entry.pages)}`
      : range && range[0] != null && range[1] != null
        ? range[0] === range[1]
          ? `p${range[0]}`
          : `p${range[0]}–${range[1]}`
        : null;
  const parts: string[] = [];
  if (entry.recordId) parts.push(entry.recordId);
  parts.push(entry.slug);
  if (pageBit) parts.push(pageBit);
  parts.push(`${entry.fieldCount} field${entry.fieldCount === 1 ? "" : "s"}`);
  return parts.join(" · ");
}

function formatSectionOptionLabel(
  entry: SectionPickerEntry,
  verificationMap?: Map<string, SectionVerification>,
): string {
  const range = entry.pageRange;
  const pageBit =
    entry.pages && entry.pages.length > 0
      ? `p${formatPagesList(entry.pages)}`
      : range && range[0] != null && range[1] != null
        ? range[0] === range[1]
          ? `p${range[0]}`
          : `p${range[0]}–${range[1]}`
        : null;
  const parts: string[] = [];
  if (entry.recordId) parts.push(entry.recordId);
  if (pageBit) parts.push(pageBit);
  parts.push(`${entry.fieldCount} fields`);
  const label = parts.join(" · ");
  const isApproved =
    entry.sectionResultId &&
    verificationMap?.get(entry.sectionResultId)?.status === "approved";
  return isApproved ? `${label} (Approved)` : label;
}

/* ── Verification status helpers ───────────────────────────────── */

const VERIFY_STATUS_CONFIG: Record<
  SectionVerificationStatus,
  { label: string; icon: string; solidBg: string; solidText: string }
> = {
  pending: {
    label: "Pending",
    icon: "○",
    solidBg: "bg-gray-100",
    solidText: "text-gray-500",
  },
  in_review: {
    label: "In Review",
    icon: "◐",
    solidBg: "bg-blue-100",
    solidText: "text-blue-700",
  },
  approved: {
    label: "Approved",
    icon: "✓",
    solidBg: "bg-green-100",
    solidText: "text-green-700",
  },
  rejected: {
    label: "Rejected",
    icon: "✕",
    solidBg: "bg-red-100",
    solidText: "text-red-700",
  },
};

// ── QA Findings Panel ──────────────────────────────────────────────

const SEVERITY_CONFIG = {
  error: {
    icon: "❌",
    bg: "bg-red-50",
    border: "border-red-200",
    text: "text-red-800",
  },
  warning: {
    icon: "⚠️",
    bg: "bg-amber-50",
    border: "border-amber-200",
    text: "text-amber-800",
  },
  info: {
    icon: "ℹ️",
    bg: "bg-blue-50",
    border: "border-blue-200",
    text: "text-blue-800",
  },
} as const;

/** Live state of one section inside a background QA run. */
type QASectionRun = {
  status: "queued" | "running" | "done" | "failed";
  findingsCount?: number;
  message?: string;
};

/** Live state of the background QA run(s) on this file, from qa-progress-event. */
type QARunState = {
  scope: QAJobScope | null;
  sections: Record<string, QASectionRun>;
};

/** Live state of one group inside a directed re-extraction request. */
type ReextractGroupRun = {
  status: "queued" | "running" | "done" | "failed";
  findingsCount?: number;
  message?: string;
};

/** Live state of background re-extraction request(s), keyed by requestId. */
type ReextractRunState = Record<
  string,
  { sectionResultId: string; groups: Record<string, ReextractGroupRun> }
>;

/** State for the in-panel bulk-review mode. Lives in TabbedDataViewer (which
 *  owns editableJson); QAFindingsPanel only renders it. */
type BulkReviewState = {
  findings: import("@/lib/api").QAFinding[];
  outcomes: BulkOutcome[];
  excluded: Set<string>;
  autoAccept: boolean;
  busy: boolean;
};

/**
 * Floating QA progress card (bottom-right, like the job page's processing
 * toast). One row per section in the background run, each with its own
 * status — queued, running (spinner), done (finding count), or failed.
 *
 * Draggable by the header (framer-motion drag controls — already in the
 * bundle; antd has no drag primitive, its docs use react-draggable). Only
 * the header initiates a drag so the section list keeps scrolling normally.
 */
function QAProgressFloat({
  run,
  labelById,
  onDismiss,
}: {
  run: QARunState;
  labelById: Map<string, string>;
  onDismiss: () => void;
}) {
  const dragControls = useDragControls();
  const entries = Object.entries(run.sections);
  if (entries.length === 0) return null;
  const finished = entries.filter(
    ([, s]) => s.status === "done" || s.status === "failed",
  ).length;
  const total = entries.length;
  const allTerminal = finished === total;
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    // z-[1100]: must float above antd's fullscreen Modal (z-index 1000).
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      className="fixed bottom-6 right-6 z-[1100] w-80 max-w-[calc(100vw-3rem)] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 cursor-move select-none touch-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          {!allTerminal && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-700 truncate">
            {allTerminal
              ? "QA finished"
              : `Running QA — ${finished}/${total} section${total === 1 ? "" : "s"}`}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-0.5 text-gray-400 hover:text-gray-700 rounded transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Dismiss QA progress"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${allTerminal ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
        {entries.map(([sid, s]) => (
          <div key={sid} className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex-shrink-0">
              {s.status === "queued" && (
                <Clock className="w-3 h-3 text-gray-400" />
              )}
              {s.status === "running" && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              )}
              {s.status === "done" && (
                <CheckCircle2 className="w-3 h-3 text-green-600" />
              )}
              {s.status === "failed" && (
                <XCircle className="w-3 h-3 text-red-500" />
              )}
            </span>
            <span
              className="flex-1 min-w-0 truncate text-[11px] text-gray-600"
              title={labelById.get(sid) ?? sid}
            >
              {labelById.get(sid) ?? `${sid.substring(0, 8)}…`}
            </span>
            <span className="flex-shrink-0 text-[10px] text-gray-400">
              {s.status === "done"
                ? `${s.findingsCount ?? 0} issue${(s.findingsCount ?? 0) === 1 ? "" : "s"}`
                : s.status === "failed"
                  ? "failed"
                  : s.status === "running"
                    ? "running"
                    : "queued"}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

/**
 * Floating progress card for directed re-extractions — same shell and drag
 * behavior as QAProgressFloat, one row per (section, group). Sits above the
 * QA float so both can show at once.
 */
function ReextractProgressFloat({
  run,
  labelById,
  onDismiss,
}: {
  run: ReextractRunState;
  labelById: Map<string, string>;
  onDismiss: () => void;
}) {
  const dragControls = useDragControls();
  const rows: Array<{ key: string; label: string; s: ReextractGroupRun }> = [];
  for (const [reqId, r] of Object.entries(run)) {
    const sectionLabel =
      labelById.get(r.sectionResultId) ??
      `${r.sectionResultId.substring(0, 8)}…`;
    for (const [group, s] of Object.entries(r.groups)) {
      rows.push({ key: `${reqId}:${group}`, label: `${sectionLabel} · ${group}`, s });
    }
  }
  if (rows.length === 0) return null;
  const finished = rows.filter(
    ({ s }) => s.status === "done" || s.status === "failed",
  ).length;
  const total = rows.length;
  const allTerminal = finished === total;
  const pct = total > 0 ? Math.round((finished / total) * 100) : 0;

  return (
    <motion.div
      drag
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      dragElastic={0}
      className="fixed bottom-24 right-6 z-[1100] w-80 max-w-[calc(100vw-3rem)] bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden"
    >
      <div
        onPointerDown={(e) => dragControls.start(e)}
        className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 cursor-move select-none touch-none"
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
          {!allTerminal && (
            <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 flex-shrink-0" />
          )}
          <span className="text-xs font-medium text-gray-700 truncate">
            {allTerminal
              ? "Group fixes finished"
              : `Fixing groups with AI — ${finished}/${total}`}
          </span>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          onPointerDown={(e) => e.stopPropagation()}
          className="p-0.5 text-gray-400 hover:text-gray-700 rounded transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Dismiss re-extraction progress"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="h-1 bg-gray-100">
        <div
          className={`h-full transition-all duration-500 ${allTerminal ? "bg-green-500" : "bg-blue-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
        {rows.map(({ key, label, s }) => (
          <div key={key} className="flex items-center gap-2 px-3 py-1.5">
            <span className="flex-shrink-0">
              {s.status === "queued" && (
                <Clock className="w-3 h-3 text-gray-400" />
              )}
              {s.status === "running" && (
                <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
              )}
              {s.status === "done" && (
                <CheckCircle2 className="w-3 h-3 text-green-600" />
              )}
              {s.status === "failed" && (
                <XCircle className="w-3 h-3 text-red-500" />
              )}
            </span>
            <span
              className="flex-1 min-w-0 truncate text-[11px] text-gray-600"
              title={label}
            >
              {label}
            </span>
            <span className="flex-shrink-0 text-[10px] text-gray-400">
              {s.status === "done"
                ? `${s.findingsCount ?? 0} fix${(s.findingsCount ?? 0) === 1 ? "" : "es"}`
                : s.status === "failed"
                  ? "failed"
                  : s.status === "running"
                    ? "reading pages"
                    : "queued"}
            </span>
          </div>
        ))}
      </div>
    </motion.div>
  );
}

function QAFindingsPanel({
  findings,
  onUpdate,
  onApply,
  canApply,
  bulkReview,
  onOpenBulkReview,
  onToggleExclude,
  onToggleAutoAccept,
  onConfirmBulkApply,
  onCancelBulkReview,
}: {
  findings: import("@/lib/api").QAFinding[];
  onUpdate: (
    findingId: string,
    status: "accepted" | "dismissed",
  ) => Promise<void>;
  /** Inject this finding's `expected` into the editable JSON (review then Save). */
  onApply: (finding: import("@/lib/api").QAFinding) => void;
  /** Only show "Apply" when the JSON is editable (otherwise it can't be saved). */
  canApply: boolean;
  /** Non-null → the panel flips to review mode (pending changes) in place. */
  bulkReview?: BulkReviewState | null;
  onOpenBulkReview?: () => void;
  onToggleExclude?: (findingId: string) => void;
  onToggleAutoAccept?: () => void;
  onConfirmBulkApply?: () => void;
  onCancelBulkReview?: () => void;
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const open = findings.filter((f) => f.status === "open");
  const resolved = findings.filter((f) => f.status !== "open");
  const [showResolved, setShowResolved] = useState(false);

  // ── Review mode: same panel, flipped to show the pending changes ─────────
  // (one component for both QA list and "Review & apply all" — the PDF and
  // the result stay visible beside it while the reviewer works through it).
  if (bulkReview) {
    const fmt = (v: unknown) =>
      v === undefined
        ? ""
        : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
    const includedCount = bulkReview.findings.length - bulkReview.excluded.size;
    return (
      <div className="h-full bg-white flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 shrink-0">
          <button
            onClick={onCancelBulkReview}
            className="text-gray-400 hover:text-gray-700"
            aria-label="Back to findings"
            title="Back to findings"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
            Review changes
          </span>
          <span className="text-xs text-gray-400">
            {includedCount}/{bulkReview.findings.length} selected
          </span>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-3 py-2 space-y-1.5">
          <p className="text-xs text-gray-500">
            Check each change against the PDF. Untick anything you disagree with
            — nothing is saved until you Save the record.
          </p>
          {bulkReview.outcomes.map((o) => {
            const skipped = o.status === "skipped";
            const checked = !bulkReview.excluded.has(o.findingId);
            return (
              <div
                key={o.findingId}
                className={`flex items-start gap-2 rounded border px-2 py-1.5 text-xs ${skipped ? "border-gray-200 bg-gray-50 opacity-70" : checked ? "border-blue-200 bg-blue-50/40" : "border-gray-200 bg-white"}`}
              >
                <Checkbox
                  className="mt-0.5"
                  disabled={skipped}
                  checked={!skipped && checked}
                  onChange={() => onToggleExclude?.(o.findingId)}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <code className="font-mono font-semibold text-gray-800 break-all">
                      {o.label}
                    </code>
                    <span className="capitalize text-gray-500">
                      {o.issue_type.replace(/_/g, " ")}
                    </span>
                    {o.note && (
                      <span className="text-amber-700">({o.note})</span>
                    )}
                  </div>
                  {(o.before !== undefined || o.after !== undefined) && (
                    <div className="mt-0.5 font-mono break-all text-gray-600 space-y-0.5">
                      {o.before !== undefined && (
                        <div className="line-through decoration-red-400">
                          {fmt(o.before)}
                        </div>
                      )}
                      {o.after !== undefined && (
                        <div className="text-green-700">{fmt(o.after)}</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <div className="border-t border-gray-100 px-3 py-2 space-y-2 shrink-0">
          <Checkbox
            checked={bulkReview.autoAccept}
            onChange={() => onToggleAutoAccept?.()}
          >
            <span className="text-xs">Mark applied findings as accepted</span>
          </Checkbox>
          <div className="flex gap-2">
            <button
              onClick={onCancelBulkReview}
              className="flex-1 text-xs rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 px-2 py-1.5"
            >
              Cancel
            </button>
            <button
              onClick={onConfirmBulkApply}
              disabled={includedCount === 0 || bulkReview.busy}
              className="flex-1 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 px-2 py-1.5"
            >
              {bulkReview.busy
                ? "Applying…"
                : `Apply ${includedCount} change(s)`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  const handleAction = async (
    findingId: string,
    status: "accepted" | "dismissed",
  ) => {
    setUpdating(findingId);
    try {
      await onUpdate(findingId, status);
    } finally {
      setUpdating(null);
    }
  };

  const ROW_ISSUE_TYPES = new Set(["add_row", "update_row", "delete_row"]);

  const renderFinding = (f: import("@/lib/api").QAFinding) => {
    const cfg = SEVERITY_CONFIG[f.severity] ?? SEVERITY_CONFIG.info;
    const isResolved = f.status !== "open";
    const isRowOp = ROW_ISSUE_TYPES.has(f.issue_type);
    const rowOpLabel =
      f.issue_type === "delete_row"
        ? `Delete row ${f.row_index ?? "?"}`
        : f.issue_type === "add_row"
          ? f.row_index != null
            ? `Insert row at ${f.row_index}`
            : "Insert row"
          : f.issue_type === "update_row"
            ? `Replace row ${f.row_index ?? "?"}`
            : "Apply";
    return (
      <div
        key={f.id}
        className={`rounded-md border px-3 py-2 ${cfg.bg} ${cfg.border} ${isResolved ? "opacity-60" : ""}`}
      >
        {!isResolved && (
          <div className="flex gap-1 flex-shrink-0">
            {canApply && APPLYABLE_ISSUE_TYPES.has(f.issue_type) && (
              <>
                {isRowOp ? (
                  <Popconfirm
                    title={rowOpLabel}
                    description={`This changes ${f.field_path}'s row count/order — review the result in the JSON tree before Saving.`}
                    okText={rowOpLabel}
                    cancelText="Cancel"
                    onConfirm={() => onApply(f)}
                  >
                    <button className="text-xs text-blue-700 font-medium hover:underline">
                      {rowOpLabel}
                    </button>
                  </Popconfirm>
                ) : (
                  <button
                    onClick={() => onApply(f)}
                    className="text-xs text-blue-700 font-medium hover:underline"
                    title={`Set ${f.field_path} = ${
                      f.issue_type === "extra_value"
                        ? "null"
                        : f.corrected_value !== undefined
                          ? JSON.stringify(f.corrected_value)
                          : (f.expected ?? "null")
                    }`}
                  >
                    Apply
                  </button>
                )}
                <span className="text-gray-300">|</span>
              </>
            )}
            <button
              disabled={updating === f.id}
              onClick={() => handleAction(f.id, "accepted")}
              className="text-xs text-green-700 hover:underline disabled:opacity-50"
            >
              Accept
            </button>
            <span className="text-gray-300">|</span>
            <button
              disabled={updating === f.id}
              onClick={() => handleAction(f.id, "dismissed")}
              className="text-xs text-gray-500 hover:underline disabled:opacity-50"
            >
              Dismiss
            </button>
          </div>
        )}
        {isResolved && (
          <span
            className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${f.status === "accepted" ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}
          >
            {f.status}
          </span>
        )}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span>{cfg.icon}</span>
              <code className="text-xs font-mono font-semibold text-gray-800 break-all">
                {f.field_path}
              </code>
              <span className={`text-xs ${cfg.text} capitalize`}>
                {f.issue_type.replace(/_/g, " ")}
              </span>
            </div>
            {(f.expected || f.actual || f.corrected_value !== undefined) && (
              <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                {f.expected && (
                  <div>
                    <span className="font-medium">Expected:</span> {f.expected}
                  </div>
                )}
                {f.actual && !isRowOp && (
                  <div>
                    <span className="font-medium">Actual:</span> {f.actual}
                  </div>
                )}
                {f.corrected_value !== undefined &&
                  f.corrected_value !== null && (
                    <div>
                      <span className="font-medium">Correction:</span>{" "}
                      {JSON.stringify(f.corrected_value)}
                    </div>
                  )}
              </div>
            )}
            {isRowOp && f.actual && (
              <div className="mt-1">
                <span className="text-xs font-medium text-gray-600">
                  {f.issue_type === "delete_row"
                    ? "Row to remove:"
                    : "Current row:"}
                </span>
                <pre className="mt-0.5 text-xs bg-white/60 border border-gray-200 rounded px-2 py-1 overflow-x-auto max-w-full">
                  {(() => {
                    try {
                      return JSON.stringify(JSON.parse(f.actual), null, 2);
                    } catch {
                      return f.actual;
                    }
                  })()}
                </pre>
              </div>
            )}
            {isRowOp && f.row_value && (
              <div className="mt-1">
                <span className="text-xs font-medium text-gray-600">
                  Proposed row:
                </span>
                <pre className="mt-0.5 text-xs bg-white/60 border border-gray-200 rounded px-2 py-1 overflow-x-auto max-w-full">
                  {JSON.stringify(f.row_value, null, 2)}
                </pre>
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 italic">{f.explanation}</p>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full bg-white px-3 py-2 space-y-2 overflow-y-auto">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
          QA Findings{" "}
          {open.length > 0 && (
            <span className="text-red-600 ml-1">({open.length} open)</span>
          )}
        </span>
        {resolved.length > 0 && (
          <button
            onClick={() => setShowResolved((v) => !v)}
            className="text-xs text-gray-400 hover:text-gray-600"
          >
            {showResolved
              ? "Hide resolved"
              : `Show resolved (${resolved.length})`}
          </button>
        )}
      </div>
      {open.length === 0 && (
        <p className="text-xs text-gray-400 italic">
          No open issues — all clear ✅
        </p>
      )}
      {canApply &&
        onOpenBulkReview &&
        open.filter((f) => APPLYABLE_ISSUE_TYPES.has(f.issue_type)).length >=
          2 && (
          <button
            onClick={onOpenBulkReview}
            className="w-full text-xs font-medium rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 px-2 py-1.5"
          >
            Review &amp; apply all (
            {open.filter((f) => APPLYABLE_ISSUE_TYPES.has(f.issue_type)).length}
            )
          </button>
        )}
      <div className="space-y-1.5">
        {open.map(renderFinding)}
        {showResolved && resolved.map(renderFinding)}
      </div>
    </div>
  );
}

function SectionVerifyControls({
  verification,
  loading,
  onVerify,
  totalSections,
  verificationMap,
  sectionEntries,
  approveShortcutLabel,
}: {
  verification: SectionVerification | null;
  loading: boolean;
  onVerify: (status: SectionVerificationStatus) => void;
  totalSections: number;
  verificationMap: Map<string, SectionVerification>;
  sectionEntries: SectionPickerEntry[];
  approveShortcutLabel?: string;
}) {
  const currentStatus = verification?.status ?? "pending";
  const cfg = VERIFY_STATUS_CONFIG[currentStatus];

  // Count approved / total for progress (bulk approve now lives in the ⋯ menu)
  const approvedCount = sectionEntries.filter(
    (e) =>
      e.sectionResultId &&
      verificationMap.get(e.sectionResultId)?.status === "approved",
  ).length;

  return (
    <div className="flex items-center gap-2">
      {/* ── Status badge (non-interactive, solid pill) ── */}
      <span
        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold select-none ${cfg.solidBg} ${cfg.solidText}`}
      >
        <span className="text-[9px] leading-none">{cfg.icon}</span>
        {cfg.label}
      </span>

      {/* Progress: 3/28 approved */}
      <span className="text-[10px] text-gray-400 tabular-nums whitespace-nowrap">
        {approvedCount}/{totalSections} approved
      </span>

      {/* ── Actions (visually grouped, text-style links) ── */}
      <span className="w-px h-4 bg-gray-200" />
      <div className="flex items-center gap-0.5">
        {currentStatus !== "approved" && (
          <Popconfirm
            title="Approve this section?"
            description="Mark this section as approved for review."
            okText="Approve"
            cancelText="Cancel"
            disabled={loading}
            onConfirm={() => onVerify("approved")}
          >
            <span className="inline-flex">
              <button
                type="button"
                disabled={loading}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title={
                  approveShortcutLabel
                    ? `Approve this section (${approveShortcutLabel})`
                    : "Approve this section"
                }
              >
                Approve
                {approveShortcutLabel && (
                  <span className="ml-1 text-gray-400 tabular-nums">
                    {approveShortcutLabel}
                  </span>
                )}
              </button>
            </span>
          </Popconfirm>
        )}
        {currentStatus !== "rejected" && (
          <Popconfirm
            title="Reject this section?"
            description="Mark this section as rejected."
            okText="Reject"
            cancelText="Cancel"
            okButtonProps={{ danger: true }}
            disabled={loading}
            onConfirm={() => onVerify("rejected")}
          >
            <span className="inline-flex">
              <button
                type="button"
                disabled={loading}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Reject this section"
              >
                Reject
              </button>
            </span>
          </Popconfirm>
        )}
        {currentStatus !== "pending" && (
          <Popconfirm
            title="Reset verification?"
            description="This section will return to pending status."
            okText="Reset"
            cancelText="Cancel"
            disabled={loading}
            onConfirm={() => onVerify("pending")}
          >
            <span className="inline-flex">
              <button
                type="button"
                disabled={loading}
                className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                title="Reset to pending"
              >
                Reset
              </button>
            </span>
          </Popconfirm>
        )}
      </div>
    </div>
  );
}

type TabType = "results" | "markdown" | "compare" | "comments";
type MarkdownViewType = "full" | "pages" | "chunks";

const TabbedDataViewer: React.FC<TabbedDataViewerProps> = ({
  data,
  filename,
  schema,
  className = "",
  onUpdate,
  editable = false,
  markdown,
  actual_result,
  pages,
  comments = [],
  onAddComment,
  fileId,
  jobId,
  resultEnvelope,
  sectionResults,
  detectedSections,
  sectionVerifications,
  onSectionVerify,
  onBulkSectionVerify,
  selectedSectionResultId = null,
  onSelectedSectionResultIdChange,
  activeResultTab = null,
  onActiveResultTabChange,
  qaPanelContainer = null,
  onQaPanelActiveChange,
  onNavigateToPdfPage,
}) => {
  const { message, modal } = App.useApp();
  const [fallbackTab, setFallbackTab] = useState<TabType>("results");
  const [markdownView, setMarkdownView] = useState<MarkdownViewType>("full");
  const [editableJson, setEditableJson] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [fallbackSectionIdx, setFallbackSectionIdx] = useState<number>(0);

  // Per-section (v2 envelope) detection. The picker only renders when both
  // (a) the data shape matches and (b) there's at least one section to pick.
  // When v1 (or empty), we behave exactly as before.
  const isV2 = useMemo(
    () =>
      isV2ResultEnvelope(data, {
        result_envelope: resultEnvelope,
        section_results: sectionResults,
      }),
    [data, resultEnvelope, sectionResults],
  );
  const sectionEntries = useMemo<SectionPickerEntry[]>(
    () =>
      isV2
        ? buildSectionPickerEntries(
            data as V2ResultEnvelope,
            sectionResults,
            detectedSections,
          )
        : [],
    [isV2, data, sectionResults, detectedSections],
  );

  const sectionIdxFromUrl = useMemo(() => {
    if (!selectedSectionResultId) return null;
    const idx = sectionEntries.findIndex(
      (entry) => entry.sectionResultId === selectedSectionResultId,
    );
    return idx >= 0 ? idx : null;
  }, [selectedSectionResultId, sectionEntries]);

  const selectedSectionIdx = sectionIdxFromUrl ?? fallbackSectionIdx;

  const activeTab = useMemo(() => {
    const wanted = activeResultTab ?? fallbackTab;
    if (wanted === "markdown" && !markdown) return "results" as TabType;
    if (wanted === "compare" && !actual_result) return "results" as TabType;
    if (wanted === "comments" && !(comments.length > 0 || onAddComment)) {
      return "results" as TabType;
    }
    return wanted as TabType;
  }, [
    activeResultTab,
    fallbackTab,
    markdown,
    actual_result,
    comments.length,
    onAddComment,
  ]);

  const selectSectionIdx = useCallback(
    (idx: number) => {
      setFallbackSectionIdx(idx);
      const id = sectionEntries[idx]?.sectionResultId ?? null;
      onSelectedSectionResultIdChange?.(id);
    },
    [sectionEntries, onSelectedSectionResultIdChange],
  );

  useEffect(() => {
    if (sectionEntries.length <= 1) return;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true;
      }
      if (target.isContentEditable) return true;
      if (target.closest(".cm-editor")) return true;
      if (target.closest(".ant-select-dropdown")) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      if (isTypingTarget(e.target)) return;

      if (e.key === "ArrowLeft" && selectedSectionIdx > 0) {
        e.preventDefault();
        selectSectionIdx(selectedSectionIdx - 1);
      } else if (
        e.key === "ArrowRight" &&
        selectedSectionIdx < sectionEntries.length - 1
      ) {
        e.preventDefault();
        selectSectionIdx(selectedSectionIdx + 1);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [sectionEntries.length, selectedSectionIdx, selectSectionIdx]);

  const setResultTab = useCallback(
    (tab: TabType) => {
      setFallbackTab(tab);
      onActiveResultTabChange?.(tab);
    },
    [onActiveResultTabChange],
  );

  useEffect(() => {
    if (!selectedSectionResultId || sectionEntries.length === 0) return;
    if (sectionIdxFromUrl === null) {
      const firstId = sectionEntries[0]?.sectionResultId ?? null;
      onSelectedSectionResultIdChange?.(firstId);
    }
  }, [
    fileId,
    sectionEntries,
    selectedSectionResultId,
    sectionIdxFromUrl,
    onSelectedSectionResultIdChange,
  ]);

  useEffect(() => {
    if (!activeResultTab) return;
    if (activeTab !== activeResultTab) {
      onActiveResultTabChange?.(activeTab);
    }
  }, [fileId, activeResultTab, activeTab, onActiveResultTabChange]);

  const selectedSection =
    sectionEntries[selectedSectionIdx] ?? sectionEntries[0];

  // First page of the selected section — used by the "scroll PDF" control.
  const selectedSectionPage =
    selectedSection?.pages?.[0] ??
    (typeof selectedSection?.pageRange?.[0] === "number"
      ? selectedSection.pageRange[0]
      : null);

  // Build a lookup map: section_result_id → verification row
  const verificationMap = useMemo(() => {
    const m = new Map<string, SectionVerification>();
    if (sectionVerifications) {
      for (const sv of sectionVerifications) {
        m.set(sv.section_result_id, sv);
      }
    }
    return m;
  }, [sectionVerifications]);

  const selectedVerification = selectedSection?.sectionResultId
    ? (verificationMap.get(selectedSection.sectionResultId) ?? null)
    : null;

  const [verifyLoading, setVerifyLoading] = useState(false);

  // ── Field descriptions (hover hints in the JSON tree) ──────────────
  // Fetch the active schema for the selected section's slug, flatten it to a
  // path→description map, cache per slug. Falls back gracefully when there's no
  // slug (v1) or the schema can't be loaded.
  const schemaDescCacheRef = React.useRef<
    Record<string, Record<string, string>>
  >({});
  const [fieldDescriptions, setFieldDescriptions] = useState<
    Record<string, string>
  >({});
  const descSlug = selectedSection?.slug ?? null;
  useEffect(() => {
    if (!descSlug) {
      setFieldDescriptions({});
      return;
    }
    const cached = schemaDescCacheRef.current[descSlug];
    if (cached) {
      setFieldDescriptions(cached);
      return;
    }
    let cancelled = false;
    apiClient
      .getDocumentTypeSchema(descSlug)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "success" && res.json_schema) {
          const map = buildFieldDescriptionMap(res.json_schema);
          schemaDescCacheRef.current[descSlug] = map;
          setFieldDescriptions(map);
        } else {
          setFieldDescriptions({});
        }
      })
      .catch(() => {
        if (!cancelled) setFieldDescriptions({});
      });
    return () => {
      cancelled = true;
    };
  }, [descSlug]);

  const handleVerify = useCallback(
    async (status: SectionVerificationStatus) => {
      if (!selectedSection?.sectionResultId || !onSectionVerify) return;
      setVerifyLoading(true);
      try {
        await onSectionVerify(selectedSection.sectionResultId, status);
        message.success(`Section marked as ${status}`);
      } catch {
        message.error("Failed to update verification");
      } finally {
        setVerifyLoading(false);
      }
    },
    [selectedSection?.sectionResultId, onSectionVerify, message],
  );

  // ⌘⇧↵ / Ctrl+Shift+Enter — approve current section without the click confirm.
  // Chosen over Alt+A: Option+A inserts å on Mac, and Alt+letter hits Windows
  // menu mnemonics. Pairs with ⌘↵ save; that handler already ignores Shift.
  useEffect(() => {
    if (!onSectionVerify) return;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        return true;
      }
      if (target.isContentEditable) return true;
      if (target.closest(".cm-editor")) return true;
      if (target.closest(".ant-select-dropdown")) return true;
      return false;
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey) || !e.shiftKey) return;
      if (e.key !== "Enter") return;
      if (e.altKey) return;
      if (isTypingTarget(e.target)) return;
      if (verifyLoading) return;
      if (!selectedSection?.sectionResultId) return;
      if (selectedVerification?.status === "approved") return;

      e.preventDefault();
      void handleVerify("approved");
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    onSectionVerify,
    verifyLoading,
    selectedSection?.sectionResultId,
    selectedVerification?.status,
    handleVerify,
  ]);

  const approveShortcutLabel = useMemo(() => {
    if (typeof navigator === "undefined") return "Ctrl+Shift+↵";
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform)
      ? "⌘⇧↵"
      : "Ctrl+Shift+↵";
  }, []);

  const handleBulkVerify = useCallback(
    async (status: SectionVerificationStatus) => {
      if (!onBulkSectionVerify) return;
      // Only touch sections not already in the target status, so "Approve
      // remaining" acts on exactly the sections that still need it.
      const ids = sectionEntries
        .map((e) => e.sectionResultId)
        .filter((id): id is string => !!id)
        .filter((id) => verificationMap.get(id)?.status !== status);
      if (ids.length === 0) return;
      setVerifyLoading(true);
      try {
        await onBulkSectionVerify(ids, status);
        message.success(
          `${ids.length} section${ids.length === 1 ? "" : "s"} marked as ${status}`,
        );
      } catch {
        message.error("Failed to bulk update");
      } finally {
        setVerifyLoading(false);
      }
    },
    [sectionEntries, onBulkSectionVerify, verificationMap, message],
  );

  // ── QA state ──────────────────────────────────────────────────────
  // Findings are loaded per-file on mount, then refreshed after a QA run.
  const [qaFindings, setQaFindings] = useState<
    Record<string, import("@/lib/api").QAFinding[]>
  >({});
  // QA runs are queued to the worker; this only tracks the (fast) enqueue
  // request. Live run state comes from `qaRun` below via qa-progress-event.
  const [qaLoading, setQaLoading] = useState<"idle" | "section" | "all">(
    "idle",
  );
  // Per-section live run state, keyed by section_result_id. Sections from
  // concurrent jobs (e.g. two single-section runs) merge into one map, so
  // every section's indicator is independent.
  const [qaRun, setQaRun] = useState<QARunState | null>(null);
  // Active jobs found on mount (client reloaded mid-run) — hydrated into
  // qaRun once section ids are known.
  const [activeQaSnapshot, setActiveQaSnapshot] = useState<{
    jobs: import("@/lib/api").ActiveQAJob[];
    qaedIds: string[];
  } | null>(null);
  // Sections QA'd during this session. A clean pass persists no findings, so it
  // can't be inferred from qaFindings alone — we track it here so the buttons
  // still reflect that QA ran.
  const [sessionQaedIds, setSessionQaedIds] = useState<Set<string>>(
    () => new Set(),
  );

  // ── Single-section reprocess (mirror of the file reprocess modal) ──
  const [reprocessOpen, setReprocessOpen] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [reprocessOpts, setReprocessOpts] = useState({
    reExtractText: true,
    reProcessAi: true,
  });

  // ── Directed group re-extraction ──────────────────────────────────
  // Vision repair for up to 3 groups of the selected section: re-reads the
  // page images (optionally steered by an operator note) and stages the
  // differences as QA findings for review — never overwrites data directly.
  // Queued: the POST returns 202; findings arrive per group over
  // `reextract-progress-event`.
  const [reextractOpen, setReextractOpen] = useState(false);
  const [reextractLoading, setReextractLoading] = useState(false);
  const [reextractGroups, setReextractGroups] = useState<string[]>([]);
  const [reextractMode, setReextractMode] =
    useState<import("@/lib/api").ReextractMode>("auto");
  const [reextractPrompt, setReextractPrompt] = useState("");
  const [reextractPages, setReextractPages] = useState<number[]>([]);
  // In-flight requests by sectionResultId → group names (drives the busy
  // hint + double-submit guard; server-side dedupe is the authority).
  const [pendingReextractions, setPendingReextractions] = useState<
    Record<string, string[]>
  >({});
  // Live per-group progress (drives the floating tracker, mirroring qaRun).
  const [reextractRun, setReextractRun] = useState<ReextractRunState | null>(
    null,
  );
  // Which section the modal's form was last seeded for. Closing the modal
  // never clears the form — reopening on the same section restores it, so
  // an operator can close it to check the PDF and come back.
  const [reextractFormSection, setReextractFormSection] = useState<
    string | null
  >(null);
  // "What's wrong?" suggestions mined from past requests, cached per slug.
  const [promptSuggestions, setPromptSuggestions] = useState<
    import("@/lib/api").ReextractPromptSuggestion[]
  >([]);
  const promptSuggCacheRef = React.useRef<
    Record<string, import("@/lib/api").ReextractPromptSuggestion[]>
  >({});
  // Drag controls for the (non-blocking, draggable) re-extraction modal.
  const reextractDragControls = useDragControls();

  const MAX_REEXTRACT_GROUPS = 3;
  const MAX_REEXTRACT_PAGES = 4;

  // Group options = the record's top-level keys (strict extraction emits
  // every schema group, so this matches the schema's group list).
  const reextractGroupOptions = useMemo(() => {
    const data = selectedSection?.data;
    if (!data || typeof data !== "object") return [];
    return Object.keys(data)
      .filter((k) => k !== "section_result_id")
      .map((k) => ({ value: k, label: k }));
  }, [selectedSection?.data]);

  // The section's extraction pages — suggested (and pre-selected) in the
  // page picker. section_results first; detected_sections as fallback (its
  // rows carry extraction_pages and, in real data, section_result_id — the
  // prop type just doesn't declare the id).
  const reextractSectionPages = useMemo(() => {
    const sid = selectedSection?.sectionResultId;
    if (!sid) return [];
    const fromResults = Array.isArray(sectionResults)
      ? sectionResults.find((s) => s.section_result_id === sid)
          ?.extraction_pages
      : undefined;
    if (Array.isArray(fromResults) && fromResults.length > 0) {
      return fromResults;
    }
    const ds = detectedSections?.sections?.find(
      (s) =>
        (s as { section_result_id?: string }).section_result_id === sid,
    );
    return Array.isArray(ds?.extraction_pages) ? ds.extraction_pages : [];
  }, [sectionResults, detectedSections, selectedSection?.sectionResultId]);

  // Fetch operator-note suggestions when the modal opens (cached per slug).
  useEffect(() => {
    const slug = selectedSection?.slug;
    if (!reextractOpen || !slug) return;
    const cached = promptSuggCacheRef.current[slug];
    if (cached) {
      setPromptSuggestions(cached);
      return;
    }
    let cancelled = false;
    apiClient
      .getReextractPromptSuggestions(slug)
      .then((res) => {
        if (cancelled || res.status !== "success") return;
        const prompts = res.prompts ?? [];
        promptSuggCacheRef.current[slug] = prompts;
        setPromptSuggestions(prompts);
      })
      .catch(() => {
        if (!cancelled) setPromptSuggestions([]);
      });
    return () => {
      cancelled = true;
    };
  }, [reextractOpen, selectedSection?.slug]);

  // ── Per-section markdown scope ("This section" vs "Whole file") ──
  const [markdownScope, setMarkdownScope] = useState<"section" | "file">(
    "section",
  );
  const [sectionMarkdownLoading, setSectionMarkdownLoading] = useState(false);
  // Cache section markdown by sectionResultId so toggling/navigating is instant.
  const [sectionMarkdownCache, setSectionMarkdownCache] = useState<
    Record<
      string,
      { markdown: string; pages: { page_number: number; markdown: string }[] }
    >
  >({});
  // Sections with a persisted QA-run record (from the backend, incl. clean
  // passes). Makes "Re-run QA" / "Run remaining" correct across reloads.
  const [persistedQaedIds, setPersistedQaedIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Load existing findings + run records when the component mounts or fileId changes
  useEffect(() => {
    if (!fileId) return;
    apiClient
      .getQAFindings(fileId)
      .then((res) => {
        if (res.status === "success" && res.findings) {
          setQaFindings(res.findings);
        }
        if (res.status === "success" && res.qaRuns) {
          setPersistedQaedIds(new Set(Object.keys(res.qaRuns)));
        }
        // QA job(s) queued/running right now (page loaded mid-run) —
        // restore the indicators. Resolved into qaRun by a later effect
        // once the section list is known.
        if (res.status === "success" && res.activeQa?.length) {
          setActiveQaSnapshot({
            jobs: res.activeQa,
            qaedIds: Object.keys(res.qaRuns ?? {}),
          });
        }
        // Directed re-extractions queued/running right now (page loaded
        // mid-run) — restore the busy hints and the floating tracker.
        if (res.status === "success") {
          const pending: Record<string, string[]> = {};
          const run: ReextractRunState = {};
          for (const r of res.activeReextractions ?? []) {
            pending[r.section_result_id] = [
              ...(pending[r.section_result_id] ?? []),
              ...r.groups,
            ];
            run[r.id] = {
              sectionResultId: r.section_result_id,
              groups: Object.fromEntries(
                r.groups.map((g: string) => [
                  g,
                  {
                    status:
                      r.status === "processing"
                        ? ("running" as const)
                        : ("queued" as const),
                  },
                ]),
              ),
            };
          }
          setPendingReextractions(pending);
          setReextractRun(Object.keys(run).length > 0 ? run : null);
        }
      })
      .catch(() => {
        /* non-fatal */
      });
  }, [fileId]);

  // Findings for the currently selected section
  const selectedSectionFindings = useMemo(() => {
    if (!selectedSection?.sectionResultId) return [];
    return qaFindings[selectedSection.sectionResultId] ?? [];
  }, [qaFindings, selectedSection?.sectionResultId]);

  const openFindingsCount = useMemo(
    () => selectedSectionFindings.filter((f) => f.status === "open").length,
    [selectedSectionFindings],
  );

  // A section counts as "QA'd" if it has persisted findings or was QA'd this
  // session. Drives "Run QA" → "Re-run QA" and "Run all" → "Run remaining".
  const qaedSectionIds = useMemo(() => {
    const ids = new Set([...persistedQaedIds, ...sessionQaedIds]);
    for (const [sid, findings] of Object.entries(qaFindings)) {
      if (findings && findings.length > 0) ids.add(sid);
    }
    return ids;
  }, [qaFindings, sessionQaedIds, persistedQaedIds]);

  const allSectionIds = useMemo(
    () =>
      sectionEntries
        .map((e) => e.sectionResultId)
        .filter((id): id is string => !!id),
    [sectionEntries],
  );
  // Hydrate qaRun from jobs that were already queued/running when the page
  // loaded. Whole-file jobs don't carry a section list in the queue row, so
  // approximate: all sections (scope=all) or the not-yet-QA'd ones
  // (scope=remaining). Live qa-progress-events correct this as they arrive.
  useEffect(() => {
    if (!activeQaSnapshot || allSectionIds.length === 0) return;
    const { jobs, qaedIds } = activeQaSnapshot;
    const qaed = new Set(qaedIds);
    const sections: Record<string, QASectionRun> = {};
    let scope: QAJobScope | null = null;
    for (const job of jobs) {
      scope = job.scope;
      const ids =
        job.scope === "section" && job.sectionResultId
          ? [job.sectionResultId]
          : job.scope === "remaining"
            ? allSectionIds.filter((id) => !qaed.has(id))
            : allSectionIds;
      for (const id of ids) {
        sections[id] = {
          status: job.status === "processing" ? "running" : "queued",
        };
      }
    }
    if (Object.keys(sections).length > 0) {
      setQaRun((prev) => ({
        scope: prev?.scope ?? scope,
        sections: { ...sections, ...prev?.sections },
      }));
    }
    setActiveQaSnapshot(null);
  }, [activeQaSnapshot, allSectionIds]);

  // Live QA progress. The socket room is per-job, so events for other files
  // in the same job arrive too — filter by fileId.
  useSocket(jobId, {
    onQAProgressEvent: (evt: QAProgressEvent) => {
      if (!fileId || evt.fileId !== fileId) return;
      switch (evt.status) {
        case "queued":
        case "started": {
          const ids = evt.sectionResultIds ?? [];
          if (!ids.length) return;
          setQaRun((prev) => ({
            scope: evt.scope ?? prev?.scope ?? null,
            sections: {
              ...prev?.sections,
              ...Object.fromEntries(
                ids.map((id) => [id, { status: "queued" as const }]),
              ),
            },
          }));
          break;
        }
        case "section_start": {
          if (!evt.sectionResultId) return;
          const id = evt.sectionResultId;
          setQaRun((prev) => ({
            scope: prev?.scope ?? evt.scope ?? null,
            sections: {
              ...prev?.sections,
              [id]: { status: "running" },
            },
          }));
          break;
        }
        case "section_done": {
          if (!evt.sectionResultId) return;
          const id = evt.sectionResultId;
          setQaRun((prev) => ({
            scope: prev?.scope ?? evt.scope ?? null,
            sections: {
              ...prev?.sections,
              [id]: { status: "done", findingsCount: evt.findingsCount ?? 0 },
            },
          }));
          setQaFindings((prev) => ({ ...prev, [id]: evt.findings ?? [] }));
          setSessionQaedIds((prev) => {
            const next = new Set(prev);
            next.add(id);
            return next;
          });
          break;
        }
        case "section_failed": {
          if (!evt.sectionResultId) return;
          const id = evt.sectionResultId;
          setQaRun((prev) => ({
            scope: prev?.scope ?? evt.scope ?? null,
            sections: {
              ...prev?.sections,
              [id]: { status: "failed", message: evt.message },
            },
          }));
          break;
        }
        case "done": {
          // Job finished — reload findings + run records (authoritative).
          apiClient
            .getQAFindings(fileId)
            .then((r) => {
              if (r.status === "success") {
                if (r.findings) setQaFindings(r.findings);
                if (r.qaRuns)
                  setPersistedQaedIds(new Set(Object.keys(r.qaRuns)));
              }
            })
            .catch(() => {});
          const total = evt.totalFindings ?? 0;
          const across = evt.totalSections ?? 0;
          const failed = evt.failedSections ?? 0;
          if (across > 0) {
            message.success(
              `QA complete — ${total} issue${total === 1 ? "" : "s"} found across ${across} section${across === 1 ? "" : "s"}` +
                (failed > 0 ? ` (${failed} failed)` : ""),
            );
          }
          break;
        }
        case "failed": {
          // Fatal job failure: mark everything still pending as failed.
          setQaRun((prev) => {
            if (!prev) return prev;
            const sections = { ...prev.sections };
            for (const [id, s] of Object.entries(sections)) {
              if (s.status === "queued" || s.status === "running") {
                sections[id] = { status: "failed", message: evt.message };
              }
            }
            return { ...prev, sections };
          });
          message.error(evt.message || "QA run failed");
          break;
        }
      }
    },
    onReextractProgressEvent: (evt: import("@/lib/api").ReextractProgressEvent) => {
      if (!fileId || evt.fileId !== fileId) return;
      const sid = evt.sectionResultId;
      // Upsert this request's per-group status in the floating tracker.
      const setGroupStatuses = (
        status: ReextractGroupRun["status"],
        onlyGroup?: string,
        extra?: Partial<ReextractGroupRun>,
      ) =>
        setReextractRun((prev) => {
          const req = prev?.[evt.requestId] ?? {
            sectionResultId: sid,
            groups: Object.fromEntries(
              evt.groups.map((g) => [g, { status: "queued" as const }]),
            ),
          };
          const groups = { ...req.groups };
          for (const g of onlyGroup ? [onlyGroup] : evt.groups) {
            // A terminal per-group state never regresses (the job-level
            // `done` sweep must not overwrite a group's `failed`).
            const cur = groups[g]?.status;
            if (
              !onlyGroup &&
              (cur === "done" || cur === "failed") &&
              status !== "failed"
            ) {
              continue;
            }
            groups[g] = { ...groups[g], status, ...extra };
          }
          return { ...prev, [evt.requestId]: { ...req, groups } };
        });
      switch (evt.status) {
        case "queued":
        case "started": {
          setGroupStatuses(evt.status === "queued" ? "queued" : "running");
          setPendingReextractions((prev) => ({
            ...prev,
            [sid]: [...new Set([...(prev[sid] ?? []), ...evt.groups])],
          }));
          break;
        }
        case "group_done": {
          const group = evt.group;
          if (!group) return;
          setGroupStatuses(
            evt.message ? "failed" : "done",
            group,
            evt.message
              ? { message: evt.message }
              : { findingsCount: evt.findingsCount ?? 0 },
          );
          // The server replaced this group's open findings — mirror that.
          const staged = evt.findings ?? [];
          setQaFindings((prev) => {
            const list = prev[sid] ?? [];
            const inGroup = (p: string) =>
              p === group ||
              p.startsWith(`${group}.`) ||
              p.startsWith(`${group}[`);
            const kept = list.filter(
              (f) => !(f.status === "open" && inGroup(f.field_path)),
            );
            return { ...prev, [sid]: [...staged, ...kept] };
          });
          if (evt.message) {
            message.warning(`Re-extraction of "${group}" failed: ${evt.message}`);
          }
          break;
        }
        case "done": {
          // Sweep any group the per-group events missed into a terminal
          // state (failedGroups → failed, the rest → done).
          for (const g of evt.failedGroups ?? []) {
            setGroupStatuses("failed", g);
          }
          setGroupStatuses("done");
          setPendingReextractions((prev) => {
            const next = { ...prev };
            const remaining = (next[sid] ?? []).filter(
              (g) => !evt.groups.includes(g),
            );
            if (remaining.length) next[sid] = remaining;
            else delete next[sid];
            return next;
          });
          const total = evt.totalFindings ?? 0;
          const failed = evt.failedGroups ?? [];
          message.success(
            total === 0 && failed.length === 0
              ? `Re-read ${evt.groups.map((g) => `"${g}"`).join(", ")} — already matches the page`
              : `${total} suggested fix${total === 1 ? "" : "es"} staged for ${evt.groups.map((g) => `"${g}"`).join(", ")} — review in the QA panel` +
                  (failed.length ? ` (${failed.join(", ")} failed)` : ""),
          );
          break;
        }
        case "failed": {
          setGroupStatuses("failed", undefined, { message: evt.message });
          setPendingReextractions((prev) => {
            const next = { ...prev };
            const remaining = (next[sid] ?? []).filter(
              (g) => !evt.groups.includes(g),
            );
            if (remaining.length) next[sid] = remaining;
            else delete next[sid];
            return next;
          });
          message.error(evt.message || "Directed re-extraction failed");
          break;
        }
      }
    },
  });

  // Auto-dismiss the floating re-extraction tracker once every group is
  // terminal — same pattern as the QA float below.
  useEffect(() => {
    if (!reextractRun) return;
    const states = Object.values(reextractRun).flatMap((r) =>
      Object.values(r.groups),
    );
    const allTerminal =
      states.length > 0 &&
      states.every((s) => s.status === "done" || s.status === "failed");
    if (!allTerminal) return;
    const t = setTimeout(() => setReextractRun(null), 6000);
    return () => clearTimeout(t);
  }, [reextractRun]);

  // Labels for the floating QA progress rows.
  const qaSectionLabelById = useMemo(() => {
    const m = new Map<string, string>();
    for (const e of sectionEntries) {
      if (e.sectionResultId) m.set(e.sectionResultId, formatSectionLabel(e));
    }
    return m;
  }, [sectionEntries]);

  // Auto-dismiss the floating QA panel a few seconds after everything is
  // terminal (done/failed) — leaves time to read the outcome.
  useEffect(() => {
    if (!qaRun) return;
    const states = Object.values(qaRun.sections);
    const allTerminal =
      states.length > 0 &&
      states.every((s) => s.status === "done" || s.status === "failed");
    if (!allTerminal) return;
    const t = setTimeout(() => setQaRun(null), 5000);
    return () => clearTimeout(t);
  }, [qaRun]);

  // Clear live QA state when switching files.
  useEffect(() => {
    setQaRun(null);
  }, [fileId]);

  const qaedCount = useMemo(
    () => allSectionIds.filter((id) => qaedSectionIds.has(id)).length,
    [allSectionIds, qaedSectionIds],
  );
  const remainingQaCount = allSectionIds.length - qaedCount;
  const someQaed = qaedCount > 0;
  const allQaed = allSectionIds.length > 0 && remainingQaCount === 0;

  const selectedSectionQaed =
    !!selectedSection?.sectionResultId &&
    qaedSectionIds.has(selectedSection.sectionResultId);
  const sectionQaBase = selectedSectionQaed ? "Re-run QA" : "Run QA";

  // Live per-section run status (unique per section — other sections stay
  // actionable while one runs in the background).
  const selectedSectionRunStatus = selectedSection?.sectionResultId
    ? qaRun?.sections[selectedSection.sectionResultId]?.status
    : undefined;
  const selectedSectionQaBusy =
    selectedSectionRunStatus === "queued" ||
    selectedSectionRunStatus === "running";
  // Any QA activity on the file — a whole-file run conflicts with everything
  // (the server rejects overlapping jobs), so bulk controls lock on this.
  const anyQaActive = useMemo(
    () =>
      !!qaRun &&
      Object.values(qaRun.sections).some(
        (s) => s.status === "queued" || s.status === "running",
      ),
    [qaRun],
  );

  // Copy + label for the run-all / run-remaining control.
  const runAllLabel =
    qaLoading === "all"
      ? "Queueing…"
      : anyQaActive
        ? "QA running…"
        : !someQaed
          ? "Run all sections"
          : allQaed
            ? "Re-run all sections"
            : `Run remaining sections · ${remainingQaCount}`;
  const runAllOkText = !someQaed
    ? "Run all"
    : allQaed
      ? "Re-run all"
      : "Run remaining";
  const runAllTitle = !someQaed
    ? "Run QA on all sections?"
    : allQaed
      ? "Re-run QA on all sections?"
      : "Run QA on remaining sections?";
  const runAllDescription = !someQaed
    ? "Analyzes every section in this file. This may take longer."
    : allQaed
      ? "Re-analyzes every section in this file. This may take longer."
      : `Analyzes the ${remainingQaCount} section${remainingQaCount === 1 ? "" : "s"} not yet QA'd.`;

  // Bulk approve — lives in the ⋯ menu alongside bulk QA.
  const sectionApprovedCount = useMemo(
    () =>
      allSectionIds.filter(
        (id) => verificationMap.get(id)?.status === "approved",
      ).length,
    [allSectionIds, verificationMap],
  );
  const allSectionsApproved =
    allSectionIds.length > 0 && sectionApprovedCount === allSectionIds.length;
  const remainingApproveCount = allSectionIds.length - sectionApprovedCount;
  const bulkApproveLabel =
    sectionApprovedCount > 0 ? "Approve remaining" : "Approve all";

  // Queue a QA run on the selected section. Returns immediately (202) — the
  // worker runs it and progress arrives via qa-progress-event.
  const handleRunSectionQA = useCallback(async () => {
    if (!fileId || !selectedSection?.sectionResultId) return;
    const id = selectedSection.sectionResultId;
    setQaLoading("section");
    try {
      const res = await apiClient.runSectionQA(fileId, id);
      if (res.status === "success") {
        // Optimistic — the server's `queued` socket event confirms this.
        setQaRun((prev) => ({
          scope: prev?.scope ?? "section",
          sections: { ...prev?.sections, [id]: { status: "queued" } },
        }));
      } else {
        message.error(res.message || "Failed to queue QA");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to queue QA");
    } finally {
      setQaLoading("idle");
    }
  }, [fileId, selectedSection?.sectionResultId, message]);

  // Queue a QA run on all / remaining sections (one background job).
  const handleRunAllQA = useCallback(async () => {
    if (!fileId) return;
    const remaining = allSectionIds.filter((id) => !qaedSectionIds.has(id));
    // Only a subset is left → ask the server to QA just those (scope=remaining),
    // so "Run remaining" doesn't waste a pass on sections already done.
    // Otherwise run the whole file — also covers "Re-run all" once all QA'd.
    const remainingOnly =
      remaining.length > 0 && remaining.length < allSectionIds.length;
    setQaLoading("all");
    try {
      const res = await apiClient.runFileQA(
        fileId,
        remainingOnly ? "remaining" : undefined,
      );
      if (res.status === "success") {
        if (res.queued === false) {
          message.info("All sections have already been QA'd");
          return;
        }
        const ids: string[] = res.sectionResultIds ?? [];
        setQaRun((prev) => ({
          scope: remainingOnly ? "remaining" : "all",
          sections: {
            ...prev?.sections,
            ...Object.fromEntries(
              ids.map((id) => [id, { status: "queued" as const }]),
            ),
          },
        }));
      } else {
        message.error(res.message || "Failed to queue QA");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Failed to queue QA");
    } finally {
      setQaLoading("idle");
    }
  }, [fileId, allSectionIds, qaedSectionIds, message]);

  const handleReprocessSection = useCallback(async () => {
    if (!fileId || !selectedSection?.sectionResultId) return;
    if (!reprocessOpts.reExtractText && !reprocessOpts.reProcessAi) {
      message.error("Pick at least one operation");
      return;
    }
    const sid = selectedSection.sectionResultId;
    setReprocessLoading(true);
    try {
      const res = await apiClient.reprocessSection(fileId, sid, reprocessOpts);
      if (res.status === "success") {
        // Result/detected_sections update arrives via the socket file-patch the
        // server emits (same path reextract-sections uses). Drop any cached
        // section markdown so the Markdown tab refetches the new text, and
        // refresh QA findings since the data changed.
        setSectionMarkdownCache((prev) => {
          const next = { ...prev };
          delete next[sid];
          return next;
        });
        apiClient
          .getQAFindings(fileId)
          .then((r) => {
            if (r.status === "success" && r.findings) setQaFindings(r.findings);
          })
          .catch(() => {});
        message.success("Section reprocessed");
        setReprocessOpen(false);
      } else {
        message.error(res.message || "Reprocess failed");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Reprocess failed");
    } finally {
      setReprocessLoading(false);
    }
  }, [fileId, selectedSection?.sectionResultId, reprocessOpts, message]);

  // Queue a directed group re-extraction. Returns 202 immediately — the
  // worker runs it and findings arrive per group via reextract-progress-event
  // (handled in the useSocket block above).
  const handleReextractGroup = useCallback(async () => {
    const sid = selectedSection?.sectionResultId;
    if (!fileId || !sid || reextractGroups.length === 0) return;
    setReextractLoading(true);
    try {
      const res = await apiClient.reextractSectionGroup(fileId, sid, {
        groups: reextractGroups,
        mode: reextractMode,
        ...(reextractPrompt.trim() ? { prompt: reextractPrompt.trim() } : {}),
        ...(reextractPages.length > 0 ? { pages: reextractPages } : {}),
      });
      if (res.status === "success" && res.queued) {
        // Optimistic — the server's `queued` socket event confirms this.
        setPendingReextractions((prev) => ({
          ...prev,
          [sid]: [...new Set([...(prev[sid] ?? []), ...reextractGroups])],
        }));
        setReextractRun((prev) => ({
          ...prev,
          [res.requestId]: {
            sectionResultId: sid,
            groups: Object.fromEntries(
              reextractGroups.map((g) => [g, { status: "queued" as const }]),
            ),
          },
        }));
        setReextractOpen(false);
        // The request is on its way — clear the form so the next open
        // starts fresh (closing WITHOUT queueing keeps everything typed).
        setReextractFormSection(null);
        message.success(
          `Re-extraction of ${reextractGroups.map((g) => `"${g}"`).join(", ")} queued — findings will appear in the QA panel`,
        );
      } else {
        message.error(res.message || "Failed to queue re-extraction");
      }
    } catch (err) {
      message.error(
        err instanceof Error ? err.message : "Failed to queue re-extraction",
      );
    } finally {
      setReextractLoading(false);
    }
  }, [
    fileId,
    selectedSection?.sectionResultId,
    reextractGroups,
    reextractMode,
    reextractPrompt,
    reextractPages,
    message,
  ]);

  // Lazily fetch the selected section's markdown when the Markdown tab is open
  // and scoped to "This section". Cached by sectionResultId.
  useEffect(() => {
    const sid = selectedSection?.sectionResultId;
    if (
      activeTab !== "markdown" ||
      markdownScope !== "section" ||
      !fileId ||
      !sid ||
      sectionMarkdownCache[sid]
    ) {
      return;
    }
    let cancelled = false;
    setSectionMarkdownLoading(true);
    apiClient
      .getSectionMarkdown(fileId, sid)
      .then((res) => {
        if (cancelled) return;
        if (res.status === "success") {
          setSectionMarkdownCache((prev) => ({
            ...prev,
            [sid]: { markdown: res.markdown ?? "", pages: res.pages ?? [] },
          }));
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSectionMarkdownLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    activeTab,
    markdownScope,
    fileId,
    selectedSection?.sectionResultId,
    sectionMarkdownCache,
  ]);

  // Items for the ⋯ "more actions" menu. Bulk QA and bulk approve are occasional
  // — tucking them here keeps the per-section actions front-and-centre.
  // Confirmations use modal.confirm (a Popconfirm anchored to a menu item that
  // closes on click is awkward).
  const bulkMenuItems: MenuProps["items"] = [];
  if (fileId && selectedSection?.sectionResultId) {
    bulkMenuItems.push({
      key: "reprocess-section",
      label: "Reprocess section…",
      onClick: () => {
        setReprocessOpts({ reExtractText: true, reProcessAi: true });
        setReprocessOpen(true);
      },
    });
    const sid = selectedSection.sectionResultId;
    const pendingGroups = pendingReextractions[sid] ?? [];
    bulkMenuItems.push({
      key: "reextract-group",
      label: pendingGroups.length
        ? `Fixing ${pendingGroups.map((g) => `"${g}"`).join(", ")}…`
        : "Fix groups with AI…",
      disabled: pendingGroups.length > 0,
      onClick: () => {
        // Seed the form only when it belongs to a different section (or was
        // consumed by a queued request) — closing and reopening on the same
        // section keeps whatever the operator had typed.
        if (reextractFormSection !== sid) {
          setReextractGroups([]);
          setReextractMode("auto");
          setReextractPrompt("");
          setReextractPages(
            reextractSectionPages.slice(0, MAX_REEXTRACT_PAGES),
          );
          setReextractFormSection(sid);
        }
        setReextractOpen(true);
      },
    });
  }
  if (fileId && allSectionIds.length > 0) {
    bulkMenuItems.push({
      key: "run-all-qa",
      label: runAllLabel,
      disabled: qaLoading !== "idle" || anyQaActive,
      onClick: () =>
        modal.confirm({
          title: runAllTitle,
          content: runAllDescription,
          okText: runAllOkText,
          cancelText: "Cancel",
          onOk: handleRunAllQA,
        }),
    });
  }
  if (onBulkSectionVerify && !allSectionsApproved && allSectionIds.length > 1) {
    bulkMenuItems.push({
      key: "bulk-approve",
      label: bulkApproveLabel,
      disabled: verifyLoading,
      onClick: () =>
        modal.confirm({
          title:
            sectionApprovedCount > 0
              ? `Approve remaining ${remainingApproveCount} section${remainingApproveCount === 1 ? "" : "s"}?`
              : `Approve all ${allSectionIds.length} sections?`,
          content:
            sectionApprovedCount > 0
              ? "Every not-yet-approved section in this file will be marked approved."
              : "Every section in this file will be marked approved.",
          okText: bulkApproveLabel,
          cancelText: "Cancel",
          onOk: () => handleBulkVerify("approved"),
        }),
    });
  }

  // Markdown view scoping: when a section is selected and scope is "section",
  // feed the section's sliced markdown/pages into the existing renderer.
  const sectionScopeActive =
    isV2 && !!selectedSection?.sectionResultId && markdownScope === "section";
  const currentSectionMarkdown = selectedSection?.sectionResultId
    ? sectionMarkdownCache[selectedSection.sectionResultId]
    : undefined;
  const mdForView = sectionScopeActive
    ? (currentSectionMarkdown?.markdown ?? "")
    : (markdown ?? "");
  const pagesForView = sectionScopeActive
    ? (currentSectionMarkdown?.pages ?? [])
    : pages;

  // Inject a finding's correct answer into the editable JSON. The user
  // reviews the change in the tree and Saves to persist (via the existing
  // per-record PATCH) — this never writes directly to the server.
  // Row-level ops (add_row/update_row/delete_row) mutate the array at
  // field_path using row_index/row_value; everything else writes a single
  // scalar at field_path. extra_value (hallucination) → set null. Prefer the
  // typed `corrected_value` when present for scalars — it's the model's
  // actual typed answer (e.g. a real boolean true/false), not a string quote
  // of page evidence that may not coerce cleanly (coerceExpected is a
  // best-effort fallback for findings saved before corrected_value existed).
  const handleApplyFinding = useCallback(
    (finding: import("@/lib/api").QAFinding) => {
      try {
        const parsed = JSON.parse(editableJson);

        // Re-point still-open findings on the same array after a structural
        // apply (delete shifts later rows down, insert shifts them up):
        //  - row ops (same bare field_path): shift row_index
        //  - scalar findings addressed INTO the array ("path[4].moisture"):
        //    rewrite the bracket index — these carry no row anchor, so this
        //    re-index is their only protection against landing on the wrong row
        // Without this, applying "delete row 6" then "update row 7" hits the
        // original row 8. Local state only; nothing persists until Save.
        const shiftSiblingRowIndices = (fromIndex: number, delta: number) => {
          const sid = selectedSection?.sectionResultId;
          if (!sid) return;
          const bracketRe = new RegExp(
            `^${finding.field_path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\[(\\d+)\\]`,
          );
          setQaFindings((prev) => {
            const list = prev[sid];
            if (!list) return prev;
            return {
              ...prev,
              [sid]: list.map((f) => {
                if (f.id === finding.id || f.status !== "open") return f;
                const isRowOp =
                  f.issue_type === "delete_row" ||
                  f.issue_type === "update_row" ||
                  f.issue_type === "add_row";
                if (
                  isRowOp &&
                  f.field_path === finding.field_path &&
                  f.row_index != null &&
                  f.row_index >= fromIndex
                ) {
                  return { ...f, row_index: f.row_index + delta };
                }
                if (!isRowOp) {
                  const m = f.field_path.match(bracketRe);
                  if (m && Number(m[1]) >= fromIndex) {
                    return {
                      ...f,
                      field_path: f.field_path.replace(
                        bracketRe,
                        `${finding.field_path}[${Number(m[1]) + delta}]`,
                      ),
                    };
                  }
                }
                return f;
              }),
            };
          });
        };

        if (
          finding.issue_type === "delete_row" ||
          finding.issue_type === "update_row"
        ) {
          if (finding.row_index == null) {
            throw new Error(`missing row_index for ${finding.issue_type}`);
          }
          if (finding.issue_type === "update_row" && !finding.row_value) {
            throw new Error("missing row_value");
          }
          const arr = getByPath(parsed, finding.field_path);
          if (!Array.isArray(arr)) {
            throw new Error(`${finding.field_path} is not an array`);
          }

          // Anchor to the row CONTENT the verifier froze at QA time, not the
          // index: earlier applies (or manual edits) shift positions.
          const resolved = resolveRowAnchor(
            arr,
            finding.row_index,
            finding.actual,
          );
          if (resolved.index == null) {
            message.error(
              resolved.status === "not_found"
                ? `The row this finding targets is no longer in ${finding.field_path} — it may have been edited, deleted, or this fix was already applied. Re-run QA to refresh.`
                : `Several rows in ${finding.field_path} match this finding's original content — not applying a guess. Re-run QA to refresh.`,
            );
            return;
          }
          const idx = resolved.index;
          if (idx < 0 || idx >= arr.length) {
            // no_anchor finding (pre-anchor era) whose stored index went stale
            throw new Error(
              `row ${idx} is out of range for ${finding.field_path}`,
            );
          }

          const updated =
            finding.issue_type === "delete_row"
              ? removeAtPath(parsed, finding.field_path, idx)
              : setByPath(
                  parsed,
                  `${finding.field_path}[${idx}]`,
                  finding.row_value,
                );
          setEditableJson(JSON.stringify(updated, null, 2));
          setJsonError(null);
          if (finding.issue_type === "delete_row") {
            shiftSiblingRowIndices(idx + 1, -1);
          }
          const moved =
            resolved.status === "relocated"
              ? ` (row had moved from ${finding.row_index} to ${idx})`
              : "";
          message.success(
            `${finding.issue_type === "delete_row" ? "Removed" : "Replaced"} ${finding.field_path}[${idx}]${moved} — review and Save to persist`,
          );
          return;
        }

        if (finding.issue_type === "add_row") {
          if (!finding.row_value) {
            throw new Error("missing row_value");
          }
          const arr = getByPath(parsed, finding.field_path);
          const arrLen = Array.isArray(arr) ? arr.length : 0;
          // Mirror insertAtPath's clamping so the sibling shift uses the real
          // insertion point.
          const insertAt =
            finding.row_index == null ||
            finding.row_index < 0 ||
            finding.row_index > arrLen
              ? arrLen
              : finding.row_index;
          const updated = insertAtPath(
            parsed,
            finding.field_path,
            finding.row_index,
            finding.row_value,
          );
          setEditableJson(JSON.stringify(updated, null, 2));
          setJsonError(null);
          shiftSiblingRowIndices(insertAt, +1);
          message.success(
            `Inserted a row in ${finding.field_path} — review and Save to persist`,
          );
          return;
        }

        const current = getByPath(parsed, finding.field_path);
        // A SQL NULL always comes back as JS `null` (never `undefined`) once
        // it's crossed the DB/API boundary — so `null` here doesn't mean "the
        // model answered null", it means "no usable corrected_value" (an
        // older finding saved before this column existed, or the model
        // genuinely didn't provide one). Only trust corrected_value when it's
        // a real, non-null value; otherwise fall back to the text-based
        // coercion exactly like before this field existed. Mirrors the same
        // `!== null` check already used server-side in verifyFindingAgainstRecord.
        const hasCorrectedValue =
          finding.corrected_value !== undefined &&
          finding.corrected_value !== null;
        const newValue =
          finding.issue_type === "extra_value"
            ? null
            : hasCorrectedValue
              ? finding.corrected_value
              : coerceExpected(finding.expected, current);
        const updated = setByPath(parsed, finding.field_path, newValue);
        setEditableJson(JSON.stringify(updated, null, 2));
        setJsonError(null);
        message.success(
          `Set ${finding.field_path} = ${newValue === null ? "null" : JSON.stringify(newValue)} — review and Save to persist`,
        );
      } catch (err) {
        message.error(
          `Couldn't apply: ${err instanceof Error ? err.message : "invalid JSON"}`,
        );
      }
    },
    [editableJson, message, selectedSection?.sectionResultId],
  );

  const handleUpdateFinding = useCallback(
    async (findingId: string, status: "accepted" | "dismissed") => {
      if (!fileId || !selectedSection?.sectionResultId) return;
      try {
        const res = await apiClient.updateQAFindingStatus(
          fileId,
          findingId,
          status,
        );
        if (res.status === "success" && res.finding) {
          const updated = res.finding;
          const sectionId = updated.section_result_id;
          setQaFindings((prev) => ({
            ...prev,
            [sectionId]: (prev[sectionId] ?? []).map((f) =>
              f.id === findingId ? updated : f,
            ),
          }));
        }
      } catch {
        message.error("Failed to update finding");
      }
    },
    [fileId, selectedSection?.sectionResultId, message],
  );

  // ── Bulk apply: one reviewed batch instead of N micro-approvals ─────────
  // openBulkReview snapshots the would-be changes (computeBulkApply is pure);
  // the QA panel flips to review mode IN PLACE (no modal) so the PDF and the
  // result stay visible while the reviewer unticks what they disagree with;
  // confirm recomputes from the ticked set, writes the editable JSON, and
  // (optionally) marks the applied findings accepted. Nothing is saved until
  // the user hits Save.
  const [bulkReview, setBulkReview] = useState<BulkReviewState | null>(null);

  const toggleBulkExclude = useCallback((findingId: string) => {
    setBulkReview((prev) => {
      if (!prev) return prev;
      const excluded = new Set(prev.excluded);
      if (excluded.has(findingId)) excluded.delete(findingId);
      else excluded.add(findingId);
      return { ...prev, excluded };
    });
  }, []);

  const toggleBulkAutoAccept = useCallback(() => {
    setBulkReview((prev) =>
      prev ? { ...prev, autoAccept: !prev.autoAccept } : prev,
    );
  }, []);

  const cancelBulkReview = useCallback(() => setBulkReview(null), []);

  // A pending review is meaningless once the section (and its record) change.
  useEffect(() => {
    setBulkReview(null);
  }, [selectedSection?.sectionResultId]);

  const openBulkReview = useCallback(() => {
    try {
      const parsed = JSON.parse(editableJson);
      const eligible = (
        qaFindings[selectedSection?.sectionResultId ?? ""] ?? []
      ).filter(
        (f) => f.status === "open" && APPLYABLE_ISSUE_TYPES.has(f.issue_type),
      );
      if (eligible.length === 0) return;
      const { outcomes } = computeBulkApply(parsed, eligible);
      setBulkReview({
        findings: eligible,
        outcomes,
        excluded: new Set(
          outcomes
            .filter((o) => o.status === "skipped")
            .map((o) => o.findingId),
        ),
        autoAccept: true,
        busy: false,
      });
    } catch {
      message.error("Fix the JSON first — it doesn't parse");
    }
  }, [editableJson, qaFindings, selectedSection?.sectionResultId, message]);

  const confirmBulkApply = useCallback(async () => {
    if (!bulkReview) return;
    setBulkReview((prev) => (prev ? { ...prev, busy: true } : prev));
    try {
      const parsed = JSON.parse(editableJson);
      const included = bulkReview.findings.filter(
        (f) => !bulkReview.excluded.has(f.id),
      );
      const { result, outcomes } = computeBulkApply(parsed, included);
      const applied = outcomes.filter((o) => o.status !== "skipped");
      setEditableJson(JSON.stringify(result, null, 2));
      setJsonError(null);
      if (bulkReview.autoAccept && applied.length > 0) {
        // Best-effort status flips; failures leave findings open (harmless).
        await Promise.allSettled(
          applied.map((o) => handleUpdateFinding(o.findingId, "accepted")),
        );
      }
      const skipped = outcomes.length - applied.length;
      message.success(
        `Applied ${applied.length} change(s)${skipped ? `, ${skipped} skipped` : ""} — review the JSON and Save to persist`,
      );
      setBulkReview(null);
    } catch (err) {
      message.error(
        `Bulk apply failed: ${err instanceof Error ? err.message : "invalid JSON"}`,
      );
      setBulkReview((prev) => (prev ? { ...prev, busy: false } : prev));
    }
  }, [bulkReview, editableJson, handleUpdateFinding, message]);

  // The data that the data-shaped tabs (Preview, JSON, CSV, Edit) operate on.
  // When v2 we scope to the selected section so the user sees one focused
  // result tree; when v1, we pass the original `data` through unchanged.
  const sectionData: unknown =
    isV2 && selectedSection ? selectedSection.data : data;

  // Keep fallback index in range when sections change
  React.useEffect(() => {
    if (selectedSectionIdx > sectionEntries.length - 1) {
      setFallbackSectionIdx(0);
    }
  }, [sectionEntries.length, selectedSectionIdx]);

  // Initialize editable JSON when the *displayed* data changes — for v2
  // that's the selected section's slot, for v1 the whole result.
  React.useEffect(() => {
    if (sectionData !== undefined && sectionData !== null) {
      setEditableJson(JSON.stringify(sectionData, null, 2));
      setJsonError(null);
    }
  }, [sectionData]);

  // Reset markdown view when switching away from markdown tab
  React.useEffect(() => {
    if (activeTab !== "markdown") {
      setMarkdownView("full");
    }
  }, [activeTab]);

  // Handle JSON editing
  const handleJsonChange = (value: string) => {
    setEditableJson(value);
    setJsonError(null);

    // Validate JSON in real-time
    try {
      JSON.parse(value);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Invalid JSON");
    }
  };

  // Save changes. For v2 we splice the edited section back into the envelope
  // Save the current section's edited JSON.
  // V2 with section_result_id: use the PATCH endpoint (small payload, no size limit issues).
  // V1 or V2 without section_result_id: fall back to the full-result PUT via onUpdate.
  const handleSave = useCallback(
    async (e?: React.MouseEvent) => {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }

      if (!onUpdate || jsonError || isSaving) return;

      try {
        setIsSaving(true);
        const parsedSectionData = JSON.parse(editableJson);

        if (isV2 && selectedSection?.sectionResultId && fileId) {
          // V2 path: patch just this one record by section_result_id.
          // Strip section_result_id from the edited data (the endpoint preserves it).
          const { section_result_id: _strip, ...recordData } =
            parsedSectionData;
          const res = await apiClient.patchResultRecord(
            fileId,
            selectedSection.sectionResultId,
            recordData,
          );
          if (!res.success) {
            throw new Error(res.message || "Failed to save");
          }
          // Don't call onUpdate here — the PATCH already saved to the server
          // and emitted a WebSocket event (emitFileFullPatch) that will refresh
          // the parent's file data. Calling onUpdate would trigger the old PUT
          // endpoint with the full envelope, causing PayloadTooLargeError.
        } else if (isV2 && selectedSection) {
          // V2 but no section_result_id (legacy file) — full envelope PUT
          const envelope = data as V2ResultEnvelope;
          const slugInstances = Array.isArray(envelope[selectedSection.slug])
            ? [...envelope[selectedSection.slug]]
            : [];
          slugInstances[selectedSection.instanceIndex] = parsedSectionData;
          const nextEnvelope: V2ResultEnvelope = {
            ...envelope,
            [selectedSection.slug]: slugInstances,
          };
          await onUpdate(nextEnvelope);
        } else {
          // V1 — full result PUT
          await onUpdate(parsedSectionData);
        }

        setJsonError(null);
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : "Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    [
      onUpdate,
      jsonError,
      isSaving,
      editableJson,
      isV2,
      selectedSection,
      data,
      fileId,
    ],
  );

  useEffect(() => {
    if (!editable || !onUpdate) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (activeTab !== "results") return;
      if (!(e.metaKey || e.ctrlKey) || e.key !== "Enter") return;
      if (e.shiftKey || e.altKey) return;
      e.preventDefault();
      void handleSave();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editable, onUpdate, activeTab, handleSave]);

  const saveLabel = useMemo(() => {
    const shortcut =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform)
        ? "⌘↵"
        : "Ctrl+↵";
    return isSaving ? "Saving…" : `Update (${shortcut})`;
  }, [isSaving]);

  // Convert data to CSV format. Scoped to the selected section in v2 so the
  // CSV columns line up with that section's schema instead of mashing every
  // section's keys into one wide table.
  const csvData = useMemo(() => {
    try {
      const csvString = jsonToCsv(sectionData, {
        includeHeaders: true,
        flattenNested: true,
      });
      return csvString;
    } catch (error) {
      console.error("Error converting to CSV:", error);
      return "";
    }
  }, [sectionData]);

  // Export handlers — JSON exports the full envelope (v2) so the user gets a
  // complete file-level snapshot; CSV stays scoped to the selected section
  // because flattening multiple sections together produces a confusing union.
  const handleJsonExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}_results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvExport = () => {
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const sectionSuffix =
      isV2 && selectedSection
        ? `_${selectedSection.slug}_${selectedSection.instanceIndex + 1}`
        : "";
    a.download = `${filename.replace(/\.[^/.]+$/, "")}${sectionSuffix}_results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Handle adding comment
  const handleAddComment = async () => {
    if (!newComment.trim() || !onAddComment) return;

    try {
      setAddingComment(true);
      await onAddComment(newComment.trim());
      setNewComment("");
      message.success("Comment added successfully");
    } catch (err: any) {
      message.error(err.message || "Failed to add comment");
    } finally {
      setAddingComment(false);
    }
  };

  // QA findings render below the JSON result, in a resizable bottom panel.
  const showFindings =
    isV2 &&
    !!selectedSection?.sectionResultId &&
    selectedSectionFindings.length > 0;

  // Tell the host layout whether the QA side-column has content (it mounts/
  // unmounts the third splitter pane off this). Signal false on unmount so a
  // closed viewer never leaves a dead column behind.
  const qaPanelActive = showFindings && activeTab === "results";
  useEffect(() => {
    onQaPanelActiveChange?.(qaPanelActive);
  }, [qaPanelActive, onQaPanelActiveChange]);
  useEffect(
    () => () => {
      onQaPanelActiveChange?.(false);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // One QA element for both homes: the host's side column (portal) or the
  // stacked fallback. Same component renders the findings list AND the
  // "Review & apply all" review mode — it flips in place via bulkReview.
  const qaPanelEl = (
    <QAFindingsPanel
      findings={selectedSectionFindings}
      onUpdate={handleUpdateFinding}
      onApply={handleApplyFinding}
      canApply={editable}
      bulkReview={bulkReview}
      onOpenBulkReview={openBulkReview}
      onToggleExclude={toggleBulkExclude}
      onToggleAutoAccept={toggleBulkAutoAccept}
      onConfirmBulkApply={confirmBulkApply}
      onCancelBulkReview={cancelBulkReview}
    />
  );

  const jsonViewerEl = (
    <JsonViewer
      text={editableJson}
      descriptions={fieldDescriptions}
      onChange={({ text, isValid, error }) => {
        setEditableJson(text);
        setJsonError(isValid ? null : (error ?? "Invalid JSON"));
      }}
      readOnly={!editable}
      bordered={false}
      defaultMode="tree"
      height="100%"
      toolbar={
        editable
          ? [
              "mode",
              "format",
              "minify",
              "wrap",
              "search",
              "copy",
              "download",
              "upload",
              "cancel",
              "save",
            ]
          : ["mode", "wrap", "search", "copy", "download"]
      }
      onSave={
        editable
          ? async () => {
              await handleSave();
            }
          : undefined
      }
      onCancel={
        editable
          ? () => {
              setEditableJson(JSON.stringify(sectionData, null, 2));
              setJsonError(null);
            }
          : undefined
      }
      cancelLabel="Reset"
      saveLabel={saveLabel}
      saving={isSaving}
    />
  );

  return (
    <div
      className={`bg-white flex flex-col h-full overflow-hidden ${className}`}
    >
      {/* Per-section picker (v2 envelope only) — sits ABOVE the tab strip
          and only swaps the data fed to data-shaped tabs. Markdown / Compare
          / Comments stay file-level. */}
      {isV2 && sectionEntries.length > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-gray-50 flex-shrink-0">
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wide whitespace-nowrap">
            Sections
          </span>
          <button
            type="button"
            disabled={selectedSectionIdx <= 0}
            onClick={() =>
              selectSectionIdx(Math.max(0, selectedSectionIdx - 1))
            }
            className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous section (⌘←)"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <Select
            showSearch
            value={selectedSectionIdx}
            onChange={(v: number) => selectSectionIdx(v)}
            optionFilterProp="label"
            className="flex-1 min-w-0"
            size="small"
            popupMatchSelectWidth={false}
          >
            {(() => {
              const slugs = new Set(sectionEntries.map((e) => e.slug));
              if (slugs.size <= 1) {
                return sectionEntries.map((entry) => (
                  <Select.Option
                    key={entry.globalIndex}
                    value={entry.globalIndex}
                    label={formatSectionOptionLabel(entry, verificationMap)}
                  >
                    {formatSectionOptionLabel(entry, verificationMap)}
                  </Select.Option>
                ));
              }
              // Multiple slugs — use OptGroups
              const slugOrder: string[] = [];
              for (const entry of sectionEntries) {
                if (!slugOrder.includes(entry.slug)) slugOrder.push(entry.slug);
              }
              return slugOrder.map((slug) => (
                <Select.OptGroup key={slug} label={slug}>
                  {sectionEntries
                    .filter((e) => e.slug === slug)
                    .map((entry) => (
                      <Select.Option
                        key={entry.globalIndex}
                        value={entry.globalIndex}
                        label={`${entry.recordId ?? ""} ${formatSectionOptionLabel(entry, verificationMap)}`}
                      >
                        {formatSectionOptionLabel(entry, verificationMap)}
                      </Select.Option>
                    ))}
                </Select.OptGroup>
              ));
            })()}
          </Select>
          <button
            type="button"
            disabled={selectedSectionIdx >= sectionEntries.length - 1}
            onClick={() =>
              selectSectionIdx(
                Math.min(sectionEntries.length - 1, selectedSectionIdx + 1),
              )
            }
            className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next section (⌘→)"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
            {selectedSectionIdx + 1} / {sectionEntries.length}
          </span>
          <button
            type="button"
            disabled={
              !onNavigateToPdfPage ||
              typeof selectedSectionPage !== "number" ||
              selectedSectionPage < 1
            }
            onClick={() => {
              if (
                onNavigateToPdfPage &&
                typeof selectedSectionPage === "number" &&
                selectedSectionPage >= 1
              ) {
                onNavigateToPdfPage(selectedSectionPage);
              }
            }}
            className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title={
              typeof selectedSectionPage === "number" && selectedSectionPage >= 1
                ? `Scroll PDF to page ${selectedSectionPage}`
                : "No page for this section"
            }
          >
            <LocateFixed className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-xs text-gray-600 whitespace-nowrap">
              {typeof selectedSectionPage === "number" &&
              selectedSectionPage >= 1
                ? `p${selectedSectionPage}`
                : "Go to page"}
            </span>
          </button>
        </div>
      )}

      {/* QA + verification — below section picker; section row is navigation only */}
      {isV2 &&
        selectedSection?.sectionResultId &&
        (fileId || onSectionVerify) && (
          <div className="flex flex-wrap items-center gap-2 px-3 py-1.5 border-b border-gray-100 bg-gray-50 flex-shrink-0">
            {fileId && (
              <>
                <span className="text-[10px] text-gray-400 uppercase tracking-wide font-medium">
                  QA
                </span>
                <div className="flex items-center gap-0.5">
                  <Popconfirm
                    title={
                      selectedSectionQaed
                        ? "Re-run QA on this section?"
                        : "Run QA on this section?"
                    }
                    description="Queues QA for this section — it runs in the background and results appear when done."
                    okText={sectionQaBase}
                    cancelText="Cancel"
                    disabled={qaLoading !== "idle" || selectedSectionQaBusy}
                    onConfirm={handleRunSectionQA}
                  >
                    <span className="inline-flex">
                      <button
                        type="button"
                        disabled={qaLoading !== "idle" || selectedSectionQaBusy}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {selectedSectionQaBusy && (
                          <Loader2 className="w-2.5 h-2.5 animate-spin text-blue-600" />
                        )}
                        {selectedSectionQaBusy
                          ? selectedSectionRunStatus === "queued"
                            ? "QA queued…"
                            : "QA running…"
                          : qaLoading === "section"
                            ? "Queueing…"
                            : openFindingsCount > 0
                              ? `${sectionQaBase} · ${openFindingsCount} open`
                              : sectionQaBase}
                      </button>
                    </span>
                  </Popconfirm>
                </div>
              </>
            )}
            {onSectionVerify && (
              <>
                {fileId && <span className="w-px h-5 bg-gray-200" />}
                <SectionVerifyControls
                  verification={selectedVerification}
                  loading={verifyLoading}
                  onVerify={handleVerify}
                  totalSections={sectionEntries.length}
                  verificationMap={verificationMap}
                  sectionEntries={sectionEntries}
                  approveShortcutLabel={approveShortcutLabel}
                />
              </>
            )}

            {/* Occasional bulk actions live in a ⋯ menu on the right, keeping
                the frequently-used per-section actions uncrowded. */}
            {bulkMenuItems.length > 0 && (
              <Dropdown
                menu={{ items: bulkMenuItems }}
                trigger={["click"]}
                placement="bottomRight"
              >
                <button
                  type="button"
                  className="ml-auto px-1 py-0.5 text-gray-400 hover:text-gray-700 hover:bg-gray-200 rounded transition-colors cursor-pointer"
                  title="More actions"
                  aria-label="More actions"
                >
                  <MoreHorizontal className="w-4 h-4" />
                </button>
              </Dropdown>
            )}
          </div>
        )}

      {/* Tab Headers */}
      <div className="flex items-center justify-between border-b border-gray-200 flex-shrink-0">
        <div className="flex space-x-1">
          <button
            onClick={() => setResultTab("results")}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              activeTab === "results"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Results
          </button>
          {markdown && (
            <button
              onClick={() => setResultTab("markdown")}
              className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                activeTab === "markdown"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Markdown
            </button>
          )}
          {actual_result && (
            <button
              onClick={() => setResultTab("compare")}
              className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                activeTab === "compare"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Compare
            </button>
          )}
          {(comments.length > 0 || onAddComment) && (
            <button
              onClick={() => setResultTab("comments")}
              className={`px-4 py-2 text-sm font-medium transition-colors duration-200 flex items-center space-x-1 ${
                activeTab === "comments"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              <MessageSquare className="w-3 h-3" />
              <span>
                Comments {comments.length > 0 ? `(${comments.length})` : ""}
              </span>
            </button>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex space-x-2 pr-4">
          <button
            onClick={handleJsonExport}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors duration-200"
          >
            Export JSON
          </button>
          <button
            onClick={handleCsvExport}
            className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors duration-200"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden flex flex-col min-h-0">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="flex-1 overflow-hidden flex flex-col min-h-0"
        >
          {activeTab === "results" &&
            (showFindings && !onQaPanelActiveChange ? (
              // Host doesn't support a QA side column: fall back to JSON on
              // top, QA findings below, draggable divider (standalone embeds).
              // (Keying off the listener, not the container, avoids a flash
              // of this stacked layout while the host's third pane mounts.)
              <Splitter layout="vertical" className="flex-1 min-h-0">
                <Splitter.Panel min={120}>
                  <div className="h-full min-h-0 flex flex-col">
                    {jsonViewerEl}
                  </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize={220} min={80} max="70%">
                  {qaPanelEl}
                </Splitter.Panel>
              </Splitter>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">{jsonViewerEl}</div>
            ))}

          {/* 3-segment layout: the QA / review panel renders into the host's
              third column (beside PDF and result), keeping all QA state here. */}
          {qaPanelActive &&
            qaPanelContainer &&
            createPortal(qaPanelEl, qaPanelContainer)}

          {activeTab === "markdown" && markdown && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Source scope: this section vs the whole file */}
              {isV2 && selectedSection?.sectionResultId && (
                <div className="flex items-center gap-1 border-b border-gray-100 bg-gray-50 px-4 py-1.5">
                  <span className="text-[10px] uppercase tracking-wide text-gray-400 mr-1">
                    Source
                  </span>
                  {(["section", "file"] as const).map((scope) => (
                    <button
                      key={scope}
                      onClick={() => {
                        setMarkdownScope(scope);
                        if (scope === "section" && markdownView === "chunks") {
                          setMarkdownView("full");
                        }
                      }}
                      className={`px-2 py-0.5 text-xs rounded transition-colors ${
                        markdownScope === scope
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {scope === "section" ? "This section" : "Whole file"}
                    </button>
                  ))}
                </div>
              )}
              {/* Markdown Subtabs */}
              {pagesForView &&
                Array.isArray(pagesForView) &&
                pagesForView.length > 0 && (
                  <div className="flex border-b border-gray-200 bg-gray-50 px-4">
                    <button
                      onClick={() => setMarkdownView("full")}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        markdownView === "full"
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Full
                    </button>
                    <button
                      onClick={() => setMarkdownView("pages")}
                      className={`px-4 py-2 text-sm font-medium transition-colors ${
                        markdownView === "pages"
                          ? "text-blue-600 border-b-2 border-blue-600"
                          : "text-gray-500 hover:text-gray-700"
                      }`}
                    >
                      Pages
                    </button>
                    {!sectionScopeActive && (
                      <button
                        onClick={() => setMarkdownView("chunks")}
                        className={`px-4 py-2 text-sm font-medium transition-colors ${
                          markdownView === "chunks"
                            ? "text-blue-600 border-b-2 border-blue-600"
                            : "text-gray-500 hover:text-gray-700"
                        }`}
                      >
                        Chunks
                      </button>
                    )}
                  </div>
                )}
              {sectionScopeActive && sectionMarkdownLoading && (
                <div className="px-6 py-4 text-sm text-gray-400">
                  Loading section source…
                </div>
              )}
              {sectionScopeActive &&
                !sectionMarkdownLoading &&
                mdForView.length === 0 && (
                  <div className="px-6 py-4 text-sm text-gray-400">
                    No source text for this section.
                  </div>
                )}

              {/* Markdown Content */}
              <div className="overflow-auto flex-1 p-6 min-h-0">
                {markdownView === "full" && (
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    rehypePlugins={[rehypeRaw]}
                    // className="prose prose-sm max-w-none"
                    components={{
                      ...markdownRehypeRawPassthrough,
                      // Custom styles for better readability
                      h1: ({ node, ...props }) => (
                        <h1
                          className="text-2xl font-bold mb-4 mt-6"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className="text-xl font-bold mb-3 mt-5"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className="text-lg font-semibold mb-2 mt-4"
                          {...props}
                        />
                      ),
                      p: ({ node, ...props }: any) => {
                        // Extract text content from React children
                        const extractText = (children: any): string => {
                          if (typeof children === "string") return children;
                          if (Array.isArray(children)) {
                            return children.map(extractText).join("");
                          }
                          if (children?.props?.children) {
                            return extractText(children.props.children);
                          }
                          return String(children || "");
                        };

                        const textContent = extractText(props.children);

                        // Detect text table: multiple lines with aligned columns
                        // Check if text contains multiple lines with spaces or pipes that look like a table
                        const lines = textContent
                          .split("\n")
                          .filter((line) => line.trim().length > 0);
                        const isTextTable =
                          lines.length >= 2 &&
                          lines.some((line) => {
                            const trimmedLine = line.trim();
                            // Check for patterns typical of text tables
                            const hasMultipleSpaces =
                              (trimmedLine.match(/\s{2,}/g) || []).length >= 2;
                            const hasPipes = trimmedLine.includes("|");
                            const hasTableSeparator =
                              trimmedLine.match(/^[\s|+-]+$/); // Separator row like "|---|---|"
                            const hasPatternedSpaces =
                              trimmedLine.match(/^[^\s]+\s{2,}[^\s]/); // Multiple spaces between text
                            return (
                              hasMultipleSpaces ||
                              hasPipes ||
                              hasTableSeparator ||
                              hasPatternedSpaces
                            );
                          });

                        if (isTextTable) {
                          return (
                            <pre className="mb-4 text-gray-700 font-mono text-sm whitespace-pre overflow-x-auto bg-gray-50 p-2 rounded border border-gray-200">
                              {textContent}
                            </pre>
                          );
                        }

                        return <p className="mb-4 text-gray-700" {...props} />;
                      },
                      code: ({ node, inline, ...props }: any) =>
                        inline ? (
                          <code
                            className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-red-600"
                            {...props}
                          />
                        ) : (
                          <code
                            className="block bg-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4"
                            {...props}
                          />
                        ),
                      pre: ({ node, ...props }) => (
                        <pre
                          className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="list-disc list-inside mb-4 space-y-1"
                          {...props}
                        />
                      ),
                      ol: ({ node, ...props }) => (
                        <ol
                          className="list-decimal list-inside mb-4 space-y-1"
                          {...props}
                        />
                      ),
                      table: ({ node, ...props }: any) => (
                        <div className="overflow-x-auto mb-4 my-4">
                          <table
                            className="min-w-full border border-gray-300 border-collapse whitespace-nowrap"
                            {...props}
                          />
                        </div>
                      ),
                      thead: ({ node, ...props }: any) => (
                        <thead className="bg-gray-50" {...props} />
                      ),
                      tbody: ({ node, ...props }: any) => <tbody {...props} />,
                      tr: ({ node, ...props }: any) => (
                        <tr className="hover:bg-gray-50" {...props} />
                      ),
                      th: ({ node, ...props }: any) => (
                        <th
                          className="border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left align-top whitespace-nowrap"
                          {...props}
                        />
                      ),
                      td: ({ node, ...props }: any) => (
                        <td
                          className="border border-gray-300 px-4 py-2 align-top whitespace-nowrap"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {mdForView}
                  </ReactMarkdown>
                )}

                {markdownView === "pages" &&
                  pagesForView &&
                  Array.isArray(pagesForView) && (
                    <div className="space-y-8">
                      {pagesForView.map((page: any, index: number) => {
                        const pageMarkdown =
                          page?.markdown?.text ||
                          page?.markdown ||
                          page?.text ||
                          "";
                        const pageNumber =
                          page?.page_number !== undefined
                            ? page.page_number
                            : page?.pageIndex !== undefined
                              ? page.pageIndex + 1
                              : index + 1;

                        return (
                          <div
                            key={index}
                            className="border-b border-gray-200 pb-8 last:border-b-0"
                          >
                            <div className="mb-4 flex items-center">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                                Page {pageNumber}
                              </span>
                            </div>
                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeRaw]}
                              components={{
                                ...markdownRehypeRawPassthrough,
                                h1: ({ node, ...props }) => (
                                  <h1
                                    className="text-2xl font-bold mb-4 mt-6"
                                    {...props}
                                  />
                                ),
                                h2: ({ node, ...props }) => (
                                  <h2
                                    className="text-xl font-bold mb-3 mt-5"
                                    {...props}
                                  />
                                ),
                                h3: ({ node, ...props }) => (
                                  <h3
                                    className="text-lg font-semibold mb-2 mt-4"
                                    {...props}
                                  />
                                ),
                                p: ({ node, ...props }: any) => (
                                  <p
                                    className="mb-4 text-gray-700"
                                    {...props}
                                  />
                                ),
                                code: ({ node, inline, ...props }: any) =>
                                  inline ? (
                                    <code
                                      className="bg-gray-100 px-1 py-0.5 rounded text-sm font-mono text-red-600"
                                      {...props}
                                    />
                                  ) : (
                                    <code
                                      className="block bg-gray-100 p-4 rounded-lg text-sm font-mono overflow-x-auto mb-4"
                                      {...props}
                                    />
                                  ),
                                pre: ({ node, ...props }) => (
                                  <pre
                                    className="bg-gray-100 p-4 rounded-lg overflow-x-auto mb-4"
                                    {...props}
                                  />
                                ),
                                ul: ({ node, ...props }) => (
                                  <ul
                                    className="list-disc list-inside mb-4 space-y-1"
                                    {...props}
                                  />
                                ),
                                ol: ({ node, ...props }) => (
                                  <ol
                                    className="list-decimal list-inside mb-4 space-y-1"
                                    {...props}
                                  />
                                ),
                                table: ({ node, ...props }: any) => (
                                  <div className="overflow-x-auto mb-4 my-4">
                                    <table
                                      className="min-w-full border border-gray-300 border-collapse whitespace-nowrap"
                                      {...props}
                                    />
                                  </div>
                                ),
                                thead: ({ node, ...props }: any) => (
                                  <thead className="bg-gray-50" {...props} />
                                ),
                                tbody: ({ node, ...props }: any) => (
                                  <tbody {...props} />
                                ),
                                tr: ({ node, ...props }: any) => (
                                  <tr className="hover:bg-gray-50" {...props} />
                                ),
                                th: ({ node, ...props }: any) => (
                                  <th
                                    className="border border-gray-300 px-4 py-2 bg-gray-50 font-semibold text-left align-top whitespace-nowrap"
                                    {...props}
                                  />
                                ),
                                td: ({ node, ...props }: any) => (
                                  <td
                                    className="border border-gray-300 px-4 py-2 align-top whitespace-nowrap"
                                    {...props}
                                  />
                                ),
                              }}
                            >
                              {pageMarkdown}
                            </ReactMarkdown>
                          </div>
                        );
                      })}
                    </div>
                  )}

                {markdownView === "chunks" &&
                  !sectionScopeActive &&
                  pages &&
                  Array.isArray(pages) && (
                    <div className="space-y-8">
                      {pages.map((page: any, pageIndex: number) => {
                        const pageNumber =
                          page?.pageIndex !== undefined
                            ? page.pageIndex + 1
                            : pageIndex + 1;
                        const sourceBlocks = page?.source_blocks || [];

                        if (!sourceBlocks || sourceBlocks.length === 0) {
                          return (
                            <div
                              key={pageIndex}
                              className="border-b border-gray-200 pb-8 last:border-b-0"
                            >
                              <div className="mb-4 flex items-center">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                                  Page {pageNumber}
                                </span>
                                <span className="ml-4 text-sm text-gray-500">
                                  No chunks available
                                </span>
                              </div>
                            </div>
                          );
                        }

                        return (
                          <div
                            key={pageIndex}
                            className="border-b border-gray-200 pb-8 last:border-b-0"
                          >
                            <div className="mb-4 flex items-center">
                              <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium">
                                Page {pageNumber}
                              </span>
                              <span className="ml-4 text-sm text-gray-500">
                                {sourceBlocks.length} chunk
                                {sourceBlocks.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            <div className="space-y-4">
                              {sourceBlocks.map(
                                (block: any, blockIndex: number) => {
                                  const chunkMarkdown =
                                    block?.markdown ||
                                    block?.text ||
                                    block?.blockContent ||
                                    "";
                                  const chunkType = block?.type || "text";

                                  return (
                                    <div
                                      key={blockIndex}
                                      className="border border-gray-200 rounded-lg p-4 bg-gray-50"
                                    >
                                      <div className="mb-2 flex items-center justify-between">
                                        <span className="px-2 py-1 bg-gray-200 text-gray-700 rounded text-xs font-medium">
                                          Chunk {blockIndex + 1}
                                        </span>
                                        {chunkType && (
                                          <span className="text-xs text-gray-500 capitalize">
                                            {chunkType}
                                          </span>
                                        )}
                                      </div>
                                      <ReactMarkdown
                                        remarkPlugins={[remarkGfm]}
                                        rehypePlugins={[rehypeRaw]}
                                        components={{
                                          ...markdownRehypeRawPassthrough,
                                          h1: ({ node, ...props }) => (
                                            <h1
                                              className="text-xl font-bold mb-3 mt-4"
                                              {...props}
                                            />
                                          ),
                                          h2: ({ node, ...props }) => (
                                            <h2
                                              className="text-lg font-bold mb-2 mt-3"
                                              {...props}
                                            />
                                          ),
                                          h3: ({ node, ...props }) => (
                                            <h3
                                              className="text-base font-semibold mb-2 mt-2"
                                              {...props}
                                            />
                                          ),
                                          p: ({ node, ...props }: any) => (
                                            <p
                                              className="mb-2 text-gray-700 text-sm"
                                              {...props}
                                            />
                                          ),
                                          code: ({
                                            node,
                                            inline,
                                            ...props
                                          }: any) =>
                                            inline ? (
                                              <code
                                                className="bg-gray-200 px-1 py-0.5 rounded text-xs font-mono text-red-600"
                                                {...props}
                                              />
                                            ) : (
                                              <code
                                                className="block bg-gray-200 p-2 rounded text-xs font-mono overflow-x-auto mb-2"
                                                {...props}
                                              />
                                            ),
                                          ul: ({ node, ...props }) => (
                                            <ul
                                              className="list-disc list-inside mb-2 space-y-1 text-sm"
                                              {...props}
                                            />
                                          ),
                                          ol: ({ node, ...props }) => (
                                            <ol
                                              className="list-decimal list-inside mb-2 space-y-1 text-sm"
                                              {...props}
                                            />
                                          ),
                                        }}
                                      >
                                        {chunkMarkdown}
                                      </ReactMarkdown>
                                    </div>
                                  );
                                },
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
              </div>
            </div>
          )}

          {activeTab === "compare" && actual_result && (
            <div className="flex-1 overflow-hidden min-h-0">
              <JsonViewer
                value={sectionData}
                compareWith={actual_result}
                compareLabel="Original (AI)"
                currentLabel="Current (Updated)"
                mode="diff"
                readOnly
                bordered={false}
                showStatusBar={false}
                toolbar={false}
                height="100%"
              />
            </div>
          )}

          {activeTab === "comments" && (
            <div className="flex-1 overflow-auto min-h-0 p-4">
              <div className="space-y-4">
                {/* Comments List */}
                <div className="space-y-3">
                  {comments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <MessageSquare className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                      <Text type="secondary" className="text-sm">
                        No comments yet. Be the first to add one!
                      </Text>
                    </div>
                  ) : (
                    comments.map((comment) => (
                      <div
                        key={comment.id}
                        className="bg-gray-50 rounded-lg p-3 border border-gray-200"
                      >
                        <div className="flex items-start justify-between mb-1">
                          <div>
                            <Text strong className="text-xs">
                              {comment.userEmail}
                            </Text>
                            <Text type="secondary" className="text-xs ml-2">
                              {new Date(comment.createdAt).toLocaleString()}
                            </Text>
                          </div>
                        </div>
                        <Text className="text-sm">{comment.text}</Text>
                      </div>
                    ))
                  )}
                </div>
                {/* Add Comment Form */}
                {onAddComment && (
                  <div className="border-t border-gray-200 pt-4">
                    <TextArea
                      rows={3}
                      placeholder="Add a comment..."
                      value={newComment}
                      onChange={(e) => setNewComment(e.target.value)}
                      className="mb-2"
                    />
                    <Button
                      type="primary"
                      size="small"
                      onClick={handleAddComment}
                      loading={addingComment}
                      disabled={!newComment.trim()}
                    >
                      Add Comment
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Single-section reprocess modal (mirrors the file reprocess modal) */}
      <Modal
        title="Reprocess section"
        open={reprocessOpen}
        onCancel={() => setReprocessOpen(false)}
        confirmLoading={reprocessLoading}
        okText="Reprocess section"
        okButtonProps={{
          disabled: !reprocessOpts.reExtractText && !reprocessOpts.reProcessAi,
        }}
        onOk={handleReprocessSection}
        width={520}
      >
        <p className="text-sm text-gray-600 mb-3">
          Choose what to re-run for{" "}
          <span className="font-medium">
            {selectedSection?.recordId ||
              selectedSection?.slug ||
              "this section"}
          </span>
          .
        </p>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 space-y-2">
          <Checkbox
            checked={reprocessOpts.reExtractText}
            onChange={(e) =>
              setReprocessOpts((p) => ({
                ...p,
                reExtractText: e.target.checked,
              }))
            }
          >
            <span className="font-medium">Re-run Text Extraction</span>
            <div className="text-xs text-gray-600 ml-6">
              Re-OCR this section&apos;s pages from the original PDF
            </div>
          </Checkbox>
          <Checkbox
            checked={reprocessOpts.reProcessAi}
            onChange={(e) =>
              setReprocessOpts((p) => ({
                ...p,
                reProcessAi: e.target.checked,
              }))
            }
          >
            <span className="font-medium">Re-run AI Processing</span>
            <div className="text-xs text-gray-600 ml-6">
              Re-extract structured data with AI using the current schema
            </div>
          </Checkbox>
        </div>
      </Modal>

      {/* Directed group re-extraction: pick up to 3 groups, say what's
          wrong, and a vision model re-reads the chosen pages (one focused
          call per group). Differences arrive as QA findings to review —
          nothing is overwritten directly.
          Maskless + draggable (framer-motion, like QAProgressFloat) so the
          operator can scroll the PDF/result behind it while deciding what to
          fix; closing it keeps the typed state (see reextractFormSection). */}
      <Modal
        title={
          <div
            onPointerDown={(e) => reextractDragControls.start(e)}
            className="flex items-center gap-2 cursor-move select-none touch-none -my-1 py-1"
          >
            <GripVertical className="w-3.5 h-3.5 text-gray-300 flex-shrink-0" />
            Fix groups with AI
          </div>
        }
        open={reextractOpen}
        onCancel={() => setReextractOpen(false)}
        confirmLoading={reextractLoading}
        okText={reextractLoading ? "Queueing…" : "Queue re-extraction"}
        okButtonProps={{
          disabled: reextractGroups.length === 0 || reextractPages.length === 0,
        }}
        onOk={handleReextractGroup}
        width={560}
        mask={false}
        maskClosable={false}
        wrapClassName="pointer-events-none"
        modalRender={(node) => (
          <motion.div
            drag
            dragListener={false}
            dragControls={reextractDragControls}
            dragMomentum={false}
            dragElastic={0}
            className="pointer-events-auto"
          >
            {node}
          </motion.div>
        )}
      >
        <p className="text-sm text-gray-600 mb-3">
          Re-reads the selected pages with a vision model and stages the
          differences as QA findings for{" "}
          <span className="font-medium">
            {selectedSection?.recordId ||
              selectedSection?.slug ||
              "this section"}
          </span>
          . Runs in the background; nothing is applied until you review.
        </p>
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              Groups to re-extract{" "}
              <span className="text-gray-400">
                (up to {MAX_REEXTRACT_GROUPS} — each gets its own focused pass)
              </span>
            </div>
            <Select
              mode="multiple"
              className="w-full"
              placeholder="e.g. samples_collected"
              value={reextractGroups}
              onChange={(v: string[]) =>
                setReextractGroups(v.slice(0, MAX_REEXTRACT_GROUPS))
              }
              options={reextractGroupOptions}
              showSearch
              disabled={reextractLoading}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              What&apos;s wrong? <span className="text-gray-400">(optional)</span>
            </div>
            <Input.TextArea
              rows={3}
              placeholder="e.g. Most sample rows are missing — the table continues onto the second page."
              value={reextractPrompt}
              onChange={(e) => setReextractPrompt(e.target.value)}
              disabled={reextractLoading}
            />
            {promptSuggestions.length > 0 && (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {promptSuggestions.slice(0, 5).map((s) => (
                  <button
                    key={s.prompt}
                    type="button"
                    title={`${s.prompt}${s.uses > 1 ? ` — used ${s.uses}×` : ""}`}
                    onClick={() => setReextractPrompt(s.prompt)}
                    disabled={reextractLoading}
                    className={`max-w-full truncate text-[11px] px-2 py-0.5 rounded-full border transition-colors cursor-pointer ${
                      s.same_slug
                        ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                        : "border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100"
                    }`}
                  >
                    {s.prompt.length > 64
                      ? `${s.prompt.slice(0, 64)}…`
                      : s.prompt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              Strategy
            </div>
            <Select
              className="w-full"
              value={reextractMode}
              onChange={(v: import("@/lib/api").ReextractMode) =>
                setReextractMode(v)
              }
              disabled={reextractLoading}
              options={[
                {
                  value: "auto",
                  label: "Auto — full re-read, or spot-fix for large tables",
                },
                {
                  value: "full",
                  label: "Full re-read — re-transcribe the whole group",
                },
                {
                  value: "patch",
                  label: "Spot-fix — only flag what's wrong (large tables)",
                },
              ]}
            />
          </div>
          <div>
            <div className="text-xs font-medium text-gray-700 mb-1">
              Pages to read{" "}
              <span className="text-gray-400">
                (max {MAX_REEXTRACT_PAGES} — type any page number, e.g. one the
                classifier missed)
              </span>
            </div>
            <Select
              mode="tags"
              className="w-full"
              placeholder="e.g. 46"
              value={reextractPages.map(String)}
              onChange={(vals: string[]) => {
                const pages = [
                  ...new Set(
                    vals
                      .map((v) => parseInt(v, 10))
                      .filter((n) => Number.isInteger(n) && n >= 1),
                  ),
                ].sort((a, b) => a - b);
                if (pages.length > MAX_REEXTRACT_PAGES) {
                  message.warning(
                    `At most ${MAX_REEXTRACT_PAGES} pages — pick the pages that actually hold the data`,
                  );
                }
                setReextractPages(pages.slice(0, MAX_REEXTRACT_PAGES));
              }}
              options={reextractSectionPages.map((p) => ({
                value: String(p),
                label: `Page ${p}`,
              }))}
              disabled={reextractLoading}
            />
          </div>
        </div>
      </Modal>

      {/* Floating QA progress — one row per section in the background run,
          same pattern as the job page's processing toast. */}
      {qaRun && (
        <QAProgressFloat
          run={qaRun}
          labelById={qaSectionLabelById}
          onDismiss={() => setQaRun(null)}
        />
      )}

      {/* Floating re-extraction progress — one row per (section, group),
          stacked above the QA float so both can show at once. */}
      {reextractRun && (
        <ReextractProgressFloat
          run={reextractRun}
          labelById={qaSectionLabelById}
          onDismiss={() => setReextractRun(null)}
        />
      )}
    </div>
  );
};

export default TabbedDataViewer;
