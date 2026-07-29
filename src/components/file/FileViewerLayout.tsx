"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Splitter, Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import type { JobFile } from "@/lib/api";
import type { ViewerPane, ViewerResultTab } from "@/lib/jobViewUrlState";
import FileViewerHeader, {
  type FileViewerHeaderProps,
} from "./FileViewerHeader";
import FileViewerRightPane from "./FileViewerRightPane";
import dynamic from "next/dynamic";
import { Loader } from "lucide-react";

// pdf.js (used by react-pdf) references browser-only globals like DOMMatrix at
// import time, which throws during SSR. Load the viewer client-side only.
const PdfViewer = dynamic(() => import("./PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-full">
      <Loader className="w-6 h-6 animate-spin text-gray-400" />
    </div>
  ),
});

const { Text } = Typography;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
  if (target.isContentEditable) return true;
  if (target.closest(".cm-editor")) return true;
  if (target.closest(".ant-select-dropdown")) return true;
  return false;
}

type PanelSizes = [number | string, number | string, number | string];

function parsePercent(size: number | string): number | null {
  if (typeof size === "string" && size.endsWith("%")) {
    const n = parseFloat(size);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function isCollapsedSize(size: number | string): boolean {
  return size === 0 || size === "0" || size === "0%";
}

/**
 * Redistribute splitter sizes when PDF/QA visibility changes.
 * Critical: only move space between the toggled pane and the middle (results)
 * pane — never resize the other side pane. Resizing the PDF triggers a known
 * react-pdf fade/reload flicker; hiding QA must not touch panelSizes[0].
 */
function redistributeSizes(
  prev: PanelSizes,
  pdfOpen: boolean,
  qaVisible: boolean,
  pdfWasOpen: boolean,
  qaWasVisible: boolean,
  savedPdfSize: { current: number | string },
  savedQaSize: { current: number | string },
): PanelSizes {
  let [pdf, mid, qa] = prev;

  if (!isCollapsedSize(pdf)) savedPdfSize.current = pdf;
  if (!isCollapsedSize(qa)) savedQaSize.current = qa;

  if (pdfWasOpen === pdfOpen && qaWasVisible === qaVisible) {
    return prev;
  }

  // ── QA toggle only → freeze PDF ───────────────────────────────────────
  if (pdfWasOpen === pdfOpen && qaWasVisible !== qaVisible) {
    if (!qaVisible) {
      if (typeof mid === "number" && typeof qa === "number") {
        return [pdf, mid + qa, 0];
      }
      const pdfPct = parsePercent(pdf);
      if (pdfPct != null) {
        return [pdf, `${100 - pdfPct}%`, 0];
      }
      return [pdf, mid, 0];
    }

    const restore = savedQaSize.current;
    if (typeof mid === "number" && typeof restore === "number") {
      const take = Math.min(restore, Math.max(0, mid - 280));
      return [pdf, mid - take, take];
    }
    const pdfPct = parsePercent(pdf) ?? 38;
    const qaPct = parsePercent(restore) ?? 24;
    return [pdf, `${Math.max(20, 100 - pdfPct - qaPct)}%`, `${qaPct}%`];
  }

  // ── PDF toggle only → freeze QA ───────────────────────────────────────
  if (qaWasVisible === qaVisible && pdfWasOpen !== pdfOpen) {
    if (!pdfOpen) {
      if (typeof mid === "number" && typeof pdf === "number") {
        return [0, mid + pdf, qa];
      }
      const qaPct = parsePercent(qa);
      if (qaPct != null) {
        return [0, `${100 - qaPct}%`, qa];
      }
      if (isCollapsedSize(qa)) {
        return [0, "100%", 0];
      }
      return [0, mid, qa];
    }

    const restore = savedPdfSize.current;
    if (typeof mid === "number" && typeof restore === "number") {
      const take = Math.min(restore, Math.max(0, mid - 280));
      return [take, mid - take, qa];
    }
    const qaPct = parsePercent(qa) ?? (isCollapsedSize(qa) ? 0 : 24);
    const pdfPct = parsePercent(restore) ?? 38;
    return [`${pdfPct}%`, `${Math.max(20, 100 - pdfPct - qaPct)}%`, qa];
  }

  // Both changed in one tick (rare) — rebuild from defaults but still prefer
  // saved widths for whichever pane stays open.
  if (pdfOpen && qaVisible) {
    return [
      savedPdfSize.current,
      "38%",
      savedQaSize.current,
    ];
  }
  if (pdfOpen) return [savedPdfSize.current, "60%", 0];
  if (qaVisible) return [0, "70%", savedQaSize.current];
  return [0, "100%", 0];
}

export type FileViewerLayoutProps = {
  file: JobFile;
  className?: string;
  pdfUrl: string | null;
  pdfUrlLoading: boolean;
  jobSchema: unknown;
  editable: boolean;
  comments: Array<{
    id: string;
    userId: string;
    userEmail: string;
    text: string;
    createdAt: string;
  }>;
  onAddComment: (text: string) => Promise<void>;
  onUpdate: (updatedData: unknown) => Promise<void>;
  onSectionsUpdated?: (sections: JobFile["detected_sections"]) => void;
  detailLoading?: boolean;
  splitContainerClassName?: string;
  viewerPane?: ViewerPane | null;
  onViewerPaneChange?: (pane: ViewerPane) => void;
  viewerSectionId?: string | null;
  onViewerSectionChange?: (sectionResultId: string | null) => void;
  viewerResultTab?: ViewerResultTab | null;
  onViewerResultTabChange?: (tab: ViewerResultTab) => void;
} & Omit<
  FileViewerHeaderProps,
  | "file"
  | "pdfOpen"
  | "qaOpen"
  | "qaAvailable"
  | "onTogglePdf"
  | "onToggleQa"
  | "pdfShortcutLabel"
  | "qaShortcutLabel"
> & {
  /** When true, owns ⌘B for the PDF pane (sidebar skips its own ⌘B). */
  shortcutScopeActive?: boolean;
};

export default function FileViewerLayout({
  file,
  className = "",
  pdfUrl,
  pdfUrlLoading,
  jobSchema,
  editable,
  comments,
  onAddComment,
  onUpdate,
  onSectionsUpdated,
  detailLoading = false,
  splitContainerClassName = "file-viewer-split",
  viewerPane = null,
  onViewerPaneChange,
  viewerSectionId = null,
  onViewerSectionChange,
  viewerResultTab = null,
  onViewerResultTabChange,
  shortcutScopeActive = true,
  ...headerProps
}: FileViewerLayoutProps) {
  const [pdfNavRequest, setPdfNavRequest] = useState<{
    page: number;
    nonce: number;
  } | null>(null);

  // Cursor-style pane visibility (session-local; not URL state).
  const [pdfOpen, setPdfOpen] = useState(true);
  const [qaOpen, setQaOpen] = useState(true);

  useEffect(() => {
    setPdfNavRequest(null);
  }, [file.id]);

  const handleNavigateToPdfPage = useCallback((page: number) => {
    // Reveal PDF if the user hid it — navigating to a page implies they want
    // to see it (same spirit as focusing an editor pane).
    setPdfOpen(true);
    setPdfNavRequest((prev) => ({
      page,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  // ── QA side column (3-segment review: PDF | content | QA) ───────────────
  // TabbedDataViewer portals findings into the third pane. qaActive is
  // data-driven; qaOpen is the user's hide/show preference on top.
  const [qaActive, setQaActive] = useState(false);
  const [qaContainer, setQaContainer] = useState<HTMLDivElement | null>(null);
  const qaContainerRef = useCallback((node: HTMLDivElement | null) => {
    setQaContainer(node);
  }, []);

  const showQaPanel = qaActive && qaOpen;

  // Controlled sizes — always 3 panels, collapsed ones at 0. Never remount the
  // Splitter (a `key` remount was causing PDF/results to reload in a loop:
  // remount → qaActive cleanup false → showQaPanel flip → remount again).
  //
  // When QA toggles we only move space between results ↔ QA so the PDF width
  // stays put (resizing the PDF triggers an existing react-pdf fade flicker).
  const [panelSizes, setPanelSizes] = useState<PanelSizes>(["40%", "60%", 0]);
  const savedPdfSizeRef = useRef<number | string>("38%");
  const savedQaSizeRef = useRef<number | string>("24%");
  const prevPdfOpenRef = useRef(pdfOpen);
  const prevShowQaRef = useRef(showQaPanel);

  useEffect(() => {
    const pdfWasOpen = prevPdfOpenRef.current;
    const qaWasVisible = prevShowQaRef.current;
    prevPdfOpenRef.current = pdfOpen;
    prevShowQaRef.current = showQaPanel;

    if (pdfWasOpen === pdfOpen && qaWasVisible === showQaPanel) return;

    setPanelSizes((prev) =>
      redistributeSizes(
        prev,
        pdfOpen,
        showQaPanel,
        pdfWasOpen,
        qaWasVisible,
        savedPdfSizeRef,
        savedQaSizeRef,
      ),
    );
  }, [pdfOpen, showQaPanel]);

  const togglePdf = useCallback(() => {
    setPdfOpen((v) => !v);
  }, []);

  const toggleQa = useCallback(() => {
    if (!qaActive) return;
    setQaOpen((v) => !v);
  }, [qaActive]);

  const { pdfShortcutLabel, qaShortcutLabel } = useMemo(() => {
    const isMac =
      typeof navigator !== "undefined" &&
      /Mac|iPhone|iPad|iPod/.test(navigator.platform);
    return {
      pdfShortcutLabel: isMac ? "⌘B" : "Ctrl+B",
      qaShortcutLabel: isMac ? "⌘⇧B" : "Ctrl+Shift+B",
    };
  }, []);

  // ⌘B / Ctrl+B → PDF; ⌘⇧B / Ctrl+Shift+B → QA (when findings exist).
  useEffect(() => {
    if (!shortcutScopeActive) return;

    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (e.key.toLowerCase() !== "b") return;
      if (e.altKey) return;
      if (isTypingTarget(e.target)) return;

      e.preventDefault();
      if (e.shiftKey) {
        if (!qaActive) return;
        setQaOpen((v) => !v);
      } else {
        setPdfOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [qaActive, shortcutScopeActive]);

  return (
    <div
      className={`flex flex-col overflow-hidden bg-gray-50 ${className}`}
      data-file-viewer-modal={shortcutScopeActive ? "open" : undefined}
    >
      <FileViewerHeader
        file={file}
        {...headerProps}
        pdfOpen={pdfOpen}
        qaOpen={qaOpen}
        qaAvailable={qaActive}
        onTogglePdf={togglePdf}
        onToggleQa={toggleQa}
        pdfShortcutLabel={pdfShortcutLabel}
        qaShortcutLabel={qaShortcutLabel}
      />

      <div
        className={`flex flex-1 overflow-hidden border-t border-gray-200 min-h-0 relative ${splitContainerClassName}`}
      >
        {detailLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Loader className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        )}

        <Splitter
          className="flex-1 min-h-0 w-full"
          onResize={(next) => {
            if (next.length >= 3) {
              const nextSizes: PanelSizes = [next[0], next[1], next[2]];
              if (!isCollapsedSize(nextSizes[0])) {
                savedPdfSizeRef.current = nextSizes[0];
              }
              if (!isCollapsedSize(nextSizes[2])) {
                savedQaSizeRef.current = nextSizes[2];
              }
              setPanelSizes(nextSizes);
            }
          }}
        >
          <Splitter.Panel
            size={panelSizes[0]}
            min={pdfOpen ? 200 : 0}
            max={pdfOpen ? undefined : 0}
            resizable={pdfOpen}
            className={pdfOpen ? undefined : "file-viewer-pane-collapsed"}
          >
            {/* Keep PdfViewer mounted while hidden so ⌘B doesn't reload the PDF. */}
            <div
              className={`flex flex-col h-full min-w-0 overflow-hidden border-r border-gray-200 bg-gray-100 ${
                pdfOpen ? "" : "hidden"
              }`}
              aria-hidden={!pdfOpen}
            >
              <div className="flex-1 overflow-hidden min-h-0">
                {pdfUrlLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader className="w-6 h-6 animate-spin text-gray-400" />
                  </div>
                ) : pdfUrl ? (
                  <PdfViewer
                    url={pdfUrl}
                    fileKey={file.id}
                    targetPage={pdfNavRequest?.page ?? null}
                    targetPageNonce={pdfNavRequest?.nonce}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <Text type="secondary" className="text-sm">
                      <ExclamationCircleOutlined className="mr-2" />
                      Unable to load PDF
                    </Text>
                  </div>
                )}
              </div>
            </div>
          </Splitter.Panel>

          <Splitter.Panel size={panelSizes[1]} min={280}>
            <div className="flex flex-col h-full min-w-0 w-full overflow-hidden bg-white">
              <FileViewerRightPane
                file={file}
                jobSchema={jobSchema}
                editable={editable}
                comments={comments}
                onAddComment={onAddComment}
                onUpdate={onUpdate}
                onSectionsUpdated={onSectionsUpdated}
                viewerPane={viewerPane}
                onViewerPaneChange={onViewerPaneChange}
                viewerSectionId={viewerSectionId}
                onViewerSectionChange={onViewerSectionChange}
                viewerResultTab={viewerResultTab}
                onViewerResultTabChange={onViewerResultTabChange}
                onNavigateToPdfPage={handleNavigateToPdfPage}
                qaPanelContainer={showQaPanel ? qaContainer : null}
                onQaPanelActiveChange={setQaActive}
              />
            </div>
          </Splitter.Panel>

          <Splitter.Panel
            size={panelSizes[2]}
            min={showQaPanel ? 240 : 0}
            max={showQaPanel ? "45%" : 0}
            resizable={showQaPanel}
            className={showQaPanel ? undefined : "file-viewer-pane-collapsed"}
          >
            {/* Slot always mounted so the portal target is stable; collapsed
                to size 0 when there are no findings or the user hid QA. */}
            <div
              ref={qaContainerRef}
              className={`h-full min-h-0 overflow-hidden bg-white border-l border-gray-200 ${
                showQaPanel ? "" : "hidden"
              }`}
              aria-hidden={!showQaPanel}
            />
          </Splitter.Panel>
        </Splitter>
      </div>
    </div>
  );
}
