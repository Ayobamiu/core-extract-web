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
  Modal,
  Upload,
  Button,
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
import { apiClient } from "@/lib/api";
import {
  checkPermitNumberMatch,
  getViolationSeverityColor,
  getViolationSeverityIcon,
} from "@/lib/constraintUtils";
import styles from "./FileTable.module.css";

const { Text } = Typography;

interface FileTableProps {
  files: JobFile[];
  filePreviews: Record<string, any[]>;
  jobSchema: any;
  onShowResults: (fileId: string) => void;
  onAddToPreview: (fileId: string) => void;
  onEditResults: (file: JobFile) => void;
  onBulkAddToPreview: (fileIds: string[]) => void;
  onDataUpdate?: () => void;
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
  onBulkAddToPreview,
  onDataUpdate,
  showFileResults,
}) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [expandedRows, setExpandedRows] = useState<string[]>([]);
  const [retryModalVisible, setRetryModalVisible] = useState(false);
  const [retryFileId, setRetryFileId] = useState<string | null>(null);
  const [retryFile, setRetryFile] = useState<File | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteFileId, setDeleteFileId] = useState<string | null>(null);
  const [deleteFileName, setDeleteFileName] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [bulkDeleteModalVisible, setBulkDeleteModalVisible] = useState(false);
  const [bulkDeleteLoading, setBulkDeleteLoading] = useState(false);

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
  console.log({ groupedFiles });
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: FileTableData) => ({
      // Only allow selection of completed files
      disabled: record.processing_status !== "completed",
    }),
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success("ID copied to clipboard");
    });
  };

  const handleRetryUpload = async () => {
    if (!retryFileId) return;

    try {
      setRetryLoading(true);
      const response = await apiClient.retryFileUpload(
        retryFileId,
        retryFile || undefined
      );

      if (response.status === "success") {
        message.success(
          response.message || "File upload retry initiated successfully"
        );
        setRetryModalVisible(false);
        setRetryFileId(null);
        setRetryFile(null);

        // Refresh data
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        message.error(response.message || "Failed to retry upload");
      }
    } catch (error) {
      console.error("Error retrying upload:", error);
      message.error("Failed to retry upload");
    } finally {
      setRetryLoading(false);
    }
  };

  const openRetryModal = (fileId: string) => {
    setRetryFileId(fileId);
    setRetryModalVisible(true);
    setRetryFile(null);
  };

  const handleDeleteFile = (fileId: string, filename: string) => {
    setDeleteFileId(fileId);
    setDeleteFileName(filename);
    setDeleteModalVisible(true);
  };

  const confirmDeleteFile = async () => {
    if (!deleteFileId) return;

    try {
      setDeleteLoading(true);
      const response = await apiClient.deleteFile(deleteFileId);

      if (response.status === "success") {
        message.success(`File "${deleteFileName}" deleted successfully`);
        setDeleteModalVisible(false);
        setDeleteFileId(null);
        setDeleteFileName(null);

        // Refresh data
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        message.error(response.message || "Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      message.error("Failed to delete file");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Please select files to delete");
      return;
    }
    setBulkDeleteModalVisible(true);
  };

  const confirmBulkDelete = async () => {
    try {
      setBulkDeleteLoading(true);
      const fileIds = selectedRowKeys.map((key) => key.toString());
      const response = await apiClient.deleteFiles(fileIds);

      if (response.status === "success") {
        const deletedCount = response.data?.deletedFiles?.length || 0;
        message.success(`${deletedCount} files deleted successfully`);

        if (response.data?.errors && response.data.errors.length > 0) {
          message.warning(
            `${response.data.errors.length} files could not be deleted`
          );
        }

        // Clear selection and refresh data
        setSelectedRowKeys([]);
        setBulkDeleteModalVisible(false);
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        message.error(response.message || "Failed to delete files");
      }
    } catch (error) {
      console.error("Error deleting files:", error);
      message.error("Failed to delete files");
    } finally {
      setBulkDeleteLoading(false);
    }
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
      width: 100,
      render: (_: any, record: FileTableData) => (
        <Tooltip
          title={
            <div>
              <div>Upload: {record.upload_status || "unknown"}</div>
              <div>Extraction: {record.extraction_status}</div>
              <div>Processing: {record.processing_status}</div>
              {record.upload_error && (
                <div style={{ color: "#ff4d4f" }}>
                  Error: {record.upload_error}
                </div>
              )}
            </div>
          }
        >
          <div className="flex items-center space-x-1">
            {getUploadStatusIcon(record.upload_status)}
            {getStatusIcon(record.extraction_status)}
            {getStatusIcon(record.processing_status)}
          </div>
        </Tooltip>
      ),
    },
    {
      title: "Constraints",
      key: "constraints",
      width: 120,
      render: (_: any, record: FileTableData) => {
        // Only check for permit number mismatch using client-side logic
        const permitCheck = checkPermitNumberMatch(record);

        // Show violation flag if there's a permit number mismatch
        if (permitCheck.hasViolation) {
          return (
            <Tooltip
              title={
                <div>
                  <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                    Permit Number Mismatch:
                  </div>
                  <div>Filename: {permitCheck.filenamePermit || "N/A"}</div>
                  <div>Data: {permitCheck.dataPermit || "N/A"}</div>
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "12px",
                      color: "#666",
                    }}
                  >
                    {permitCheck.message}
                  </div>
                </div>
              }
            >
              <div className="flex items-center space-x-1">
                <span style={{ fontSize: "16px" }}>
                  {getViolationSeverityIcon("warning")}
                </span>
                <Badge
                  count={1}
                  style={{
                    backgroundColor: getViolationSeverityColor("warning"),
                    fontSize: "10px",
                    minWidth: "16px",
                    height: "16px",
                    lineHeight: "16px",
                  }}
                />
              </div>
            </Tooltip>
          );
        }

        // Show checkmark for files with no permit number violations
        if (record.processing_status === "completed" && record.result) {
          return (
            <Tooltip title="Permit numbers match">
              <div className="flex items-center justify-center">
                <CheckCircleOutlined
                  style={{ color: "#52c41a", fontSize: "16px" }}
                />
              </div>
            </Tooltip>
          );
        }

        return null;
      },
    },
    {
      title: "Actions",
      key: "actions",
      width: 60,
      render: (_: any, record: FileTableData) => {
        const menuItems = [];

        // Show retry upload option for failed uploads
        if (record.upload_status === "failed") {
          menuItems.push({
            key: "retry",
            label: (
              <a onClick={() => openRetryModal(record.id)}>🔄 Retry Upload</a>
            ),
          });
        }

        // Show other actions only for completed files
        if (record.processing_status === "completed" && record.result) {
          menuItems.push(
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
            }
          );
        }

        // Add delete option for all files (except those currently processing)
        if (
          record.processing_status !== "processing" &&
          record.extraction_status !== "processing"
        ) {
          menuItems.push({
            key: "delete",
            label: (
              <a
                onClick={() => handleDeleteFile(record.id, record.filename)}
                style={{ color: "#ff4d4f" }}
              >
                🗑️ Delete File
              </a>
            ),
          });
        }

        // Don't show dropdown if no actions available
        if (menuItems.length === 0) {
          return null;
        }

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
          editable={true}
          onUpdate={async (updatedData) => {
            try {
              // Import apiClient dynamically to avoid circular imports
              const { apiClient } = await import("@/lib/api");
              await apiClient.updateFileResults(record.id, updatedData);

              // Show success message
              message.success("File results updated successfully");

              // Refresh the data in the parent component
              if (onDataUpdate) {
                await onDataUpdate();
              }
            } catch (error) {
              console.error("Error updating file results:", error);
              message.error(
                `Failed to update file results: ${
                  (error as Error).message || "Unknown error"
                }`
              );
            }
          }}
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
        <Badge
          overflowCount={999}
          count={count}
          style={{ backgroundColor: "#52c41a" }}
        />
      </div>
    );
  };

  const createTableComponent = (files: FileTableData[]) => (
    <Table
      columns={columns}
      dataSource={files}
      rowSelection={rowSelection}
      pagination={{
        defaultPageSize: 10,
        showSizeChanger: true,
        showQuickJumper: false,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} files`,
        size: "small",
      }}
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
      {/* Bulk Actions */}
      {selectedRowKeys.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Text strong className="text-blue-900">
                {selectedRowKeys.length} file(s) selected
              </Text>
              <Text type="secondary" className="text-sm">
                Only completed files can be selected
              </Text>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => {
                  onBulkAddToPreview(selectedRowKeys as string[]);
                  setSelectedRowKeys([]); // Clear selection after clicking
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors text-sm font-medium"
              >
                Add to Preview
              </button>
              <button
                onClick={handleBulkDelete}
                className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors text-sm font-medium"
              >
                🗑️ Delete Selected
              </button>
              <button
                onClick={() => setSelectedRowKeys([])}
                className="px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors text-sm font-medium"
              >
                Clear Selection
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Retry Upload Modal */}
      <Modal
        title="Retry File Upload"
        open={retryModalVisible}
        onCancel={() => {
          setRetryModalVisible(false);
          setRetryFileId(null);
          setRetryFile(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setRetryModalVisible(false);
              setRetryFileId(null);
              setRetryFile(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="retry"
            type="primary"
            loading={retryLoading}
            onClick={handleRetryUpload}
          >
            {retryFile ? "Upload New File" : "Retry Upload"}
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <p>This file failed to upload to S3. You can either:</p>
          <ul className="list-disc list-inside space-y-2 text-sm text-gray-600">
            <li>
              <strong>Retry with original file:</strong> Attempt to upload the
              original file again
            </li>
            <li>
              <strong>Upload a new file:</strong> Replace with a different file
            </li>
          </ul>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Optional: Upload a new file to replace the original
            </label>
            <Upload
              beforeUpload={(file) => {
                setRetryFile(file);
                return false; // Prevent auto upload
              }}
              onRemove={() => setRetryFile(null)}
              maxCount={1}
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
            >
              <Button>Select File</Button>
            </Upload>
            {retryFile && (
              <p className="text-sm text-green-600 mt-2">
                Selected: {retryFile.name} (
                {(retryFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </div>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Delete File"
        open={deleteModalVisible}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteFileId(null);
          setDeleteFileName(null);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setDeleteModalVisible(false);
              setDeleteFileId(null);
              setDeleteFileName(null);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={deleteLoading}
            onClick={confirmDeleteFile}
          >
            Delete File
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="text-red-500 text-2xl">⚠️</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Are you sure you want to delete this file?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                <strong>File:</strong> {deleteFileName}
              </p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. The file
              and all its extracted data will be permanently deleted.
            </p>
          </div>
        </div>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        title="Delete Multiple Files"
        open={bulkDeleteModalVisible}
        onCancel={() => setBulkDeleteModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setBulkDeleteModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="delete"
            type="primary"
            danger
            loading={bulkDeleteLoading}
            onClick={confirmBulkDelete}
          >
            Delete {selectedRowKeys.length} Files
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="text-red-500 text-2xl">⚠️</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Are you sure you want to delete {selectedRowKeys.length} files?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                This action will permanently delete all selected files and their
                extracted data.
              </p>
            </div>
          </div>

          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <p className="text-sm text-red-800">
              <strong>Warning:</strong> This action cannot be undone. All
              selected files and their extracted data will be permanently
              deleted.
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default FileTable;
