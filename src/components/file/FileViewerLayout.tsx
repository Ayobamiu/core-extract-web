"use client";

import React from "react";
import { Splitter, Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import type { JobFile } from "@/lib/api";
import type { ViewerPane, ViewerResultTab } from "@/lib/jobViewUrlState";
import FileViewerHeader, {
  type FileViewerHeaderProps,
} from "./FileViewerHeader";
import FileViewerRightPane from "./FileViewerRightPane";
import { Loader } from "lucide-react";

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
          <Splitter.Panel defaultSize="50%" min={200}>
            <div className="flex flex-col h-full min-w-0 overflow-hidden border-r border-gray-200 bg-gray-100">
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
                  <iframe
                    key={file.id}
                    src={pdfUrl}
                    className="w-full h-full border-0 bg-white"
                    title={`PDF viewer for ${file.filename}`}
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
              />
            </div>
          </Splitter.Panel>
        </Splitter>
      </div>
    </div>
  );
}
