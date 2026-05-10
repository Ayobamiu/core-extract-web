"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Tag, Tooltip, Empty, Collapse } from "antd";
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
}: Props) {
  const sections = detectedSections?.sections ?? [];
  const pages = detectedSections?.pages ?? [];

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
    </div>
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
