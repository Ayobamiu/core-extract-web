"use client";

import React from "react";
import { Button, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  CheckCircleOutlined,
  FilePdfOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import type { JobFile } from "@/lib/api";
import FileViewerMetaChips from "./FileViewerMetaChips";
import FileViewerActions from "./FileViewerActions";
import { buildFileProcessingSummary } from "@/lib/fileProcessingMeta";

const { Text } = Typography;

export interface FileViewerHeaderProps {
  file: JobFile;
  fileIndex?: number;
  totalFiles?: number;
  showNavigation?: boolean;
  onPrevious?: () => void;
  onNext?: () => void;
  onClose?: () => void;
  onOpenFileDetails?: (file: JobFile) => void;
  onUpdateReviewStatus: (
    fileId: string,
    status: "reviewed" | "pending",
  ) => void;
  onVerifyFile: (fileId: string, verified: boolean) => void;
  onReviewAndVerifyFile: (fileId: string) => void;
  onReprocessFile: (fileId: string) => void;
  reviewingFileId: string | null;
  verifyingFileId: string | null;
  reprocessingFileId: string | null;
  isAdmin: boolean;
  /** Show Review & Verify as a primary toolbar button (file page). */
  showReviewAndVerifyInBar?: boolean;
  onReload?: () => void;
  reloadLoading?: boolean;
}

export default function FileViewerHeader({
  file,
  fileIndex,
  totalFiles,
  showNavigation = false,
  onPrevious,
  onNext,
  onClose,
  onOpenFileDetails,
  onUpdateReviewStatus,
  onVerifyFile,
  onReviewAndVerifyFile,
  onReprocessFile,
  reviewingFileId,
  verifyingFileId,
  reprocessingFileId,
  isAdmin,
  showReviewAndVerifyInBar = false,
  onReload,
  reloadLoading = false,
}: FileViewerHeaderProps) {
  const moreMenuItems: MenuProps["items"] = [];
  if (isAdmin && !showReviewAndVerifyInBar) {
    moreMenuItems.push({
      key: "review-verify",
      label: "Review & verify",
      icon: <CheckCircleOutlined />,
      disabled: reviewingFileId === file.id || verifyingFileId === file.id,
      onClick: () => onReviewAndVerifyFile(file.id),
    });
  }
  const summary = buildFileProcessingSummary(file);
  const hasMetaChips =
    Boolean(summary.extractionMethod) ||
    Boolean(summary.model) ||
    summary.documentTypeSlugs.length > 0 ||
    Boolean(summary.routingStatus) ||
    file.review_status === "reviewed" ||
    file.admin_verified;

  return (
    <header className="flex-shrink-0 bg-white">
      <div className="flex items-center gap-2 px-3 py-1.5 min-h-[40px] border-b border-gray-200">
        {showNavigation && (
          <div className="flex items-center gap-0.5 shrink-0">
            <Button
              type="text"
              size="small"
              icon={<LeftOutlined />}
              onClick={onPrevious}
              disabled={fileIndex === 0}
              aria-label="Previous file"
            />
            <Button
              type="text"
              size="small"
              icon={<RightOutlined />}
              onClick={onNext}
              disabled={
                fileIndex === undefined ||
                totalFiles === undefined ||
                fileIndex >= totalFiles - 1
              }
              aria-label="Next file"
            />
          </div>
        )}

        <FilePdfOutlined className="text-gray-400 shrink-0 text-sm" />

        <div className="flex-1 min-w-0 flex items-center gap-2">
          <Tooltip title={file.filename}>
            <span className="text-sm font-medium text-gray-900 truncate">
              {file.filename}
            </span>
          </Tooltip>
          {showNavigation &&
            fileIndex !== undefined &&
            totalFiles !== undefined && (
              <Text type="secondary" className="!text-[11px] shrink-0">
                {fileIndex + 1}/{totalFiles}
              </Text>
            )}
        </div>

        <FileViewerActions
          file={file}
          isAdmin={isAdmin}
          reviewingFileId={reviewingFileId}
          verifyingFileId={verifyingFileId}
          reprocessingFileId={reprocessingFileId}
          onUpdateReviewStatus={onUpdateReviewStatus}
          onVerifyFile={onVerifyFile}
          onReviewAndVerifyFile={onReviewAndVerifyFile}
          onReprocessFile={onReprocessFile}
          onOpenFileDetails={onOpenFileDetails}
          onReload={onReload}
          reloadLoading={reloadLoading}
          onClose={onClose}
          moreMenuItems={moreMenuItems}
          showReviewAndVerifyInBar={showReviewAndVerifyInBar}
        />
      </div>

      {hasMetaChips && (
        <div className="px-3 py-1">
          <FileViewerMetaChips file={file} />
        </div>
      )}
    </header>
  );
}
