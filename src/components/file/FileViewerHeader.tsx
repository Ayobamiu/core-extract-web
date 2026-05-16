"use client";

import React from "react";
import { Button, Dropdown, Tooltip, Typography } from "antd";
import type { MenuProps } from "antd";
import {
  CheckCircleOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  LeftOutlined,
  LinkOutlined,
  MoreOutlined,
  ReloadOutlined,
  RightOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import type { JobFile } from "@/lib/api";
import { Loader } from "lucide-react";
import FileViewerMetaChips from "./FileViewerMetaChips";

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
  onOpenFilePage?: (fileId: string) => void;
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
  onOpenFilePage,
  onUpdateReviewStatus,
  onVerifyFile,
  onReviewAndVerifyFile,
  onReprocessFile,
  reviewingFileId,
  verifyingFileId,
  reprocessingFileId,
  isAdmin,
}: FileViewerHeaderProps) {
  const isProcessing =
    reprocessingFileId === file.id ||
    file.extraction_status === "processing" ||
    file.processing_status === "processing";

  const moreMenuItems: MenuProps["items"] = [];
  if (isAdmin) {
    moreMenuItems.push({
      key: "review-verify",
      label: "Review & verify",
      icon: <CheckCircleOutlined />,
      disabled: reviewingFileId === file.id || verifyingFileId === file.id,
      onClick: () => onReviewAndVerifyFile(file.id),
    });
  }
  if (onOpenFilePage) {
    moreMenuItems.push({
      key: "open-page",
      label: "Open in full page",
      icon: <LinkOutlined />,
      onClick: () => onOpenFilePage(file.id),
    });
  }

  return (
    <header className="flex-shrink-0 border-b border-gray-200 bg-white">
      <div className="flex items-center gap-2 px-3 py-2 min-h-[44px]">
        {showNavigation && (
          <div className="flex items-center gap-1 shrink-0">
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

        <FilePdfOutlined className="text-gray-400 flex-shrink-0 text-sm" />

        <div className="flex-1 min-w-0">
          <Tooltip title={file.filename}>
            <Text className="!text-sm !font-medium !text-gray-900 block truncate">
              {file.filename}
            </Text>
          </Tooltip>
          {showNavigation &&
            fileIndex !== undefined &&
            totalFiles !== undefined && (
              <Text type="secondary" className="!text-[11px]">
                {fileIndex + 1} of {totalFiles}
              </Text>
            )}
        </div>

        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            type={file.review_status === "reviewed" ? "default" : "primary"}
            size="small"
            icon={
              reviewingFileId === file.id ? (
                <Loader className="w-3 h-3 animate-spin" />
              ) : file.review_status === "reviewed" ? (
                <CheckCircleOutlined className="text-emerald-600" />
              ) : (
                <FileTextOutlined />
              )
            }
            onClick={() =>
              onUpdateReviewStatus(
                file.id,
                file.review_status === "reviewed" ? "pending" : "reviewed",
              )
            }
            disabled={reviewingFileId === file.id}
            loading={reviewingFileId === file.id}
          >
            {file.review_status === "reviewed" ? "Reviewed" : "Review"}
          </Button>

          {isAdmin && (
            <Button
              type={file.admin_verified ? "default" : "primary"}
              size="small"
              icon={
                verifyingFileId === file.id ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <CheckCircleOutlined />
                )
              }
              onClick={() => onVerifyFile(file.id, !file.admin_verified)}
              disabled={file.admin_verified || verifyingFileId === file.id}
              loading={verifyingFileId === file.id}
            >
              {file.admin_verified ? "Verified" : "Verify"}
            </Button>
          )}

          <Button
            type="default"
            size="small"
            icon={
              isProcessing ? (
                <Loader className="w-3 h-3 animate-spin" />
              ) : (
                <ReloadOutlined />
              )
            }
            onClick={() => onReprocessFile(file.id)}
            disabled={isProcessing}
            loading={isProcessing}
          >
            Reprocess
          </Button>

          {moreMenuItems.length > 0 && (
            <Dropdown menu={{ items: moreMenuItems }} trigger={["click"]}>
              <Button type="text" size="small" icon={<MoreOutlined />} />
            </Dropdown>
          )}

          {onOpenFileDetails && (
            <Tooltip title="File details">
              <Button
                type="text"
                size="small"
                icon={<InfoCircleOutlined />}
                onClick={() => onOpenFileDetails(file)}
              />
            </Tooltip>
          )}

          {onClose && (
            <Button
              type="text"
              size="small"
              icon={<ShrinkOutlined />}
              onClick={onClose}
            >
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="px-3 pb-2">
        <FileViewerMetaChips file={file} />
      </div>
    </header>
  );
}
