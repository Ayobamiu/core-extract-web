"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Button, Spin, Empty, message, Modal, Checkbox, Space } from "antd";
import { apiClient, JobFile, ProcessingConfig } from "@/lib/api";
import { DEFAULT_MODELS, PROCESSING_METHODS } from "@/lib/processingConfig";
import FileViewerLayout from "@/components/file/FileViewerLayout";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions, canEdit } from "@/utils/roleUtils";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";

export default function FilePage() {
  const params = useParams();
  const fileId = params?.id as string;
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);
  const canEditFile = canEdit(user);

  const [file, setFile] = useState<JobFile | null>(null);
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
  // Use File.filename as the title
  useEffect(() => {
    document.title = file?.filename || "File Details";
  }, [file?.filename]);

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

  // Fetch file data
  useEffect(() => {
    const fetchFile = async () => {
      if (!fileId) return;

      try {
        setLoading(true);
        setError(null);

        const response = await apiClient.getFileResult(fileId);

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
        model: DEFAULT_MODELS[PROCESSING_METHODS.OPENAI],
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
        processingConfig,
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
    reviewStatus:
      | "pending"
      | "in_review"
      | "reviewed"
      | "approved"
      | "rejected",
  ) => {
    setIsReviewing(true);
    try {
      const response = await apiClient.updateFileReviewStatus(
        fileId,
        reviewStatus,
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
            : null,
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

  const handleReviewAndVerifyFile = async () => {
    if (!file) return;
    setIsReviewing(true);
    setIsVerifying(true);
    try {
      const response = await apiClient.bulkReviewAndVerifyFiles(
        [file.id],
        "reviewed",
        true, // adminVerified
      );

      if (
        response.success &&
        response.data &&
        response.data.updated?.length > 0
      ) {
        const updated = response.data.updated[0];
        setFile((prev) =>
          prev
            ? {
                ...prev,
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
            : null,
        );
        message.success("File marked as reviewed and verified successfully");
      } else {
        throw new Error(response.message || "Failed to update file");
      }
    } catch (err: any) {
      message.error(err.message || "Failed to update file");
    } finally {
      setIsReviewing(false);
      setIsVerifying(false);
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
      <SidebarLayout>
        <FileViewerLayout
          className="h-[calc(100vh-4rem)] -m-6"
          file={file}
          pdfUrl={pdfUrl}
          pdfUrlLoading={pdfUrlLoading}
          jobSchema={jobSchema}
          editable={canEditFile}
          comments={comments}
          onAddComment={handleAddComment}
          onUpdate={handleUpdateResults}
          onSectionsUpdated={(next) =>
            setFile((prev) =>
              prev ? { ...prev, detected_sections: next } : prev,
            )
          }
          splitContainerClassName="file-viewer-split-page"
          showReviewAndVerifyInBar
          onUpdateReviewStatus={handleUpdateReviewStatus}
          onVerifyFile={handleVerifyFile}
          onReviewAndVerifyFile={handleReviewAndVerifyFile}
          onReprocessFile={() => setReprocessModalVisible(true)}
          reviewingFileId={isReviewing ? file.id : null}
          verifyingFileId={isVerifying ? file.id : null}
          reprocessingFileId={
            isReprocessing ||
            file.extraction_status === "processing" ||
            file.processing_status === "processing"
              ? file.id
              : null
          }
          isAdmin={isAdmin}
        />
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
