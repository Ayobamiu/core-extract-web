"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Button,
  Empty,
  Collapse,
  Modal,
  Popconfirm,
  Select,
  Space,
  Tag,
  Tooltip,
  message,
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
}

type ActionKind = "change_slug" | "split";
interface ActionState {
  kind: ActionKind;
  sectionIndex: number;
}

// ─── Per-page thumbnail with intersection-observer-based lazy fetch ────────
//
// Lazy loads on demand so a 200-page document doesn't fire 200 simultaneous
// rasterise requests. Cleans up its blob URL on unmount.
function PageThumbnail({
  fileId,
  pageNumber,
  width = 160,
}: {
  fileId: string;
  pageNumber: number;
  width?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
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
    <div
      ref={containerRef}
      className="relative bg-gray-100 border border-gray-200 rounded shrink-0 flex items-center justify-center overflow-hidden"
      style={{ width, height: width * 1.3, minWidth: width }}
    >
      {src ? (
        <img
          src={src}
          alt={`Page ${pageNumber}`}
          className="w-full h-full object-contain"
        />
      ) : error ? (
        <div className="text-xs text-red-500 px-2 text-center">
          Thumbnail failed
        </div>
      ) : (
        <Loader className="w-5 h-5 animate-spin text-gray-400" />
      )}
      <div className="absolute bottom-1 left-1 bg-black/60 text-white text-xs px-1.5 py-0.5 rounded">
        p.{pageNumber}
      </div>
    </div>
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

// ─── Main component ───────────────────────────────────────────────────────

export default function DocumentRoutingPanel({
  fileId,
  detectedSections,
  visualClassifierMeta,
  onSectionsUpdated,
}: Props) {
  const sections = detectedSections?.sections ?? [];
  const pages = detectedSections?.pages ?? [];

  // Slugs for the change-slug picker. Loaded once; cheap. Empty array until
  // the request completes — the picker shows a "loading" state.
  const [availableSlugs, setAvailableSlugs] = useState<DocumentTypeInfo[]>([]);
  const [slugsLoaded, setSlugsLoaded] = useState(false);

  // Single in-flight action at a time. Index is into `sections`; kind drives
  // which modal opens. `null` when no modal is open.
  const [activeAction, setActiveAction] = useState<ActionState | null>(null);
  const [actionLoadingFor, setActionLoadingFor] = useState<number | null>(null);
  const [pickedSlug, setPickedSlug] = useState<string | null>(null);
  const [pickedSplitPage, setPickedSplitPage] = useState<number | null>(null);

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
  }, []);

  const handleApprove = useCallback(
    async (sectionIndex: number) => {
      setActionLoadingFor(sectionIndex);
      try {
        const res = await apiClient.routingApproveSection(fileId, sectionIndex);
        if (res.success && res.data?.detected_sections) {
          message.success("Section approved");
          onSectionsUpdated?.(res.data.detected_sections);
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

  const handleChangeSlug = useCallback(async () => {
    if (!activeAction || activeAction.kind !== "change_slug" || !pickedSlug) return;
    setActionLoadingFor(activeAction.sectionIndex);
    try {
      const res = await apiClient.routingChangeSectionSlug(
        fileId,
        activeAction.sectionIndex,
        pickedSlug,
      );
      if (res.success && res.data?.detected_sections) {
        message.success(`Section re-routed to ${pickedSlug}`);
        onSectionsUpdated?.(res.data.detected_sections);
        closeAction();
      } else {
        message.error(res.message || "Change failed");
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Change failed");
    } finally {
      setActionLoadingFor(null);
    }
  }, [activeAction, pickedSlug, fileId, onSectionsUpdated, closeAction]);

  const handleSplit = useCallback(async () => {
    if (!activeAction || activeAction.kind !== "split" || pickedSplitPage == null) return;
    setActionLoadingFor(activeAction.sectionIndex);
    try {
      const res = await apiClient.routingSplitSection(
        fileId,
        activeAction.sectionIndex,
        pickedSplitPage,
      );
      if (res.success && res.data?.detected_sections) {
        message.success(`Section split at page ${pickedSplitPage}`);
        onSectionsUpdated?.(res.data.detected_sections);
        closeAction();
      } else {
        message.error(res.message || "Split failed");
      }
    } catch (err: unknown) {
      message.error(err instanceof Error ? err.message : "Split failed");
    } finally {
      setActionLoadingFor(null);
    }
  }, [activeAction, pickedSplitPage, fileId, onSectionsUpdated, closeAction]);

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

      {/* Sections */}
      {sections.length === 0 ? (
        <div className="text-sm text-gray-500 italic px-2">
          No sections detected. Every page was classified as &quot;none&quot;
          (boilerplate / empty / unrelated) — extraction will run on the full
          document instead.
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
                  onApprove={() => handleApprove(i)}
                  onChangeSlug={() => {
                    setPickedSlug(section.document_type_slug);
                    setActiveAction({ kind: "change_slug", sectionIndex: i });
                  }}
                  onSplit={() => {
                    setPickedSplitPage(null);
                    setActiveAction({ kind: "split", sectionIndex: i });
                  }}
                />
              ),
              children: (
                <div className="flex flex-col gap-2">
                  {decisions.map((d) => (
                    <PageRow key={d.page.page_number} fileId={fileId} d={d} />
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
                </div>
              ),
              children: (
                <div className="flex flex-col gap-2">
                  {orphans.map((p) => (
                    <PageRow
                      key={p.page_number}
                      fileId={fileId}
                      d={{ page: p, decision: "outside" }}
                    />
                  ))}
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
        destroyOnClose
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
        destroyOnClose
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
    </div>
  );
}

function SectionActions({
  section,
  loading,
  onApprove,
  onChangeSlug,
  onSplit,
}: {
  section: DetectedSection;
  loading: boolean;
  onApprove: () => void;
  onChangeSlug: () => void;
  onSplit: () => void;
}) {
  const [start, end] = section.page_range;
  const canSplit = end > start;
  const isPending = section.status === "pending_review";

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
    </Space>
  );
}

function SectionHeader({ section }: { section: DetectedSection }) {
  const [start, end] = section.page_range;
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-mono text-sm font-medium">
        {section.document_type_slug}
      </span>
      <span className="text-sm text-gray-500">
        pages {start}–{end} ({section.page_count})
      </span>
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
}: {
  fileId: string;
  d: PageDecision;
}) {
  const { page, decision, reason, duplicate_of } = d;
  return (
    <div className="flex items-start gap-3 p-2 bg-white border border-gray-200 rounded hover:bg-gray-50">
      <PageThumbnail fileId={fileId} pageNumber={page.page_number} width={120} />
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
    </div>
  );
}
