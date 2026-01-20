"use client";

import React, { useRef, useState, useEffect } from "react";
import { Modal, Button, Typography } from "antd";
import {
  FilePdfOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  RightOutlined,
  ShrinkOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import ConstraintErrorIcon from "@/components/ui/ConstraintErrorIcon";
import { Loader } from "lucide-react";

const { Text } = Typography;

interface FullscreenModalProps {
  file: JobFile | null;
  open: boolean;
  onClose: () => void;
  onOpenFileDetails: (file: JobFile) => void;
  onPreviousFile: () => void;
  onNextFile: () => void;
  onUpdateReviewStatus: (
    fileId: string,
    status: "reviewed" | "pending"
  ) => void;
  onVerifyFile: (fileId: string, verified: boolean) => void;
  onReviewAndVerifyFile: (fileId: string) => void;
  onReprocessFile: (fileId: string) => void;
  onUpdateResults: (fileId: string, updatedData: any) => Promise<void>;
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
  jobSchema: any;
  pdfUrl: string | null;
  pdfUrlLoading: boolean;
  fileIndex: number;
  totalFiles: number;
}

const FullscreenModal: React.FC<FullscreenModalProps> = ({
  file,
  open,
  onClose,
  onOpenFileDetails,
  onPreviousFile,
  onNextFile,
  onUpdateReviewStatus,
  onVerifyFile,
  onReviewAndVerifyFile,
  onReprocessFile,
  onUpdateResults,
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
}) => {
  const [splitPosition, setSplitPosition] = useState(50);
  const [isResizing, setIsResizing] = useState(false);
  const splitPositionRef = useRef(50);
  const leftPaneRef = useRef<HTMLDivElement>(null);
  const rightPaneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    splitPositionRef.current = splitPosition;
  }, [splitPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const handleMouseMove = (e: MouseEvent) => {
      if (!leftPaneRef.current || !rightPaneRef.current) return;

      const container = leftPaneRef.current.parentElement;
      if (!container) return;

      const containerRect = container.getBoundingClientRect();
      const newPosition =
        ((e.clientX - containerRect.left) / containerRect.width) * 100;

      // Constrain between 20% and 80%
      const constrainedPosition = Math.max(20, Math.min(80, newPosition));
      setSplitPosition(constrainedPosition);
      splitPositionRef.current = constrainedPosition;
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  };

  const handleUpdate = async (updatedData: any) => {
    if (!file) return;
    await onUpdateResults(file.id, updatedData);
    if (onDataUpdate) {
      const result = onDataUpdate();
      if (result instanceof Promise) {
        await result;
      }
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
        body: {
          height: "100vh",
          padding: 0,
          overflow: "hidden",
        },
        content: {
          top: 0,
          paddingBottom: 0,
          maxHeight: "100vh",
          borderRadius: 0,
          boxShadow: "none",
        },
        wrapper: {
          padding: 0,
          top: 0,
          overflow: "hidden",
        },
      }}
      style={{
        top: 0,
        paddingBottom: 0,
        maxWidth: "100vw",
        margin: 0,
      }}
      closeIcon={null}
      maskClosable={false}
    >
      <div className="flex flex-col h-full overflow-hidden border border-gray-200">
        {/* Navigation Header */}
        <div className="flex items-center justify-between p-2 border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center space-x-4 flex-1">
            <div className="flex items-center space-x-2">
              <Button
                type="default"
                icon={<LeftOutlined />}
                onClick={onPreviousFile}
                disabled={fileIndex === 0}
              >
                Previous
              </Button>
              <Button
                type="default"
                icon={<RightOutlined />}
                iconPosition="end"
                onClick={onNextFile}
                disabled={fileIndex === totalFiles - 1}
              >
                Next
              </Button>
            </div>
            <div className="flex items-center space-x-2 text-sm text-gray-600">
              <FilePdfOutlined className="text-blue-500" />
              <span className="font-medium">{file.filename}</span>
              <span className="text-gray-400">
                ({fileIndex + 1} of {totalFiles})
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button
              type="text"
              icon={<InfoCircleOutlined />}
              onClick={() => onOpenFileDetails(file)}
              title="View File Details"
            />
            <Button
              type={file.review_status === "reviewed" ? "default" : "primary"}
              icon={
                reviewingFileId === file.id ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : file.review_status === "reviewed" ? (
                  <CheckCircleOutlined style={{ color: "#52c41a" }} />
                ) : (
                  <FileTextOutlined />
                )
              }
              onClick={() =>
                onUpdateReviewStatus(
                  file.id,
                  file.review_status === "reviewed" ? "pending" : "reviewed"
                )
              }
              disabled={reviewingFileId === file.id}
              loading={reviewingFileId === file.id}
              style={
                file.review_status === "reviewed"
                  ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                  : {}
              }
            >
              {reviewingFileId === file.id
                ? "Updating..."
                : file.review_status === "reviewed"
                ? "Reviewed"
                : "Mark as Reviewed"}
            </Button>
            {isAdmin && (
              <Button
                type={file.admin_verified ? "default" : "primary"}
                icon={
                  verifyingFileId === file.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : file.admin_verified ? (
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                onClick={() => onVerifyFile(file.id, !file.admin_verified)}
                disabled={file.admin_verified || verifyingFileId === file.id}
                loading={verifyingFileId === file.id}
                style={
                  file.admin_verified
                    ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                    : {}
                }
              >
                {verifyingFileId === file.id
                  ? "Verifying..."
                  : file.admin_verified
                  ? "Verified"
                  : "Verify"}
              </Button>
            )}
            {isAdmin && (
              <Button
                type="primary"
                style={{
                  backgroundColor: "#fa8c16",
                  borderColor: "#fa8c16",
                }}
                icon={
                  reviewingFileId === file.id || verifyingFileId === file.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                onClick={() => onReviewAndVerifyFile(file.id)}
                disabled={
                  reviewingFileId === file.id || verifyingFileId === file.id
                }
                loading={
                  reviewingFileId === file.id || verifyingFileId === file.id
                }
              >
                {reviewingFileId === file.id || verifyingFileId === file.id
                  ? "Updating..."
                  : "Review & Verify"}
              </Button>
            )}
            <Button
              type="default"
              icon={
                reprocessingFileId === file.id ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing" ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <ReloadOutlined />
                )
              }
              onClick={() => onReprocessFile(file.id)}
              disabled={
                reprocessingFileId === file.id ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing"
              }
              loading={
                reprocessingFileId === file.id ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing"
              }
            >
              {reprocessingFileId === file.id ||
              file.extraction_status === "processing" ||
              file.processing_status === "processing"
                ? "Processing..."
                : "Reprocess"}
            </Button>
            <Button type="text" icon={<ShrinkOutlined />} onClick={onClose}>
              Close
            </Button>
          </div>
        </div>

        {/* Content Area - Two Pane Layout */}
        <div className="flex flex-1 overflow-hidden min-h-0 fullscreen-modal-content">
          {/* Left Pane - PDF Viewer */}
          <div
            ref={leftPaneRef}
            className="bg-gray-100 flex flex-col min-w-0 overflow-hidden"
            style={{ width: `${splitPosition}%`, minWidth: "200px" }}
          >
            <div className="px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
              <Text strong className="text-sm">
                PDF Document
              </Text>
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              {pdfUrlLoading ? (
                <div className="flex items-center justify-center h-full">
                  <Loader className="w-8 h-8 animate-spin text-blue-500" />
                </div>
              ) : pdfUrl ? (
                <iframe
                  src={pdfUrl}
                  className="w-full h-full border-0 bg-white"
                  style={{ display: "block", height: "100%" }}
                  title={`PDF viewer for ${file.filename}`}
                />
              ) : (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <ExclamationCircleOutlined className="text-gray-400 text-4xl mb-4" />
                    <Text type="secondary" className="text-lg">
                      Unable to load PDF
                    </Text>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resizable Divider */}
          <div
            className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0 relative group"
            onMouseDown={handleMouseDown}
            style={{ minWidth: "4px" }}
          >
            <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 group-hover:bg-blue-500 transition-colors" />
          </div>

          {/* Right Pane - Results Viewer */}
          <div
            ref={rightPaneRef}
            className="bg-white flex flex-col min-w-0 overflow-hidden"
            style={{ width: `${100 - splitPosition}%`, minWidth: "200px" }}
          >
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
              <Text strong className="text-sm">
                Extracted Results
                {file.selected_pages &&
                  file.selected_pages.length > 0 &&
                  ` - Selected pages: ${file.selected_pages
                    .sort((a, b) => a - b)
                    .join(", ")}`}
              </Text>
              <ConstraintErrorIcon file={file} />
            </div>
            <div className="flex-1 overflow-hidden min-h-0">
              {file.processing_status !== "completed" || !file.result ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-center">
                    <ExclamationCircleOutlined className="text-gray-400 text-4xl mb-4" />
                    <Text type="secondary" className="text-lg">
                      No results available for this file.
                    </Text>
                    <br />
                    <Text type="secondary" className="text-sm">
                      File status: {file.processing_status}
                    </Text>
                  </div>
                </div>
              ) : (
                <TabbedDataViewer
                  data={file.result}
                  filename={file.filename}
                  schema={jobSchema}
                  editable={true}
                  markdown={file.markdown}
                  actual_result={file.actual_result}
                  pages={Array.isArray(file.pages) ? file.pages : undefined}
                  onUpdate={handleUpdate}
                  comments={comments}
                  onAddComment={onAddComment}
                  fileId={file.id}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default FullscreenModal;
