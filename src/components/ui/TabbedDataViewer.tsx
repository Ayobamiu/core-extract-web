"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { jsonToCsv } from "@/lib/csvExport";
import { buildFieldDescriptionMap } from "@/lib/schemaDescriptions";
import {
  getByPath,
  setByPath,
  coerceExpected,
  APPLYABLE_ISSUE_TYPES,
} from "@/lib/jsonPath";
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  MoreHorizontal,
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
  type SectionResult,
  type SectionVerification,
  type SectionVerificationStatus,
  type V2ResultEnvelope,
} from "@/lib/api";
import type { ViewerResultTab } from "@/lib/jobViewUrlState";

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
  status?: string;
}

function buildSectionPickerEntries(
  envelope: V2ResultEnvelope,
  sectionResults?: SectionResult[],
  detectedSections?: {
    sections?: Array<{
      document_type_slug: string;
      record_id?: string | null;
      page_range?: [number, number];
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
    Array<{ record_id?: string | null; page_range?: [number, number] }>
  >();
  if (detectedSections?.sections) {
    for (const ds of detectedSections.sections) {
      if (!ds.document_type_slug || ds.document_type_slug === "none") continue;
      const arr = detectedBySlug.get(ds.document_type_slug) ?? [];
      arr.push({ record_id: ds.record_id, page_range: ds.page_range });
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
        status: sr?.status,
      });
    });
  }
  return entries;
}

function formatSectionLabel(entry: SectionPickerEntry): string {
  const range = entry.pageRange;
  const pageBit =
    range && range[0] != null && range[1] != null
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
    range && range[0] != null && range[1] != null
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

function QAFindingsPanel({
  findings,
  onUpdate,
  onApply,
  canApply,
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
}) {
  const [updating, setUpdating] = useState<string | null>(null);
  const open = findings.filter((f) => f.status === "open");
  const resolved = findings.filter((f) => f.status !== "open");
  const [showResolved, setShowResolved] = useState(false);

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

  const renderFinding = (f: import("@/lib/api").QAFinding) => {
    const cfg = SEVERITY_CONFIG[f.severity] ?? SEVERITY_CONFIG.info;
    const isResolved = f.status !== "open";
    return (
      <div
        key={f.id}
        className={`rounded-md border px-3 py-2 ${cfg.bg} ${cfg.border} ${isResolved ? "opacity-60" : ""}`}
      >
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
            {(f.expected || f.actual) && (
              <div className="mt-1 text-xs text-gray-600 space-y-0.5">
                {f.expected && (
                  <div>
                    <span className="font-medium">Expected:</span> {f.expected}
                  </div>
                )}
                {f.actual && (
                  <div>
                    <span className="font-medium">Actual:</span> {f.actual}
                  </div>
                )}
              </div>
            )}
            <p className="mt-1 text-xs text-gray-500 italic">{f.explanation}</p>
          </div>
          {!isResolved && (
            <div className="flex gap-1 flex-shrink-0">
              {canApply && APPLYABLE_ISSUE_TYPES.has(f.issue_type) && (
                <>
                  <button
                    onClick={() => onApply(f)}
                    className="text-xs text-blue-700 font-medium hover:underline"
                    title={`Set ${f.field_path} = ${f.issue_type === "extra_value" ? "null" : (f.expected ?? "null")}`}
                  >
                    Apply
                  </button>
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
}: {
  verification: SectionVerification | null;
  loading: boolean;
  onVerify: (status: SectionVerificationStatus) => void;
  totalSections: number;
  verificationMap: Map<string, SectionVerification>;
  sectionEntries: SectionPickerEntry[];
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
                title="Approve this section"
              >
                Approve
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
        message.success(`${ids.length} section${ids.length === 1 ? "" : "s"} marked as ${status}`);
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
  const [qaLoading, setQaLoading] = useState<"idle" | "section" | "all">(
    "idle",
  );
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

  // ── Per-section markdown scope ("This section" vs "Whole file") ──
  const [markdownScope, setMarkdownScope] = useState<"section" | "file">(
    "section",
  );
  const [sectionMarkdownLoading, setSectionMarkdownLoading] = useState(false);
  // Cache section markdown by sectionResultId so toggling/navigating is instant.
  const [sectionMarkdownCache, setSectionMarkdownCache] = useState<
    Record<string, { markdown: string; pages: { page_number: number; markdown: string }[] }>
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

  // Copy + label for the run-all / run-remaining control.
  const runAllLabel =
    qaLoading === "all"
      ? "Running…"
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

  const handleRunSectionQA = useCallback(async () => {
    if (!fileId || !selectedSection?.sectionResultId) return;
    setQaLoading("section");
    try {
      const res = await apiClient.runSectionQA(
        fileId,
        selectedSection.sectionResultId,
      );
      if (res.status === "success" && res.findings) {
        const id = selectedSection.sectionResultId;
        setQaFindings((prev) => ({ ...prev, [id]: res.findings }));
        setSessionQaedIds((prev) => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        const count = res.findings.filter(
          (f: import("@/lib/api").QAFinding) => f.status === "open",
        ).length;
        message.success(
          `QA complete — ${count} issue${count === 1 ? "" : "s"} found`,
        );
      } else {
        message.error(res.message || "QA failed");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "QA failed");
    } finally {
      setQaLoading("idle");
    }
  }, [fileId, selectedSection?.sectionResultId, message]);

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
        // Reload findings + run records from the server (authoritative).
        const findingsRes = await apiClient.getQAFindings(fileId);
        if (findingsRes.status === "success") {
          if (findingsRes.findings) setQaFindings(findingsRes.findings);
          if (findingsRes.qaRuns)
            setPersistedQaedIds(new Set(Object.keys(findingsRes.qaRuns)));
        }
        setSessionQaedIds((prev) =>
          remainingOnly ? new Set([...prev, ...remaining]) : new Set(allSectionIds),
        );
        const total = (res as any).totalFindings ?? 0;
        const scopeLabel = remainingOnly
          ? `${remaining.length} remaining section${remaining.length === 1 ? "" : "s"}`
          : "all sections";
        message.success(
          `QA complete — ${total} issue${total === 1 ? "" : "s"} found across ${scopeLabel}`,
        );
      } else {
        message.error(res.message || "QA failed");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "QA failed");
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
  }, [activeTab, markdownScope, fileId, selectedSection?.sectionResultId, sectionMarkdownCache]);

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
  }
  if (fileId && allSectionIds.length > 0) {
    bulkMenuItems.push({
      key: "run-all-qa",
      label: runAllLabel,
      disabled: qaLoading !== "idle",
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
  if (
    onBulkSectionVerify &&
    !allSectionsApproved &&
    allSectionIds.length > 1
  ) {
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
    ? currentSectionMarkdown?.markdown ?? ""
    : markdown ?? "";
  const pagesForView = sectionScopeActive
    ? currentSectionMarkdown?.pages ?? []
    : pages;

  // Inject a finding's "right answer" (expected) into the editable JSON at its
  // field_path. The user reviews the change in the tree and Saves to persist
  // (via the existing per-record PATCH). extra_value (hallucination) → set null.
  const handleApplyFinding = useCallback(
    (finding: import("@/lib/api").QAFinding) => {
      try {
        const parsed = JSON.parse(editableJson);
        const current = getByPath(parsed, finding.field_path);
        const newValue =
          finding.issue_type === "extra_value"
            ? null
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
    [editableJson, message],
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
                    description="Analyzes the current section's extracted data. This may take a moment."
                    okText={sectionQaBase}
                    cancelText="Cancel"
                    disabled={qaLoading !== "idle"}
                    onConfirm={handleRunSectionQA}
                  >
                    <span className="inline-flex">
                      <button
                        type="button"
                        disabled={qaLoading !== "idle"}
                        className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
                      >
                        {qaLoading === "section"
                          ? "Running…"
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
            (showFindings ? (
              // JSON result on top, QA findings below — the divider between them
              // is draggable so the user can grow either pane.
              <Splitter layout="vertical" className="flex-1 min-h-0">
                <Splitter.Panel min={120}>
                  <div className="h-full min-h-0 flex flex-col">
                    {jsonViewerEl}
                  </div>
                </Splitter.Panel>
                <Splitter.Panel defaultSize={220} min={80} max="70%">
                  <QAFindingsPanel
                    findings={selectedSectionFindings}
                    onUpdate={handleUpdateFinding}
                    onApply={handleApplyFinding}
                    canApply={editable}
                  />
                </Splitter.Panel>
              </Splitter>
            ) : (
              <div className="flex-1 min-h-0 flex flex-col">{jsonViewerEl}</div>
            ))}

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
              {pagesForView && Array.isArray(pagesForView) && pagesForView.length > 0 && (
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
                        page?.markdown?.text || page?.markdown || page?.text || "";
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
                                <p className="mb-4 text-gray-700" {...props} />
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
          disabled:
            !reprocessOpts.reExtractText && !reprocessOpts.reProcessAi,
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
    </div>
  );
};

export default TabbedDataViewer;
