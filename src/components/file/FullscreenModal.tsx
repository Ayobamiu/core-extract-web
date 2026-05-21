"use client";

import React from "react";
import { Modal, Spin } from "antd";
import { JobFile } from "@/lib/api";
import FileViewerLayout from "./FileViewerLayout";

interface FullscreenModalProps {
  file: JobFile | null;
  open: boolean;
  onClose: () => void;
  onOpenFileDetails: (file: JobFile) => void;
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
      wrapClassName="top-0 overflow-hidden"
      styles={{
        body: {
          height: "100vh",
          padding: 0,
          overflow: "hidden",
        },
        content: {
          top: 0,
          maxHeight: "100vh",
          borderRadius: 1,
          boxShadow: "none",
          padding: 0,
        },
        wrapper: { top: 0, overflow: "hidden" },
      }}
      style={{
        top: 0,
        paddingBottom: 0,
        maxWidth: "100vw",
        margin: 0,
        padding: 0,
      }}
      closeIcon={null}
      maskClosable={false}
    >
      {!file ? (
        <div className="flex h-full items-center justify-center bg-gray-50">
          <Spin size="large" />
        </div>
      ) : (
      <FileViewerLayout
        className="h-full"
        file={file}
        pdfUrl={pdfUrl}
        pdfUrlLoading={pdfUrlLoading}
        jobSchema={jobSchema}
        editable
        comments={comments}
        onAddComment={onAddComment}
        onUpdate={handleUpdate}
        onSectionsUpdated={(next) => onSectionsUpdated?.(file.id, next)}
        detailLoading={detailLoading}
        splitContainerClassName="file-viewer-split-modal"
        showNavigation
        fileIndex={fileIndex}
        totalFiles={totalFiles}
        onPrevious={onPreviousFile}
        onNext={onNextFile}
        onClose={onClose}
        onOpenFileDetails={onOpenFileDetails}
        onUpdateReviewStatus={onUpdateReviewStatus}
        onVerifyFile={onVerifyFile}
        onReviewAndVerifyFile={onReviewAndVerifyFile}
        onReprocessFile={onReprocessFile}
        reviewingFileId={reviewingFileId}
        verifyingFileId={verifyingFileId}
        reprocessingFileId={reprocessingFileId}
        isAdmin={isAdmin}
      />
      )}
    </Modal>
  );
};

export default FullscreenModal;
