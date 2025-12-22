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
  Descriptions,
  Tag,
  Input,
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
  ExportOutlined,
  LeftOutlined,
  RightOutlined,
  InfoCircleOutlined,
  PlusOutlined,
  ReloadOutlined,
  SettingOutlined,
  FileTextOutlined,
  EllipsisOutlined,
} from "@ant-design/icons";
import { JobFile, ProcessingConfig } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import { apiClient } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import moment from "moment";
import {
  checkPermitNumberMatch,
  getViolationSeverityColor,
  getViolationSeverityIcon,
  checkFileConstraints,
  checkFormationContinuity,
} from "@/lib/constraintUtils";
import ConstraintErrorIcon from "@/components/ui/ConstraintErrorIcon";
import ConstraintList from "@/components/ui/ConstraintList";
import styles from "./FileTable.module.css";
import { Loader, MessageSquare } from "lucide-react";
import { SignalIcon } from "@heroicons/react/24/outline";
import StatusIndicator from "@/components/ui/StatusIndicator";

const { TextArea } = Input;

const { Text } = Typography;

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
  fileSummary?: {
    total: number;
    extraction_pending: number;
    extraction_processing: number;
    extraction_completed: number;
    extraction_failed: number;
    processing_pending: number;
    processing_processing: number;
    processing_completed: number;
    processing_failed: number;
    processing: number; // extraction_status = 'processing' OR processing_status = 'processing'
    pending: number; // extraction_status = 'pending' AND processing_status = 'pending'
  } | null;
  // Actions props
  isConnected?: boolean;
  isGoingLive?: boolean;
  isRefreshing?: boolean;
  onGoLive?: () => void;
  onRefresh?: () => void;
  onAddFiles?: () => void;
  onEditConfig?: () => void;
  onShowSchema?: () => void;
  // Job status props
  jobStatus?: string;
  getJobStatusColor?: (status: string) => string;
}

interface TableParams {
  pagination?: TablePaginationConfig;
  sortField?: string;
  sortOrder?: "ascend" | "descend";
  filters?: Record<string, any>;
}

const DEFAULT_PAGE_SIZE = 20;

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
  fileSummary,
  isConnected = false,
  isGoingLive = false,
  isRefreshing = false,
  onGoLive,
  onRefresh,
  onAddFiles,
  onEditConfig,
  onShowSchema,
  jobStatus,
  getJobStatusColor,
}) => {
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);
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
  const [bulkVerifyModalVisible, setBulkVerifyModalVisible] = useState(false);
  const [bulkVerifyLoading, setBulkVerifyLoading] = useState(false);
  const [bulkReviewLoading, setBulkReviewLoading] = useState(false);
  const [bulkReviewAndVerifyLoading, setBulkReviewAndVerifyLoading] =
    useState(false);
  const [reprocessModalVisible, setReprocessModalVisible] = useState(false);
  const [reprocessLoading, setReprocessLoading] = useState(false);
  const [showProcessingConfigInReprocess, setShowProcessingConfigInReprocess] =
    useState(false);
  const [reprocessingFileId, setReprocessingFileId] = useState<string | null>(
    null
  );
  const [singleFileReprocessMode, setSingleFileReprocessMode] = useState(false);
  const [fullscreenModalVisible, setFullscreenModalVisible] = useState(false);
  const [fullscreenFileIndex, setFullscreenFileIndex] = useState<number>(0);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfUrlLoading, setPdfUrlLoading] = useState(false);
  const [verifyingFileId, setVerifyingFileId] = useState<string | null>(null);
  const [fileDetailsDrawerVisible, setFileDetailsDrawerVisible] =
    useState(false);
  const [selectedFileForDetails, setSelectedFileForDetails] =
    useState<JobFile | null>(null);
  const selectedFilePageCount = computePageCount(selectedFileForDetails);
  const [splitPosition, setSplitPosition] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const splitPositionRef = React.useRef(50);
  const leftPaneRef = React.useRef<HTMLDivElement>(null);
  const rightPaneRef = React.useRef<HTMLDivElement>(null);

  // Comments state for drawer
  const [drawerComments, setDrawerComments] = useState<
    Array<{
      id: string;
      userId: string;
      userEmail: string;
      text: string;
      createdAt: string;
    }>
  >([]);

  // Comments state for fullscreen modal
  const [fullscreenComments, setFullscreenComments] = useState<
    Array<{
      id: string;
      userId: string;
      userEmail: string;
      text: string;
      createdAt: string;
    }>
  >([]);

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
        method: "paddleocr",
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

  const [loading, setLoading] = useState(false);
  const [tableParams, setTableParams] = useState<TableParams>({
    pagination: {
      current: 1,
      pageSize: DEFAULT_PAGE_SIZE,
    },
  });

  // AJAX fetch function
  const fetchData = async () => {
    console.log("📥 FileTable fetchData called");
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
  const handleOpenDrawer = async (record: JobFile) => {
    setSelectedFile(record);
    setDrawerVisible(true);
    // Fetch comments for this file
    try {
      const commentsResponse = await apiClient.getFileComments(record.id);
      if (commentsResponse.success && commentsResponse.data?.comments) {
        setDrawerComments(commentsResponse.data.comments);
      }
    } catch (err) {
      console.error("Failed to load comments:", err);
      setDrawerComments([]);
    }
  };

  const handleCloseDrawer = () => {
    setDrawerVisible(false);
    setSelectedFile(null);
    setDrawerComments([]);
  };

  // Handle adding comment in drawer
  const handleDrawerAddComment = async (text: string) => {
    if (!selectedFile) return;

    try {
      const response = await apiClient.addFileComment(selectedFile.id, text);

      if (response.success && response.data?.comment) {
        setDrawerComments((prev) => [...prev, response.data!.comment]);
      } else {
        throw new Error(response.message || "Failed to add comment");
      }
    } catch (err: any) {
      throw err; // Re-throw to let TabbedDataViewer handle the error message
    }
  };

  // Handle file details drawer
  const handleOpenFileDetails = async (record: JobFile) => {
    setSelectedFileForDetails(record);
    setFileDetailsDrawerVisible(true);
  };

  const handleCloseFileDetails = () => {
    setFileDetailsDrawerVisible(false);
    setSelectedFileForDetails(null);
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

      // Fetch comments for this file
      try {
        const commentsResponse = await apiClient.getFileComments(record.id);
        if (commentsResponse.success && commentsResponse.data?.comments) {
          setFullscreenComments(commentsResponse.data.comments);
        }
      } catch (err) {
        console.error("Failed to load comments:", err);
        setFullscreenComments([]);
      }
    }
  };

  const handleCloseFullscreen = () => {
    setFullscreenModalVisible(false);
    setFullscreenFileIndex(0);
    setPdfUrl(null);
    setFullscreenComments([]);
  };

  // Handle adding comment in fullscreen modal
  const handleFullscreenAddComment = async (text: string) => {
    if (!currentFullscreenFile) return;

    try {
      const response = await apiClient.addFileComment(
        currentFullscreenFile.id,
        text
      );

      if (response.success && response.data?.comment) {
        setFullscreenComments((prev) => [...prev, response.data!.comment]);
      } else {
        throw new Error(response.message || "Failed to add comment");
      }
    } catch (err: any) {
      throw err; // Re-throw to let TabbedDataViewer handle the error message
    }
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

  // Handle file verification
  const handleVerifyFile = async (fileId: string, adminVerified: boolean) => {
    setVerifyingFileId(fileId);
    try {
      await apiClient.verifyFile(fileId, adminVerified, undefined);
      message.success("File verification updated successfully");
      // Refresh data
      if (onDataUpdate) {
        await onDataUpdate();
      }
      // Update local state
      setData((prevData) =>
        prevData.map((file) =>
          file.id === fileId ? { ...file, admin_verified: adminVerified } : file
        )
      );
    } catch (error: any) {
      console.error("Error verifying file:", error);
      message.error(error.message || "Failed to verify file");
    } finally {
      setVerifyingFileId(null);
    }
  };

  // Handle file review status update
  const [reviewingFileId, setReviewingFileId] = useState<string | null>(null);

  const handleReviewAndVerifyFile = async (fileId: string) => {
    setReviewingFileId(fileId);
    setVerifyingFileId(fileId);
    try {
      const response = await apiClient.bulkReviewAndVerifyFiles(
        [fileId],
        "reviewed",
        true // adminVerified
      );

      if (
        response.success &&
        response.data &&
        response.data.updated?.length > 0
      ) {
        const updated = response.data.updated[0];
        message.success("File marked as reviewed and verified successfully");

        // Refresh data
        if (onDataUpdate) {
          await onDataUpdate();
        }

        // Update local state
        setData((prevData) =>
          prevData.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  review_status: updated.review_status as
                    | "pending"
                    | "in_review"
                    | "reviewed"
                    | "approved"
                    | "rejected"
                    | undefined,
                  reviewed_by: updated.reviewed_by,
                  reviewed_at: updated.reviewed_at,
                  admin_verified: updated.admin_verified,
                  customer_verified: updated.customer_verified,
                }
              : file
          )
        );
      } else {
        throw new Error(response.message || "Failed to update file");
      }
    } catch (error: any) {
      console.error("Error reviewing and verifying file:", error);
      message.error(error.message || "Failed to update file");
    } finally {
      setReviewingFileId(null);
      setVerifyingFileId(null);
    }
  };

  const handleUpdateReviewStatus = async (
    fileId: string,
    reviewStatus:
      | "pending"
      | "in_review"
      | "reviewed"
      | "approved"
      | "rejected",
    reviewNotes?: string
  ) => {
    setReviewingFileId(fileId);
    try {
      const response = await apiClient.updateFileReviewStatus(
        fileId,
        reviewStatus,
        reviewNotes
      );
      if (response.status === "success" && response.data) {
        message.success(`File marked as ${reviewStatus}`);
        // Refresh data
        if (onDataUpdate) {
          await onDataUpdate();
        }
        // Update local state
        setData((prevData) =>
          prevData.map((file) =>
            file.id === fileId
              ? {
                  ...file,
                  review_status: response.data!.review_status as
                    | "pending"
                    | "in_review"
                    | "reviewed"
                    | "approved"
                    | "rejected"
                    | undefined,
                  reviewed_by: response.data!.reviewed_by,
                  reviewed_at: response.data!.reviewed_at,
                  review_notes: response.data!.review_notes,
                }
              : file
          )
        );
      } else {
        throw new Error(response.message || "Failed to update review status");
      }
    } catch (error: any) {
      console.error("Error updating review status:", error);
      message.error(error.message || "Failed to update review status");
    } finally {
      setReviewingFileId(null);
    }
  };

  // Handle bulk review
  const handleBulkReview = async (
    reviewStatus:
      | "pending"
      | "in_review"
      | "reviewed"
      | "approved"
      | "rejected" = "reviewed"
  ) => {
    if (selectedRowKeys.length === 0) {
      return;
    }

    try {
      setBulkReviewLoading(true);
      const fileIds = selectedRowKeys.map((key) => key.toString());

      // Use bulk endpoint
      const response = await apiClient.bulkUpdateFileReviewStatus(
        fileIds,
        reviewStatus
      );

      if (response.success && response.data) {
        const updatedCount = response.data.updated?.length || 0;
        const deniedCount = response.data.denied?.length || 0;

        if (updatedCount > 0) {
          message.success(
            `${updatedCount} file(s) marked as ${reviewStatus} successfully`
          );
        }
        if (deniedCount > 0) {
          message.warning(
            `${deniedCount} file(s) could not be updated (access denied or not found)`
          );
        }

        // Update local state for updated files
        if (response.data.updated) {
          setData((prevData) =>
            prevData.map((file) => {
              const updated = response.data!.updated.find(
                (u) => u.id === file.id
              );
              if (updated) {
                return {
                  ...file,
                  review_status: updated.review_status as
                    | "pending"
                    | "in_review"
                    | "reviewed"
                    | "approved"
                    | "rejected"
                    | undefined,
                  reviewed_by: updated.reviewed_by,
                  reviewed_at: updated.reviewed_at,
                  review_notes: updated.review_notes,
                };
              }
              return file;
            })
          );
        }
      } else {
        throw new Error(response.message || "Failed to update review status");
      }

      // Clear selection and refresh data
      setSelectedRowKeys([]);

      // Trigger refresh
      if (onDataUpdate) {
        await onDataUpdate();
      } else {
        await fetchData();
      }
    } catch (error: any) {
      console.error("Error updating review status for files:", error);
      message.error(error.message || "Failed to update review status");
    } finally {
      setBulkReviewLoading(false);
    }
  };

  // Handle bulk verification
  const handleBulkReviewAndVerify = async () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    try {
      setBulkReviewAndVerifyLoading(true);
      const fileIds = selectedRowKeys.map((key) => key.toString());

      // Use combined endpoint
      const response = await apiClient.bulkReviewAndVerifyFiles(
        fileIds,
        "reviewed",
        true // adminVerified
      );

      if (response.success && response.data) {
        const updatedCount = response.data.updated?.length || 0;
        const deniedCount = response.data.denied?.length || 0;

        if (updatedCount > 0) {
          message.success(
            `${updatedCount} file(s) marked as reviewed and verified successfully`
          );
        }

        if (deniedCount > 0) {
          message.warning(
            `${deniedCount} file(s) could not be updated (access denied or not found)`
          );
        }

        // Update local state for updated files immediately
        if (response.data.updated) {
          setData((prevData) =>
            prevData.map((file) => {
              const updated = response.data!.updated.find(
                (u) => u.id === file.id
              );
              if (updated) {
                return {
                  ...file,
                  review_status: updated.review_status as
                    | "pending"
                    | "in_review"
                    | "reviewed"
                    | "approved"
                    | "rejected"
                    | undefined,
                  reviewed_by: updated.reviewed_by,
                  reviewed_at: updated.reviewed_at,
                  admin_verified: updated.admin_verified,
                  customer_verified: updated.customer_verified,
                };
              }
              return file;
            })
          );
        }

        // Clear selection and refresh data
        setSelectedRowKeys([]);

        // Trigger refresh - both via callback and by refetching data
        if (onDataUpdate) {
          await onDataUpdate();
        } else {
          // Fallback: directly refetch data if onDataUpdate is not provided
          await fetchData();
        }
      } else {
        message.error(response.message || "Failed to update files");
      }
    } catch (error: any) {
      console.error("Error bulk reviewing and verifying files:", error);
      message.error(
        error.message || "Failed to update files. Please try again."
      );
    } finally {
      setBulkReviewAndVerifyLoading(false);
    }
  };

  const handleBulkVerify = () => {
    if (selectedRowKeys.length === 0) {
      return;
    }
    setBulkVerifyModalVisible(true);
  };

  const confirmBulkVerify = async (adminVerified: boolean) => {
    try {
      setBulkVerifyLoading(true);
      const fileIds = selectedRowKeys.map((key) => key.toString());

      // Use bulk endpoint
      const response = await apiClient.bulkVerifyFiles(
        fileIds,
        adminVerified,
        undefined
      );

      if (response.success && response.data) {
        const updatedCount = response.data.updated?.length || 0;
        const deniedCount = response.data.denied?.length || 0;

        if (updatedCount > 0) {
          message.success(
            `${updatedCount} file(s) ${
              adminVerified ? "verified" : "unverified"
            } successfully`
          );
        }
        if (deniedCount > 0) {
          message.warning(
            `${deniedCount} file(s) could not be verified (access denied or not found)`
          );
        }

        // Update local state for updated files
        if (response.data.updated) {
          setData((prevData) =>
            prevData.map((file) => {
              const updated = response.data!.updated.find(
                (u) => u.id === file.id
              );
              if (updated) {
                return {
                  ...file,
                  admin_verified: updated.admin_verified,
                  customer_verified: updated.customer_verified,
                };
              }
              return file;
            })
          );
        }
      } else {
        throw new Error(response.message || "Failed to verify files");
      }

      // Clear selection and refresh data
      setSelectedRowKeys([]);
      setBulkVerifyModalVisible(false);

      // Trigger refresh - both via callback and by refetching data
      if (onDataUpdate) {
        await onDataUpdate();
      } else {
        // Fallback: directly refetch data if onDataUpdate is not provided
        await fetchData();
      }
    } catch (error: any) {
      console.error("Error verifying files:", error);
      message.error(error.message || "Failed to verify files");
    } finally {
      setBulkVerifyLoading(false);
    }
  };

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
    console.log(
      "🔄 FileTable useEffect triggered - refreshTrigger:",
      refreshTrigger
    );
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

    // Fetch comments when file changes
    apiClient
      .getFileComments(currentFullscreenFile.id)
      .then((commentsResponse) => {
        if (commentsResponse.success && commentsResponse.data?.comments) {
          setFullscreenComments(commentsResponse.data.comments);
        }
      })
      .catch((err) => {
        console.error("Failed to load comments:", err);
        setFullscreenComments([]);
      });
  }, [fullscreenModalVisible, fullscreenFileIndex, currentFullscreenFile?.id]);

  // Resize handlers - optimized for smooth dragging
  useEffect(() => {
    let animationFrameId: number | null = null;

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing) return;

      // Cancel previous animation frame if exists
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }

      animationFrameId = requestAnimationFrame(() => {
        const container = document.querySelector(".fullscreen-modal-content");
        if (!container || !leftPaneRef.current || !rightPaneRef.current) return;

        const rect = container.getBoundingClientRect();
        const newPosition = ((e.clientX - rect.left) / rect.width) * 100;
        const clampedPosition = Math.max(20, Math.min(80, newPosition));

        // Update ref immediately
        splitPositionRef.current = clampedPosition;

        // Update DOM directly for smooth performance (no React re-render)
        leftPaneRef.current.style.width = `${clampedPosition}%`;
        rightPaneRef.current.style.width = `${100 - clampedPosition}%`;
      });
    };

    const handleMouseUp = () => {
      // Sync final position to React state
      setSplitPosition(splitPositionRef.current);
      setIsResizing(false);
    };

    if (isResizing) {
      document.addEventListener("mousemove", handleMouseMove, {
        passive: true,
      });
      document.addEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };
  }, [isResizing]);

  // Sync ref when state changes (e.g., initial load)
  useEffect(() => {
    splitPositionRef.current = splitPosition;
  }, [splitPosition]);

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  };

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

  const handleSingleFileReprocess = (fileId: string) => {
    setReprocessingFileId(fileId);
    setSingleFileReprocessMode(true);
    setReprocessModalVisible(true);
  };

  const confirmBulkReprocess = async () => {
    try {
      setReprocessLoading(true);
      const fileIds =
        singleFileReprocessMode && reprocessingFileId
          ? [reprocessingFileId]
          : selectedRowKeys.map((key) => key.toString());

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
          if (!singleFileReprocessMode) {
            setSelectedRowKeys([]);
          }
          setReprocessModalVisible(false);
          setSingleFileReprocessMode(false);
          setReprocessingFileId(null);
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
      title: "Filename",
      dataIndex: "id",
      key: "id",
      width: 150,
      fixed: "left" as const,
      render: (id: string, record: JobFile) => (
        <div
          className="flex items-center space-x-1"
          style={{ whiteSpace: "nowrap", overflow: "hidden" }}
        >
          {record.processing_status === "completed" && record.result && (
            <>
              <Tooltip title="Open in new tab">
                <ExportOutlined
                  style={{
                    cursor: "pointer",
                    color: "#1890ff",
                    flexShrink: 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    window.open(`/files/${id}`, "_blank");
                  }}
                />
              </Tooltip>
              <Tooltip title="Fullscreen view">
                <FullscreenOutlined
                  style={{
                    cursor: "pointer",
                    color: "#1890ff",
                    flexShrink: 0,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleOpenFullscreen(record);
                  }}
                />
              </Tooltip>
            </>
          )}
          <CopyOutlined
            style={{
              color: "#1890ff",
              cursor: "pointer",
              flexShrink: 0,
            }}
            onClick={() => copyToClipboard(id)}
          />
          <Text
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {record.filename}
          </Text>
          {record.selected_pages &&
            Array.isArray(record.selected_pages) &&
            record.selected_pages.length > 0 && (
              <Tooltip
                title={`Selected pages: ${record.selected_pages.join(", ")} (${
                  record.selected_pages.length
                } of ${computePageCount(record) || "?"} pages)`}
              >
                <Badge
                  count={record.selected_pages.length}
                  style={{ backgroundColor: "#1890ff" }}
                  overflowCount={99}
                />
              </Tooltip>
            )}
        </div>
      ),
    },
    // {
    //   title: "Filename",
    //   dataIndex: "filename",
    //   key: "filename",
    //   fixed: "left" as const,
    //   width: 200,
    //   render: (filename: string) => (
    //     <div
    //       className="flex items-center space-x-1"
    //       style={{ overflow: "hidden" }}
    //     >
    //       <FilePdfOutlined style={{ color: "#ff4d4f", flexShrink: 0 }} />
    //       <Tooltip title={filename}>
    //         <Text
    //           ellipsis
    //           style={{
    //             overflow: "hidden",
    //             textOverflow: "ellipsis",
    //             whiteSpace: "nowrap",
    //           }}
    //         >
    //           {filename}
    //         </Text>
    //       </Tooltip>
    //     </div>
    //   ),
    // },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: 100,
      render: (size: number) => (
        <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
          {formatFileSize(size)}
        </Text>
      ),
    },
    {
      title: "Pages",
      key: "pages",
      width: 80,
      render: (_: any, record: JobFile) => {
        const pageCount = computePageCount(record);
        return (
          <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
            {pageCount !== null ? pageCount : "-"}
          </Text>
        );
      },
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (date: string) => (
        <Text
          type="secondary"
          style={{
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
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
            <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
              None
            </Text>
          );
        }

        const visiblePreviews = previews.slice(0, 2);
        const remainingCount = previews.length - 2;

        return (
          <div
            className="flex items-center space-x-1"
            style={{ overflow: "hidden", whiteSpace: "nowrap" }}
          >
            {visiblePreviews.map((preview, index) => (
              <a
                key={preview.id}
                href={`/preview/${preview.id}`}
                target="_blank"
                style={{
                  color: "#1890ff",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
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
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
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
      title: "Verified",
      key: "verified",
      width: 120,
      render: (_: any, record: JobFile) => (
        <div
          className="flex items-center space-x-1"
          style={{ whiteSpace: "nowrap" }}
        >
          {record.admin_verified && (
            <Tooltip title="Admin Verified">
              <CheckCircleOutlined
                style={{ color: "#52c41a", flexShrink: 0 }}
              />
            </Tooltip>
          )}
          {record.customer_verified && (
            <Tooltip title="Customer Verified">
              <CheckCircleOutlined
                style={{ color: "#1890ff", flexShrink: 0 }}
              />
            </Tooltip>
          )}
          {!record.admin_verified && !record.customer_verified && (
            <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
              -
            </Text>
          )}
        </div>
      ),
    },
    {
      title: "Review Status",
      key: "review_status",
      width: 130,
      render: (_: any, record: JobFile) => {
        const status = record.review_status || "pending";
        const statusColors: Record<string, string> = {
          pending: "default",
          in_review: "processing",
          reviewed: "success",
          approved: "success",
          rejected: "error",
        };
        const statusLabels: Record<string, string> = {
          pending: "Pending",
          in_review: "In Review",
          reviewed: "Reviewed",
          approved: "Approved",
          rejected: "Rejected",
        };
        return (
          <Tooltip
            title={
              record.reviewed_at
                ? `Reviewed at: ${moment(record.reviewed_at).format(
                    "YYYY-MM-DD HH:mm"
                  )}`
                : statusLabels[status]
            }
          >
            <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
          </Tooltip>
        );
      },
    },
    {
      title: "Config",
      key: "config",
      width: 150,
      render: (_: any, record: JobFile) => {
        // Get extraction method from extraction_metadata
        const extractionMethod =
          (record.extraction_metadata as any)?.extraction_method || "unknown";

        // Get model from processing_metadata
        const model = (record.processing_metadata as any)?.model || "unknown";

        // If both are unknown, show dash
        if (extractionMethod === "unknown" && model === "unknown") {
          return (
            <Text type="secondary" style={{ whiteSpace: "nowrap" }}>
              -
            </Text>
          );
        }

        // Simple display: lowercase extraction, model name
        const extractionDisplay = extractionMethod.toLowerCase();
        const modelDisplay = model !== "unknown" ? model : "-";

        return (
          <Text
            type="secondary"
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {extractionDisplay}, {modelDisplay}
          </Text>
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
          <div
            className="flex items-center space-x-0.5"
            style={{ whiteSpace: "nowrap" }}
          >
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
      sorter: (a: JobFile, b: JobFile) => {
        const aConstraints = checkFileConstraints(a);
        const bConstraints = checkFileConstraints(b);
        const aFailedCount = aConstraints.filter((c) => !c.passed).length;
        const bFailedCount = bConstraints.filter((c) => !c.passed).length;
        return aFailedCount - bFailedCount;
      },
      render: (_: any, record: JobFile) => {
        // Only check for permit number mismatch using client-side logic
        const permitCheck = checkPermitNumberMatch(record);
        const hasApiNumber = record.result?.api_number;
        const correctElevation =
          record.result?.elevation && record.result?.elevation > 100;
        const correctFormationCount =
          record.result?.formations && record.result?.formations.length >= 10;
        const continuityCheck = checkFormationContinuity(
          record.result?.formations || []
        );

        // Show violation flag if there's a permit number mismatch

        if (
          record.processing_status === "completed" &&
          record.job_id === "5667fe82-63e1-47fa-a640-b182b5c5d034" &&
          record.result
        ) {
          return (
            <div className="flex items-center justify-center">
              {permitCheck.hasViolation && (
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
                  <div
                    className="flex items-center space-x-0.5"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <span style={{ flexShrink: 0 }}>
                      {getViolationSeverityIcon("warning")}
                    </span>
                    <Badge
                      count={1}
                      style={{
                        backgroundColor: getViolationSeverityColor("warning"),
                        minWidth: "14px",
                        height: "14px",
                        lineHeight: "14px",
                        flexShrink: 0,
                      }}
                    />
                  </div>
                </Tooltip>
              )}
              {!hasApiNumber && (
                <Tooltip title="API number not found">
                  <div
                    className="flex items-center justify-center"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <ExclamationCircleOutlined
                      style={{ color: "#ff4d4f", flexShrink: 0 }}
                    />
                  </div>
                </Tooltip>
              )}
              {!correctElevation && (
                <Tooltip
                  title={
                    <div>
                      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                        Check Elevation:
                      </div>
                      <div>Elevation: {record.result?.elevation || "N/A"}</div>
                    </div>
                  }
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <ExclamationCircleOutlined
                      style={{ color: "#ff4d4f", flexShrink: 0 }}
                    />
                  </div>
                </Tooltip>
              )}
              {!correctFormationCount && (
                <Tooltip
                  title={
                    <div>
                      <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                        Check Formation Count:
                      </div>
                      <div>
                        Formation count:{" "}
                        {record.result?.formations?.length || "N/A"}
                      </div>
                    </div>
                  }
                >
                  <div
                    className="flex items-center justify-center"
                    style={{ whiteSpace: "nowrap" }}
                  >
                    <ExclamationCircleOutlined
                      style={{ color: "#ff4d4f", flexShrink: 0 }}
                    />
                  </div>
                </Tooltip>
              )}
              {!continuityCheck.isContinuous &&
                continuityCheck.gaps.length > 0 && (
                  <Tooltip
                    title={
                      <div>
                        <div
                          style={{ fontWeight: "bold", marginBottom: "4px" }}
                        >
                          Formation Continuity Issue:
                        </div>
                        <div>
                          {continuityCheck.gaps
                            .map(
                              (g) =>
                                `Gap of ${g.gap} between ${g.from} and ${g.to}`
                            )
                            .join(", ")}
                        </div>
                      </div>
                    }
                  >
                    <div
                      className="flex items-center justify-center"
                      style={{ whiteSpace: "nowrap" }}
                    >
                      <ExclamationCircleOutlined
                        style={{ color: "#d97706", flexShrink: 0 }}
                      />
                    </div>
                  </Tooltip>
                )}
            </div>
          );
        }

        // Show checkmark for files with no permit number violations
        if (
          record.processing_status === "completed" &&
          record.result &&
          record.job_id === "5667fe82-63e1-47fa-a640-b182b5c5d034" &&
          correctElevation &&
          hasApiNumber &&
          correctFormationCount &&
          continuityCheck.isContinuous
        ) {
          return (
            <Tooltip title="All constraints met">
              <div
                className="flex items-center justify-center"
                style={{ whiteSpace: "nowrap" }}
              >
                <CheckCircleOutlined
                  style={{ color: "#52c41a", flexShrink: 0 }}
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
      fixed: "right" as const,
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
          menuItems.push({
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
          });

          // Add to Preview - only for admins
          if (isAdmin) {
            menuItems.push({
              key: "preview",
              label: (
                <a onClick={() => onAddToPreview(record.id)}>Add to Preview</a>
              ),
            });
          }

          // {
          //   key: "edit",
          //   label: <a onClick={() => onEditResults(record)}>Edit Results</a>,
          // }

          // Mark as Reviewed - for reviewers (non-admins) and admins
          if (record.processing_status === "completed" && record.result) {
            const isReviewed =
              record.review_status === "reviewed" ||
              record.review_status === "approved";
            const isUpdating = reviewingFileId === record.id;
            menuItems.push({
              key: "mark_reviewed",
              label: (
                <a
                  onClick={() => {
                    if (!isUpdating) {
                      handleUpdateReviewStatus(
                        record.id,
                        isReviewed ? "pending" : "reviewed"
                      );
                    }
                  }}
                  style={{
                    cursor: isUpdating ? "not-allowed" : "pointer",
                    opacity: isUpdating ? 0.5 : 1,
                  }}
                >
                  {isUpdating
                    ? "Updating..."
                    : isReviewed
                    ? "Mark as Pending"
                    : "Mark as Reviewed"}
                </a>
              ),
            });
          }
        }

        // Add "View Details" option for all files
        menuItems.push({
          key: "details",
          label: (
            <a onClick={() => handleOpenFileDetails(record)}>📄 File Info</a>
          ),
        });

        // Add delete option for all files (except those currently processing) - only for admins
        if (
          isAdmin &&
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
            <MoreOutlined style={{ cursor: "pointer", flexShrink: 0 }} />
          </Dropdown>
        );
      },
    },
  ];

  // Create header component (summary or bulk actions)
  const renderTableHeader = () => {
    // Show bulk actions when selections are made
    if (selectedRowKeys.length > 0) {
      return (
        <div className={styles.bulkActionsHeader}>
          <div className="flex items-center space-x-2">
            <Text strong style={{ fontSize: "12px" }}>
              {selectedRowKeys.length} selected
            </Text>
          </div>
          <div className="flex items-center space-x-1">
            <Button
              size="small"
              type="primary"
              style={{ backgroundColor: "#1890ff", borderColor: "#1890ff" }}
              onClick={() => handleBulkReview("reviewed")}
              loading={bulkReviewLoading}
            >
              ✓ Mark as Reviewed
            </Button>
            {isAdmin && (
              <Button
                size="small"
                type="primary"
                style={{ backgroundColor: "#52c41a", borderColor: "#52c41a" }}
                onClick={() => {
                  onBulkAddToPreview(selectedRowKeys as string[]);
                  setSelectedRowKeys([]);
                }}
              >
                Add to Preview
              </Button>
            )}
            {isAdmin && (
              <Button
                size="small"
                style={{
                  backgroundColor: "#722ed1",
                  borderColor: "#722ed1",
                  color: "white",
                }}
                onClick={handleBulkVerify}
                loading={bulkVerifyLoading}
              >
                ✓ Verify
              </Button>
            )}
            {isAdmin && (
              <Button
                size="small"
                type="primary"
                style={{ backgroundColor: "#fa8c16", borderColor: "#fa8c16" }}
                onClick={handleBulkReviewAndVerify}
                loading={bulkReviewAndVerifyLoading}
              >
                ✓✓ Review & Verify
              </Button>
            )}
            {isAdmin && (
              <Button
                size="small"
                type="primary"
                onClick={handleBulkReprocess}
                loading={reprocessLoading}
              >
                🔄 Reprocess
              </Button>
            )}
            {isAdmin && (
              <Button size="small" danger onClick={handleBulkDelete}>
                🗑️ Delete
              </Button>
            )}
            <Button size="small" onClick={() => setSelectedRowKeys([])}>
              Clear
            </Button>
          </div>
        </div>
      );
    }

    // Show summary header by default
    return (
      <div className={styles.summaryHeader}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px" }}>
          {/* Live Status Indicator */}
          {jobStatus && getJobStatusColor && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <StatusIndicator
                status={
                  getJobStatusColor(jobStatus) as
                    | "success"
                    | "warning"
                    | "error"
                    | "info"
                    | "neutral"
                }
              >
                {jobStatus}
              </StatusIndicator>
              <div
                style={{ display: "flex", alignItems: "center", gap: "4px" }}
              >
                <div
                  style={{
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    backgroundColor: isConnected ? "#52c41a" : "#ff4d4f",
                  }}
                />
                <span style={{ fontSize: "11px", color: "#8c8c8c" }}>
                  {isConnected ? "Live" : "Offline"}
                </span>
              </div>
            </div>
          )}
          <div className="text-center flex space-x-2 items-center">
            <div className="text-sm font-semibold text-green-600">
              {stats.processed}
            </div>
            <div className="text-xs text-gray-500">Processed</div>
          </div>
          <div className="text-center flex space-x-2 items-center">
            <div className="text-sm font-semibold text-blue-600">
              {stats.processing}
            </div>
            <div className="text-xs text-gray-500">Processing</div>
          </div>
          <div className="text-center flex space-x-2 items-center">
            <div className="text-sm font-semibold text-gray-600">
              {stats.pending}
            </div>
            <div className="text-xs text-gray-500">Pending</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onGoLive && (
            <Button
              size="small"
              onClick={onGoLive}
              disabled={isGoingLive}
              color={isConnected ? "green" : "orange"}
              icon={
                isGoingLive ? (
                  <Loader className="w-3 h-3 animate-spin" />
                ) : (
                  <SignalIcon className="text-green-600 w-4 h-4" />
                )
              }
            >
              {isGoingLive ? "Going Live..." : "Go Live"}
            </Button>
          )}
          {onRefresh && (
            <Button
              size="small"
              onClick={onRefresh}
              disabled={isRefreshing}
              icon={
                <ReloadOutlined
                  className={isRefreshing ? "animate-spin" : ""}
                />
              }
            >
              Refresh
            </Button>
          )}
          {onAddFiles && isAdmin && (
            <Button
              size="small"
              type="primary"
              onClick={onAddFiles}
              icon={<PlusOutlined />}
            >
              Add Files
            </Button>
          )}
          {(onEditConfig || onShowSchema) && (
            <Dropdown
              menu={{
                items: [
                  ...(onEditConfig && isAdmin
                    ? [
                        {
                          key: "config",
                          label: "Edit Configuration",
                          icon: <SettingOutlined />,
                          onClick: onEditConfig,
                        },
                      ]
                    : []),
                  ...(onShowSchema
                    ? [
                        {
                          key: "schema",
                          label: "Show Schema",
                          icon: <FileTextOutlined />,
                          onClick: onShowSchema,
                        },
                      ]
                    : []),
                ],
              }}
              trigger={["click"]}
            >
              <Button size="small" icon={<EllipsisOutlined />} />
            </Dropdown>
          )}
        </div>
      </div>
    );
  };

  const createTableComponent = () => (
    <Table<JobFile>
      title={renderTableHeader}
      columns={columns}
      dataSource={data}
      rowKey="id"
      rowSelection={rowSelection}
      pagination={{
        ...tableParams.pagination,
        showQuickJumper: true,
        showTotal: (total, range) =>
          `${range[0]}-${range[1]} of ${total} items`,
      }}
      loading={loading}
      onChange={handleTableChange}
      size="small"
      scroll={{
        x: "max-content",
        // Calculate scroll height: 100vh - (top bar 64px + table title header 40px + pagination 40px)
        y: "calc(100vh - 64px - 40px - 110px)",
      }}
      className={styles.fileTable}
    />
  );

  // Calculate file stats from summary
  const getFileStats = () => {
    if (!fileSummary) return { processed: 0, processing: 0, pending: 0 };
    return {
      processed: fileSummary.processing_completed,
      processing: fileSummary.processing ?? 0,
      pending: fileSummary.pending ?? 0,
    };
  };

  const stats = getFileStats();

  return (
    <div className="h-full flex flex-col">
      {/* Files Table - fills entire space, header and pagination handled by Ant Design */}
      <div className="border-0 flex-1 h-full">{createTableComponent()}</div>

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
              accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp"
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

      {/* Bulk Verify Modal */}
      <Modal
        title="Verify Files"
        open={bulkVerifyModalVisible}
        onCancel={() => setBulkVerifyModalVisible(false)}
        footer={[
          <Button key="cancel" onClick={() => setBulkVerifyModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="unverify"
            onClick={() => confirmBulkVerify(false)}
            loading={bulkVerifyLoading}
          >
            Unverify {selectedRowKeys.length} Files
          </Button>,
          <Button
            key="verify"
            type="primary"
            loading={bulkVerifyLoading}
            onClick={() => confirmBulkVerify(true)}
          >
            Verify {selectedRowKeys.length} Files
          </Button>,
        ]}
      >
        <div className="space-y-4">
          <div className="flex items-center space-x-3">
            <div className="text-purple-500 text-2xl">✓</div>
            <div>
              <p className="text-lg font-medium text-gray-900">
                Verify {selectedRowKeys.length} selected file(s)?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                This will mark all selected files as verified (or unverified).
                Only admins can perform this action.
              </p>
            </div>
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
        title={singleFileReprocessMode ? "Reprocess File" : "Reprocess Files"}
        open={reprocessModalVisible}
        onCancel={() => {
          setReprocessModalVisible(false);
          setShowProcessingConfigInReprocess(false);
          setSingleFileReprocessMode(false);
          setReprocessingFileId(null);
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
              setSingleFileReprocessMode(false);
              setReprocessingFileId(null);
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
            Reprocess{" "}
            {singleFileReprocessMode
              ? "File"
              : `${selectedRowKeys.length} Files`}
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
                Reprocess{" "}
                {singleFileReprocessMode
                  ? "this file"
                  : `${selectedRowKeys.length} files`}
                ?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Choose what operations to perform on{" "}
                {singleFileReprocessMode ? "this file" : "the selected files"}.
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
            <div className="flex items-center justify-between w-full">
              <div className="flex items-center space-x-2">
                <FilePdfOutlined className="text-blue-500" />
                <span className="font-medium">{selectedFile.filename}</span>
              </div>
              <ConstraintErrorIcon file={selectedFile} />
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
          <div className="flex items-center space-x-2">
            {selectedFile && (
              <>
                <Button
                  type={
                    selectedFile.review_status === "reviewed"
                      ? "default"
                      : "primary"
                  }
                  icon={
                    reviewingFileId === selectedFile.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : selectedFile.review_status === "reviewed" ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <FileTextOutlined />
                    )
                  }
                  onClick={() =>
                    handleUpdateReviewStatus(
                      selectedFile.id,
                      selectedFile.review_status === "reviewed"
                        ? "pending"
                        : "reviewed"
                    )
                  }
                  disabled={reviewingFileId === selectedFile.id}
                  loading={reviewingFileId === selectedFile.id}
                  style={
                    selectedFile.review_status === "reviewed"
                      ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                      : {}
                  }
                >
                  {reviewingFileId === selectedFile.id
                    ? "Updating..."
                    : selectedFile.review_status === "reviewed"
                    ? "Reviewed"
                    : "Mark as Reviewed"}
                </Button>
                {isAdmin && (
                  <Button
                    type={selectedFile.admin_verified ? "default" : "primary"}
                    icon={
                      verifyingFileId === selectedFile.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : selectedFile.admin_verified ? (
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                      ) : (
                        <CheckCircleOutlined />
                      )
                    }
                    onClick={() =>
                      handleVerifyFile(
                        selectedFile.id,
                        !selectedFile.admin_verified
                      )
                    }
                    disabled={
                      selectedFile.admin_verified ||
                      verifyingFileId === selectedFile.id
                    }
                    loading={verifyingFileId === selectedFile.id}
                    style={
                      selectedFile.admin_verified
                        ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                        : {}
                    }
                  >
                    {verifyingFileId === selectedFile.id
                      ? "Verifying..."
                      : selectedFile.admin_verified
                      ? "Verified"
                      : "Verify"}
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    type="primary"
                    style={{
                      backgroundColor: "#fa8c16",
                      borderColor: "#fa8c16",
                    }}
                    icon={
                      reviewingFileId === selectedFile.id ||
                      verifyingFileId === selectedFile.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircleOutlined />
                      )
                    }
                    onClick={() => handleReviewAndVerifyFile(selectedFile.id)}
                    disabled={
                      reviewingFileId === selectedFile.id ||
                      verifyingFileId === selectedFile.id
                    }
                    loading={
                      reviewingFileId === selectedFile.id ||
                      verifyingFileId === selectedFile.id
                    }
                  >
                    {reviewingFileId === selectedFile.id ||
                    verifyingFileId === selectedFile.id
                      ? "Updating..."
                      : "Review & Verify"}
                  </Button>
                )}
                <Button
                  type="default"
                  icon={
                    reprocessingFileId === selectedFile.id ||
                    selectedFile.extraction_status === "processing" ||
                    selectedFile.processing_status === "processing" ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <ReloadOutlined />
                    )
                  }
                  onClick={() => handleSingleFileReprocess(selectedFile.id)}
                  disabled={
                    reprocessingFileId === selectedFile.id ||
                    selectedFile.extraction_status === "processing" ||
                    selectedFile.processing_status === "processing"
                  }
                  loading={
                    reprocessingFileId === selectedFile.id ||
                    selectedFile.extraction_status === "processing" ||
                    selectedFile.processing_status === "processing"
                  }
                >
                  {reprocessingFileId === selectedFile.id ||
                  selectedFile.extraction_status === "processing" ||
                  selectedFile.processing_status === "processing"
                    ? "Processing..."
                    : "Reprocess"}
                </Button>
              </>
            )}
            <Button type="text" onClick={handleCloseDrawer}>
              Close
            </Button>
          </div>
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
                pages={
                  Array.isArray(selectedFile.pages)
                    ? selectedFile.pages
                    : undefined
                }
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
                comments={drawerComments}
                onAddComment={handleDrawerAddComment}
                fileId={selectedFile.id}
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
          <div className="flex flex-col h-full overflow-hidden border border-gray-200">
            {/* Navigation Header */}
            <div className="flex items-center justify-between p-2 border-b border-gray-200 flex-shrink-0">
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
              <div className="flex items-center space-x-2">
                <Button
                  type={
                    currentFullscreenFile.review_status === "reviewed"
                      ? "default"
                      : "primary"
                  }
                  icon={
                    reviewingFileId === currentFullscreenFile.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : currentFullscreenFile.review_status === "reviewed" ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <FileTextOutlined />
                    )
                  }
                  onClick={() =>
                    handleUpdateReviewStatus(
                      currentFullscreenFile.id,
                      currentFullscreenFile.review_status === "reviewed"
                        ? "pending"
                        : "reviewed"
                    )
                  }
                  disabled={reviewingFileId === currentFullscreenFile.id}
                  loading={reviewingFileId === currentFullscreenFile.id}
                  style={
                    currentFullscreenFile.review_status === "reviewed"
                      ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                      : {}
                  }
                >
                  {reviewingFileId === currentFullscreenFile.id
                    ? "Updating..."
                    : currentFullscreenFile.review_status === "reviewed"
                    ? "Reviewed"
                    : "Mark as Reviewed"}
                </Button>
                {isAdmin && (
                  <Button
                    type={
                      currentFullscreenFile.admin_verified
                        ? "default"
                        : "primary"
                    }
                    icon={
                      verifyingFileId === currentFullscreenFile.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : currentFullscreenFile.admin_verified ? (
                        <CheckCircleOutlined style={{ color: "#52c41a" }} />
                      ) : (
                        <CheckCircleOutlined />
                      )
                    }
                    onClick={() =>
                      handleVerifyFile(
                        currentFullscreenFile.id,
                        !currentFullscreenFile.admin_verified
                      )
                    }
                    disabled={
                      currentFullscreenFile.admin_verified ||
                      verifyingFileId === currentFullscreenFile.id
                    }
                    loading={verifyingFileId === currentFullscreenFile.id}
                    style={
                      currentFullscreenFile.admin_verified
                        ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                        : {}
                    }
                  >
                    {verifyingFileId === currentFullscreenFile.id
                      ? "Verifying..."
                      : currentFullscreenFile.admin_verified
                      ? "Verified"
                      : "Verify"}
                  </Button>
                )}
                {isAdmin && (
                  <Button
                    type="primary"
                    style={{
                      backgroundColor: "#fa8c16",
                      borderColor: "#fa8c16",
                    }}
                    icon={
                      reviewingFileId === currentFullscreenFile.id ||
                      verifyingFileId === currentFullscreenFile.id ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <CheckCircleOutlined />
                      )
                    }
                    onClick={() =>
                      handleReviewAndVerifyFile(currentFullscreenFile.id)
                    }
                    disabled={
                      reviewingFileId === currentFullscreenFile.id ||
                      verifyingFileId === currentFullscreenFile.id
                    }
                    loading={
                      reviewingFileId === currentFullscreenFile.id ||
                      verifyingFileId === currentFullscreenFile.id
                    }
                  >
                    {reviewingFileId === currentFullscreenFile.id ||
                    verifyingFileId === currentFullscreenFile.id
                      ? "Updating..."
                      : "Review & Verify"}
                  </Button>
                )}
                <Button
                  type="default"
                  icon={
                    reprocessingFileId === currentFullscreenFile.id ||
                    currentFullscreenFile.extraction_status === "processing" ||
                    currentFullscreenFile.processing_status === "processing" ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <ReloadOutlined />
                    )
                  }
                  onClick={() =>
                    handleSingleFileReprocess(currentFullscreenFile.id)
                  }
                  disabled={
                    reprocessingFileId === currentFullscreenFile.id ||
                    currentFullscreenFile.extraction_status === "processing" ||
                    currentFullscreenFile.processing_status === "processing"
                  }
                  loading={
                    reprocessingFileId === currentFullscreenFile.id ||
                    currentFullscreenFile.extraction_status === "processing" ||
                    currentFullscreenFile.processing_status === "processing"
                  }
                >
                  {reprocessingFileId === currentFullscreenFile.id ||
                  currentFullscreenFile.extraction_status === "processing" ||
                  currentFullscreenFile.processing_status === "processing"
                    ? "Processing..."
                    : "Reprocess"}
                </Button>
                <Button
                  type="text"
                  icon={<ShrinkOutlined />}
                  onClick={handleCloseFullscreen}
                >
                  Close
                </Button>
              </div>
            </div>

            {/* Content Area - Two Pane Layout */}
            <div className="flex flex-1 overflow-hidden min-h-0 fullscreen-modal-content">
              {/* Left Pane - PDF Viewer */}
              <div
                ref={leftPaneRef}
                className="bg-gray-100 flex flex-col min-w-0 overflow-hidden"
                style={{ width: `${splitPosition}%`, minWidth: "200px" }}
              >
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

              {/* Resizable Divider */}
              <div
                className="w-1 bg-gray-300 hover:bg-blue-500 cursor-col-resize flex-shrink-0 relative group"
                onMouseDown={handleMouseDown}
                style={{ minWidth: "4px" }}
              >
                <div className="absolute inset-y-0 left-1/2 -translate-x-1/2 w-1 group-hover:bg-blue-500 transition-colors" />
              </div>

              {/* Right Pane - Results Viewer */}
              <div
                ref={rightPaneRef}
                className="bg-white flex flex-col min-w-0 overflow-hidden"
                style={{ width: `${100 - splitPosition}%`, minWidth: "200px" }}
              >
                <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                  <Text strong className="text-sm">
                    Extracted Results
                  </Text>
                  <ConstraintErrorIcon file={currentFullscreenFile} />
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
                    <TabbedDataViewer
                      data={currentFullscreenFile.result}
                      filename={currentFullscreenFile.filename}
                      schema={jobSchema}
                      editable={true}
                      markdown={currentFullscreenFile.markdown}
                      actual_result={currentFullscreenFile.actual_result}
                      pages={
                        Array.isArray(currentFullscreenFile.pages)
                          ? currentFullscreenFile.pages
                          : undefined
                      }
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
                          console.error("Error updating file results:", error);
                        }
                      }}
                      comments={fullscreenComments}
                      onAddComment={handleFullscreenAddComment}
                      fileId={currentFullscreenFile.id}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* File Details Drawer */}
      <Drawer
        title={
          selectedFileForDetails ? (
            <div className="flex items-center space-x-2">
              <InfoCircleOutlined className="text-blue-500" />
              <span className="font-medium">
                File Details: {selectedFileForDetails.filename}
              </span>
            </div>
          ) : (
            "File Details"
          )
        }
        placement="right"
        size="large"
        onClose={handleCloseFileDetails}
        open={fileDetailsDrawerVisible}
        width={600}
      >
        {selectedFileForDetails && (
          <div className="space-y-6">
            {/* File Overview */}
            <div>
              <h3 className="text-lg font-semibold mb-3">Overview</h3>
              <Descriptions column={1} bordered size="small">
                <Descriptions.Item label="Filename">
                  {selectedFileForDetails.filename}
                </Descriptions.Item>
                <Descriptions.Item label="File ID">
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs">
                      {selectedFileForDetails.id}
                    </span>
                    <Button
                      type="text"
                      size="small"
                      icon={<CopyOutlined />}
                      onClick={() => copyToClipboard(selectedFileForDetails.id)}
                    />
                  </div>
                </Descriptions.Item>
                <Descriptions.Item label="File Size">
                  {formatFileSize(selectedFileForDetails.size)}
                </Descriptions.Item>
                <Descriptions.Item label="File Hash">
                  {selectedFileForDetails.file_hash ? (
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs">
                        {selectedFileForDetails.file_hash}
                      </span>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copyToClipboard(
                            selectedFileForDetails.file_hash || ""
                          )
                        }
                      />
                    </div>
                  ) : (
                    <Text type="secondary">-</Text>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Storage Type">
                  <Tag>{selectedFileForDetails.storage_type || "s3"}</Tag>
                </Descriptions.Item>
                {selectedFileForDetails.s3_key && (
                  <Descriptions.Item label="S3 Key">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs break-all">
                        {selectedFileForDetails.s3_key}
                      </span>
                      <Button
                        type="text"
                        size="small"
                        icon={<CopyOutlined />}
                        onClick={() =>
                          copyToClipboard(selectedFileForDetails.s3_key || "")
                        }
                      />
                    </div>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </div>

            {/* Page Selection Information */}
            {selectedFileForDetails.selected_pages &&
              Array.isArray(selectedFileForDetails.selected_pages) &&
              selectedFileForDetails.selected_pages.length > 0 && (
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
                          {selectedFileForDetails.selected_pages.length} of{" "}
                          {selectedFilePageCount || "?"} pages
                        </Tag>
                      </div>
                    </Descriptions.Item>
                    <Descriptions.Item label="Selected Page Numbers">
                      <div className="flex flex-wrap gap-1">
                        {selectedFileForDetails.selected_pages
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
                  {getUploadStatusIcon(selectedFileForDetails.upload_status)}
                  <span className="ml-2">
                    {selectedFileForDetails.upload_status ? (
                      <Tag
                        color={
                          selectedFileForDetails.upload_status === "success"
                            ? "green"
                            : selectedFileForDetails.upload_status === "failed"
                            ? "red"
                            : "orange"
                        }
                      >
                        {selectedFileForDetails.upload_status}
                      </Tag>
                    ) : (
                      <Tag>pending</Tag>
                    )}
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Extraction Status">
                  {getStatusIcon(selectedFileForDetails.extraction_status)}
                  <span className="ml-2">
                    <Tag
                      color={
                        selectedFileForDetails.extraction_status === "completed"
                          ? "green"
                          : selectedFileForDetails.extraction_status ===
                            "failed"
                          ? "red"
                          : selectedFileForDetails.extraction_status ===
                            "processing"
                          ? "blue"
                          : "default"
                      }
                    >
                      {selectedFileForDetails.extraction_status}
                    </Tag>
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Processing Status">
                  {getStatusIcon(selectedFileForDetails.processing_status)}
                  <span className="ml-2">
                    <Tag
                      color={
                        selectedFileForDetails.processing_status === "completed"
                          ? "green"
                          : selectedFileForDetails.processing_status ===
                            "failed"
                          ? "red"
                          : selectedFileForDetails.processing_status ===
                            "processing"
                          ? "blue"
                          : "default"
                      }
                    >
                      {selectedFileForDetails.processing_status}
                    </Tag>
                  </span>
                </Descriptions.Item>
                <Descriptions.Item label="Verification">
                  <Space>
                    {selectedFileForDetails.admin_verified && (
                      <Tag color="green">Admin Verified</Tag>
                    )}
                    {selectedFileForDetails.customer_verified && (
                      <Tag color="blue">Customer Verified</Tag>
                    )}
                    {!selectedFileForDetails.admin_verified &&
                      !selectedFileForDetails.customer_verified && (
                        <Text type="secondary">Not verified</Text>
                      )}
                  </Space>
                </Descriptions.Item>
                {selectedFileForDetails.retry_count !== undefined &&
                  selectedFileForDetails.retry_count > 0 && (
                    <Descriptions.Item label="Retry Count">
                      <Tag color="orange">
                        {selectedFileForDetails.retry_count}
                      </Tag>
                    </Descriptions.Item>
                  )}
              </Descriptions>
            </div>

            {/* Processing Configuration */}
            {(() => {
              const extractionMethod = (
                selectedFileForDetails.extraction_metadata as any
              )?.extraction_method;
              const processingMethod = (
                selectedFileForDetails.processing_metadata as any
              )?.processing_method;
              const model = (selectedFileForDetails.processing_metadata as any)
                ?.model;

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
                  {moment(selectedFileForDetails.created_at).format(
                    "MMMM DD, YYYY hh:mm:ss A"
                  )}
                  <div className="text-xs text-gray-500 mt-1">
                    ({moment(selectedFileForDetails.created_at).fromNow()})
                  </div>
                </Descriptions.Item>
                {selectedFileForDetails.processed_at && (
                  <Descriptions.Item label="Processed At">
                    {moment(selectedFileForDetails.processed_at).format(
                      "MMMM DD, YYYY hh:mm:ss A"
                    )}
                    <div className="text-xs text-gray-500 mt-1">
                      ({moment(selectedFileForDetails.processed_at).fromNow()})
                    </div>
                  </Descriptions.Item>
                )}
                {selectedFileForDetails.processed_at && (
                  <Descriptions.Item label="Total Time Elapsed">
                    <Tag color="geekblue">
                      {moment
                        .duration(
                          moment(selectedFileForDetails.processed_at).diff(
                            moment(selectedFileForDetails.created_at)
                          )
                        )
                        .humanize()}
                    </Tag>
                    <span className="ml-2 text-gray-500 text-xs">
                      (
                      {formatDuration(
                        moment(selectedFileForDetails.processed_at).diff(
                          moment(selectedFileForDetails.created_at),
                          "seconds"
                        )
                      )}
                      )
                    </span>
                  </Descriptions.Item>
                )}
                {selectedFileForDetails.extraction_time_seconds !== undefined &&
                  selectedFileForDetails.extraction_time_seconds !== null && (
                    <Descriptions.Item label="Extraction Duration">
                      <Tag color="blue">
                        {formatDuration(
                          Number(selectedFileForDetails.extraction_time_seconds)
                        )}
                      </Tag>
                      <span className="ml-2 text-gray-500 text-xs">
                        (
                        {Number(
                          selectedFileForDetails.extraction_time_seconds
                        ).toFixed(2)}
                        s)
                      </span>
                    </Descriptions.Item>
                  )}
                {selectedFileForDetails.ai_processing_time_seconds !==
                  undefined &&
                  selectedFileForDetails.ai_processing_time_seconds !==
                    null && (
                    <Descriptions.Item label="Processing Duration">
                      <Tag color="purple">
                        {formatDuration(
                          Number(
                            selectedFileForDetails.ai_processing_time_seconds
                          )
                        )}
                      </Tag>
                      <span className="ml-2 text-gray-500 text-xs">
                        (
                        {Number(
                          selectedFileForDetails.ai_processing_time_seconds
                        ).toFixed(2)}
                        s)
                      </span>
                    </Descriptions.Item>
                  )}
                {selectedFileForDetails.extraction_time_seconds !== undefined &&
                  selectedFileForDetails.extraction_time_seconds !== null &&
                  selectedFileForDetails.ai_processing_time_seconds !==
                    undefined &&
                  selectedFileForDetails.ai_processing_time_seconds !==
                    null && (
                    <Descriptions.Item label="Combined Processing Time">
                      <Tag color="green">
                        {formatDuration(
                          Number(
                            selectedFileForDetails.extraction_time_seconds
                          ) +
                            Number(
                              selectedFileForDetails.ai_processing_time_seconds
                            )
                        )}
                      </Tag>
                      <span className="ml-2 text-gray-500 text-xs">
                        (
                        {(
                          Number(
                            selectedFileForDetails.extraction_time_seconds
                          ) +
                          Number(
                            selectedFileForDetails.ai_processing_time_seconds
                          )
                        ).toFixed(2)}
                        s)
                      </span>
                    </Descriptions.Item>
                  )}
              </Descriptions>
            </div>

            {/* Errors */}
            {(selectedFileForDetails.upload_error ||
              selectedFileForDetails.extraction_error ||
              selectedFileForDetails.processing_error) && (
              <div>
                <h3 className="text-lg font-semibold mb-3 text-red-600">
                  Errors
                </h3>
                <Collapse>
                  {selectedFileForDetails.upload_error && (
                    <Collapse.Panel header="Upload Error" key="upload">
                      <Text
                        type="danger"
                        className="font-mono text-xs whitespace-pre-wrap"
                      >
                        {selectedFileForDetails.upload_error}
                      </Text>
                    </Collapse.Panel>
                  )}
                  {selectedFileForDetails.extraction_error && (
                    <Collapse.Panel header="Extraction Error" key="extraction">
                      <Text
                        type="danger"
                        className="font-mono text-xs whitespace-pre-wrap"
                      >
                        {selectedFileForDetails.extraction_error}
                      </Text>
                    </Collapse.Panel>
                  )}
                  {selectedFileForDetails.processing_error && (
                    <Collapse.Panel header="Processing Error" key="processing">
                      <Text
                        type="danger"
                        className="font-mono text-xs whitespace-pre-wrap"
                      >
                        {selectedFileForDetails.processing_error}
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
                {selectedFileForDetails.extracted_text &&
                  typeof selectedFileForDetails.extracted_text === "string" && (
                    <Descriptions.Item label="Extracted Text Length">
                      {selectedFileForDetails.extracted_text.length.toLocaleString()}{" "}
                      characters
                    </Descriptions.Item>
                  )}
                {selectedFileForDetails.extracted_tables &&
                  Array.isArray(selectedFileForDetails.extracted_tables) && (
                    <Descriptions.Item label="Extracted Tables">
                      {selectedFileForDetails.extracted_tables.length}
                    </Descriptions.Item>
                  )}
                <Descriptions.Item label="Has Result">
                  <Tag
                    color={selectedFileForDetails.result ? "green" : "default"}
                  >
                    {selectedFileForDetails.result ? "Yes" : "No"}
                  </Tag>
                </Descriptions.Item>
                <Descriptions.Item label="Has Actual Result">
                  <Tag
                    color={
                      selectedFileForDetails.actual_result ? "green" : "default"
                    }
                  >
                    {selectedFileForDetails.actual_result ? "Yes" : "No"}
                  </Tag>
                </Descriptions.Item>
              </Descriptions>
            </div>

            {/* Data Extraction Page Detection (Comprehensive) */}
            {(() => {
              console.log({ selectedFileForDetails });
              const metadata =
                selectedFileForDetails.processing_metadata as any;
              // Use comprehensive detection (pre-processing) if available, fallback to old formation detection for backward compatibility
              const dataExtractionDetection =
                metadata?.data_extraction_page_detection_pre ||
                metadata?.formation_page_detection;
              console.log({ dataExtractionDetection, selectedFileForDetails });

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
                      <Collapse>
                        <Collapse.Panel
                          header={`View Detailed Page Scores (${scoring.scoredPages.length} pages)`}
                          key="scoring"
                        >
                          <div className="max-h-96 overflow-y-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                  <th className="px-2 py-1 text-left border">
                                    Page
                                  </th>
                                  <th className="px-2 py-1 text-left border">
                                    {isComprehensive ? "Total Score" : "Score"}
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
                                          {page.formationScore !== undefined ? (
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
                                      {page.text_length?.toLocaleString() || 0}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </Collapse.Panel>
                      </Collapse>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Constraints */}
            <ConstraintList file={selectedFileForDetails} />
          </div>
        )}
      </Drawer>
    </div>
  );
};

export default FileTable;
