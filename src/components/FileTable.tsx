"use client";

import React, { useState } from "react";
import {
  Table,
  Tooltip,
  Badge,
  Collapse,
  Typography,
  Dropdown,
  Popover,
  message,
} from "antd";
import {
  FilePdfOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  MoreOutlined,
  CopyOutlined,
  ArrowsAltOutlined,
  ShrinkOutlined,
} from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import styles from "./FileTable.module.css";

const { Text } = Typography;

interface FileTableProps {
  files: JobFile[];
  filePreviews: Record<string, any[]>;
  jobSchema: any;
  onShowResults: (fileId: string) => void;
  onAddToPreview: (fileId: string) => void;
  onEditResults: (file: JobFile) => void;
  showFileResults: Record<string, boolean>;
}

interface FileTableData extends JobFile {
  key: string;
  statusGroup: "completed" | "processing" | "pending" | "failed";
}

const FileTable: React.FC<FileTableProps> = ({
  files,
  filePreviews,
  jobSchema,
  onShowResults,
  onAddToPreview,
  onEditResults,
  showFileResults,
}) => {
  const [expandedRows, setExpandedRows] = useState<string[]>([]);

  // Group files by status
  const groupedFiles = files.reduce(
    (acc, file) => {
      let statusGroup: "completed" | "processing" | "pending" | "failed";

      if (
        file.extraction_status === "completed" &&
        file.processing_status === "completed"
      ) {
        statusGroup = "completed";
      } else if (
        file.extraction_status === "processing" ||
        file.processing_status === "processing"
      ) {
        statusGroup = "processing";
      } else if (
        file.extraction_status === "failed" ||
        file.processing_status === "failed"
      ) {
        statusGroup = "failed";
      } else {
        statusGroup = "pending";
      }

      acc[statusGroup].push({
        ...file,
        key: file.id,
        statusGroup,
      });

      return acc;
    },
    {
      completed: [] as FileTableData[],
      processing: [] as FileTableData[],
      pending: [] as FileTableData[],
      failed: [] as FileTableData[],
    }
  );

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return <CheckCircleOutlined style={{ color: "#52c41a" }} />;
      case "processing":
        return <ClockCircleOutlined style={{ color: "#faad14" }} />;
      case "failed":
        return <CloseCircleOutlined style={{ color: "#ff4d4f" }} />;
      case "pending":
        return <ClockCircleOutlined style={{ color: "#d9d9d9" }} />;
      default:
        return <ExclamationCircleOutlined style={{ color: "#d9d9d9" }} />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success("ID copied to clipboard");
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const columns = [
    {
      title: "File ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      render: (id: string) => (
        <div className="flex items-center space-x-1">
          <CopyOutlined
            style={{ color: "#1890ff", cursor: "pointer", fontSize: "12px" }}
            onClick={() => copyToClipboard(id)}
          />
          <Text code style={{ fontSize: "12px" }}>
            {id.slice(0, 8)}...
          </Text>
        </div>
      ),
    },
    {
      title: "Filename",
      dataIndex: "filename",
      key: "filename",
      width: 200,
      render: (filename: string) => (
        <div className="flex items-center space-x-2">
          <FilePdfOutlined style={{ color: "#ff4d4f" }} />
          <Tooltip title={filename}>
            <Text ellipsis style={{ maxWidth: 150 }}>
              {filename}
            </Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: 100,
      render: (size: number) => (
        <Text type="secondary" style={{ fontSize: "12px" }}>
          {formatFileSize(size)}
        </Text>
      ),
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (date: string) => (
        <Text type="secondary" style={{ fontSize: "12px" }}>
          {formatDate(date)}
        </Text>
      ),
    },
    {
      title: "Previews",
      key: "previews",
      width: 150,
      render: (_: any, record: FileTableData) => {
        const previews = filePreviews[record.id] || [];

        if (previews.length === 0) {
          return (
            <Text type="secondary" style={{ fontSize: "12px" }}>
              None
            </Text>
          );
        }

        const visiblePreviews = previews.slice(0, 2);
        const remainingCount = previews.length - 2;

        return (
          <div className="flex items-center space-x-1">
            {visiblePreviews.map((preview, index) => (
              <a
                key={preview.id}
                href={`/preview/${preview.id}`}
                target="_blank"
                style={{ color: "#1890ff", fontSize: "12px" }}
              >
                {preview.name}
                {index < visiblePreviews.length - 1 && ", "}
              </a>
            ))}
            {remainingCount > 0 && (
              <Popover
                content={
                  <div>
                    {previews.slice(2).map((preview) => (
                      <div key={preview.id}>
                        <a
                          href={`/preview/${preview.id}`}
                          target="_blank"
                          style={{ color: "#1890ff" }}
                        >
                          {preview.name}
                        </a>
                      </div>
                    ))}
                  </div>
                }
                title="More Previews"
                trigger="hover"
              >
                <a
                  style={{
                    color: "#1890ff",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  +{remainingCount}
                </a>
              </Popover>
            )}
          </div>
        );
      },
    },
    {
      title: "Status",
      key: "status",
      width: 80,
      render: (_: any, record: FileTableData) => (
        <Tooltip
          title={
            <div>
              <div>Extraction: {record.extraction_status}</div>
              <div>Processing: {record.processing_status}</div>
            </div>
          }
        >
          <div className="flex items-center space-x-1">
            {getStatusIcon(record.extraction_status)}
            {getStatusIcon(record.processing_status)}
          </div>
        </Tooltip>
      ),
    },
    {
      title: "Actions",
      key: "actions",
      width: 60,
      render: (_: any, record: FileTableData) => {
        if (record.processing_status !== "completed" || !record.result) {
          return null;
        }

        const menuItems = [
          {
            key: "show",
            label: (
              <a
                onClick={() => {
                  onShowResults(record.id);
                  // Also expand the row if it's not already expanded
                  if (!expandedRows.includes(record.key)) {
                    setExpandedRows([...expandedRows, record.key]);
                  }
                }}
              >
                {showFileResults[record.id] ? "Hide Results" : "Show Results"}
              </a>
            ),
          },
          {
            key: "preview",
            label: (
              <a onClick={() => onAddToPreview(record.id)}>Add to Preview</a>
            ),
          },
          {
            key: "edit",
            label: <a onClick={() => onEditResults(record)}>Edit Results</a>,
          },
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={["hover"]}
            placement="bottomRight"
          >
            <MoreOutlined style={{ cursor: "pointer", fontSize: "16px" }} />
          </Dropdown>
        );
      },
    },
  ];

  const expandedRowRender = (record: FileTableData) => {
    if (record.processing_status !== "completed" || !record.result) {
      return (
        <div style={{ padding: "16px", backgroundColor: "#fafafa" }}>
          <Text type="secondary">No results available for this file.</Text>
        </div>
      );
    }

    return (
      <div style={{ padding: "16px", backgroundColor: "#fafafa" }}>
        <TabbedDataViewer
          data={record.result}
          filename={record.filename}
          schema={jobSchema}
        />
      </div>
    );
  };

  const getStatusGroupTitle = (status: string, count: number) => {
    const icons = {
      completed: <CheckCircleOutlined style={{ color: "#52c41a" }} />,
      processing: <ClockCircleOutlined style={{ color: "#faad14" }} />,
      pending: <ClockCircleOutlined style={{ color: "#d9d9d9" }} />,
      failed: <CloseCircleOutlined style={{ color: "#ff4d4f" }} />,
    };

    return (
      <div className="flex items-center space-x-2">
        {icons[status as keyof typeof icons]}
        <span className="capitalize">{status} Files</span>
        <Badge count={count} style={{ backgroundColor: "#52c41a" }} />
      </div>
    );
  };

  const createTableComponent = (files: FileTableData[]) => (
    <Table
      columns={columns}
      dataSource={files}
      pagination={false}
      size="small"
      expandable={{
        expandedRowRender,
        expandedRowKeys: expandedRows,
        onExpandedRowsChange: (expandedKeys) =>
          setExpandedRows(expandedKeys as string[]),
        expandRowByClick: false,
        expandIcon: ({ expanded, onExpand, record }) => {
          if (record.processing_status !== "completed" || !record.result) {
            return null;
          }
          return expanded ? (
            <ShrinkOutlined
              style={{ cursor: "pointer", fontSize: "14px" }}
              onClick={(e) => onExpand(record, e)}
            />
          ) : (
            <ArrowsAltOutlined
              style={{ cursor: "pointer", fontSize: "14px" }}
              onClick={(e) => onExpand(record, e)}
            />
          );
        },
      }}
      scroll={{ x: 1000 }}
      className={styles.fileTable}
    />
  );

  return (
    <div className="space-y-4">
      {/* File Groups */}
      <Collapse
        defaultActiveKey={["completed", "processing", "pending", "failed"]}
        ghost
        items={[
          // Completed Files
          ...(groupedFiles.completed.length > 0
            ? [
                {
                  key: "completed",
                  label: getStatusGroupTitle(
                    "completed",
                    groupedFiles.completed.length
                  ),
                  children: createTableComponent(groupedFiles.completed),
                },
              ]
            : []),

          // Processing Files
          ...(groupedFiles.processing.length > 0
            ? [
                {
                  key: "processing",
                  label: getStatusGroupTitle(
                    "processing",
                    groupedFiles.processing.length
                  ),
                  children: createTableComponent(groupedFiles.processing),
                },
              ]
            : []),

          // Pending Files
          ...(groupedFiles.pending.length > 0
            ? [
                {
                  key: "pending",
                  label: getStatusGroupTitle(
                    "pending",
                    groupedFiles.pending.length
                  ),
                  children: createTableComponent(groupedFiles.pending),
                },
              ]
            : []),

          // Failed Files
          ...(groupedFiles.failed.length > 0
            ? [
                {
                  key: "failed",
                  label: getStatusGroupTitle(
                    "failed",
                    groupedFiles.failed.length
                  ),
                  children: createTableComponent(groupedFiles.failed),
                },
              ]
            : []),
        ]}
      />
    </div>
  );
};

export default FileTable;
