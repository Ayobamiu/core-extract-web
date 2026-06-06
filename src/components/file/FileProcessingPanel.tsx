"use client";

import React from "react";
import { Descriptions, Tag, Typography } from "antd";
import type { JobFile } from "@/lib/api";
import { buildFileProcessingSummary } from "@/lib/fileProcessingMeta";
import ProcessingTimeline from "./ProcessingTimeline";

const { Text } = Typography;

interface FileProcessingPanelProps {
  file: JobFile;
}

function MetaTag({ children }: { children: React.ReactNode }) {
  return (
    <Tag className="!m-0 !rounded !border-gray-200 !bg-gray-50 !text-gray-700 !text-xs">
      {children}
    </Tag>
  );
}

export default function FileProcessingPanel({ file }: FileProcessingPanelProps) {
  const summary = buildFileProcessingSummary(file);

  return (
    <div className="p-4 space-y-4 overflow-auto h-full">
      <div>
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Live progress
        </Text>
        <div className="mt-2">
          <ProcessingTimeline fileId={file.id} jobId={file.job_id ?? undefined} />
        </div>
      </div>

      <div>
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Pipeline
        </Text>
        <div className="flex flex-wrap gap-1.5 mt-2">
          {summary.extractionMethod && (
            <MetaTag>Extract: {summary.extractionMethod}</MetaTag>
          )}
          {summary.processingMethod && (
            <MetaTag>AI: {summary.processingMethod}</MetaTag>
          )}
          {summary.model && <MetaTag>Model: {summary.model}</MetaTag>}
          {summary.resultEnvelope && (
            <MetaTag>Envelope {summary.resultEnvelope}</MetaTag>
          )}
        </div>
      </div>

      {summary.documentTypeSlugs.length > 0 && (
        <div>
          <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Document types (routing)
          </Text>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {summary.documentTypeSlugs.map((slug) => (
              <MetaTag key={slug}>{slug}</MetaTag>
            ))}
          </div>
        </div>
      )}

      {summary.schemasUsed.length > 0 && (
        <div>
          <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Schemas used
          </Text>
          <Descriptions
            column={1}
            size="small"
            bordered
            className="mt-2 !text-xs"
          >
            {summary.schemasUsed.map((s) => (
              <Descriptions.Item key={s.slug} label={s.slug}>
                <span className="font-mono text-xs">v{s.version}</span>
                {s.schemaId && (
                  <Text
                    type="secondary"
                    className="block text-[10px] truncate max-w-[200px]"
                  >
                    {s.schemaId}
                  </Text>
                )}
              </Descriptions.Item>
            ))}
          </Descriptions>
        </div>
      )}

      {summary.classifier && (
        <div>
          <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Visual classifier
          </Text>
          <Descriptions column={1} size="small" bordered className="mt-2">
            {summary.classifier.model && (
              <Descriptions.Item label="Model">
                {summary.classifier.model}
              </Descriptions.Item>
            )}
            {summary.classifier.version != null && (
              <Descriptions.Item label="Version">
                {summary.classifier.version}
              </Descriptions.Item>
            )}
            {summary.classifier.fellBack && (
              <Descriptions.Item label="Fallback">
                <Text type="warning">
                  {summary.classifier.fellBackReason || "Used full document"}
                </Text>
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}

      {summary.perSection && (
        <div>
          <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Per-section extraction
          </Text>
          <Descriptions column={1} size="small" bordered className="mt-2">
            <Descriptions.Item label="Sections">
              {summary.perSection.successCount}/{summary.perSection.sectionCount}{" "}
              succeeded
              {summary.perSection.failedCount > 0 &&
                ` · ${summary.perSection.failedCount} failed`}
            </Descriptions.Item>
            {summary.perSection.totalAiTimeSeconds != null && (
              <Descriptions.Item label="AI time">
                {summary.perSection.totalAiTimeSeconds.toFixed(1)}s
              </Descriptions.Item>
            )}
          </Descriptions>
        </div>
      )}

      <div>
        <Text className="text-xs font-medium text-gray-500 uppercase tracking-wide">
          Status
        </Text>
        <Descriptions column={1} size="small" bordered className="mt-2">
          <Descriptions.Item label="Extraction">
            {file.extraction_status}
          </Descriptions.Item>
          <Descriptions.Item label="Processing">
            {file.processing_status}
          </Descriptions.Item>
          {file.extraction_time_seconds != null && (
            <Descriptions.Item label="Extract time">
              {Number(file.extraction_time_seconds).toFixed(1)}s
            </Descriptions.Item>
          )}
          {file.ai_processing_time_seconds != null && (
            <Descriptions.Item label="AI time">
              {Number(file.ai_processing_time_seconds).toFixed(1)}s
            </Descriptions.Item>
          )}
        </Descriptions>
      </div>
    </div>
  );
}
