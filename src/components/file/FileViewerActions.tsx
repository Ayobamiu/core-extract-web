"use client";

import React from "react";
import { Button, Dropdown, Tooltip } from "antd";
import type { MenuProps } from "antd";
import {
  CheckCircleOutlined,
  FileTextOutlined,
  InfoCircleOutlined,
  MoreOutlined,
  ReloadOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import type { JobFile } from "@/lib/api";
import { Loader } from "lucide-react";

export interface FileViewerActionsProps {
  file: JobFile;
  isAdmin: boolean;
  reviewingFileId: string | null;
  verifyingFileId: string | null;
  reprocessingFileId: string | null;
  onUpdateReviewStatus: (
    fileId: string,
    status: "reviewed" | "pending",
  ) => void;
  onVerifyFile: (fileId: string, verified: boolean) => void;
  onReviewAndVerifyFile: (fileId: string) => void;
  onReprocessFile: (fileId: string) => void;
  onOpenFileDetails?: (file: JobFile) => void;
  onClose?: () => void;
  moreMenuItems?: MenuProps["items"];
  showReviewAndVerifyInBar?: boolean;
}

export default function FileViewerActions({
  file,
  isAdmin,
  reviewingFileId,
  verifyingFileId,
  reprocessingFileId,
  onUpdateReviewStatus,
  onVerifyFile,
  onReviewAndVerifyFile,
  onReprocessFile,
  onOpenFileDetails,
  onClose,
  moreMenuItems = [],
  showReviewAndVerifyInBar = false,
}: FileViewerActionsProps) {
  const isProcessing =
    reprocessingFileId === file.id ||
    file.extraction_status === "processing" ||
    file.processing_status === "processing";

  const reviewVerifyLoading =
    reviewingFileId === file.id || verifyingFileId === file.id;

  return (
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

      {isAdmin && showReviewAndVerifyInBar && (
        <Button
          type="default"
          size="small"
          icon={
            reviewVerifyLoading ? (
              <Loader className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircleOutlined />
            )
          }
          onClick={() => onReviewAndVerifyFile(file.id)}
          disabled={reviewVerifyLoading}
          loading={reviewVerifyLoading}
        >
          Review & Verify
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
  );
}
