"use client";

import React, { useState, useEffect } from "react";
import type { GetProp, TableProps } from "antd";
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
  Drawer,
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
import { Loader } from "lucide-react";

const { Text } = Typography;

type TablePaginationConfig = Exclude<
  GetProp<TableProps, "pagination">,
  boolean
>;

interface FileTableProps {
  jobId: string;
  jobSchema: any;
  onShowResults: (fileId: string) => void;
  onAddToPreview: (fileId: string) => void;
  onEditResults: (file: JobFile) => void;
  onBulkAddToPreview: (fileIds: string[]) => void;
  onDataUpdate?: () => void;
  showFileResults: Record<string, boolean>;
  refreshTrigger?: number;
}

interface TableParams {
  pagination?: TablePaginationConfig;
  sortField?: string;
  sortOrder?: "ascend" | "descend";
  filters?: Record<string, any>;
}

const DEFAULT_PAGE_SIZE = 10;

const FileTable: React.FC<FileTableProps> = ({
  jobId,
  jobSchema,
  onShowResults,
  onAddToPreview,
  onEditResults,
  onBulkAddToPreview,
  onDataUpdate,
  showFileResults,
  refreshTrigger,
}) => {
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [selectedFile, setSelectedFile] = useState<JobFile | null>(null);
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
  const [reprocessModalVisible, setReprocessModalVisible] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [showProcessingConfigInReprocess, setShowProcessingConfigInReprocess] =
    useState(false);

  // AJAX loading state
  const [data, setData] = useState<JobFile[]>([]);
  console.log({ data });
  const [loading, setLoading] = useState(false);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    },
  });

  // AJAX fetch function
  const fetchData = async () => {
    setLoading(true);
    try {
      const { pagination } = tableParams;
      const offset =
        ((pagination?.current || 1) - 1) *
        (pagination?.pageSize || DEFAULT_PAGE_SIZE);

      const response = await apiClient.getAllFiles(
        pagination?.pageSize || DEFAULT_PAGE_SIZE,
        offset,
        undefined, // status filter
        jobId // jobId filter
      );

      setData(response.files || []);
      setTableParams((prev) => ({
        ...prev,
        pagination: {
          ...prev.pagination,
          total: response.total || 0,
        },
      }));
    } catch (error: any) {
      console.error("Failed to fetch files:", error.message);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  // Handle table change
  const handleTableChange: TableProps<JobFile>["onChange"] = (
    pagination,
    filters,
    sorter
  ) => {
    setTableParams({
      pagination,
      filters,
      sortOrder: Array.isArray(sorter)
        ? undefined
        : sorter?.order === "ascend" || sorter?.order === "descend"
        ? sorter.order
        : undefined,
      sortField: Array.isArray(sorter)
        ? undefined
        : typeof sorter?.field === "string"
        ? sorter.field
        : undefined,
    });

    // Clear data when page size changes
    if (pagination.pageSize !== tableParams.pagination?.pageSize) {
      setData([]);
    }
  };

  // Handle drawer functions
  const handleOpenDrawer = (record: JobFile) => {
    setSelectedFile(record);
    setDrawerVisible(true);
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedFile(null);
  };

  // Fetch data when dependencies change
  useEffect(() => {
    fetchData();
  }, [
    jobId,
    tableParams.pagination?.current,
    tableParams.pagination?.pageSize,
    tableParams?.sortOrder,
    tableParams?.sortField,
    JSON.stringify(tableParams.filters),
    refreshTrigger,
  ]);

  // Refresh data when onDataUpdate changes
  useEffect(() => {
    if (onDataUpdate) {
      fetchData();
    }
  }, [onDataUpdate]);
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

  const rowSelection = {
    selectedRowKeys,
    onChange: (newSelectedRowKeys: React.Key[]) => {
      setSelectedRowKeys(newSelectedRowKeys);
    },
    getCheckboxProps: (record: JobFile) => ({
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

  const handleBulkReprocess = () => {
    if (selectedRowKeys.length === 0) {
      message.warning("Please select files to reprocess");
      return;
    }
    setReprocessModalVisible(true);
  };

  const confirmBulkReprocess = async () => {
    try {
      setReprocessLoading(true);
      const fileIds = selectedRowKeys.map((key) => key.toString());
      const response = await apiClient.reprocessFiles(fileIds);

      if (response.status === "success") {
        const queuedCount = response.data?.queuedFiles?.length || 0;
        message.success(`${queuedCount} files queued for reprocessing`);

        if (
          response.data?.skippedFiles &&
          response.data.skippedFiles.length > 0
        ) {
          const skippedReasons = response.data.skippedFiles
            .map((f) => f.reason)
            .join(", ");
          message.warning(
            `${response.data.skippedFiles.length} files were skipped: ${skippedReasons}`
          );
        }

        if (response.data?.errors && response.data.errors.length > 0) {
          message.error(`${response.data.errors.length} files failed to queue`);
        }

        // Clear selection and refresh data
        setSelectedRowKeys([]);
        setReprocessModalVisible(false);
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        message.error(response.message || "Failed to reprocess files");
      }
    } catch (error) {
      console.error("Error reprocessing files:", error);
      message.error("Failed to reprocess files");
    } finally {
      setReprocessLoading(false);
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
      width: 150,
      render: (id: string, record: JobFile) => (
        <div className="flex items-center space-x-1">
          {record.processing_status === "completed" && record.result && (
            <ArrowsAltOutlined
              style={{ cursor: "pointer", fontSize: "14px" }}
              onClick={(e) => {
                e.stopPropagation();
                handleOpenDrawer(record);
              }}
            />
          )}
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
      render: (_: any, record: JobFile) => {
        const previews = record.previews || [];

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
      render: (_: any, record: JobFile) => (
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
      render: (_: any, record: JobFile) => {
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
      render: (_: any, record: JobFile) => {
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
                    handleOpenDrawer(record);
                  }}
                >
                  Show Results
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

  const createTableComponent = () => (
    <Table<JobFile>
      columns={columns}
      dataSource={data}
      rowKey="id"
      rowSelection={rowSelection}
      pagination={tableParams.pagination}
      loading={loading}
      onChange={handleTableChange}
      size="small"
      // expandable={{
      //   expandIcon: ({ record }) => {
      //     if (record.processing_status !== "completed" || !record.result) {
      //       return null;
      //     }
      //     return (
      //       <ArrowsAltOutlined
      //         style={{ cursor: "pointer", fontSize: "14px" }}
      //         onClick={(e) => {
      //           e.stopPropagation();
      //           handleOpenDrawer(record);
      //         }}
      //       />
      //     );
      //   },
      // }}
      // scroll={{ x: 1000 }}
      scroll={{ x: 300, y: "calc(100vh - 320px)" }}
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
                onClick={handleBulkReprocess}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                🔄 Reprocess Selected
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

      {/* Files Table */}
      <div className="border border-gray-200 rounded-lg flex-1">
        {createTableComponent()}
      </div>

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

      {/* Reprocess Confirmation Modal */}
      <Modal
        title="Reprocess Files"
        open={reprocessModalVisible}
        onCancel={() => {
          setReprocessModalVisible(false);
          setShowProcessingConfigInReprocess(false);
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setReprocessModalVisible(false);
              setShowProcessingConfigInReprocess(false);
            }}
          >
            Cancel
          </Button>,
          <Button
            key="reprocess"
            type="primary"
            loading={reprocessLoading}
            onClick={confirmBulkReprocess}
          >
            Reprocess {selectedRowKeys.length} Files
          </Button>,
        ]}
        width={showProcessingConfigInReprocess ? 700 : 520}
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="text-blue-500 text-2xl">🔄</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Reprocess {selectedRowKeys.length} files?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                This will re-run AI processing on the existing extracted text
                without re-extracting from PDFs.
              </p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>What happens:</strong>
            </p>
            <ul className="text-sm text-blue-800 mt-2 list-disc list-inside space-y-1">
              <li>
                Uses existing extracted text/markdown (no PDF re-processing)
              </li>
              <li>Re-runs AI processing with current job schema</li>
              <li>Overwrites existing processing results</li>
              <li>Files will show as "processing" until complete</li>
            </ul>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Current processing results will be replaced
              with new results.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4">
            <button
              onClick={() =>
                setShowProcessingConfigInReprocess(
                  !showProcessingConfigInReprocess
                )
              }
              className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center space-x-1"
            >
              <span>{showProcessingConfigInReprocess ? "▼" : "▶"}</span>
              <span>
                {showProcessingConfigInReprocess ? "Hide" : "Show"} Processing
                Options (Advanced)
              </span>
            </button>

            {showProcessingConfigInReprocess && (
              <div className="mt-4 text-sm text-gray-600">
                <p className="mb-2">
                  Note: Reprocessing will use the current job's processing
                  configuration. Processing method changes are not currently
                  supported for reprocessing.
                </p>
              </div>
            )}
          </div>
        </div>
      </Modal>

      {/* File Results Drawer */}
      <Drawer
        title={
          selectedFile ? (
            <div className="flex items-center space-x-2">
              <FilePdfOutlined className="text-blue-500" />
              <span className="font-medium">{selectedFile.filename}</span>
            </div>
          ) : (
            "File Results"
          )
        }
        placement="right"
        size="large"
        onClose={handleCloseDrawer}
        open={drawerVisible}
        width={800}
        extra={
          <Button type="text" onClick={handleCloseDrawer}>
            Close
          </Button>
        }
      >
        {selectedFile && (
          <div className="h-full">
            {selectedFile.processing_status !== "completed" ||
            !selectedFile.result ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <ExclamationCircleOutlined className="text-gray-400 text-4xl mb-4" />
                  <Text type="secondary" className="text-lg">
                    No results available for this file.
                  </Text>
                  <br />
                  <Text type="secondary" className="text-sm">
                    File status: {selectedFile.processing_status}
                  </Text>
                </div>
              </div>
            ) : (
              <TabbedDataViewer
                data={selectedFile.result}
                filename={selectedFile.filename}
                schema={jobSchema}
                editable={true}
                onUpdate={async (updatedData) => {
                  try {
                    // Import apiClient dynamically to avoid circular imports
                    const { apiClient } = await import("@/lib/api");
                    await apiClient.updateFileResults(
                      selectedFile.id,
                      updatedData
                    );

                    // Show success message
                    message.success("File results updated successfully");

                    // Refresh the data in the parent component
                    if (onDataUpdate) {
                      await onDataUpdate();
                    }

                    // Update the selected file data
                    setSelectedFile({
                      ...selectedFile,
                      result: updatedData,
                    });
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
            )}
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default FileTable;
