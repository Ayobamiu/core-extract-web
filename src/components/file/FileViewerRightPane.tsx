"use client";

import React, { useState } from "react";
import { Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import type { JobFile } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import ConstraintErrorIcon from "@/components/ui/ConstraintErrorIcon";
import DocumentRoutingPanel from "@/components/DocumentRoutingPanel";
import FileProcessingPanel from "./FileProcessingPanel";

const { Text } = Typography;

type RightPaneTab = "results" | "routing" | "processing";

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

export default function FileViewerRightPane({
  file,
  jobSchema,
  editable,
  comments,
  onAddComment,
  onUpdate,
  onSectionsUpdated,
}: FileViewerRightPaneProps) {
  const [activeTab, setActiveTab] = useState<RightPaneTab>("results");
  const hasRouting = Boolean(file.detected_sections);
  const sectionCount = file.detected_sections?.sections?.length ?? 0;
  const routingBadge =
    hasRouting && sectionCount > 0 ? String(sectionCount) : undefined;

  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden">
      <div className="flex items-center justify-between px-3 border-b border-gray-200 bg-white flex-shrink-0">
        <nav className="flex items-center gap-0" aria-label="File viewer panels">
          <PaneTab
            active={activeTab === "results"}
            onClick={() => setActiveTab("results")}
          >
            Results
          </PaneTab>
          {hasRouting && (
            <PaneTab
              active={activeTab === "routing"}
              onClick={() => setActiveTab("routing")}
              badge={routingBadge}
            >
              Routing
            </PaneTab>
          )}
          <PaneTab
            active={activeTab === "processing"}
            onClick={() => setActiveTab("processing")}
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
                resultEnvelope={file.extraction_metadata?.result_envelope}
                sectionResults={file.extraction_metadata?.section_results}
                detectedSections={file.detected_sections}
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
              visualClassifierMeta={
                file.extraction_metadata?.visual_page_classifier ?? null
              }
              onSectionsUpdated={onSectionsUpdated}
            />
          </div>
        )}

        {activeTab === "processing" && <FileProcessingPanel file={file} />}
      </div>
    </div>
  );
}
