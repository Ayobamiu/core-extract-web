"use client";

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button, InputNumber, Segmented, Tooltip, Typography } from "antd";
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader,
  RotateCw,
  ScrollText,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { ExclamationCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

// PDF.js needs a worker. We serve a copy from /public so the version always
// matches the bundled pdfjs-dist and there's no bundler/worker-resolution
// friction under Next + Turbopack. (Keep public/pdf.worker.min.mjs in sync
// with the installed pdfjs-dist on upgrades.)
pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.4;
const MAX_ZOOM = 4;
const PAGE_GAP = 8;
// Fallback aspect (height / width) for not-yet-rendered pages — US Letter.
const DEFAULT_ASPECT = 11 / 8.5;

type ViewMode = "continuous" | "single";

type PdfViewerProps = {
  url: string;
  /** Resets internal state (page/zoom/rotation) when the file changes. */
  fileKey: string;
  /**
   * 1-based page to auto-scroll to once the document loads (and again whenever
   * this value changes — e.g. selecting a different record). Only auto-navigates
   * on change, so it never yanks the user back after they scroll away manually.
   */
  targetPage?: number | null;
  /** Bumps on each navigation request so re-clicking the same page still scrolls. */
  targetPageNonce?: number;
};

const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, n));

export default function PdfViewer({
  url,
  fileKey,
  targetPage,
  targetPageNonce = 0,
}: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1); // 1 = fit container width
  const [rotation, setRotation] = useState(0);
  const [viewMode, setViewMode] = useState<ViewMode>("continuous");
  const [loadError, setLoadError] = useState<string | null>(null);

  // The page is rendered at (container width × zoom), so the default fills the
  // pane and stays responsive when the resizable split changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);

  // Virtualization state for continuous mode: which pages are mounted, and the
  // measured height of each rendered page (used to size placeholders so the
  // scrollbar is accurate without mounting all pages — matters for 100s of pages).
  const [renderSet, setRenderSet] = useState<Set<number>>(new Set());
  const pageHeights = useRef<Map<number, number>>(new Map());
  const pageEls = useRef<Map<number, HTMLDivElement>>(new Map());
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const programmaticScroll = useRef(false);
  // The (page, numPages) we last auto-navigated to, so the targetPage effect
  // fires only when the target or the loaded doc actually changes — not on
  // every resize/zoom re-render.
  const appliedTarget = useRef<{ page: number; n: number; nonce: number } | null>(
    null,
  );

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const measure = () => setBaseWidth(el.clientWidth);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset view when the file changes.
  useEffect(() => {
    setPageNumber(1);
    setZoom(1);
    setRotation(0);
    setLoadError(null);
    setNumPages(0);
    setRenderSet(new Set());
    pageHeights.current.clear();
    appliedTarget.current = null;
  }, [fileKey]);

  // Page geometry changed → previous placeholder heights are stale.
  useEffect(() => {
    pageHeights.current.clear();
  }, [zoom, rotation, baseWidth]);

  const pageWidth =
    baseWidth > 0 ? Math.max(1, (baseWidth - 16) * zoom) : undefined;

  // Placeholder height for not-yet-mounted pages: reuse a measured page if we
  // have one, else the Letter ratio. Cheap; recomputed each render (e.g. scroll).
  const estimatedHeight = (() => {
    const first = pageHeights.current.values().next().value as
      | number
      | undefined;
    if (first) return first;
    return pageWidth ? pageWidth * DEFAULT_ASPECT : 800;
  })();

  const onLoadSuccess = useCallback(({ numPages: n }: { numPages: number }) => {
    setNumPages(n);
    setPageNumber((p) => clamp(p, 1, n));
  }, []);

  // Recompute which pages to mount (visible ± 1 viewport) and the active page,
  // from the scroll position. Cheap O(numPages) scan, throttled via rAF.
  const recompute = useCallback(() => {
    const cont = scrollRef.current;
    if (!cont || viewMode !== "continuous") return;
    const cr = cont.getBoundingClientRect();
    const buffer = cr.height; // one viewport of look-ahead each side
    const top = cr.top - buffer;
    const bottom = cr.bottom + buffer;
    const line = cr.top + 40; // "current page" is the one crossing this line
    const next = new Set<number>();
    let current = 1;
    pageEls.current.forEach((el, p) => {
      const r = el.getBoundingClientRect();
      if (r.bottom >= top && r.top <= bottom) next.add(p);
      if (r.top <= line) current = p;
    });
    setRenderSet((prev) => {
      if (prev.size === next.size && [...next].every((p) => prev.has(p)))
        return prev;
      return next;
    });
    if (!programmaticScroll.current) {
      setPageNumber((prev) => (prev === current ? prev : current));
    }
  }, [viewMode]);

  // Trailing throttle (~60ms). setTimeout instead of rAF so virtualization keeps
  // working in backgrounded tabs (where rAF is paused).
  const onScroll = useCallback(() => {
    if (scrollTimer.current != null) return;
    scrollTimer.current = setTimeout(() => {
      scrollTimer.current = null;
      programmaticScroll.current = false;
      recompute();
    }, 60);
  }, [recompute]);

  useEffect(
    () => () => {
      if (scrollTimer.current != null) clearTimeout(scrollTimer.current);
    },
    [],
  );

  // Initial / dependency-driven recompute for continuous mode.
  useLayoutEffect(() => {
    if (viewMode === "continuous" && numPages > 0 && baseWidth > 0) {
      recompute();
    }
  }, [viewMode, numPages, baseWidth, recompute]);

  const setPageRef = useCallback(
    (p: number) => (el: HTMLDivElement | null) => {
      if (el) pageEls.current.set(p, el);
      else pageEls.current.delete(p);
    },
    [],
  );

  const onPageRender = useCallback(
    (p: number) => () => {
      const el = pageEls.current.get(p);
      if (el) {
        const h = el.getBoundingClientRect().height;
        if (h > 0) pageHeights.current.set(p, h);
      }
    },
    [],
  );

  const scrollToPage = useCallback((p: number) => {
    const el = pageEls.current.get(p);
    const cont = scrollRef.current;
    if (!el || !cont) return;
    programmaticScroll.current = true;
    cont.scrollTop +=
      el.getBoundingClientRect().top - cont.getBoundingClientRect().top;
  }, []);

  const goTo = useCallback(
    (next: number) => {
      const target = clamp(Number.isFinite(next) ? next : 1, 1, numPages || 1);
      setPageNumber(target);
      if (viewMode === "continuous") scrollToPage(target);
    },
    [numPages, viewMode, scrollToPage],
  );

  // Parent-driven auto-navigation: scroll to targetPage once the doc is loaded
  // and laid out, and again whenever the target (or loaded doc) changes. We
  // scroll twice — immediately and after a short delay — because the continuous
  // virtualizer sizes off-screen pages from an estimate until the first page
  // measures; the second pass lands accurately once real heights are known.
  useEffect(() => {
    if (targetPage == null || numPages <= 0 || baseWidth <= 0) return;
    const target = clamp(targetPage, 1, numPages);
    const last = appliedTarget.current;
    if (
      last &&
      last.page === target &&
      last.n === numPages &&
      last.nonce === targetPageNonce
    ) {
      return;
    }
    appliedTarget.current = { page: target, n: numPages, nonce: targetPageNonce };
    setPageNumber(target);
    const t1 = setTimeout(() => scrollToPage(target), 0);
    const t2 = setTimeout(() => scrollToPage(target), 250);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [targetPage, targetPageNonce, numPages, baseWidth, scrollToPage]);

  // When switching to continuous, jump to the page the user was on.
  useEffect(() => {
    if (viewMode === "continuous" && numPages > 0) {
      const id = setTimeout(() => scrollToPage(pageNumber), 0);
      return () => clearTimeout(id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => clamp(+(z + delta).toFixed(2), MIN_ZOOM, MAX_ZOOM));
  }, []);

  const docOptions = useMemo(() => ({}), []); // stable — react-pdf refetches if identity changes

  const renderPage = (p: number, mount: boolean) => (
    <div
      key={p}
      ref={setPageRef(p)}
      data-page={p}
      className="flex justify-center"
      style={
        mount
          ? undefined
          : { height: pageHeights.current.get(p) ?? estimatedHeight }
      }
    >
      {mount && (
        <Page
          pageNumber={p}
          width={pageWidth}
          rotate={rotation}
          renderTextLayer
          renderAnnotationLayer
          onRenderSuccess={onPageRender(p)}
          className="shadow-sm bg-white"
          loading={
            <div
              className="flex items-center justify-center bg-white"
              style={{ height: pageHeights.current.get(p) ?? estimatedHeight }}
            >
              <Loader className="w-5 h-5 animate-spin text-gray-300" />
            </div>
          }
        />
      )}
    </div>
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-100">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-2 py-1 bg-white border-b border-gray-200 flex-shrink-0">
        <Tooltip title="Previous page">
          <Button
            type="text"
            size="small"
            icon={<ChevronLeft className="w-4 h-4" />}
            disabled={pageNumber <= 1}
            onClick={() => goTo(pageNumber - 1)}
          />
        </Tooltip>
        <div className="flex items-center gap-1">
          <InputNumber
            size="small"
            min={1}
            max={numPages || 1}
            value={pageNumber}
            onChange={(v) => goTo(Number(v))}
            controls={false}
            className="w-12"
            aria-label="Page number"
          />
          <Text className="text-xs text-gray-500 whitespace-nowrap">
            / {numPages || "—"}
          </Text>
        </div>
        <Tooltip title="Next page">
          <Button
            type="text"
            size="small"
            icon={<ChevronRight className="w-4 h-4" />}
            disabled={numPages > 0 && pageNumber >= numPages}
            onClick={() => goTo(pageNumber + 1)}
          />
        </Tooltip>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <Tooltip title="Zoom out">
          <Button
            type="text"
            size="small"
            icon={<ZoomOut className="w-4 h-4" />}
            disabled={zoom <= MIN_ZOOM}
            onClick={() => zoomBy(-ZOOM_STEP)}
          />
        </Tooltip>
        <Tooltip title="Reset zoom (fit width)">
          <Button
            type="text"
            size="small"
            className="text-xs tabular-nums min-w-[3rem]"
            onClick={() => setZoom(1)}
          >
            {Math.round(zoom * 100)}%
          </Button>
        </Tooltip>
        <Tooltip title="Zoom in">
          <Button
            type="text"
            size="small"
            icon={<ZoomIn className="w-4 h-4" />}
            disabled={zoom >= MAX_ZOOM}
            onClick={() => zoomBy(ZOOM_STEP)}
          />
        </Tooltip>

        <div className="w-px h-4 bg-gray-200 mx-1" />

        <Tooltip title="Rotate 90°">
          <Button
            type="text"
            size="small"
            icon={<RotateCw className="w-4 h-4" />}
            onClick={() => setRotation((r) => (r + 90) % 360)}
          />
        </Tooltip>

        <div className="flex-1" />

        <Segmented<ViewMode>
          size="small"
          value={viewMode}
          onChange={setViewMode}
          options={[
            {
              value: "continuous",
              label: (
                <Tooltip title="Continuous scroll">
                  <ScrollText className="w-4 h-4" />
                </Tooltip>
              ),
            },
            {
              value: "single",
              label: (
                <Tooltip title="Single page">
                  <FileText className="w-4 h-4" />
                </Tooltip>
              ),
            },
          ]}
        />
      </div>

      {/* Page area */}
      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 overflow-auto min-h-0 p-2"
      >
        {loadError ? (
          <div className="flex items-center justify-center h-full">
            <Text type="secondary" className="text-sm">
              <ExclamationCircleOutlined className="mr-2" />
              {loadError}
            </Text>
          </div>
        ) : (
          <Document
            file={url}
            options={docOptions}
            onLoadSuccess={onLoadSuccess}
            onLoadError={(e) => setLoadError(e?.message || "Unable to load PDF")}
            loading={
              <div className="flex items-center justify-center h-full py-12">
                <Loader className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            }
            error={
              <div className="flex items-center justify-center h-full py-12">
                <Text type="secondary" className="text-sm">
                  <ExclamationCircleOutlined className="mr-2" />
                  Unable to load PDF
                </Text>
              </div>
            }
          >
            {numPages > 0 &&
              pageWidth != null &&
              (viewMode === "single" ? (
                <div className="flex justify-center">
                  <Page
                    key={`${pageNumber}-${rotation}`}
                    pageNumber={pageNumber}
                    width={pageWidth}
                    rotate={rotation}
                    renderTextLayer
                    renderAnnotationLayer
                    className="shadow-sm bg-white"
                    loading={
                      <div className="flex items-center justify-center py-12">
                        <Loader className="w-6 h-6 animate-spin text-gray-400" />
                      </div>
                    }
                  />
                </div>
              ) : (
                <div
                  className="flex flex-col items-center"
                  style={{ gap: PAGE_GAP }}
                >
                  {Array.from({ length: numPages }, (_, i) =>
                    renderPage(i + 1, renderSet.has(i + 1)),
                  )}
                </div>
              ))}
          </Document>
        )}
      </div>
    </div>
  );
}
