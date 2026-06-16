"use client";

import React, { useEffect, useRef, useState } from "react";
import { Typography } from "antd";
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
} & Omit<FileViewerHeaderProps, "file">;

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
  ...headerProps
}: FileViewerLayoutProps) {
  const [splitPosition, setSplitPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const splitPositionRef = useRef(50);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    splitPositionRef.current = splitPosition;
  }, [splitPosition]);

  useEffect(() => {
    let animationFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;
      if (animationFrameId) cancelAnimationFrame(animationFrameId);

      animationFrameId = requestAnimationFrame(() => {
        const container = document.querySelector(`.${splitContainerClassName}`);
        if (!container || !leftPaneRef.current || !rightPaneRef.current) return;

        const rect = container.getBoundingClientRect();
        const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(20, Math.min(80, newPosition));
        splitPositionRef.current = clamped;
        leftPaneRef.current.style.width = `${clamped}%`;
        rightPaneRef.current.style.width = `${100 - clamped}%`;
      });
    };

    const handleMouseUp = () => {
      setSplitPosition(splitPositionRef.current);
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove, {
        passive: true,
      });
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing, splitContainerClassName]);

  const _pageCountDisplay = React.useMemo(() => {
    if (!file) return null;
    if (
      typeof file.page_count === "number" &&
      Number.isFinite(file.page_count)
    ) {
      return file.page_count;
    }
    if (typeof file.pages === "number" && Number.isFinite(file.pages)) {
      return file.pages;
    }
    if (Array.isArray(file.pages)) {
      return file.pages.length;
    }
    return null;
  }, [file]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

  return (
    <div className={`flex flex-col overflow-hidden bg-gray-50 ${className}`}>
      <FileViewerHeader file={file} {...headerProps} />

      <div
        className={`flex flex-1 overflow-hidden border-t border-gray-200 min-h-0 relative ${splitContainerClassName}`}
      >
        {detailLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60">
            <Loader className="w-6 h-6 animate-spin text-gray-500" />
          </div>
        )}

        <div
          ref={leftPaneRef}
          className="flex flex-col min-w-0 overflow-hidden border-r border-gray-200 bg-gray-100"
          style={{ width: `${splitPosition}%`, minWidth: "200px" }}
        >
          <div className="px-3 py-1 bg-white border-b border-gray-200 flex-shrink-0 flex items-baseline gap-2">
            <Text className="text-xs font-medium text-gray-600">PDF</Text>
            {_pageCountDisplay != null && (
              <Text className="text-[11px] text-gray-400">
                {_pageCountDisplay} pages
              </Text>
            )}
          </div>
          <div className="flex-1 overflow-hidden min-h-0">
            {pdfUrlLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : pdfUrl ? (
              <PdfViewer url={pdfUrl} fileKey={file.id} />
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

        <div
          className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize flex-shrink-0"
          style={{ minWidth: "4px" }}
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
        />

        <div
          ref={rightPaneRef}
          className="flex flex-col min-w-0 overflow-hidden bg-white"
          style={{ width: `${100 - splitPosition}%`, minWidth: "280px" }}
        >
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
          />
        </div>
      </div>
    </div>
  );
}
