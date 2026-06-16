"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Document, Page, pdfjs } from "react-pdf";
import "react-pdf/dist/Page/AnnotationLayer.css";
import "react-pdf/dist/Page/TextLayer.css";
import { Button, InputNumber, Tooltip, Typography } from "antd";
import {
  ChevronLeft,
  ChevronRight,
  Loader,
  RotateCw,
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

type PdfViewerProps = {
  url: string;
  /** Resets internal state (page/zoom/rotation) when the file changes. */
  fileKey: string;
};

export default function PdfViewer({ url, fileKey }: PdfViewerProps) {
  const [numPages, setNumPages] = useState(0);
  const [pageNumber, setPageNumber] = useState(1);
  const [zoom, setZoom] = useState(1); // 1 = fit container width
  const [rotation, setRotation] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);

  // The page is rendered at (container width × zoom), so the default fills the
  // pane and stays responsive when the resizable split changes.
  const scrollRef = useRef<HTMLDivElement>(null);
  const [baseWidth, setBaseWidth] = useState(0);

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
  }, [fileKey]);

  const onLoadSuccess = useCallback(
    ({ numPages: n }: { numPages: number }) => {
      setNumPages(n);
      setPageNumber((p) => Math.min(Math.max(1, p), n));
    },
    [],
  );

  const goTo = useCallback(
    (next: number) => {
      setPageNumber((p) => {
        const target = Number.isFinite(next) ? next : p;
        return Math.min(Math.max(1, target), numPages || 1);
      });
    },
    [numPages],
  );

  const zoomBy = useCallback((delta: number) => {
    setZoom((z) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, +(z + delta).toFixed(2))));
  }, []);

  // Stable options object — react-pdf re-fetches if this identity changes.
  const docOptions = useMemo(() => ({}), []);

  // ~16px of horizontal breathing room inside the scroll area.
  const pageWidth = baseWidth > 0 ? Math.max(1, (baseWidth - 16) * zoom) : undefined;

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
      </div>

      {/* Page area */}
      <div ref={scrollRef} className="flex-1 overflow-auto min-h-0 p-2">
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
            onLoadError={(e) =>
              setLoadError(e?.message || "Unable to load PDF")
            }
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
            className="flex justify-center"
          >
            {numPages > 0 && (
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
            )}
          </Document>
        )}
      </div>
    </div>
  );
}
