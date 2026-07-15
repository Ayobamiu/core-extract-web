"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import {
  apiClient,
  type JobFile,
  type SectionVerification,
  type SectionVerificationStatus,
} from "@/lib/api";
import type { ViewerPane, ViewerResultTab } from "@/lib/jobViewUrlState";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import ConstraintErrorIcon from "@/components/ui/ConstraintErrorIcon";
import DocumentRoutingPanel from "@/components/DocumentRoutingPanel";
import FileProcessingPanel from "./FileProcessingPanel";

const { Text } = Typography;

interface FileViewerRightPaneProps {
  file: JobFile;
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
  onSectionsUpdated?: (next: JobFile["detected_sections"]) => void;
  viewerPane?: ViewerPane | null;
  onViewerPaneChange?: (pane: ViewerPane) => void;
  viewerSectionId?: string | null;
  onViewerSectionChange?: (sectionResultId: string | null) => void;
  viewerResultTab?: ViewerResultTab | null;
  onViewerResultTabChange?: (tab: ViewerResultTab) => void;
  onNavigateToPdfPage?: (pageNumber: number) => void;
  /** Slot + activity signal for the QA side column (3-segment layout). */
  qaPanelContainer?: HTMLElement | null;
  onQaPanelActiveChange?: (active: boolean) => void;
}

function PaneTab({
  active,
  onClick,
  children,
  badge,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-2 text-xs font-medium border-b-2 -mb-px transition-colors ${
        active
          ? "border-gray-900 text-gray-900"
          : "border-transparent text-gray-500 hover:text-gray-800"
      }`}
    >
      {children}
      {badge && (
        <span className="ml-1.5 text-[10px] font-normal text-gray-400">
          {badge}
        </span>
      )}
    </button>
  );
}

function defaultPaneForFile(file: JobFile): ViewerPane {
  return file.processing_status === "completed" && file.result
    ? "results"
    : "processing";
}

function normalizePane(file: JobFile, pane: ViewerPane, hasRouting: boolean): ViewerPane {
  if (pane === "routing" && !hasRouting) {
    return defaultPaneForFile(file);
  }
  return pane;
}

export default function FileViewerRightPane({
  file,
  jobSchema,
  editable,
  comments,
  onAddComment,
  onUpdate,
  onSectionsUpdated,
  viewerPane = null,
  onViewerPaneChange,
  viewerSectionId = null,
  onViewerSectionChange,
  viewerResultTab = null,
  onViewerResultTabChange,
  onNavigateToPdfPage,
  qaPanelContainer,
  onQaPanelActiveChange,
}: FileViewerRightPaneProps) {
  const hasRouting = Boolean(file.detected_sections);
  const sectionCount = file.detected_sections?.sections?.length ?? 0;
  const routingBadge =
    hasRouting && sectionCount > 0 ? String(sectionCount) : undefined;

  const activeTab = useMemo(
    () =>
      normalizePane(
        file,
        viewerPane ?? defaultPaneForFile(file),
        hasRouting,
      ),
    [file, viewerPane, hasRouting],
  );

  useEffect(() => {
    if (!onViewerPaneChange || viewerPane == null) return;
    const normalized = normalizePane(file, viewerPane, hasRouting);
    if (normalized !== viewerPane) {
      onViewerPaneChange(normalized);
    }
  }, [file.id, viewerPane, hasRouting, file, onViewerPaneChange]);

  const handlePaneChange = useCallback(
    (pane: ViewerPane) => {
      onViewerPaneChange?.(pane);
    },
    [onViewerPaneChange],
  );

  const [sectionVerifications, setSectionVerifications] = useState<SectionVerification[]>(
    file.section_verifications ?? [],
  );

  useEffect(() => {
    setSectionVerifications(file.section_verifications ?? []);
  }, [file.id, file.section_verifications]);

  const handleSectionVerify = useCallback(
    async (sectionResultId: string, status: SectionVerificationStatus, notes?: string) => {
      const res = await apiClient.updateSectionVerification(file.id, sectionResultId, status, notes);
      if (res.status === "success" && res.data) {
        setSectionVerifications((prev) => {
          const idx = prev.findIndex((v) => v.section_result_id === sectionResultId);
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = res.data as SectionVerification;
            return next;
          }
          return [...prev, res.data as SectionVerification];
        });
      }
    },
    [file.id],
  );

  const handleBulkSectionVerify = useCallback(
    async (sectionResultIds: string[], status: SectionVerificationStatus) => {
      const res = await apiClient.bulkUpdateSectionVerifications(file.id, sectionResultIds, status);
      if (res.status === "success" && res.data) {
        setSectionVerifications(res.data as SectionVerification[]);
      }
    },
    [file.id],
  );

  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 border-b border-gray-200 bg-white flex-shrink-0">
        <nav className="flex items-center gap-0" aria-label="File viewer panels">
          <PaneTab
            active={activeTab === "results"}
            onClick={() => handlePaneChange("results")}
          >
            Results
          </PaneTab>
          {hasRouting && (
            <PaneTab
              active={activeTab === "routing"}
              onClick={() => handlePaneChange("routing")}
              badge={routingBadge}
            >
              Routing
            </PaneTab>
          )}
          <PaneTab
            active={activeTab === "processing"}
            onClick={() => handlePaneChange("processing")}
          >
            Processing
          </PaneTab>
        </nav>
        <ConstraintErrorIcon file={file} defaultOpen={false} />
      </div>

      <div className="flex-1 min-h-0 overflow-hidden">
        {activeTab === "results" && (
          <>
            {file.processing_status !== "completed" || !file.result ? (
              <div className="flex items-center justify-center h-full p-6">
                <div className="text-center">
                  <ExclamationCircleOutlined className="text-gray-300 text-3xl mb-3" />
                  <Text type="secondary">No results available.</Text>
                  <br />
                  <Text type="secondary" className="text-xs">
                    Status: {file.processing_status}
                  </Text>
                </div>
              </div>
            ) : (
              <TabbedDataViewer
                data={file.result}
                filename={file.filename}
                schema={jobSchema}
                editable={editable}
                markdown={file.markdown}
                actual_result={file.actual_result}
                pages={Array.isArray(file.pages) ? file.pages : undefined}
                onUpdate={onUpdate}
                comments={comments}
                onAddComment={onAddComment}
                fileId={file.id}
                jobId={file.job_id}
                resultEnvelope={file.extraction_metadata?.result_envelope}
                sectionResults={file.extraction_metadata?.section_results}
                detectedSections={file.detected_sections}
                sectionVerifications={sectionVerifications}
                onSectionVerify={handleSectionVerify}
                onBulkSectionVerify={handleBulkSectionVerify}
                selectedSectionResultId={viewerSectionId}
                onSelectedSectionResultIdChange={onViewerSectionChange}
                activeResultTab={viewerResultTab}
                onActiveResultTabChange={onViewerResultTabChange}
                qaPanelContainer={qaPanelContainer}
                onQaPanelActiveChange={onQaPanelActiveChange}
                className="h-full"
              />
            )}
          </>
        )}

        {activeTab === "routing" && hasRouting && file.detected_sections && (
          <div className="h-full overflow-auto">
            <DocumentRoutingPanel
              fileId={file.id}
              detectedSections={file.detected_sections}
              result={file.result ?? null}
              visualClassifierMeta={
                file.extraction_metadata?.visual_page_classifier ?? null
              }
              onSectionsUpdated={onSectionsUpdated}
              onNavigateToPdfPage={onNavigateToPdfPage}
            />
          </div>
        )}

        {activeTab === "processing" && <FileProcessingPanel file={file} />}
      </div>
    </div>
  );
}
