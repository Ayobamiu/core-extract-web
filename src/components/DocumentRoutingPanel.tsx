"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  App,
  Button,
  Checkbox,
  Empty,
  Collapse,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
} from "antd";
import {
  CheckCircleFilled,
  CloseCircleFilled,
  CopyOutlined,
  WarningFilled,
  EyeOutlined,
} from "@ant-design/icons";
import { Loader } from "lucide-react";
import {
  apiClient,
  DetectedPage,
  DetectedSection,
  DetectedSections,
  DocumentTypeInfo,
} from "@/lib/api";
import {
  splitSection,
  mergeSections,
  changeSectionSlug,
  addPageToSection,
  createSectionFromPage,
  hasUnsavedChanges,
  getSectionsNeedingExtraction,
} from "@/lib/routingEdits";

interface Props {
  fileId: string;
  detectedSections: DetectedSections | null | undefined;
  // extraction_metadata.visual_page_classifier — the worker's record of
  // what actually ran (may differ from detected_sections if the classifier
  // ran but extraction fell back to the full doc).
  visualClassifierMeta?: {
    ran?: boolean;
    fell_back?: boolean;
    fell_back_reason?: string;
    section_count?: number;
    file_status?: string;
    extraction_pages?: number[];
    total_pages?: number;
    classifier?: { provider?: string; model?: string; version?: number };
  } | null;
  // Called with the updated detected_sections blob whenever the operator
  // approves / re-routes / splits a section. Parent should hold the source
  // of truth for `file.detected_sections` so the panel reflects the new
  // state without a full file re-fetch.
  onSectionsUpdated?: (next: DetectedSections) => void;
  /** Scroll the left-hand PDF pane to this page (1-based). */
  onNavigateToPdfPage?: (pageNumber: number) => void;
}

type ActionKind =
  | "change_slug"
  | "split"
  | "merge"
  | "new_section"
  | "include_skipped";
interface ActionState {
  kind: ActionKind;
  sectionIndex: number;
  // For "new_section": the orphan page the section is created from.
  pageNumber?: number;
}

// ─── Per-page thumbnail with intersection-observer-based lazy fetch ────────
//
// Lazy loads on demand so a 200-page document doesn't fire 200 simultaneous
// rasterise requests. Cleans up its blob URL on unmount.
function PageThumbnail({
  fileId,
  pageNumber,
  width = 160,
  onClick,
}: {
  fileId: string;
  pageNumber: number;
  width?: number;
  onClick?: () => void;
}) {
  const containerRef = useRef<HTMLButtonElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Trigger fetch when the thumbnail enters the viewport (or close to it).
  useEffect(() => {
    if (!containerRef.current) return;
    const node = containerRef.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        }
      },
      { rootMargin: "200px" }
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Fetch the JPEG once shouldLoad flips true.
  useEffect(() => {
    if (!shouldLoad) return;
    let cancelled = false;
    let blobUrl: string | null = null;
    const ctrl = new AbortController();
    (async () => {
      try {
        blobUrl = await apiClient.getFilePageThumbnail(fileId, pageNumber, {
          width,
          signal: ctrl.signal,
        });
        if (!cancelled) setSrc(blobUrl);
      } catch (err: any) {
        if (!cancelled && err?.name !== "AbortError") {
          setError(err?.message || "Failed to load");
        }
      }
    })();
    return () => {
      cancelled = true;
      ctrl.abort();
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [shouldLoad, fileId, pageNumber, width]);

  return (
    <Tooltip title="View page in PDF">
      <button
        type="button"
        ref={containerRef}
        onClick={onClick}
        className={`relative bg-gray-100 border border-gray-200 rounded shrink-0 flex items-center justify-center overflow-hidden p-0 ${
          onClick
            ? "cursor-pointer hover:border-blue-400 hover:ring-2 hover:ring-blue-200 transition-shadow"
            : ""
        }`}
        style={{ width, height: width * 1.3, minWidth: width }}
      >
        {src ? (
          <img
            src={src}
            alt={`Page ${pageNumber}`}
            className="w-full h-full object-contain pointer-events-none"
          />
        ) : error ? (
          <div className="text-xs text-red-500 px-2 text-center">
            Thumbnail failed
          </div>
        ) : (
          <Loader className="w-5 h-5 animate-spin text-gray-400" />
        )}
        <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded pointer-events-none">
          p.{pageNumber}
        </div>
      </button>
    </Tooltip>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────

function purposeColor(purpose?: string): string {
  switch (purpose) {
    case "data":
      return "green";
    case "reference":
      return "blue";
    case "boilerplate":
      return "default";
    case "cover":
      return "purple";
    case "blank":
      return "default";
    case "attachment":
      return "geekblue";
    default:
      return "default";
  }
}

function statusColor(status?: string): string {
  switch (status) {
    case "auto_approved":
    case "approved":
      return "green";
    case "pending_review":
      return "orange";
    case "skipped":
      return "default";
    default:
      return "default";
  }
}

function statusLabel(status?: string): string {
  if (!status) return "unknown";
  return status.replace(/_/g, " ");
}

interface PageDecision {
  page: DetectedPage;
  decision: "extract" | "skip" | "outside";
  reason?: string;
  duplicate_of?: number | null;
}

function decisionsForSection(
  section: DetectedSection,
  pages: DetectedPage[]
): PageDecision[] {
  const inRange = pages.filter(
    (p) =>
      p.page_number >= section.page_range[0] &&
      p.page_number <= section.page_range[1]
  );
  return inRange.map((p) => {
    if (section.extraction_pages.includes(p.page_number)) {
      return { page: p, decision: "extract" };
    }
    const skip = section.skipped_pages.find(
      (s) => s.page_number === p.page_number
    );
    if (skip) {
      return {
        page: p,
        decision: "skip",
        reason: skip.reason,
        duplicate_of: skip.duplicate_of ?? null,
      };
    }
    return { page: p, decision: "skip", reason: "unknown" };
  });
}

function pagesOutsideAnySection(
  pages: DetectedPage[],
  sections: DetectedSection[]
): DetectedPage[] {
  if (sections.length === 0) return pages;
  return pages.filter(
    (p) =>
      !sections.some(
        (s) =>
          p.page_number >= s.page_range[0] && p.page_number <= s.page_range[1]
      )
  );
}

// For an orphan page, find the nearest section ending before it (prev) and the
// nearest section starting after it (next). Sections are in document order.
function adjacentSectionIndices(
  pageNumber: number,
  sections: DetectedSection[]
): { prevIdx: number; nextIdx: number } {
  let prevIdx = -1;
  let nextIdx = -1;
  for (let i = 0; i < sections.length; i++) {
    if (sections[i].page_range[1] < pageNumber) prevIdx = i;
    if (sections[i].page_range[0] > pageNumber && nextIdx === -1) nextIdx = i;
  }
  return { prevIdx, nextIdx };
}

// ─── Main component ───────────────────────────────────────────────────────

export default function DocumentRoutingPanel({
  fileId,
  detectedSections,
  visualClassifierMeta,
  onSectionsUpdated,
  onNavigateToPdfPage,
}: Props) {
  const { message } = App.useApp();

  // ── Local draft state ─────────────────────────────────────────────
  // Split/merge/slug-change are performed client-side on a local copy.
  // Nothing hits the server until the user clicks "Save & Re-extract".
  // "Discard" resets to the server version.
  const [draft, setDraft] = useState<DetectedSections | null>(null);

  // Reset draft when the server state changes (file switch, post-save refresh)
  useEffect(() => {
    setDraft(null);
  }, [detectedSections]);

  // The "active" blob: draft if editing, otherwise server state
  const activeSections = draft ?? detectedSections;
  const sections = activeSections?.sections ?? [];
  const pages = activeSections?.pages ?? [];
  const isDirty = draft !== null;

  // Slugs for the change-slug picker
  const [availableSlugs, setAvailableSlugs] = useState<DocumentTypeInfo[]>([]);
  const [slugsLoaded, setSlugsLoaded] = useState(false);

  const [activeAction, setActiveAction] = useState<ActionState | null>(null);
  const [actionLoadingFor, setActionLoadingFor] = useState<number | null>(null);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [pickedSplitPage, setPickedSplitPage] = useState<number | null>(null);
  const [pickedSkippedPages, setPickedSkippedPages] = useState<number[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getDocumentTypes({ includeDeprecated: true });
        if (cancelled) return;
        if (res.success && res.documentTypes) {
          setAvailableSlugs(res.documentTypes);
        }
      } catch {
        // Non-fatal: the picker just won't have suggestions.
      } finally {
        if (!cancelled) setSlugsLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const closeAction = useCallback(() => {
    setActiveAction(null);
    setPickedSlug(null);
    setPickedSplitPage(null);
    setPickedSkippedPages([]);
  }, []);

  // ── Client-side edit handlers (no server calls) ───────────────────

  const handleApprove = useCallback(
    async (sectionIndex: number) => {
      // Approve still goes to the server (it's a lightweight status flip,
      // not a structural change that needs undo support).
      setActionLoadingFor(sectionIndex);
      try {
        const res = await apiClient.routingApproveSection(fileId, sectionIndex);
        if (res.success && res.detected_sections) {
          message.success("Section approved");
          onSectionsUpdated?.(res.detected_sections);
        } else {
          message.error(res.message || "Approve failed");
        }
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : "Approve failed");
      } finally {
        setActionLoadingFor(null);
      }
    },
    [fileId, onSectionsUpdated],
  );

  const handleChangeSlug = useCallback(() => {
    if (!activeAction || activeAction.kind !== "change_slug" || !pickedSlug) return;
    if (!activeSections) return;
    try {
      const updated = changeSectionSlug(activeSections, activeAction.sectionIndex, pickedSlug);
      setDraft(updated);
      message.success(`Section re-routed to ${pickedSlug} (unsaved)`);
      closeAction();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Change failed");
    }
  }, [activeAction, pickedSlug, activeSections, closeAction]);

  const handleSplit = useCallback(() => {
    if (!activeAction || activeAction.kind !== "split" || pickedSplitPage == null) return;
    if (!activeSections) return;
    try {
      const updated = splitSection(activeSections, activeAction.sectionIndex, pickedSplitPage);
      setDraft(updated);
      message.success(`Section split at page ${pickedSplitPage} (unsaved)`);
      closeAction();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Split failed");
    }
  }, [activeAction, pickedSplitPage, activeSections, closeAction]);

  const handleMerge = useCallback(
    (sectionIndex: number) => {
      if (!activeSections) return;
      try {
        const updated = mergeSections(activeSections, sectionIndex);
        setDraft(updated);
        message.success("Sections merged (unsaved)");
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : "Merge failed");
      }
    },
    [activeSections],
  );

  const handleAddToSection = useCallback(
    (pageNumber: number, sectionIndex: number) => {
      if (!activeSections) return;
      try {
        const updated = addPageToSection(activeSections, sectionIndex, pageNumber);
        setDraft(updated);
        message.success(`Page ${pageNumber} added to section (unsaved)`);
      } catch (err: unknown) {
        message.error(err instanceof Error ? err.message : "Add failed");
      }
    },
    [activeSections],
  );

  const handleIncludeSkipped = useCallback(() => {
    if (!activeAction || activeAction.kind !== "include_skipped") return;
    if (!activeSections || pickedSkippedPages.length === 0) return;
    try {
      // Force each picked page into the section (in document order). In-range
      // additions don't reorder sections, so sectionIndex stays valid.
      let blob = activeSections;
      const pages = [...pickedSkippedPages].sort((a, b) => a - b);
      for (const pageNumber of pages) {
        blob = addPageToSection(blob, activeAction.sectionIndex, pageNumber);
      }
      setDraft(blob);
      message.success(
        `${pages.length} page${pages.length === 1 ? "" : "s"} added to section (unsaved)`,
      );
      closeAction();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Include failed");
    }
  }, [activeAction, pickedSkippedPages, activeSections, closeAction]);

  const handleCreateSection = useCallback(() => {
    if (!activeAction || activeAction.kind !== "new_section") return;
    if (activeAction.pageNumber == null || !pickedSlug) return;
    if (!activeSections) return;
    try {
      const updated = createSectionFromPage(
        activeSections,
        activeAction.pageNumber,
        pickedSlug,
      );
      setDraft(updated);
      message.success(
        `Page ${activeAction.pageNumber} → new ${pickedSlug} section (unsaved)`,
      );
      closeAction();
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Create failed");
    }
  }, [activeAction, pickedSlug, activeSections, closeAction]);

  const handleDiscard = useCallback(() => {
    setDraft(null);
    message.info("Changes discarded");
  }, []);

  // ── Save & Re-extract (the only server call for edits) ────────────

  const [saveLoading, setSaveLoading] = useState(false);

  const handleSaveAndReextract = useCallback(async () => {
    if (!draft) return;
    setSaveLoading(true);
    try {
      const res = await apiClient.saveAndReextractSections(fileId, draft);
      if (res.status === "success") {
        const count = getSectionsNeedingExtraction(draft).length;
        message.success(
          count > 0
            ? `Saved and re-extracted ${count} section${count === 1 ? "" : "s"}`
            : "Saved (no extraction needed)",
        );
        const noText = res.pages_without_text ?? [];
        if (noText.length > 0) {
          message.warning(
            `No extractable text found for page${noText.length === 1 ? "" : "s"} ${noText.join(", ")} — ` +
              `the corresponding section${noText.length === 1 ? "" : "s"} may have produced no content.`,
            8,
          );
        }
        if (res.detected_sections) {
          onSectionsUpdated?.(res.detected_sections);
        }
        setDraft(null);
      } else {
        message.error(res.message || "Save failed");
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaveLoading(false);
    }
  }, [draft, fileId, onSectionsUpdated]);

  // Sections needing extraction (for the old re-extract banner on server state)
  const needsExtractionIndices = useMemo(() => {
    return getSectionsNeedingExtraction(detectedSections);
  }, [detectedSections]);

  // Draft sections needing extraction
  const draftNeedsExtraction = useMemo(() => {
    return draft ? getSectionsNeedingExtraction(draft) : [];
  }, [draft]);

  // High-level summary numbers.
  const summary = useMemo(() => {
    const totalPages = pages.length;
    const extractCount = sections.reduce(
      (n, s) => n + s.extraction_pages.length,
      0
    );
    const skipCount = sections.reduce(
      (n, s) => n + s.skipped_pages.length,
      0
    );
    const orphans = pagesOutsideAnySection(pages, sections);
    return { totalPages, extractCount, skipCount, orphanCount: orphans.length };
  }, [pages, sections]);

  if (!detectedSections) {
    return (
      <div className="px-4 py-6">
        <Empty
          description={
            <div className="text-sm text-gray-500">
              <div>The visual page classifier did not run on this file.</div>
              <div className="mt-1 text-xs">
                Enable it on the job&apos;s processing config to see the
                per-page routing decisions here.
              </div>
            </div>
          }
        />
      </div>
    );
  }

  const orphans = pagesOutsideAnySection(pages, sections);

  return (
    <div className="px-4 py-3 space-y-3">
      {/* Top summary bar */}
      <div className="flex items-center justify-between flex-wrap gap-2 bg-gray-50 border border-gray-200 rounded p-3">
        <div className="flex items-center gap-3 flex-wrap">
          <Tag
            color={statusColor(detectedSections.status)}
            icon={
              detectedSections.status === "auto_approved" ? (
                <CheckCircleFilled />
              ) : detectedSections.status === "pending_review" ? (
                <WarningFilled />
              ) : undefined
            }
          >
            {statusLabel(detectedSections.status)}
          </Tag>
          <span className="text-sm text-gray-700">
            <span className="font-semibold text-gray-900">
              {summary.extractCount}
            </span>
            <span className="text-gray-500"> / {summary.totalPages} pages</span>
            <span className="text-gray-500"> for extraction</span>
            {summary.skipCount > 0 && (
              <>
                {" · "}
                <span className="text-gray-500">{summary.skipCount} skipped</span>
              </>
            )}
            {summary.orphanCount > 0 && (
              <>
                {" · "}
                <span className="text-gray-500">
                  {summary.orphanCount} outside any section
                </span>
              </>
            )}
          </span>
        </div>
        <div className="text-xs text-gray-500 flex items-center gap-2">
          {detectedSections.classifier?.model && (
            <Tooltip
              title={
                <>
                  classifier v{detectedSections.classifier.version ?? "?"}
                  {detectedSections.grouper?.strategy && (
                    <>
                      {" · "}grouper {detectedSections.grouper.strategy} v
                      {detectedSections.grouper.version}
                    </>
                  )}
                </>
              }
            >
              <span>{detectedSections.classifier.model}</span>
            </Tooltip>
          )}
          {detectedSections.candidate_slugs &&
            detectedSections.candidate_slugs.length > 0 && (
              <Tooltip
                title={
                  <>
                    Candidate document types this run considered:{" "}
                    {detectedSections.candidate_slugs.join(", ")}
                  </>
                }
              >
                <span>
                  · {detectedSections.candidate_slugs.length} candidate type
                  {detectedSections.candidate_slugs.length === 1 ? "" : "s"}
                </span>
              </Tooltip>
            )}
        </div>
      </div>

      {/* Worker provenance: did the classifier output actually drive extraction? */}
      {visualClassifierMeta?.ran && visualClassifierMeta?.fell_back && (
        <div className="bg-amber-50 border border-amber-200 text-amber-900 text-sm rounded p-2 flex items-start gap-2">
          <WarningFilled className="text-amber-500 mt-0.5" />
          <div>
            <div className="font-medium">
              Classifier ran but extraction fell back to the full document
            </div>
            <div className="text-xs">
              Reason: {visualClassifierMeta.fell_back_reason || "unknown"}
            </div>
          </div>
        </div>
      )}

      {/* Draft banner — unsaved local edits */}
      {isDirty && sections.length > 0 && (
        <div className="mx-2 mb-2 p-2.5 rounded-md bg-blue-50 border border-blue-200 flex flex-col gap-2">
          <span className="text-xs text-blue-800">
            {draftNeedsExtraction.length > 0
              ? `${draftNeedsExtraction.length} section${draftNeedsExtraction.length === 1 ? "" : "s"} changed (${draftNeedsExtraction.map((i) => {
                  const s = sections[i];
                  return s ? `p${s.page_range[0]}${s.page_range[1] !== s.page_range[0] ? `-${s.page_range[1]}` : ""}` : `#${i}`;
                }).join(", ")}). Save to persist and re-extract.`
              : "Sections modified. Save to persist changes."}
          </span>
          <div className="flex items-center gap-2">
            <Button
              size="small"
              type="primary"
              loading={saveLoading}
              onClick={handleSaveAndReextract}
            >
              Save & Re-extract ({draftNeedsExtraction.length})
            </Button>
            <Button
              size="small"
              onClick={handleDiscard}
              disabled={saveLoading}
            >
              Discard
            </Button>
          </div>
        </div>
      )}

      {/* Server-side needs-extraction banner (for files that already have null IDs from prior edits) */}
      {!isDirty && needsExtractionIndices.length > 0 && sections.length > 0 && (
        <div className="mx-2 mb-2 p-2.5 rounded-md bg-amber-50 border border-amber-200 flex flex-col gap-2">
          <span className="text-xs text-amber-800">
            {needsExtractionIndices.length} section{needsExtractionIndices.length === 1 ? "" : "s"} need{needsExtractionIndices.length === 1 ? "s" : ""} extraction.
          </span>
          <Button
            size="small"
            type="primary"
            loading={saveLoading}
            onClick={() => {
              // Save existing detected_sections (with null IDs) to trigger re-extract
              if (detectedSections) {
                setDraft(detectedSections);
                // Immediately save — the user didn't make local edits, they just need re-extract
                apiClient.saveAndReextractSections(fileId, detectedSections).then((res) => {
                  if (res.status === "success" && res.detected_sections) {
                    message.success(`Re-extracted ${needsExtractionIndices.length} section(s)`);
                    onSectionsUpdated?.(res.detected_sections);
                    setDraft(null);
                  } else {
                    message.error(res.message || "Re-extraction failed");
                    setDraft(null);
                  }
                }).catch((err) => {
                  message.error(err instanceof Error ? err.message : "Re-extraction failed");
                  setDraft(null);
                });
              }
            }}
          >
            Re-extract ({needsExtractionIndices.length})
          </Button>
        </div>
      )}

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="text-sm text-gray-500 italic px-2">
          No sections detected. Every page was classified as &quot;none&quot;
          (boilerplate / empty / unrelated) — nothing was extracted. The file
          has no extractable content.
        </div>
      ) : (
        <Collapse
          defaultActiveKey={sections.map((_, i) => `s${i}`)}
          items={sections.map((section, i) => {
            const decisions = decisionsForSection(section, pages);
            return {
              key: `s${i}`,
              label: <SectionHeader section={section} />,
              extra: (
                <SectionActions
                  section={section}
                  loading={actionLoadingFor === i}
                  isLastSection={i === sections.length - 1}
                  onApprove={() => handleApprove(i)}
                  onChangeSlug={() => {
                    setPickedSlug(section.document_type_slug);
                    setActiveAction({ kind: "change_slug", sectionIndex: i });
                  }}
                  onSplit={() => {
                    setPickedSplitPage(null);
                    setActiveAction({ kind: "split", sectionIndex: i });
                  }}
                  onMerge={() => handleMerge(i)}
                  onIncludeSkipped={() => {
                    setPickedSkippedPages([]);
                    setActiveAction({ kind: "include_skipped", sectionIndex: i });
                  }}
                />
              ),
              children: (
                <div className="flex flex-col gap-2">
                  {decisions.map((d) => (
                    <PageRow
                      key={d.page.page_number}
                      fileId={fileId}
                      d={d}
                      onNavigateToPdfPage={onNavigateToPdfPage}
                    />
                  ))}
                </div>
              ),
            };
          })}
        />
      )}

      {/* Pages outside any section */}
      {orphans.length > 0 && (
        <Collapse
          items={[
            {
              key: "orphans",
              label: (
                <div className="flex items-center gap-2">
                  <Tag color="default">no section</Tag>
                  <span className="text-sm text-gray-700">
                    {orphans.length} page
                    {orphans.length === 1 ? "" : "s"} outside any section
                  </span>
                  <span className="text-xs text-gray-400">
                    — assign to extract their content
                  </span>
                </div>
              ),
              children: (
                <div className="flex flex-col gap-2">
                  {orphans.map((p) => {
                    const { prevIdx, nextIdx } = adjacentSectionIndices(
                      p.page_number,
                      sections,
                    );
                    const canPrev =
                      prevIdx >= 0 &&
                      sections[prevIdx].page_range[1] + 1 === p.page_number;
                    const canNext =
                      nextIdx >= 0 &&
                      sections[nextIdx].page_range[0] - 1 === p.page_number;
                    return (
                      <PageRow
                        key={p.page_number}
                        fileId={fileId}
                        d={{ page: p, decision: "outside" }}
                        onNavigateToPdfPage={onNavigateToPdfPage}
                        actions={
                          <div className="flex flex-col gap-1 items-stretch min-w-[190px]">
                            <span className="text-xs font-medium text-gray-500">
                              Assign this page
                            </span>
                            {canPrev && (
                              <Popconfirm
                                title={`Add page ${p.page_number} to the previous section`}
                                description={
                                  <span className="text-xs">
                                    It will be extracted as part of{" "}
                                    <b>{sections[prevIdx].document_type_slug}</b>{" "}
                                    (pages {sections[prevIdx].page_range[0]}–
                                    {sections[prevIdx].page_range[1]}). The
                                    page&apos;s text is pulled from the original
                                    PDF when you Save &amp; Re-extract.
                                  </span>
                                }
                                okText="Add page"
                                cancelText="Cancel"
                                onConfirm={() =>
                                  handleAddToSection(p.page_number, prevIdx)
                                }
                              >
                                <Tooltip
                                  title={`Merge into the preceding ${sections[prevIdx].document_type_slug} section (pages ${sections[prevIdx].page_range[0]}–${sections[prevIdx].page_range[1]})`}
                                >
                                  <Button size="small" block>
                                    ← Add to {sections[prevIdx].document_type_slug}{" "}
                                    (p{sections[prevIdx].page_range[0]}–
                                    {sections[prevIdx].page_range[1]})
                                  </Button>
                                </Tooltip>
                              </Popconfirm>
                            )}
                            {canNext && (
                              <Popconfirm
                                title={`Add page ${p.page_number} to the next section`}
                                description={
                                  <span className="text-xs">
                                    It will be extracted as part of{" "}
                                    <b>{sections[nextIdx].document_type_slug}</b>{" "}
                                    (pages {sections[nextIdx].page_range[0]}–
                                    {sections[nextIdx].page_range[1]}). The
                                    page&apos;s text is pulled from the original
                                    PDF when you Save &amp; Re-extract.
                                  </span>
                                }
                                okText="Add page"
                                cancelText="Cancel"
                                onConfirm={() =>
                                  handleAddToSection(p.page_number, nextIdx)
                                }
                              >
                                <Tooltip
                                  title={`Merge into the following ${sections[nextIdx].document_type_slug} section (pages ${sections[nextIdx].page_range[0]}–${sections[nextIdx].page_range[1]})`}
                                >
                                  <Button size="small" block>
                                    Add to {sections[nextIdx].document_type_slug}{" "}
                                    (p{sections[nextIdx].page_range[0]}–
                                    {sections[nextIdx].page_range[1]}) →
                                  </Button>
                                </Tooltip>
                              </Popconfirm>
                            )}
                            <Tooltip title="Create a new single-page section for this page with a document type you choose">
                              <Button
                                size="small"
                                type="dashed"
                                block
                                onClick={() => {
                                  setPickedSlug(null);
                                  setActiveAction({
                                    kind: "new_section",
                                    sectionIndex: -1,
                                    pageNumber: p.page_number,
                                  });
                                }}
                              >
                                + New section…
                              </Button>
                            </Tooltip>
                          </div>
                        }
                      />
                    );
                  })}
                </div>
              ),
            },
          ]}
        />
      )}

      {/* Change-slug modal */}
      <Modal
        title={
          activeAction?.kind === "change_slug" && sections[activeAction.sectionIndex]
            ? `Re-route section: pages ${sections[activeAction.sectionIndex].page_range[0]}–${sections[activeAction.sectionIndex].page_range[1]}`
            : "Re-route section"
        }
        open={activeAction?.kind === "change_slug"}
        onCancel={closeAction}
        onOk={handleChangeSlug}
        okText="Re-route & approve"
        confirmLoading={
          activeAction?.kind === "change_slug" &&
          actionLoadingFor === activeAction.sectionIndex
        }
        okButtonProps={{ disabled: !pickedSlug }}
        destroyOnHidden
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            The new document type&apos;s schema (from the registry) will drive
            extraction on the next reprocess pass. The section will be marked
            as approved.
          </div>
          <Select
            showSearch
            value={pickedSlug ?? undefined}
            onChange={(v) => setPickedSlug(v)}
            placeholder={slugsLoaded ? "Pick a document type" : "Loading types…"}
            optionFilterProp="label"
            className="w-full"
            options={availableSlugs.map((d) => ({
              value: d.slug,
              label: `${d.display_name}  ·  ${d.slug}${d.status !== "active" ? " (deprecated)" : ""}`,
            }))}
          />
        </div>
      </Modal>

      {/* Split modal */}
      <Modal
        title={
          activeAction?.kind === "split" && sections[activeAction.sectionIndex]
            ? `Split section at page (current range ${sections[activeAction.sectionIndex].page_range[0]}–${sections[activeAction.sectionIndex].page_range[1]})`
            : "Split section"
        }
        open={activeAction?.kind === "split"}
        onCancel={closeAction}
        onOk={handleSplit}
        okText="Split & approve both halves"
        confirmLoading={
          activeAction?.kind === "split" &&
          actionLoadingFor === activeAction.sectionIndex
        }
        okButtonProps={{ disabled: pickedSplitPage == null }}
        destroyOnHidden
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            The chosen page becomes the FIRST page of the second half. Pages
            before it stay in the original section.
          </div>
          {(() => {
            if (activeAction?.kind !== "split") return null;
            const section = sections[activeAction.sectionIndex];
            if (!section) return null;
            const [start, end] = section.page_range;
            const candidates: number[] = [];
            for (let p = start + 1; p <= end; p++) candidates.push(p);
            if (candidates.length === 0) {
              return (
                <div className="text-sm text-amber-700">
                  This section is only one page long — there&apos;s nothing to
                  split.
                </div>
              );
            }
            return (
              <Select
                value={pickedSplitPage ?? undefined}
                onChange={(v) => setPickedSplitPage(v)}
                placeholder="Pick the first page of the second half"
                className="w-full"
                options={candidates.map((p) => ({
                  value: p,
                  label: `Page ${p} (split → [${start}–${p - 1}] + [${p}–${end}])`,
                }))}
              />
            );
          })()}
        </div>
      </Modal>

      {/* New-section-from-orphan-page modal */}
      <Modal
        title={
          activeAction?.kind === "new_section"
            ? `New section from page ${activeAction.pageNumber}`
            : "New section"
        }
        open={activeAction?.kind === "new_section"}
        onCancel={closeAction}
        onOk={handleCreateSection}
        okText="Create section"
        okButtonProps={{ disabled: !pickedSlug }}
        destroyOnHidden
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            Creates a new single-page section for this page. Its text wasn&apos;t
            extracted at ingest, so on Save it will be extracted from the
            original PDF, then run through the chosen type&apos;s schema.
          </div>
          <Select
            showSearch
            value={pickedSlug ?? undefined}
            onChange={(v) => setPickedSlug(v)}
            placeholder={slugsLoaded ? "Pick a document type" : "Loading types…"}
            optionFilterProp="label"
            className="w-full"
            options={availableSlugs.map((d) => ({
              value: d.slug,
              label: `${d.display_name}  ·  ${d.slug}${d.status !== "active" ? " (deprecated)" : ""}`,
            }))}
          />
        </div>
      </Modal>

      {/* Include-skipped-pages checklist modal */}
      <Modal
        title={
          activeAction?.kind === "include_skipped" &&
          sections[activeAction.sectionIndex]
            ? `Include skipped pages — ${sections[activeAction.sectionIndex].document_type_slug} (pages ${sections[activeAction.sectionIndex].page_range[0]}–${sections[activeAction.sectionIndex].page_range[1]})`
            : "Include skipped pages"
        }
        open={activeAction?.kind === "include_skipped"}
        onCancel={closeAction}
        onOk={handleIncludeSkipped}
        okText={
          pickedSkippedPages.length > 0
            ? `Include ${pickedSkippedPages.length} page${pickedSkippedPages.length === 1 ? "" : "s"}`
            : "Include pages"
        }
        okButtonProps={{ disabled: pickedSkippedPages.length === 0 }}
        destroyOnHidden
      >
        <div className="space-y-3">
          <div className="text-xs text-gray-500">
            These pages are inside this section&apos;s range but the classifier
            left them out of extraction. Tick the ones to pull back in — their
            text is re-fed (or re-extracted) into this section on Save &amp;
            Re-extract.
          </div>
          {(() => {
            if (activeAction?.kind !== "include_skipped") return null;
            const section = sections[activeAction.sectionIndex];
            const skipped = section?.skipped_pages ?? [];
            if (skipped.length === 0) {
              return (
                <div className="text-sm text-amber-700">
                  This section has no skipped pages.
                </div>
              );
            }
            return (
              <Checkbox.Group
                className="flex flex-col gap-2"
                value={pickedSkippedPages}
                onChange={(v) => setPickedSkippedPages(v as number[])}
              >
                {skipped
                  .slice()
                  .sort((a, b) => a.page_number - b.page_number)
                  .map((s) => (
                    <Checkbox key={s.page_number} value={s.page_number}>
                      <span className="font-medium">Page {s.page_number}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        skipped: {s.reason}
                        {s.duplicate_of != null && ` of p.${s.duplicate_of}`}
                      </span>
                    </Checkbox>
                  ))}
              </Checkbox.Group>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
}

function SectionActions({
  section,
  loading,
  isLastSection,
  onApprove,
  onChangeSlug,
  onSplit,
  onMerge,
  onIncludeSkipped,
}: {
  section: DetectedSection;
  loading: boolean;
  isLastSection: boolean;
  onApprove: () => void;
  onChangeSlug: () => void;
  onSplit: () => void;
  onMerge: () => void;
  onIncludeSkipped: () => void;
}) {
  const [start, end] = section.page_range;
  const canSplit = end > start;
  const canMerge = !isLastSection; // can merge with next section (unless this is the last one)
  const isPending = section.status === "pending_review";
  const skippedCount = section.skipped_pages?.length ?? 0;

  // stopPropagation so clicks don't toggle the Collapse panel.
  const stop = (e: React.MouseEvent) => e.stopPropagation();

  return (
    <Space size="small" onClick={stop}>
      {isPending ? (
        <Popconfirm
          title="Approve this section as-is?"
          description="Its pages will be eligible for extraction on the next reprocess."
          okText="Approve"
          cancelText="Cancel"
          onConfirm={onApprove}
        >
          <Button size="small" type="primary" loading={loading}>
            Approve
          </Button>
        </Popconfirm>
      ) : null}
      <Button size="small" onClick={onChangeSlug} disabled={loading}>
        Change slug
      </Button>
      <Tooltip
        title={canSplit ? "Split this section into two" : "Section is only one page"}
      >
        <Button
          size="small"
          onClick={onSplit}
          disabled={!canSplit || loading}
        >
          Split
        </Button>
      </Tooltip>
      <Tooltip
        title={
          canMerge
            ? "Merge this section with the next one"
            : "No next section to merge with"
        }
      >
        <Button
          size="small"
          onClick={onMerge}
          disabled={!canMerge || loading}
        >
          Merge
        </Button>
      </Tooltip>
      {skippedCount > 0 && (
        <Tooltip title="Re-include pages the classifier skipped in this section">
          <Button size="small" onClick={onIncludeSkipped} disabled={loading}>
            Include pages ({skippedCount})
          </Button>
        </Tooltip>
      )}
    </Space>
  );
}

function SectionHeader({ section }: { section: DetectedSection }) {
  const [start, end] = section.page_range;
  const needsExtraction = section.section_result_id == null;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-sm font-medium">
        {section.document_type_slug}
      </span>
      <span className="text-sm text-gray-500">
        pages {start}–{end} ({section.page_count})
      </span>
      {needsExtraction && (
        <Tag color="warning" style={{ marginInlineEnd: 0 }}>
          needs extraction
        </Tag>
      )}
      <Tag
        color={statusColor(section.status)}
        style={{ marginInlineEnd: 0 }}
      >
        {statusLabel(section.status)}
      </Tag>
      <span className="text-xs text-gray-500">
        confidence {(section.confidence * 100).toFixed(0)}% · min{" "}
        {(section.min_page_confidence * 100).toFixed(0)}% · threshold{" "}
        {(section.threshold_used * 100).toFixed(0)}%
      </span>
      <span className="text-xs text-gray-500">
        ·{" "}
        <span className="text-green-700 font-medium">
          {section.extraction_pages.length} extract
        </span>
        {section.skipped_pages.length > 0 && (
          <>
            {" "}
            ·{" "}
            <span className="text-orange-700 font-medium">
              {section.skipped_pages.length} skip
            </span>
          </>
        )}
      </span>
    </div>
  );
}

function PageRow({
  fileId,
  d,
  actions,
  onNavigateToPdfPage,
}: {
  fileId: string;
  d: PageDecision;
  actions?: React.ReactNode;
  onNavigateToPdfPage?: (pageNumber: number) => void;
}) {
  const { page, decision, reason, duplicate_of } = d;
  return (
    <div className="flex items-start gap-3 p-2 bg-white border border-gray-200 rounded hover:bg-gray-50">
      <PageThumbnail
        fileId={fileId}
        pageNumber={page.page_number}
        width={120}
        onClick={
          onNavigateToPdfPage
            ? () => onNavigateToPdfPage(page.page_number)
            : undefined
        }
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <span className="font-medium text-sm">Page {page.page_number}</span>
          {decision === "extract" ? (
            <Tag color="green" icon={<CheckCircleFilled />}>
              extract
            </Tag>
          ) : decision === "skip" ? (
            <Tag
              color={reason === "duplicate" ? "purple" : "default"}
              icon={
                reason === "duplicate" ? (
                  <CopyOutlined />
                ) : (
                  <CloseCircleFilled />
                )
              }
            >
              skip: {reason}
              {duplicate_of != null && ` of p.${duplicate_of}`}
            </Tag>
          ) : (
            <Tag color="default" icon={<EyeOutlined />}>
              outside any section
            </Tag>
          )}
          {page.document_type_slug && page.document_type_slug !== "none" && (
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>
              {page.document_type_slug}
            </Tag>
          )}
          {page.page_purpose && (
            <Tag
              color={purposeColor(page.page_purpose)}
              style={{ marginInlineEnd: 0 }}
            >
              {page.page_purpose}
            </Tag>
          )}
          {page.page_role && page.page_role !== "none" && (
            <span className="text-xs text-gray-500">role: {page.page_role}</span>
          )}
        </div>
        <div className="text-xs text-gray-500">
          confidence {(page.confidence * 100).toFixed(0)}%
          {page.duplicate_of != null && (
            <span className="ml-2 text-purple-700">
              ↩ duplicate of page {page.duplicate_of}
            </span>
          )}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}
