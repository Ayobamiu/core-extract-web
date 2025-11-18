"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Typography,
  Button,
  Spin,
  Empty,
  message,
  Modal,
  Checkbox,
  Space,
} from "antd";
import {
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import { apiClient, JobFile, ProcessingConfig } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import ConstraintErrorIcon from "@/components/ui/ConstraintErrorIcon";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions, isReviewer, canEdit } from "@/utils/roleUtils";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { Loader } from "lucide-react";

const { Text } = Typography;

export default function FilePage() {
  const params = useParams();
  const fileId = params?.id as string;
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);
  const canEditFile = canEdit(user);

  const [file, setFile] = useState<JobFile | null>(null);
  console.log({ fileId, file });
  const [jobSchema, setJobSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfUrlLoading, setPdfUrlLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isReviewing, setIsReviewing] = useState(false);
  const [isReprocessing, setIsReprocessing] = useState(false);
  const [reprocessModalVisible, setReprocessModalVisible] = useState(false);
  const [reprocessOptions, setReprocessOptions] = useState({
    reExtract: true,
    reProcess: true,
    forceExtraction: false,
    preview: false,
  });
  const [splitPosition, setSplitPosition] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const splitPositionRef = React.useRef(50);
  const leftPaneRef = React.useRef<HTMLDivElement>(null);
  const rightPaneRef = React.useRef<HTMLDivElement>(null);

  // Comments state
  const [comments, setComments] = useState<
    Array<{
      id: string;
      userId: string;
      userEmail: string;
      text: string;
      createdAt: string;
    }>
  >([]);

  const pageCountDisplay = React.useMemo(() => {
    if (!file) return null;
    if (
      typeof file.page_count === "number" &&
      Number.isFinite(file.page_count)
    ) {
      return file.page_count;
    }
    if (typeof file.pages === "number" && Number.isFinite(file.pages)) {
      return file.pages;
    }
    if (Array.isArray(file.pages)) {
      return file.pages.length;
    }
    return null;
  }, [file]);

  // Fetch file data
  useEffect(() => {
    const fetchFile = async () => {
      if (!fileId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.getFileResult(fileId);
        console.log("File result response:", response);

        if (response.status === "success") {
          const fileData =
            (response as any).file ||
            (response.data as any)?.file ||
            response.data;

          if (!fileData) {
            setError("File data not found in response");
            return;
          }

          setFile(fileData);
          setJobSchema(fileData.schema_data || fileData.job?.schema_data);

          // Load comments if available
          if (fileData.comments && Array.isArray(fileData.comments)) {
            setComments(fileData.comments);
          } else {
            // Fetch comments separately if not in file data
            try {
              const commentsResponse = await apiClient.getFileComments(fileId);
              if (commentsResponse.success && commentsResponse.data?.comments) {
                setComments(commentsResponse.data.comments);
              }
            } catch (err) {
              console.error("Failed to load comments:", err);
            }
          }
        } else if (response.status === "error") {
          setError(response.message || response.error || "File not found");
        } else {
          setError("File not found");
        }
      } catch (err: any) {
        setError(err.message || "Failed to load file");
      } finally {
        setLoading(false);
      }
    };

    fetchFile();
  }, [fileId]);

  // Fetch PDF URL
  useEffect(() => {
    const fetchPdfUrl = async () => {
      if (!file?.id) return;

      setPdfUrlLoading(true);
      try {
        const url = await apiClient.getFilePdfUrl(file.id);
        console.log({ url });
        setPdfUrl(url);
      } catch (err) {
        console.error("Failed to fetch PDF URL:", err);
      } finally {
        setPdfUrlLoading(false);
      }
    };

    fetchPdfUrl();
  }, [file?.id]);

  const handleVerifyFile = async (fileId: string, verified: boolean) => {
    setIsVerifying(true);
    try {
      await apiClient.verifyFile(fileId, verified, undefined);
      setFile((prev) => (prev ? { ...prev, admin_verified: verified } : null));
      message.success(`File ${verified ? "verified" : "unverified"}`);
    } catch (err: any) {
      message.error(err.message || "Failed to update verification status");
    } finally {
      setIsVerifying(false);
    }
  };

  const getReprocessConfig = (): ProcessingConfig | undefined => {
    if (!reprocessOptions.reExtract && !reprocessOptions.reProcess) {
      return undefined;
    }
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

  const handleReprocess = async () => {
    if (!file) return;

    setIsReprocessing(true);
    try {
      const processingConfig = getReprocessConfig();
      const response = await apiClient.reprocessFiles(
        [file.id],
        0,
        processingConfig
      );

      if (response.status === "success") {
        if (reprocessOptions.preview) {
          const previewCount = response.data?.preview?.length || 0;
          message.success(`Preview generated for ${previewCount} files`);
        } else {
          const queuedCount = response.data?.queuedFiles?.length || 0;
          message.success(`${queuedCount} file queued for reprocessing`);
        }
        setReprocessModalVisible(false);
        // Refresh file data
        const fileResponse = await apiClient.getFileResult(file.id);
        if (fileResponse.status === "success" && fileResponse.data) {
          setFile(fileResponse.data.file);
        }
      } else {
        message.error(response.message || "Failed to reprocess file");
      }
    } catch (error: any) {
      console.error("Error reprocessing file:", error);
      message.error(error.message || "Failed to reprocess file");
    } finally {
      setIsReprocessing(false);
    }
  };

  const handleUpdateReviewStatus = async (
    fileId: string,
    reviewStatus: "pending" | "in_review" | "reviewed" | "approved" | "rejected"
  ) => {
    setIsReviewing(true);
    try {
      const response = await apiClient.updateFileReviewStatus(
        fileId,
        reviewStatus
      );
      if (response.status === "success" && response.data) {
        setFile((prev) =>
          prev
            ? {
                ...prev,
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
            : null
        );
        message.success(`File marked as ${reviewStatus}`);
      } else {
        throw new Error(response.message || "Failed to update review status");
      }
    } catch (err: any) {
      message.error(err.message || "Failed to update review status");
    } finally {
      setIsReviewing(false);
    }
  };

  const handleUpdateResults = async (updatedData: any) => {
    if (!file) return;

    try {
      await apiClient.updateFileResults(file.id, updatedData);
      setFile((prev) => (prev ? { ...prev, result: updatedData } : null));
      message.success("Results updated successfully");
    } catch (err: any) {
      message.error(err.message || "Failed to update results");
      throw err;
    }
  };

  const handleAddComment = async (text: string) => {
    if (!file) return;

    try {
      const response = await apiClient.addFileComment(file.id, text);

      if (response.success && response.data?.comment) {
        setComments((prev) => [...prev, response.data!.comment]);
      } else {
        throw new Error(response.message || "Failed to add comment");
      }
    } catch (err: any) {
      throw err; // Re-throw to let TabbedDataViewer handle the error message
    }
  };

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
        const container = document.querySelector(".file-page-content");
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

  if (loading) {
    return (
      <ProtectedRoute>
        <SidebarLayout>
          <div className="flex items-center justify-center h-screen">
            <Spin size="large" />
          </div>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  if (error || !file) {
    return (
      <ProtectedRoute>
        <SidebarLayout>
          <div className="flex items-center justify-center h-screen">
            <Empty description={error || "File not found"} />
          </div>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarLayout
        headerContent={
          <div className="flex items-center space-x-2 text-sm text-gray-600">
            <FilePdfOutlined className="text-blue-500" />
            <span className="font-medium">{file.filename}</span>
          </div>
        }
        headerActions={
          <div className="flex items-center space-x-2">
            <Button
              type={file.review_status === "reviewed" ? "default" : "primary"}
              icon={
                isReviewing ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : file.review_status === "reviewed" ? (
                  <CheckCircleOutlined style={{ color: "#52c41a" }} />
                ) : (
                  <FileTextOutlined />
                )
              }
              onClick={() =>
                handleUpdateReviewStatus(
                  file.id,
                  file.review_status === "reviewed" ? "pending" : "reviewed"
                )
              }
              disabled={isReviewing}
              loading={isReviewing}
              style={
                file.review_status === "reviewed"
                  ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                  : {}
              }
            >
              {isReviewing
                ? "Updating..."
                : file.review_status === "reviewed"
                ? "Reviewed"
                : "Mark as Reviewed"}
            </Button>
            {isAdmin && (
              <Button
                type={file.admin_verified ? "default" : "primary"}
                icon={
                  isVerifying ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : file.admin_verified ? (
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  ) : (
                    <CheckCircleOutlined />
                  )
                }
                onClick={() => handleVerifyFile(file.id, !file.admin_verified)}
                disabled={file.admin_verified || isVerifying}
                loading={isVerifying}
                style={
                  file.admin_verified
                    ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                    : {}
                }
              >
                {isVerifying
                  ? "Verifying..."
                  : file.admin_verified
                  ? "Verified"
                  : "Verify"}
              </Button>
            )}
            <Button
              type="default"
              icon={
                isReprocessing ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing" ? (
                  <Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <ReloadOutlined />
                )
              }
              onClick={() => setReprocessModalVisible(true)}
              disabled={
                isReprocessing ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing"
              }
              loading={
                isReprocessing ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing"
              }
            >
              {isReprocessing ||
              file.extraction_status === "processing" ||
              file.processing_status === "processing"
                ? "Processing..."
                : "Reprocess"}
            </Button>
          </div>
        }
      >
        <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden -m-6 bg-white">
          {/* Content Area - Two Pane Layout with Independent Scrolling */}
          <div className="flex flex-1 overflow-hidden min-h-0 file-page-content">
            {/* Left Pane - PDF Viewer with Independent Scroll */}
            <div
              ref={leftPaneRef}
              className="border-r border-gray-200 bg-gray-100 flex flex-col min-w-0 overflow-hidden"
              style={{ width: `${splitPosition}%`, minWidth: "200px" }}
            >
              <div className="px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
                <Text strong className="text-sm">
                  PDF Document
                </Text>
                {pageCountDisplay !== null && (
                  <Text className="text-xs text-gray-500 ml-2">
                    ({pageCountDisplay} pages)
                  </Text>
                )}
              </div>
              <div className="flex-1 overflow-auto min-h-0 bg-gray-50">
                {pdfUrlLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader className="w-8 h-8 animate-spin text-blue-500" />
                  </div>
                ) : pdfUrl ? (
                  <iframe
                    src={pdfUrl}
                    className="w-full h-full border-0 bg-white"
                    style={{ minHeight: "100%", display: "block" }}
                    title={`PDF viewer for ${file.filename}`}
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

            {/* Right Pane - Results Viewer with Independent Scroll */}
            <div
              ref={rightPaneRef}
              className="bg-white flex flex-col min-w-0 overflow-hidden"
              style={{ width: `${100 - splitPosition}%`, minWidth: "200px" }}
            >
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0 flex items-center justify-between">
                <Text strong className="text-sm">
                  Extracted Results
                </Text>
                <ConstraintErrorIcon file={file} />
              </div>
              <div className="flex-1 overflow-auto min-h-0 flex flex-col">
                {file.processing_status !== "completed" || !file.result ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <ExclamationCircleOutlined className="text-gray-400 text-4xl mb-4" />
                      <Text type="secondary" className="text-lg">
                        No results available for this file.
                      </Text>
                      <br />
                      <Text type="secondary" className="text-sm">
                        File status: {file.processing_status}
                      </Text>
                    </div>
                  </div>
                ) : (
                  <TabbedDataViewer
                    data={file.result}
                    filename={file.filename}
                    schema={jobSchema}
                    editable={canEditFile}
                    markdown={file.markdown}
                    actual_result={file.actual_result}
                    pages={Array.isArray(file.pages) ? file.pages : undefined}
                    onUpdate={handleUpdateResults}
                    comments={comments}
                    onAddComment={handleAddComment}
                    fileId={file.id}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>

      {/* Reprocess Confirmation Modal */}
      <Modal
        title="Reprocess File"
        open={reprocessModalVisible}
        onCancel={() => {
          setReprocessModalVisible(false);
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
              handleReprocess();
            }}
            loading={isReprocessing}
          >
            Preview
          </Button>,
          <Button
            key="reprocess"
            type="primary"
            loading={isReprocessing}
            onClick={() => {
              setReprocessOptions((prev) => ({ ...prev, preview: false }));
              handleReprocess();
            }}
          >
            Reprocess File
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
                Reprocess this file?
              </p>
              <p className="text-sm text-gray-600 mt-1">
                Choose what operations to perform on this file.
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
                    ? "Force re-extract text from PDF file"
                    : "Re-extract text from PDF file (if not already completed)"}
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
              <li>File will show as "processing" until complete</li>
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
    </ProtectedRoute>
  );
}
