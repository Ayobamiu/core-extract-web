"use client";

import React from "react";
import {
  Drawer,
  Descriptions,
  Tag,
  Button,
  Collapse,
  Typography,
  Space,
} from "antd";
import {
  InfoCircleOutlined,
  CopyOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
} from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import moment from "moment";
import ConstraintList from "@/components/ui/ConstraintList";
import { Loader } from "lucide-react";

const { Text } = Typography;

interface FileDetailsDrawerProps {
  file: JobFile | null;
  open: boolean;
  onClose: () => void;
}

const computePageCount = (file?: JobFile | null): number | null => {
  if (!file) return null;
  if (typeof file.page_count === "number" && Number.isFinite(file.page_count)) {
    return file.page_count;
  }
  if (typeof file.pages === "number" && Number.isFinite(file.pages)) {
    return file.pages;
  }
  if (Array.isArray(file.pages)) {
    return file.pages.length;
  }
  return null;
};

const getStatusIcon = (status: string) => {
  switch (status.toLowerCase()) {
    case "completed":
      return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
    case "processing":
      return (
        <Loader
          aria-label="Processing"
          className="w-4 h-4 animate-spin text-yellow-500"
        />
      );
    case "failed":
      return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
    case "pending":
      return <ClockCircleOutlined style={{ color: "#d9d9d9" }} />;
    default:
      return <ExclamationCircleOutlined style={{ color: "#d9d9d9" }} />;
  }
};

const getUploadStatusIcon = (uploadStatus?: string) => {
  switch (uploadStatus?.toLowerCase()) {
    case "success":
      return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
    case "failed":
      return <ExclamationCircleOutlined style={{ color: "#ff4d4f" }} />;
    case "retrying":
      return <ClockCircleOutlined style={{ color: "#faad14" }} />;
    case "pending":
      return <ClockCircleOutlined style={{ color: "#d9d9d9" }} />;
    default:
      return null;
  }
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
};

const formatDuration = (seconds: number): string => {
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  } else if (seconds < 3600) {
    const minutes = Math.floor(seconds / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${minutes}m ${secs}s`;
  } else {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = (seconds % 60).toFixed(0);
    return `${hours}h ${minutes}m ${secs}s`;
  }
};

const copyToClipboard = (text: string) => {
  navigator.clipboard.writeText(text).then(() => {
    // message.success("ID copied to clipboard");
  });
};

const FileDetailsDrawer: React.FC<FileDetailsDrawerProps> = ({
  file,
  open,
  onClose,
}) => {
  const selectedFilePageCount = computePageCount(file);

  return (
    <Drawer
      title={
        file ? (
          <div className="flex items-center space-x-2">
            <InfoCircleOutlined className="text-blue-500" />
            <span className="font-medium">File Details: {file.filename}</span>
          </div>
        ) : (
          "File Details"
        )
      }
      placement="right"
      size="large"
      onClose={onClose}
      open={open}
      width={600}
    >
      {file && (
        <div className="space-y-6">
          {/* File Overview */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Overview</h3>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Filename">
                {file.filename}
              </Descriptions.Item>
              <Descriptions.Item label="File ID">
                <div className="flex items-center space-x-2">
                  <span className="font-mono text-xs">{file.id}</span>
                  <Button
                    type="text"
                    size="small"
                    icon={<CopyOutlined />}
                    onClick={() => copyToClipboard(file.id)}
                  />
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="File Size">
                {formatFileSize(file.size)}
              </Descriptions.Item>
              <Descriptions.Item label="File Hash">
                {file.file_hash ? (
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs">{file.file_hash}</span>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(file.file_hash || "")}
                    />
                  </div>
                ) : (
                  <Text type="secondary">-</Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Storage Type">
                <Tag>{file.storage_type || "s3"}</Tag>
              </Descriptions.Item>
              {file.s3_key && (
                <Descriptions.Item label="S3 Key">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs break-all">
                      {file.s3_key}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(file.s3_key || "")}
                    />
                  </div>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>

          {/* Page Selection Information */}
          {file.selected_pages &&
            Array.isArray(file.selected_pages) &&
            file.selected_pages.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold mb-3">Page Selection</h3>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Total Pages">
                    {selectedFilePageCount !== null
                      ? selectedFilePageCount
                      : "-"}
                  </Descriptions.Item>
                  <Descriptions.Item label="Selected Pages">
                    <div className="flex flex-wrap gap-1">
                      <Tag color="blue">
                        {file.selected_pages.length} of{" "}
                        {selectedFilePageCount || "?"} pages
                      </Tag>
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Selected Page Numbers">
                    <div className="flex flex-wrap gap-1">
                      {file.selected_pages
                        .sort((a, b) => a - b)
                        .map((pageNum) => (
                          <Tag key={pageNum} color="blue">
                            {pageNum}
                          </Tag>
                        ))}
                    </div>
                  </Descriptions.Item>
                  <Descriptions.Item label="Selection Status">
                    <Tag color="green">
                      <CheckCircleOutlined className="mr-1" />
                      Only selected pages were processed
                    </Tag>
                  </Descriptions.Item>
                </Descriptions>
              </div>
            )}

          {/* Status Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Status</h3>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Upload Status">
                {getUploadStatusIcon(file.upload_status)}
                <span className="ml-2">
                  {file.upload_status ? (
                    <Tag
                      color={
                        file.upload_status === "success"
                          ? "green"
                          : file.upload_status === "failed"
                          ? "red"
                          : "orange"
                      }
                    >
                      {file.upload_status}
                    </Tag>
                  ) : (
                    <Tag>pending</Tag>
                  )}
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Extraction Status">
                {getStatusIcon(file.extraction_status)}
                <span className="ml-2">
                  <Tag
                    color={
                      file.extraction_status === "completed"
                        ? "green"
                        : file.extraction_status === "failed"
                        ? "red"
                        : file.extraction_status === "processing"
                        ? "blue"
                        : "default"
                    }
                  >
                    {file.extraction_status}
                  </Tag>
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Processing Status">
                {getStatusIcon(file.processing_status)}
                <span className="ml-2">
                  <Tag
                    color={
                      file.processing_status === "completed"
                        ? "green"
                        : file.processing_status === "failed"
                        ? "red"
                        : file.processing_status === "processing"
                        ? "blue"
                        : "default"
                    }
                  >
                    {file.processing_status}
                  </Tag>
                </span>
              </Descriptions.Item>
              <Descriptions.Item label="Verification">
                <Space>
                  {file.admin_verified && (
                    <Tag color="green">Admin Verified</Tag>
                  )}
                  {file.customer_verified && (
                    <Tag color="blue">Customer Verified</Tag>
                  )}
                  {!file.admin_verified && !file.customer_verified && (
                    <Text type="secondary">Not verified</Text>
                  )}
                </Space>
              </Descriptions.Item>
              {file.retry_count !== undefined && file.retry_count > 0 && (
                <Descriptions.Item label="Retry Count">
                  <Tag color="orange">{file.retry_count}</Tag>
                </Descriptions.Item>
              )}
            </Descriptions>
          </div>

          {/* Processing Configuration */}
          {(() => {
            const extractionMethod = (file.extraction_metadata as any)
              ?.extraction_method;
            const processingMethod = (file.processing_metadata as any)
              ?.processing_method;
            const model = (file.processing_metadata as any)?.model;

            if (!extractionMethod && !processingMethod && !model) {
              return null;
            }

            return (
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  Processing Configuration
                </h3>
                <Descriptions column={1} bordered size="small">
                  {extractionMethod && (
                    <Descriptions.Item label="Extraction Method">
                      <Tag color="blue">{extractionMethod}</Tag>
                    </Descriptions.Item>
                  )}
                  {processingMethod && (
                    <Descriptions.Item label="Processing Method">
                      <Tag color="purple">{processingMethod}</Tag>
                    </Descriptions.Item>
                  )}
                  {model && (
                    <Descriptions.Item label="AI Model">
                      <Tag color="green">{model}</Tag>
                    </Descriptions.Item>
                  )}
                </Descriptions>
              </div>
            );
          })()}

          {/* Timing Information */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Timing</h3>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Created At">
                {moment(file.created_at).format("MMMM DD, YYYY hh:mm:ss A")}
                <div className="text-xs text-gray-500 mt-1">
                  ({moment(file.created_at).fromNow()})
                </div>
              </Descriptions.Item>
              {file.processed_at && (
                <Descriptions.Item label="Processed At">
                  {moment(file.processed_at).format("MMMM DD, YYYY hh:mm:ss A")}
                  <div className="text-xs text-gray-500 mt-1">
                    ({moment(file.processed_at).fromNow()})
                  </div>
                </Descriptions.Item>
              )}
              {file.processed_at && (
                <Descriptions.Item label="Total Time Elapsed">
                  <Tag color="geekblue">
                    {moment
                      .duration(
                        moment(file.processed_at).diff(moment(file.created_at))
                      )
                      .humanize()}
                  </Tag>
                  <span className="ml-2 text-gray-500 text-xs">
                    (
                    {formatDuration(
                      moment(file.processed_at).diff(
                        moment(file.created_at),
                        "seconds"
                      )
                    )}
                    )
                  </span>
                </Descriptions.Item>
              )}
              {file.extraction_time_seconds !== undefined &&
                file.extraction_time_seconds !== null && (
                  <Descriptions.Item label="Extraction Duration">
                    <Tag color="blue">
                      {formatDuration(Number(file.extraction_time_seconds))}
                    </Tag>
                    <span className="ml-2 text-gray-500 text-xs">
                      ({Number(file.extraction_time_seconds).toFixed(2)}s)
                    </span>
                  </Descriptions.Item>
                )}
              {file.ai_processing_time_seconds !== undefined &&
                file.ai_processing_time_seconds !== null && (
                  <Descriptions.Item label="Processing Duration">
                    <Tag color="purple">
                      {formatDuration(Number(file.ai_processing_time_seconds))}
                    </Tag>
                    <span className="ml-2 text-gray-500 text-xs">
                      ({Number(file.ai_processing_time_seconds).toFixed(2)}s)
                    </span>
                  </Descriptions.Item>
                )}
              {file.extraction_time_seconds !== undefined &&
                file.extraction_time_seconds !== null &&
                file.ai_processing_time_seconds !== undefined &&
                file.ai_processing_time_seconds !== null && (
                  <Descriptions.Item label="Combined Processing Time">
                    <Tag color="green">
                      {formatDuration(
                        Number(file.extraction_time_seconds) +
                          Number(file.ai_processing_time_seconds)
                      )}
                    </Tag>
                    <span className="ml-2 text-gray-500 text-xs">
                      (
                      {(
                        Number(file.extraction_time_seconds) +
                        Number(file.ai_processing_time_seconds)
                      ).toFixed(2)}
                      s)
                    </span>
                  </Descriptions.Item>
                )}
            </Descriptions>
          </div>

          {/* Errors */}
          {(file.upload_error ||
            file.extraction_error ||
            file.processing_error) && (
            <div>
              <h3 className="text-lg font-semibold mb-3 text-red-600">
                Errors
              </h3>
              <Collapse>
                {file.upload_error && (
                  <Collapse.Panel header="Upload Error" key="upload">
                    <Text
                      type="danger"
                      className="font-mono text-xs whitespace-pre-wrap"
                    >
                      {file.upload_error}
                    </Text>
                  </Collapse.Panel>
                )}
                {file.extraction_error && (
                  <Collapse.Panel header="Extraction Error" key="extraction">
                    <Text
                      type="danger"
                      className="font-mono text-xs whitespace-pre-wrap"
                    >
                      {file.extraction_error}
                    </Text>
                  </Collapse.Panel>
                )}
                {file.processing_error && (
                  <Collapse.Panel header="Processing Error" key="processing">
                    <Text
                      type="danger"
                      className="font-mono text-xs whitespace-pre-wrap"
                    >
                      {file.processing_error}
                    </Text>
                  </Collapse.Panel>
                )}
              </Collapse>
            </div>
          )}

          {/* Content Metadata */}
          <div>
            <h3 className="text-lg font-semibold mb-3">Content Metadata</h3>
            <Descriptions column={1} bordered size="small">
              {selectedFilePageCount !== null && (
                <Descriptions.Item label="Pages">
                  {selectedFilePageCount}
                </Descriptions.Item>
              )}
              {file.extracted_text &&
                typeof file.extracted_text === "string" && (
                  <Descriptions.Item label="Extracted Text Length">
                    {file.extracted_text.length.toLocaleString()} characters
                  </Descriptions.Item>
                )}
              {file.extracted_tables &&
                Array.isArray(file.extracted_tables) && (
                  <Descriptions.Item label="Extracted Tables">
                    {file.extracted_tables.length}
                  </Descriptions.Item>
                )}
              <Descriptions.Item label="Has Result">
                <Tag color={file.result ? "green" : "default"}>
                  {file.result ? "Yes" : "No"}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Has Actual Result">
                <Tag color={file.actual_result ? "green" : "default"}>
                  {file.actual_result ? "Yes" : "No"}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          </div>

          {/* Data Extraction Page Detection (Comprehensive) */}
          {(() => {
            const metadata = file.processing_metadata as any;
            // Use comprehensive detection (pre-processing) if available, fallback to old formation detection for backward compatibility
            const dataExtractionDetection =
              metadata?.data_extraction_page_detection_pre ||
              metadata?.formation_page_detection;

            if (!dataExtractionDetection) {
              return null;
            }

            const scoring = dataExtractionDetection.scoring;
            const confidentHits =
              scoring?.confidentHits ||
              dataExtractionDetection.confidentHits ||
              [];
            const borderlines = scoring?.borderlines || [];
            const confidentMisses = scoring?.confidentMisses || [];
            const summary = scoring?.summary || {};
            const detectionBreakdown =
              dataExtractionDetection.detectionBreakdown || {};
            const isComprehensive =
              !!metadata?.data_extraction_page_detection_pre;

            return (
              <div>
                <h3 className="text-lg font-semibold mb-3">
                  {isComprehensive
                    ? "Data Extraction Page Detection"
                    : "Formation Page Detection"}
                </h3>
                <Descriptions column={1} bordered size="small">
                  <Descriptions.Item label="Status">
                    <Tag
                      color={
                        dataExtractionDetection.success !== false
                          ? "green"
                          : "orange"
                      }
                    >
                      {dataExtractionDetection.success !== false
                        ? "Completed"
                        : "Not Available"}
                    </Tag>
                  </Descriptions.Item>
                  {isComprehensive &&
                    detectionBreakdown.total !== undefined && (
                      <Descriptions.Item label="Detection Breakdown">
                        <div className="flex flex-wrap gap-2">
                          {detectionBreakdown.formation > 0 && (
                            <Tag color="blue">
                              Formation: {detectionBreakdown.formation}
                            </Tag>
                          )}
                          {detectionBreakdown.log > 0 && (
                            <Tag color="cyan">
                              LOG: {detectionBreakdown.log}
                            </Tag>
                          )}
                          {detectionBreakdown.plugging > 0 && (
                            <Tag color="purple">
                              Plugging: {detectionBreakdown.plugging}
                            </Tag>
                          )}
                        </div>
                      </Descriptions.Item>
                    )}
                  {summary.total !== undefined && (
                    <Descriptions.Item label="Total Pages">
                      {summary.total}
                    </Descriptions.Item>
                  )}
                  {confidentHits.length > 0 && (
                    <Descriptions.Item label="Confident Hits">
                      <div className="flex flex-wrap gap-1">
                        <Tag color="green">
                          {confidentHits.length} page
                          {confidentHits.length !== 1 ? "s" : ""}
                        </Tag>
                        <span className="text-gray-600">
                          ({confidentHits.join(", ")})
                        </span>
                      </div>
                    </Descriptions.Item>
                  )}
                  {borderlines.length > 0 && (
                    <Descriptions.Item label="Borderline Pages">
                      <div className="flex flex-wrap gap-1">
                        <Tag color="orange">
                          {borderlines.length} page
                          {borderlines.length !== 1 ? "s" : ""}
                        </Tag>
                        <span className="text-gray-600">
                          ({borderlines.join(", ")})
                        </span>
                      </div>
                    </Descriptions.Item>
                  )}
                  {confidentMisses.length > 0 && (
                    <Descriptions.Item label="Confident Misses">
                      <div className="flex flex-wrap gap-1">
                        <Tag color="default">
                          {confidentMisses.length} page
                          {confidentMisses.length !== 1 ? "s" : ""}
                        </Tag>
                      </div>
                    </Descriptions.Item>
                  )}
                  {dataExtractionDetection.extracted_pdf && (
                    <Descriptions.Item label="Extracted PDF">
                      <div className="flex items-center space-x-2">
                        <Tag color="blue">
                          {dataExtractionDetection.extracted_pdf.filename}
                        </Tag>
                        <span className="text-xs text-gray-500">
                          ({dataExtractionDetection.extracted_pdf.page_count}{" "}
                          pages,{" "}
                          {formatFileSize(
                            dataExtractionDetection.extracted_pdf.size
                          )}
                          )
                        </span>
                      </div>
                    </Descriptions.Item>
                  )}
                  {dataExtractionDetection.error && (
                    <Descriptions.Item label="Error">
                      <Text type="danger" className="text-xs">
                        {dataExtractionDetection.error}
                      </Text>
                    </Descriptions.Item>
                  )}
                </Descriptions>

                {/* Detailed Scoring (Collapsible) */}
                {scoring?.scoredPages && scoring.scoredPages.length > 0 && (
                  <div className="mt-4">
                    <Collapse
                      items={[
                        {
                          key: "scoring",
                          label: `View Detailed Page Scores (${scoring.scoredPages.length} pages)`,
                          children: (
                            <div className="max-h-96 overflow-y-auto">
                              <table className="w-full text-sm">
                                <thead className="bg-gray-50 sticky top-0">
                                  <tr>
                                    <th className="px-2 py-1 text-left border">
                                      Page
                                    </th>
                                    <th className="px-2 py-1 text-left border">
                                      {isComprehensive
                                        ? "Total Score"
                                        : "Score"}
                                    </th>
                                    {isComprehensive && (
                                      <>
                                        <th className="px-2 py-1 text-left border">
                                          Formation
                                        </th>
                                        <th className="px-2 py-1 text-left border">
                                          LOG
                                        </th>
                                        <th className="px-2 py-1 text-left border">
                                          Plugging
                                        </th>
                                        <th className="px-2 py-1 text-left border">
                                          Types
                                        </th>
                                      </>
                                    )}
                                    <th className="px-2 py-1 text-left border">
                                      Classification
                                    </th>
                                    <th className="px-2 py-1 text-left border">
                                      Text Length
                                    </th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {scoring.scoredPages.map((page: any) => (
                                    <tr key={page.page_number}>
                                      <td className="px-2 py-1 border">
                                        {page.page_number}
                                      </td>
                                      <td className="px-2 py-1 border">
                                        <Tag
                                          color={
                                            page.classification ===
                                            "CONFIDENT_HIT"
                                              ? "green"
                                              : page.classification ===
                                                "BORDERLINE"
                                              ? "orange"
                                              : "default"
                                          }
                                        >
                                          {page.totalScore !== undefined
                                            ? page.totalScore
                                            : page.score}
                                        </Tag>
                                      </td>
                                      {isComprehensive && (
                                        <>
                                          <td className="px-2 py-1 border text-gray-600">
                                            {page.formationScore !==
                                            undefined ? (
                                              <span className="text-xs">
                                                {page.formationScore}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">
                                                -
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1 border text-gray-600">
                                            {page.logPageScore !== undefined ? (
                                              <span className="text-xs">
                                                {page.logPageScore}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">
                                                -
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1 border text-gray-600">
                                            {page.pluggingRecordScore !==
                                            undefined ? (
                                              <span className="text-xs">
                                                {page.pluggingRecordScore}
                                              </span>
                                            ) : (
                                              <span className="text-gray-400">
                                                -
                                              </span>
                                            )}
                                          </td>
                                          <td className="px-2 py-1 border">
                                            {page.detectedTypes &&
                                            page.detectedTypes.length > 0 ? (
                                              <div className="flex flex-wrap gap-1">
                                                {page.detectedTypes.map(
                                                  (type: string) => (
                                                    <Tag
                                                      key={type}
                                                      color={
                                                        type === "FORMATION"
                                                          ? "blue"
                                                          : type ===
                                                            "LOG_OF_OIL_GAS"
                                                          ? "cyan"
                                                          : "purple"
                                                      }
                                                      className="text-xs"
                                                    >
                                                      {type.replace(/_/g, " ")}
                                                    </Tag>
                                                  )
                                                )}
                                              </div>
                                            ) : (
                                              <span className="text-gray-400 text-xs">
                                                -
                                              </span>
                                            )}
                                          </td>
                                        </>
                                      )}
                                      <td className="px-2 py-1 border">
                                        <Tag
                                          color={
                                            page.classification ===
                                            "CONFIDENT_HIT"
                                              ? "green"
                                              : page.classification ===
                                                "BORDERLINE"
                                              ? "orange"
                                              : "default"
                                          }
                                        >
                                          {page.classification
                                            .replace(/_/g, " ")
                                            .toLowerCase()}
                                        </Tag>
                                      </td>
                                      <td className="px-2 py-1 border text-gray-600">
                                        {page.text_length?.toLocaleString() ||
                                          0}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ),
                        },
                      ]}
                    />
                  </div>
                )}
              </div>
            );
          })()}

          {/* Constraints */}
          <ConstraintList file={file} />
        </div>
      )}
    </Drawer>
  );
};

export default FileDetailsDrawer;
