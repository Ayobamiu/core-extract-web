"use client";

import React, { useRef, useState, useEffect } from "react";
import { Modal, Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import FileViewerHeader from "./FileViewerHeader";
import FileViewerRightPane from "./FileViewerRightPane";
import { Loader } from "lucide-react";

const { Text } = Typography;

interface FullscreenModalProps {
  file: JobFile | null;
  open: boolean;
  onClose: () => void;
  onOpenFileDetails: (file: JobFile) => void;
  onOpenFilePage?: (fileId: string) => void;
  onPreviousFile: () => void;
  onNextFile: () => void;
  onUpdateReviewStatus: (
    fileId: string,
    status: "reviewed" | "pending",
  ) => void;
  onVerifyFile: (fileId: string, verified: boolean) => void;
  onReviewAndVerifyFile: (fileId: string) => void;
  onReprocessFile: (fileId: string) => void;
  onUpdateResults: (fileId: string, updatedData: unknown) => Promise<void>;
  onSectionsUpdated?: (
    fileId: string,
    sections: JobFile["detected_sections"],
  ) => void;
  onDataUpdate?: (() => void) | (() => Promise<void>);
  reviewingFileId: string | null;
  verifyingFileId: string | null;
  reprocessingFileId: string | null;
  isAdmin: boolean;
  comments: Array<{
    id: string;
    userId: string;
    userEmail: string;
    text: string;
    createdAt: string;
  }>;
  onAddComment: (text: string) => Promise<void>;
  jobSchema: unknown;
  pdfUrl: string | null;
  pdfUrlLoading: boolean;
  fileIndex: number;
  totalFiles: number;
  detailLoading?: boolean;
}

const FullscreenModal: React.FC<FullscreenModalProps> = ({
  file,
  open,
  onClose,
  onOpenFileDetails,
  onOpenFilePage,
  onPreviousFile,
  onNextFile,
  onUpdateReviewStatus,
  onVerifyFile,
  onReviewAndVerifyFile,
  onReprocessFile,
  onUpdateResults,
  onSectionsUpdated,
  onDataUpdate,
  reviewingFileId,
  verifyingFileId,
  reprocessingFileId,
  isAdmin,
  comments,
  onAddComment,
  jobSchema,
  pdfUrl,
  pdfUrlLoading,
  fileIndex,
  totalFiles,
  detailLoading = false,
}) => {
  const [splitPosition, setSplitPosition] = useState(50);
  const splitPositionRef = useRef(50);
  const leftPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    splitPositionRef.current = splitPosition;
  }, [splitPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!leftPaneRef.current) return;
      const container = leftPaneRef.current.parentElement;
      if (!container) return;
      const containerRect = container.getBoundingClientRect();
      const newPosition =
        ((moveEvent.clientX - containerRect.left) / containerRect.width) * 100;
      const constrainedPosition = Math.max(20, Math.min(80, newPosition));
      setSplitPosition(constrainedPosition);
      splitPositionRef.current = constrainedPosition;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleUpdate = async (updatedData: unknown) => {
    if (!file) return;
    await onUpdateResults(file.id, updatedData);
    if (onDataUpdate) {
      const result = onDataUpdate();
      if (result instanceof Promise) await result;
    }
  };

  if (!file) return null;

  return (
    <Modal
      title={null}
      open={open}
      onCancel={onClose}
      footer={null}
      width="100vw"
      styles={{
        body: { height: "100vh", padding: 0, overflow: "hidden" },
        content: {
          top: 0,
          paddingBottom: 0,
          maxHeight: "100vh",
          borderRadius: 0,
          boxShadow: "none",
        },
        wrapper: { padding: 0, top: 0, overflow: "hidden" },
      }}
      style={{ top: 0, paddingBottom: 0, maxWidth: "100vw", margin: 0 }}
      closeIcon={null}
      maskClosable={false}
    >
      <div className="flex flex-col h-full overflow-hidden bg-gray-50">
        <FileViewerHeader
          file={file}
          fileIndex={fileIndex}
          totalFiles={totalFiles}
          showNavigation
          onPrevious={onPreviousFile}
          onNext={onNextFile}
          onClose={onClose}
          onOpenFileDetails={onOpenFileDetails}
          onOpenFilePage={onOpenFilePage}
          onUpdateReviewStatus={onUpdateReviewStatus}
          onVerifyFile={onVerifyFile}
          onReviewAndVerifyFile={onReviewAndVerifyFile}
          onReprocessFile={onReprocessFile}
          reviewingFileId={reviewingFileId}
          verifyingFileId={verifyingFileId}
          reprocessingFileId={reprocessingFileId}
          isAdmin={isAdmin}
        />

        <div className="flex flex-1 overflow-hidden min-h-0 relative">
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
            <div className="px-3 py-1.5 bg-white border-b border-gray-200 flex-shrink-0">
              <Text className="text-xs font-medium text-gray-600">PDF</Text>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              {pdfUrlLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : pdfUrl ? (
                <iframe
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

          <div
            className="w-1 bg-gray-200 hover:bg-gray-400 cursor-col-resize flex-shrink-0"
            style={{ minWidth: "4px" }}
            onMouseDown={handleMouseDown}
            role="separator"
            aria-orientation="vertical"
          />

          <div
            className="flex flex-col min-w-0 overflow-hidden bg-white"
            style={{ width: `${100 - splitPosition}%`, minWidth: "280px" }}
          >
            <FileViewerRightPane
              file={file}
              jobSchema={jobSchema}
              editable
              comments={comments}
              onAddComment={onAddComment}
              onUpdate={handleUpdate}
              onSectionsUpdated={(next) => onSectionsUpdated?.(file.id, next)}
            />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FullscreenModal;
