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
  Checkbox,
  Radio,
  Space,
  Divider,
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
  FullscreenOutlined,
  LeftOutlined,
  RightOutlined,
} from "@ant-design/icons";
import { JobFile, ProcessingConfig } from "@/lib/api";
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
  const [fullscreenModalVisible, setFullscreenModalVisible] = useState(false);
  const [fullscreenFileIndex, setFullscreenFileIndex] = useState<number>(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfUrlLoading, setPdfUrlLoading] = useState(false);

  // Reprocess options state
  const [reprocessOptions, setReprocessOptions] = useState({
    reExtract: true,
    reProcess: true,
    forceExtraction: false,
    preview: false,
  });

  // Convert reprocess options to ProcessingConfig
  const getReprocessConfig = (): ProcessingConfig | undefined => {
    return {
      extraction: {
        method: "mineru",
        options: {},
      },
      processing: {
        method: "openai",
        model: "gpt-4o",
        options: {},
      },
      reprocess: {
        reExtract: reprocessOptions.reExtract,
        reProcess: reprocessOptions.reProcess,
        forceExtraction: reprocessOptions.forceExtraction,
        preview: reprocessOptions.preview,
      },
    };
  };

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

  // Fullscreen modal handlers
  const handleOpenFullscreen = async (record: JobFile) => {
    const fileIndex = data.findIndex((f) => f.id === record.id);
    if (fileIndex !== -1) {
      setFullscreenFileIndex(fileIndex);
      setFullscreenModalVisible(true);

      // Fetch PDF URL
      setPdfUrlLoading(true);
      try {
        const url = await getFilePdfUrl(record.id);
        setPdfUrl(url);
      } catch (error) {
        console.error("Error fetching PDF URL:", error);
        setPdfUrl(null);
      } finally {
        setPdfUrlLoading(false);
      }
    }
  };

  const handleCloseFullscreen = () => {
    setFullscreenModalVisible(false);
    setFullscreenFileIndex(0);
    setPdfUrl(null);
  };

  const handlePreviousFile = async () => {
    if (fullscreenFileIndex > 0) {
      const newIndex = fullscreenFileIndex - 1;
      setFullscreenFileIndex(newIndex);

      // Fetch PDF URL for the new file
      const newFile = data[newIndex];
      if (newFile) {
        setPdfUrlLoading(true);
        try {
          const url = await getFilePdfUrl(newFile.id);
          setPdfUrl(url);
        } catch (error) {
          console.error("Error fetching PDF URL:", error);
          setPdfUrl(null);
        } finally {
          setPdfUrlLoading(false);
        }
      }
    }
  };

  const handleNextFile = async () => {
    if (fullscreenFileIndex < data.length - 1) {
      const newIndex = fullscreenFileIndex + 1;
      setFullscreenFileIndex(newIndex);

      // Fetch PDF URL for the new file
      const newFile = data[newIndex];
      if (newFile) {
        setPdfUrlLoading(true);
        try {
          const url = await getFilePdfUrl(newFile.id);
          setPdfUrl(url);
        } catch (error) {
          console.error("Error fetching PDF URL:", error);
          setPdfUrl(null);
        } finally {
          setPdfUrlLoading(false);
        }
      }
    }
  };

  // Get current file in fullscreen modal
  const currentFullscreenFile = data[fullscreenFileIndex] || null;

  // Get PDF URL for file
  const getFilePdfUrl = async (fileId: string) => {
    const baseURL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
    try {
      // Request JSON format to get the signed URL for iframe embedding
      const response = await fetch(
        `${baseURL}/files/${fileId}/download?format=json`,
        {
          headers: {
            Authorization: `Bearer ${apiClient.getAccessToken()}`,
            Accept: "application/json",
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        return data.url; // Return the signed S3 URL
      } else {
        // Fallback to direct URL if JSON request fails
        return `${baseURL}/files/${fileId}/download`;
      }
    } catch (error) {
      console.error("Error getting file URL:", error);
      // Fallback to direct URL
      return `${baseURL}/files/${fileId}/download`;
    }
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

  // Fetch PDF URL when file index changes in fullscreen modal
  useEffect(() => {
    if (!fullscreenModalVisible || !currentFullscreenFile) return;

    setPdfUrlLoading(true);
    getFilePdfUrl(currentFullscreenFile.id)
      .then((url) => {
        setPdfUrl(url);
      })
      .catch((error) => {
        console.error("Error fetching PDF URL:", error);
        setPdfUrl(null);
      })
      .finally(() => {
        setPdfUrlLoading(false);
      });
  }, [fullscreenModalVisible, fullscreenFileIndex, currentFullscreenFile?.id]);

  // Keyboard navigation for fullscreen modal
  useEffect(() => {
    if (!fullscreenModalVisible) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" && fullscreenFileIndex > 0) {
        setFullscreenFileIndex((prev) => Math.max(0, prev - 1));
      } else if (
        e.key === "ArrowRight" &&
        fullscreenFileIndex < data.length - 1
      ) {
        setFullscreenFileIndex((prev) => Math.min(data.length - 1, prev + 1));
      } else if (e.key === "Escape") {
        setFullscreenModalVisible(false);
        setFullscreenFileIndex(0);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [fullscreenModalVisible, fullscreenFileIndex, data.length]);

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
      // message.success("ID copied to clipboard");
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
        // message.success(
        //   response.message || "File upload retry initiated successfully"
        // );
        setRetryModalVisible(false);
        setRetryFileId(null);
        setRetryFile(null);

        // Refresh data
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        // message.error(response.message || "Failed to retry upload");
      }
    } catch (error) {
      console.error("Error retrying upload:", error);
      // message.error("Failed to retry upload");
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
        // message.success(`File "${deleteFileName}" deleted successfully`);
        setDeleteModalVisible(false);
        setDeleteFileId(null);
        setDeleteFileName(null);

        // Refresh data
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        // message.error(response.message || "Failed to delete file");
      }
    } catch (error) {
      console.error("Error deleting file:", error);
      // message.error("Failed to delete file");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleBulkDelete = () => {
    if (selectedRowKeys.length === 0) {
      // message.warning("Please select files to delete");
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
        // message.success(`${deletedCount} files deleted successfully`);

        if (response.data?.errors && response.data.errors.length > 0) {
          // message.warning(
          //   `${response.data.errors.length} files could not be deleted`
          // );
        }

        // Clear selection and refresh data
        setSelectedRowKeys([]);
        setBulkDeleteModalVisible(false);
        if (onDataUpdate) {
          await onDataUpdate();
        }
      } else {
        // message.error(response.message || "Failed to delete files");
      }
    } catch (error) {
      console.error("Error deleting files:", error);
      // message.error("Failed to delete files");
    } finally {
      setBulkDeleteLoading(false);
    }
  };

  const handleBulkReprocess = () => {
    if (selectedRowKeys.length === 0) {
      // message.warning("Please select files to reprocess");
      return;
    }
    setReprocessModalVisible(true);
  };

  const confirmBulkReprocess = async () => {
    try {
      setReprocessLoading(true);
      const fileIds = selectedRowKeys.map((key) => key.toString());

      // Use the reprocess config from state
      const processingConfig = getReprocessConfig();

      const response = await apiClient.reprocessFiles(
        fileIds,
        0,
        processingConfig
      );

      if (response.status === "success") {
        if (reprocessOptions.preview) {
          // Handle preview response
          const previewCount = response.data?.preview?.length || 0;
          message.success(`Preview generated for ${previewCount} files`);

          // You could show the preview data in a modal or drawer here
          console.log("Preview data:", response.data?.preview);
        } else {
          // Handle normal reprocess response
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
            message.error(
              `${response.data.errors.length} files failed to queue`
            );
          }

          // Clear selection and refresh data
          setSelectedRowKeys([]);
          setReprocessModalVisible(false);
          if (onDataUpdate) {
            await onDataUpdate();
          }
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
            <>
              <ArrowsAltOutlined
                style={{ cursor: "pointer", fontSize: "14px" }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenDrawer(record);
                }}
              />
              <FullscreenOutlined
                style={{
                  cursor: "pointer",
                  fontSize: "14px",
                  color: "#1890ff",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenFullscreen(record);
                }}
              />
            </>
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

        if (
          record.processing_status === "completed" &&
          record.result &&
          !record.result.api_number
        ) {
          return (
            <Tooltip title="API number not found">
              <div className="flex items-center justify-center">
                <ExclamationCircleOutlined
                  style={{ color: "#ff4d4f", fontSize: "16px" }}
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
          // Reset options to defaults
          setReprocessOptions({
            reExtract: true,
            reProcess: true,
            forceExtraction: false,
            preview: false,
          });
        }}
        footer={[
          <Button
            key="cancel"
            onClick={() => {
              setReprocessModalVisible(false);
              setShowProcessingConfigInReprocess(false);
              // Reset options to defaults
              setReprocessOptions({
                reExtract: true,
                reProcess: true,
                forceExtraction: false,
                preview: false,
              });
            }}
          >
            Cancel
          </Button>,
          <Button
            key="preview"
            onClick={() => {
              setReprocessOptions((prev) => ({ ...prev, preview: true }));
              confirmBulkReprocess();
            }}
            loading={reprocessLoading}
          >
            Preview
          </Button>,
          <Button
            key="reprocess"
            type="primary"
            loading={reprocessLoading}
            onClick={() => {
              setReprocessOptions((prev) => ({ ...prev, preview: false }));
              confirmBulkReprocess();
            }}
          >
            Reprocess {selectedRowKeys.length} Files
          </Button>,
        ]}
        width={700}
      >
        <div className="space-y-6">
          {/* Header */}
          <div className="flex items-center space-x-3">
            <div className="text-blue-500 text-2xl">🔄</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Reprocess {selectedRowKeys.length} files?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Choose what operations to perform on the selected files.
              </p>
            </div>
          </div>

          {/* Operation Selection */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-900 mb-3">
              Operations
            </h4>
            <Space direction="vertical" size="small" className="w-full">
              <Checkbox
                checked={reprocessOptions.reExtract}
                onChange={(e) =>
                  setReprocessOptions((prev) => ({
                    ...prev,
                    reExtract: e.target.checked,
                  }))
                }
              >
                <span className="font-medium">Re-run Text Extraction</span>
                <div className="text-xs text-gray-600 ml-6">
                  Extract text from PDF files again
                </div>
              </Checkbox>

              <Checkbox
                checked={reprocessOptions.reProcess}
                onChange={(e) =>
                  setReprocessOptions((prev) => ({
                    ...prev,
                    reProcess: e.target.checked,
                  }))
                }
              >
                <span className="font-medium">Re-run AI Processing</span>
                <div className="text-xs text-gray-600 ml-6">
                  Process extracted text with AI using current schema
                </div>
              </Checkbox>
            </Space>
          </div>

          {/* Advanced Options */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h4 className="text-sm font-medium text-yellow-900 mb-3">
              Advanced Options
            </h4>
            <Space direction="vertical" size="small" className="w-full">
              <Checkbox
                checked={reprocessOptions.forceExtraction}
                onChange={(e) =>
                  setReprocessOptions((prev) => ({
                    ...prev,
                    forceExtraction: e.target.checked,
                  }))
                }
                disabled={!reprocessOptions.reExtract}
              >
                <span className="font-medium">Force Extraction</span>
                <div className="text-xs text-yellow-700 ml-6">
                  Re-extract even if extraction is already completed
                </div>
              </Checkbox>
            </Space>
          </div>

          {/* What Will Happen */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800 font-medium mb-2">
              What will happen:
            </p>
            <ul className="text-sm text-blue-800 list-disc list-inside space-y-1">
              {reprocessOptions.reExtract && (
                <li>
                  {reprocessOptions.forceExtraction
                    ? "Force re-extract text from PDF files"
                    : "Re-extract text from PDF files (if not already completed)"}
                </li>
              )}
              {reprocessOptions.reProcess && (
                <li>
                  {reprocessOptions.reExtract
                    ? "Process newly extracted text with AI"
                    : "Process existing extracted text with AI"}
                </li>
              )}
              {!reprocessOptions.reExtract && !reprocessOptions.reProcess && (
                <li className="text-red-600">
                  No operations selected - please choose at least one
                </li>
              )}
              <li>Files will show as "processing" until complete</li>
              <li>Existing results will be overwritten</li>
            </ul>
          </div>

          {/* Validation Warning */}
          {!reprocessOptions.reExtract && !reprocessOptions.reProcess && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-sm text-red-800">
                <strong>Error:</strong> At least one operation must be selected.
              </p>
            </div>
          )}
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
                markdown={selectedFile.markdown}
                actual_result={selectedFile.actual_result}
                onUpdate={async (updatedData) => {
                  try {
                    // Import apiClient dynamically to avoid circular imports
                    const { apiClient } = await import("@/lib/api");
                    await apiClient.updateFileResults(
                      selectedFile.id,
                      updatedData
                    );

                    // Show success message
                    // message.success("File results updated successfully");

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
                    // message.error(
                    //   `Failed to update file results: ${
                    //     (error as Error).message || "Unknown error"
                    //   }`
                    // );
                  }
                }}
              />
            )}
          </div>
        )}
      </Drawer>

      {/* Fullscreen Modal */}
      <Modal
        title={null}
        open={fullscreenModalVisible}
        onCancel={handleCloseFullscreen}
        footer={null}
        width="100vw"
        styles={{
          body: {
            height: "100vh",
            padding: 0,
            overflow: "hidden",
          },
          content: {
            top: 0,
            paddingBottom: 0,
            maxHeight: "100vh",
            borderRadius: 0,
            boxShadow: "none",
          },
          wrapper: {
            padding: 0,
            top: 0,
            overflow: "hidden",
          },
        }}
        style={{
          top: 0,
          paddingBottom: 0,
          maxWidth: "100vw",
          margin: 0,
        }}
        closeIcon={null}
        maskClosable={false}
      >
        {currentFullscreenFile && (
          <div className="flex flex-col h-full overflow-hidden">
            {/* Navigation Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50 flex-shrink-0">
              <div className="flex items-center space-x-4 flex-1">
                <div className="flex items-center space-x-2">
                  <Button
                    type="default"
                    icon={<LeftOutlined />}
                    onClick={handlePreviousFile}
                    disabled={fullscreenFileIndex === 0}
                  >
                    Previous
                  </Button>
                  <Button
                    type="default"
                    icon={<RightOutlined />}
                    iconPosition="end"
                    onClick={handleNextFile}
                    disabled={fullscreenFileIndex === data.length - 1}
                  >
                    Next
                  </Button>
                </div>
                <div className="flex items-center space-x-2 text-sm text-gray-600">
                  <FilePdfOutlined className="text-blue-500" />
                  <span className="font-medium">
                    {currentFullscreenFile.filename}
                  </span>
                  <span className="text-gray-400">
                    ({fullscreenFileIndex + 1} of {data.length})
                  </span>
                </div>
              </div>
              <Button
                type="text"
                icon={<ShrinkOutlined />}
                onClick={handleCloseFullscreen}
              >
                Close
              </Button>
            </div>

            {/* Content Area - Two Pane Layout */}
            <div className="flex flex-1 overflow-hidden min-h-0">
              {/* Left Pane - PDF Viewer */}
              <div className="w-1/2 border-r border-gray-200 bg-gray-100 flex flex-col min-w-0 overflow-hidden">
                <div className="px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
                  <Text strong className="text-sm">
                    PDF Document
                  </Text>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  {pdfUrlLoading ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader className="w-8 h-8 animate-spin text-blue-500" />
                    </div>
                  ) : pdfUrl ? (
                    <iframe
                      src={pdfUrl}
                      className="w-full h-full border-0 bg-white"
                      style={{ display: "block", height: "100%" }}
                      title={`PDF viewer for ${currentFullscreenFile.filename}`}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ExclamationCircleOutlined className="text-gray-400 text-4xl mb-4" />
                        <Text type="secondary" className="text-lg">
                          Unable to load PDF
                        </Text>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Right Pane - Results Viewer */}
              <div className="w-1/2 bg-white flex flex-col min-w-0 overflow-hidden">
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                  <Text strong className="text-sm">
                    Extracted Results
                  </Text>
                </div>
                <div className="flex-1 overflow-hidden min-h-0">
                  {currentFullscreenFile.processing_status !== "completed" ||
                  !currentFullscreenFile.result ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <ExclamationCircleOutlined className="text-gray-400 text-4xl mb-4" />
                        <Text type="secondary" className="text-lg">
                          No results available for this file.
                        </Text>
                        <br />
                        <Text type="secondary" className="text-sm">
                          File status: {currentFullscreenFile.processing_status}
                        </Text>
                      </div>
                    </div>
                  ) : (
                    <div className="h-full overflow-hidden">
                      <TabbedDataViewer
                        data={currentFullscreenFile.result}
                        filename={currentFullscreenFile.filename}
                        schema={jobSchema}
                        editable={true}
                        markdown={currentFullscreenFile.markdown}
                        actual_result={currentFullscreenFile.actual_result}
                        onUpdate={async (updatedData) => {
                          try {
                            await apiClient.updateFileResults(
                              currentFullscreenFile.id,
                              updatedData
                            );

                            // Refresh the data in the parent component
                            if (onDataUpdate) {
                              await onDataUpdate();
                            }

                            // Update the current file data
                            setData((prevData) =>
                              prevData.map((file) =>
                                file.id === currentFullscreenFile.id
                                  ? { ...file, result: updatedData }
                                  : file
                              )
                            );
                          } catch (error) {
                            console.error(
                              "Error updating file results:",
                              error
                            );
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default FileTable;
