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
import {
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
} from "lucide-react";
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
  /** Cursor-style layout toggles (owned by FileViewerLayout). */
  pdfOpen?: boolean;
  qaOpen?: boolean;
  qaAvailable?: boolean;
  onTogglePdf?: () => void;
  onToggleQa?: () => void;
  pdfShortcutLabel?: string;
  qaShortcutLabel?: string;
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
  pdfOpen = true,
  qaOpen = true,
  qaAvailable = false,
  onTogglePdf,
  onToggleQa,
  pdfShortcutLabel = "⌘B",
  qaShortcutLabel = "⌘⇧B",
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

  const pdfToggleTitle = pdfOpen
    ? `Hide PDF (${pdfShortcutLabel})`
    : `Show PDF (${pdfShortcutLabel})`;
  const qaToggleTitle = !qaAvailable
    ? "No QA findings for this section"
    : qaOpen
      ? `Hide QA (${qaShortcutLabel})`
      : `Show QA (${qaShortcutLabel})`;

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

        {/* Layout toggles — Cursor/VS Code feel: left = primary (PDF), right = QA */}
        {(onTogglePdf || onToggleQa) && (
          <div className="flex items-center gap-0.5 shrink-0 mr-0.5 border-r border-gray-200 pr-2">
            {onTogglePdf && (
              <Tooltip title={pdfToggleTitle}>
                <button
                  type="button"
                  onClick={onTogglePdf}
                  className={`p-1.5 rounded-md transition-colors ${
                    pdfOpen
                      ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-label={pdfToggleTitle}
                  aria-pressed={pdfOpen}
                >
                  {pdfOpen ? (
                    <PanelLeftClose className="h-4 w-4" aria-hidden />
                  ) : (
                    <PanelLeftOpen className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </Tooltip>
            )}
            {onToggleQa && (
              <Tooltip title={qaToggleTitle}>
                <button
                  type="button"
                  onClick={onToggleQa}
                  disabled={!qaAvailable}
                  className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:bg-transparent ${
                    qaAvailable && qaOpen
                      ? "text-gray-700 bg-gray-100 hover:bg-gray-200"
                      : "text-gray-400 hover:text-gray-700 hover:bg-gray-100"
                  }`}
                  aria-label={qaToggleTitle}
                  aria-pressed={qaAvailable && qaOpen}
                  aria-disabled={!qaAvailable}
                >
                  {qaAvailable && qaOpen ? (
                    <PanelRightClose className="h-4 w-4" aria-hidden />
                  ) : (
                    <PanelRightOpen className="h-4 w-4" aria-hidden />
                  )}
                </button>
              </Tooltip>
            )}
          </div>
        )}

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
