"use client";

import React, { useCallback, useEffect, useState } from "react";
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
  const [pdfNavRequest, setPdfNavRequest] = useState<{
    page: number;
    nonce: number;
  } | null>(null);

  useEffect(() => {
    setPdfNavRequest(null);
  }, [file.id]);

  const handleNavigateToPdfPage = useCallback((page: number) => {
    setPdfNavRequest((prev) => ({
      page,
      nonce: (prev?.nonce ?? 0) + 1,
    }));
  }, []);

  // ── QA side column (3-segment review: PDF | content | QA) ───────────────
  // TabbedDataViewer (deep inside the right pane) owns all QA state and
  // portals its findings/review panel into this slot. We only decide whether
  // the third pane exists (qaActive) and hand over the mounted element.
  const [qaActive, setQaActive] = useState(false);
  const [qaContainer, setQaContainer] = useState<HTMLDivElement | null>(null);
  const qaContainerRef = useCallback((node: HTMLDivElement | null) => {
    setQaContainer(node);
  }, []);

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

        <Splitter className="flex-1 min-h-0">
          <Splitter.Panel defaultSize="38%" min={200}>
            <div className="flex flex-col h-full min-w-0 overflow-hidden border-r border-gray-200 bg-gray-100">
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

          <Splitter.Panel min={280}>
            <div className="flex flex-col h-full min-w-0 overflow-hidden bg-white">
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
                qaPanelContainer={qaContainer}
                onQaPanelActiveChange={setQaActive}
              />
            </div>
          </Splitter.Panel>

          {/* Third segment: QA findings / "Review & apply all" — appears only
              when the section has findings and the results tab is active.
              TabbedDataViewer portals its panel in here, so PDF + result +
              QA sit side by side, every divider draggable. */}
          {qaActive && (
            <Splitter.Panel defaultSize="24%" min={240} max="45%">
              <div
                ref={qaContainerRef}
                className="h-full min-h-0 overflow-hidden bg-white border-l border-gray-200"
              />
            </Splitter.Panel>
          )}
        </Splitter>
      </div>
    </div>
  );
}
