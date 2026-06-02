"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { jsonToCsv } from "@/lib/csvExport";
import { ChevronLeft, ChevronRight, MessageSquare } from "lucide-react";
import { App, Button, Input, Select, Typography } from "antd";
import { JsonViewer } from "@/components/json";
import {
  isV2ResultEnvelope,
  type SectionResult,
  type SectionVerification,
  type SectionVerificationStatus,
  type V2ResultEnvelope,
} from "@/lib/api";

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

function formatSectionOptionLabel(entry: SectionPickerEntry): string {
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
  return parts.join(" · ");
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

function SectionVerifyControls({
  verification,
  loading,
  onVerify,
  onBulkApprove,
  totalSections,
  verificationMap,
  sectionEntries,
}: {
  verification: SectionVerification | null;
  loading: boolean;
  onVerify: (status: SectionVerificationStatus) => void;
  onBulkApprove?: () => void;
  totalSections: number;
  verificationMap: Map<string, SectionVerification>;
  sectionEntries: SectionPickerEntry[];
}) {
  const currentStatus = verification?.status ?? "pending";
  const cfg = VERIFY_STATUS_CONFIG[currentStatus];

  // Count approved / total for progress
  const approvedCount = sectionEntries.filter(
    (e) =>
      e.sectionResultId &&
      verificationMap.get(e.sectionResultId)?.status === "approved",
  ).length;
  const allApproved = approvedCount === totalSections && totalSections > 0;

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
          <button
            type="button"
            disabled={loading}
            onClick={() => onVerify("approved")}
            className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Approve this section"
          >
            Approve
          </button>
        )}
        {currentStatus !== "rejected" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onVerify("rejected")}
            className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-red-700 hover:bg-red-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Reject this section"
          >
            Reject
          </button>
        )}
        {currentStatus !== "pending" && (
          <button
            type="button"
            disabled={loading}
            onClick={() => onVerify("pending")}
            className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
            title="Reset to pending"
          >
            Reset
          </button>
        )}
        {onBulkApprove && !allApproved && totalSections > 1 && (
          <>
            <span className="w-px h-3.5 bg-gray-200 mx-0.5" />
            <button
              type="button"
              disabled={loading}
              onClick={onBulkApprove}
              className="px-1.5 py-0.5 text-[10px] text-gray-500 hover:text-green-700 hover:bg-green-50 rounded transition-colors disabled:opacity-40 cursor-pointer disabled:cursor-not-allowed"
              title={`Approve all ${totalSections} sections`}
            >
              Approve all
            </button>
          </>
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
}) => {
  const { message } = App.useApp();
  const [activeTab, setActiveTab] = useState<TabType>("results");
  const [markdownView, setMarkdownView] = useState<MarkdownViewType>("full");
  const [editableJson, setEditableJson] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [addingComment, setAddingComment] = useState(false);
  const [selectedSectionIdx, setSelectedSectionIdx] = useState<number>(0);

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
      const ids = sectionEntries
        .map((e) => e.sectionResultId)
        .filter((id): id is string => !!id);
      if (ids.length === 0) return;
      setVerifyLoading(true);
      try {
        await onBulkSectionVerify(ids, status);
        message.success(`All ${ids.length} sections marked as ${status}`);
      } catch {
        message.error("Failed to bulk update");
      } finally {
        setVerifyLoading(false);
      }
    },
    [sectionEntries, onBulkSectionVerify, message],
  );

  // The data that the data-shaped tabs (Preview, JSON, CSV, Edit) operate on.
  // When v2 we scope to the selected section so the user sees one focused
  // result tree; when v1, we pass the original `data` through unchanged.
  const sectionData: unknown =
    isV2 && selectedSection ? selectedSection.data : data;

  // Reset section selection when the underlying data shape changes (e.g.,
  // file switch). Otherwise an out-of-range index can persist briefly.
  React.useEffect(() => {
    if (selectedSectionIdx > sectionEntries.length - 1) {
      setSelectedSectionIdx(0);
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
  // and call onUpdate with the full envelope so the file's persisted result
  // shape stays consistent (downstream consumers always see V2ResultEnvelope).
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

        if (isV2 && selectedSection) {
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
          await onUpdate(parsedSectionData);
        }

        setJsonError(null);
      } catch (error) {
        setJsonError(error instanceof Error ? error.message : "Failed to save");
      } finally {
        setIsSaving(false);
      }
    },
    [onUpdate, jsonError, isSaving, editableJson, isV2, selectedSection, data],
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
              setSelectedSectionIdx(Math.max(0, selectedSectionIdx - 1))
            }
            className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Previous section"
          >
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <Select
            showSearch
            value={selectedSectionIdx}
            onChange={(v: number) => setSelectedSectionIdx(v)}
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
                    label={formatSectionOptionLabel(entry)}
                  >
                    {formatSectionOptionLabel(entry)}
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
                        label={`${entry.recordId ?? ""} ${formatSectionOptionLabel(entry)}`}
                      >
                        {formatSectionOptionLabel(entry)}
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
              setSelectedSectionIdx(
                Math.min(sectionEntries.length - 1, selectedSectionIdx + 1),
              )
            }
            className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            title="Next section"
          >
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
          <span className="text-xs text-gray-400 whitespace-nowrap tabular-nums">
            {selectedSectionIdx + 1} / {sectionEntries.length}
          </span>

          {/* Verification controls */}
          {onSectionVerify && selectedSection?.sectionResultId && (
            <>
              <span className="w-px h-5 bg-gray-200 mx-1" />
              <SectionVerifyControls
                verification={selectedVerification}
                loading={verifyLoading}
                onVerify={handleVerify}
                onBulkApprove={
                  onBulkSectionVerify
                    ? () => handleBulkVerify("approved")
                    : undefined
                }
                totalSections={sectionEntries.length}
                verificationMap={verificationMap}
                sectionEntries={sectionEntries}
              />
            </>
          )}
        </div>
      )}

      {/* Tab Headers */}
      <div className="flex items-center justify-between border-b border-gray-200 flex-shrink-0">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("results")}
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
              onClick={() => setActiveTab("markdown")}
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
              onClick={() => setActiveTab("compare")}
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
              onClick={() => setActiveTab("comments")}
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
          {activeTab === "results" && (
            <div className="flex-1 min-h-0 flex flex-col">
              <JsonViewer
                text={editableJson}
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
                        "search",
                        "copy",
                        "download",
                        "upload",
                        "cancel",
                        "save",
                      ]
                    : ["mode", "search", "copy", "download"]
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
            </div>
          )}

          {activeTab === "markdown" && markdown && (
            <div className="flex-1 flex flex-col overflow-hidden min-h-0">
              {/* Markdown Subtabs */}
              {pages && Array.isArray(pages) && pages.length > 0 && (
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
                    {markdown}
                  </ReactMarkdown>
                )}

                {markdownView === "pages" && pages && Array.isArray(pages) && (
                  <div className="space-y-8">
                    {pages.map((page: any, index: number) => {
                      const pageMarkdown =
                        page?.markdown?.text || page?.markdown || "";
                      const pageNumber =
                        page?.pageIndex !== undefined
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

                {markdownView === "chunks" && pages && Array.isArray(pages) && (
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
    </div>
  );
};

export default TabbedDataViewer;
