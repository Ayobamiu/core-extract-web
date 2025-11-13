"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Drawer, Tabs, Dropdown, Modal, message } from "antd";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import { apiClient, JobDetails, JobFile } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import PreviewSelector from "@/components/preview/PreviewSelector";
import PreviewDrawer from "@/components/preview/PreviewDrawer";
import InlineSchemaEditor from "@/components/InlineSchemaEditor";
import FileResultsEditor from "@/components/FileResultsEditor";
import FileTable from "@/components/FileTable";
import JobConfigEditor from "@/components/JobConfigEditor";
import { useSocket } from "@/hooks/useSocket";
import {
  PlusIcon,
  DocumentIcon,
  PencilIcon,
  EllipsisVerticalIcon,
  ArrowPathIcon,
  SignalIcon,
} from "@heroicons/react/24/outline";
import { Loader } from "lucide-react";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const jobId = params.id as string;
  const isAdmin = canPerformAdminActions(user);

  const [job, setJob] = useState<JobDetails | null>(null);
  const [fileSummary, setFileSummary] = useState<{
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
  } | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSchemaDrawer, setShowSchemaDrawer] = useState(false);
  const [schemaDrawerActiveTab, setSchemaDrawerActiveTab] = useState("view");
  const [showFileResults, setShowFileResults] = useState<
    Record<string, boolean>
  >({});
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);
  const [isAddingFiles, setIsAddingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileList, setFileList] = useState<FileList | null>(null);
  const [showPreviewSelector, setShowPreviewSelector] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<
    string | null
  >(null);
  const [showFileResultsEditor, setShowFileResultsEditor] = useState(false);
  const [selectedFileForResultsEdit, setSelectedFileForResultsEdit] =
    useState<JobFile | null>(null);
  const [showPreviewDrawer, setShowPreviewDrawer] = useState(false);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(
    null
  );
  const [showBulkPreviewDrawer, setShowBulkPreviewDrawer] = useState(false);
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);
  const [showFilePreviewModal, setShowFilePreviewModal] = useState(false);
  const [isGoingLive, setIsGoingLive] = useState(false);
  const [fileTableRefreshTrigger, setFileTableRefreshTrigger] = useState(0);
  const [showConfigEditor, setShowConfigEditor] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refreshJobData = useCallback(async () => {
    try {
      const response = await apiClient.getJobDetails(jobId);
      // getJobDetails returns job without files, but we need JobDetails type for compatibility
      setJob(response.job as JobDetails);
      setFileSummary(response.summary);
      setError(null);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch job details";
      setError(errorMessage);
    }
  }, [jobId]);

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getJobDetails(jobId);
      // getJobDetails returns job without files, but we need JobDetails type for compatibility
      setJob(response.job as JobDetails);
      setFileSummary(response.summary);
      setError(null);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch job details";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // WebSocket event handlers
  const handleJobStatusUpdate = useCallback((data: any) => {
    console.log("📋 Job status update:", data);
    setRealtimeMessage(data.message);

    // Update job status - use functional update to avoid stale closure
    setJob((prev) => (prev ? { ...prev, status: data.status } : null));

    // Clear message after 5 seconds
    setTimeout(() => {
      setRealtimeMessage(null);
    }, 5000);
  }, []);

  const handleFileStatusUpdate = useCallback(
    async (data: any) => {
      console.log("📄 File status update received:", data);
      setRealtimeMessage(data.message);

      // Refresh summary when file status changes
      try {
        const response = await apiClient.getJobDetails(jobId);
        setFileSummary(response.summary);
        console.log("✅ Summary refreshed");
      } catch (err) {
        console.error("Failed to refresh file summary:", err);
      }

      // Trigger FileTable refresh with retry logic to handle race conditions
      // Try immediate refresh first, then retry if needed
      const triggerRefresh = (attempt = 1, maxAttempts = 3) => {
        const delay = attempt === 1 ? 50 : attempt === 2 ? 200 : 500; // Progressive delays

        setTimeout(() => {
          console.log(
            `🔄 Triggering FileTable refresh (attempt ${attempt}/${maxAttempts})...`
          );
          setFileTableRefreshTrigger((prev) => {
            const newValue = prev + 1;
            console.log(`📊 Refresh trigger updated: ${prev} -> ${newValue}`);
            return newValue;
          });

          // If not the last attempt, schedule a retry to catch late database updates
          if (attempt < maxAttempts) {
            triggerRefresh(attempt + 1, maxAttempts);
          }
        }, delay);
      };

      triggerRefresh();

      // Clear message after 5 seconds
      setTimeout(() => {
        setRealtimeMessage(null);
      }, 5000);
    },
    [jobId]
  );

  const handlePreviewUpdated = useCallback(
    (data: any) => {
      console.log("📊 Preview updated:", data);
      setRealtimeMessage(data.message);

      // Refresh job data to get updated preview information
      refreshJobData();

      // Clear message after 5 seconds
      setTimeout(() => {
        setRealtimeMessage(null);
      }, 5000);
    },
    [refreshJobData]
  );

  // WebSocket connection
  const { isConnected } = useSocket(jobId, {
    onJobStatusUpdate: handleJobStatusUpdate,
    onFileStatusUpdate: handleFileStatusUpdate,
    onPreviewUpdated: handlePreviewUpdated,
  });

  useEffect(() => {
    fetchJobDetails();
  }, [fetchJobDetails]);

  // Handle file selection
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
      setFileList(files);
    }
  };

  // Handle file selection within modal
  const handleModalFileSelect = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = event.target.files;
    if (files) {
      setSelectedFiles(Array.from(files));
      setFileList(files);
    }
  };

  // Handle adding files to job
  const handleAddFiles = async () => {
    // Show preview modal instead of uploading directly
    setShowFilePreviewModal(true);
  };

  // Handle Go Live functionality
  const handleGoLive = async () => {
    setIsGoingLive(true);
    try {
      // Force refresh job data
      await refreshJobData();

      // Show success message
      setRealtimeMessage("Going live - data refreshed!");

      // Clear message after 3 seconds
      setTimeout(() => {
        setRealtimeMessage(null);
      }, 3000);
    } catch (error) {
      console.error("Error going live:", error);
      setRealtimeMessage("Failed to go live - please try again");
      setTimeout(() => {
        setRealtimeMessage(null);
      }, 3000);
    } finally {
      setIsGoingLive(false);
    }
  };

  // Handle actual file upload after preview confirmation
  const handleConfirmUpload = async () => {
    if (selectedFiles.length === 0 || !fileList) return;

    setIsAddingFiles(true);
    try {
      const response = await apiClient.addFilesToJob(jobId, fileList);

      if (response.status === "success") {
        // Refresh job data to get updated file list
        await refreshJobData();
        // Clear selected files
        setSelectedFiles([]);
        setFileList(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
        // Close modal
        setShowFilePreviewModal(false);
        // Trigger immediate refresh of FileTable and summary after upload
        // This ensures files appear immediately even if socket event is delayed
        console.log("🔄 Triggering immediate refresh after file upload");
        setFileTableRefreshTrigger((prev) => prev + 1);
      } else {
        throw new Error(response.message || "Failed to add files to job");
      }
    } catch (error) {
      console.error("Error adding files:", error);
      // Handle error (you might want to show a toast notification)
    } finally {
      setIsAddingFiles(false);
    }
  };

  // Handle preview actions
  const handleAddToPreview = async (fileId: string, previewId?: string) => {
    if (!previewId) {
      setSelectedFileForPreview(fileId);
      setShowPreviewSelector(true);
      return;
    }

    try {
      const response = await fetch(`/api/previews/${previewId}/files`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileId }),
      });

      if (response.ok) {
        // Refresh job data to update preview counts
        await refreshJobData();
      } else {
        throw new Error("Failed to add file to preview");
      }
    } catch (error) {
      console.error("Error adding file to preview:", error);
    }
  };

  const handleUpdateJobConfig = async (updates: {
    name?: string;
    extraction_mode?: "full_extraction" | "text_only";
    processing_config?: any;
  }) => {
    try {
      const response = await apiClient.updateJobConfig(jobId, updates);
      if (response.status === "success") {
        // Refresh job data to get updated configuration
        await refreshJobData();
        message.success("Job configuration updated successfully");
      } else {
        throw new Error(
          response.message || "Failed to update job configuration"
        );
      }
    } catch (error) {
      console.error("Error updating job configuration:", error);
      message.error(
        error instanceof Error
          ? error.message
          : "Failed to update job configuration"
      );
      throw error;
    }
  };

  const handleEditResults = async (fileId: string, results: any) => {
    try {
      const response = await fetch(`/api/files/${fileId}/results`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ results }),
      });

      if (response.ok) {
        // Refresh job data to get updated results
        await refreshJobData();
      } else {
        throw new Error("Failed to update file results");
      }
    } catch (error) {
      console.error("Error updating file results:", error);
    }
  };

  const handleBulkAddToPreview = async (
    fileIds: string[],
    previewId: string
  ) => {
    try {
      const response = await fetch(`/api/previews/${previewId}/files/bulk`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ fileIds }),
      });

      if (response.ok) {
        // Refresh job data to update preview counts
        await refreshJobData();
      } else {
        throw new Error("Failed to add files to preview");
      }
    } catch (error) {
      console.error("Error adding files to preview:", error);
    }
  };

  // Format file size helper
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Format date helper
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // WebSocket connection status logging
  useEffect(() => {
    if (isConnected) {
      console.log("🔌 WebSocket connected");
    } else {
      console.log("🔌 WebSocket disconnected");
    }
  }, [isConnected]);

  const getJobStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "success";
      case "processing":
        return "warning";
      case "failed":
        return "error";
      case "pending":
        return "info";
      default:
        return "neutral";
    }
  };

  const getFileStats = () => {
    if (!fileSummary) return { processed: 0, processing: 0, pending: 0 };
    return {
      processed: fileSummary.processing_completed,
      processing: fileSummary.processing ?? 0,
      pending: fileSummary.pending ?? 0,
    };
  };

  const getFileStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "completed":
        return "success";
      case "processing":
        return "warning";
      case "failed":
        return "error";
      case "pending":
        return "info";
      default:
        return "neutral";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading job details...</p>
        </div>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent>
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Job Not Found
              </h2>
              <p className="text-gray-600 mb-4">
                {error || "The requested job could not be found."}
              </p>
              <Button onClick={() => router.push("/")} variant="primary">
                Back to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarLayout pageTitle={job.name}>
        {/* Check if user has an organization */}
        {!currentOrganization ? (
          <div className="flex items-center justify-center h-full">
            <Card className="p-8 max-w-md mx-auto">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No Organization Selected
              </h3>
              <p className="text-gray-600 mb-6">
                You need to be part of an organization to view job details.
              </p>
              <Button onClick={() => router.push("/")} className="w-full">
                Go to Dashboard
              </Button>
            </Card>
          </div>
        ) : (
          <div className="h-full -m-6">
            {/* Files Table */}
            <FileTable
              jobId={job.id}
              jobSchema={
                typeof job.schema_data === "string"
                  ? JSON.parse(job.schema_data)
                  : job.schema_data
              }
              onShowResults={(fileId) =>
                setShowFileResults((prev) => ({
                  ...prev,
                  [fileId]: !prev[fileId],
                }))
              }
              onAddToPreview={(fileId) => handleAddToPreview(fileId)}
              onEditResults={(file) => {
                setSelectedFileForResultsEdit(file);
                setShowFileResultsEditor(true);
              }}
              onBulkAddToPreview={(fileIds) => {
                setSelectedFileIds(fileIds);
                setShowBulkPreviewDrawer(true);
              }}
              onDataUpdate={refreshJobData}
              showFileResults={showFileResults}
              refreshTrigger={fileTableRefreshTrigger}
              fileSummary={fileSummary}
              isConnected={isConnected}
              isGoingLive={isGoingLive}
              isRefreshing={isRefreshing}
              onGoLive={handleGoLive}
              onRefresh={async () => {
                setIsRefreshing(true);
                try {
                  await refreshJobData();
                  setFileTableRefreshTrigger((prev) => prev + 1);
                } finally {
                  setIsRefreshing(false);
                }
              }}
              onAddFiles={() => setShowFilePreviewModal(true)}
              onEditConfig={() => setShowConfigEditor(true)}
              onShowSchema={() => setShowSchemaDrawer(true)}
              jobStatus={job.status}
              getJobStatusColor={getJobStatusColor}
            />

            {/* Floating Real-time Message */}
            {realtimeMessage && (
              <motion.div
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.8 }}
                className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 max-w-sm"
              >
                <div className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                  <span className="text-sm font-medium">{realtimeMessage}</span>
                </div>
              </motion.div>
            )}

            {/* Schema Drawer */}
            <Drawer
              title="Extraction Schema"
              placement="right"
              width={800}
              open={showSchemaDrawer}
              onClose={() => {
                setShowSchemaDrawer(false);
                setSchemaDrawerActiveTab("view"); // Reset to view tab when closing
              }}
            >
              {job && (
                <Tabs
                  activeKey={schemaDrawerActiveTab}
                  onChange={setSchemaDrawerActiveTab}
                  items={[
                    {
                      key: "view",
                      label: "View Schema",
                      children: (
                        <div className="mt-4">
                          <TabbedDataViewer
                            data={
                              typeof job.schema_data === "string"
                                ? JSON.parse(job.schema_data)
                                : job.schema_data
                            }
                            filename="schema"
                            schema={job.schema_data}
                          />
                        </div>
                      ),
                    },
                    ...(isAdmin
                      ? [
                          {
                            key: "edit",
                            label: "Edit Schema",
                            children: (
                              <InlineSchemaEditor
                                jobId={job.id}
                                currentSchema={
                                  typeof job.schema_data === "string"
                                    ? job.schema_data
                                    : job.schema_data?.schema ||
                                      job.schema_data ||
                                      {}
                                }
                                onSuccess={(updatedSchema) => {
                                  setJob((prev) =>
                                    prev
                                      ? {
                                          ...prev,
                                          schema_data: updatedSchema,
                                        }
                                      : null
                                  );
                                  setSchemaDrawerActiveTab("view"); // Switch back to view tab
                                }}
                              />
                            ),
                          },
                        ]
                      : []),
                  ]}
                />
              )}
            </Drawer>

            {/* File Preview Modal */}
            <Modal
              title="Add Files to Job"
              open={showFilePreviewModal}
              onCancel={() => {
                setShowFilePreviewModal(false);
                setSelectedFiles([]);
                setFileList(null);
              }}
              footer={[
                <Button
                  key="cancel"
                  variant="secondary"
                  onClick={() => {
                    setShowFilePreviewModal(false);
                    setSelectedFiles([]);
                    setFileList(null);
                  }}
                >
                  Cancel
                </Button>,
                <Button
                  key="upload"
                  variant="primary"
                  onClick={handleConfirmUpload}
                  disabled={isAddingFiles || selectedFiles.length === 0}
                  className="flex items-center space-x-2"
                >
                  {isAddingFiles ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <>
                      <PlusIcon className="h-4 w-4" />
                      <span>
                        Upload {selectedFiles.length} File
                        {selectedFiles.length !== 1 ? "s" : ""}
                      </span>
                    </>
                  )}
                </Button>,
              ]}
              width={700}
            >
              <div className="space-y-6">
                {/* File Selection Section */}
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-gray-400 transition-colors">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.bmp,.tiff,.tif,.webp"
                    onChange={handleModalFileSelect}
                    className="hidden"
                  />
                  <div className="space-y-4">
                    <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center">
                      <DocumentIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div>
                      <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex items-center space-x-2"
                      >
                        <PlusIcon className="h-4 w-4" />
                        <span>Select Files</span>
                      </Button>
                    </div>
                    <p className="text-sm text-gray-500">
                      Choose PDF, DOC, DOCX, or TXT files to upload
                    </p>
                  </div>
                </div>

                {/* File Preview Section */}
                {selectedFiles.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-sm text-gray-600">
                      You are about to upload {selectedFiles.length} file
                      {selectedFiles.length !== 1 ? "s" : ""} to this job.
                      Please review the files below before confirming.
                    </div>

                    <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg">
                      <div className="divide-y divide-gray-200">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="p-4 hover:bg-gray-50">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <DocumentIcon className="h-8 w-8 text-blue-500" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-gray-900 truncate">
                                  {file.name}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {formatFileSize(file.size)}
                                </div>
                              </div>
                              <div className="flex-shrink-0">
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {file.type || "Unknown type"}
                                </span>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="text-sm text-gray-600">
                        <strong>Total:</strong> {selectedFiles.length} file
                        {selectedFiles.length !== 1 ? "s" : ""} •{" "}
                        {formatFileSize(
                          selectedFiles.reduce(
                            (total, file) => total + file.size,
                            0
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </Modal>

            {/* Components will be added back when interfaces are fixed */}

            {/* Preview Selector Modal */}
            {showPreviewSelector && selectedFileForPreview && (
              <PreviewSelector
                fileId={selectedFileForPreview}
                onClose={() => {
                  setShowPreviewSelector(false);
                  setSelectedFileForPreview(null);
                }}
                onSuccess={() => {
                  setShowPreviewSelector(false);
                  setSelectedFileForPreview(null);
                  refreshJobData();
                }}
              />
            )}

            {/* Preview Drawer */}
            <PreviewDrawer
              open={showPreviewDrawer}
              fileIds={selectedPreviewId ? [selectedPreviewId] : []}
              onClose={() => {
                setShowPreviewDrawer(false);
                setSelectedPreviewId(null);
              }}
              onSuccess={() => {
                setShowPreviewDrawer(false);
                setSelectedPreviewId(null);
                refreshJobData();
              }}
            />

            {/* File Results Editor Modal */}
            {showFileResultsEditor && selectedFileForResultsEdit && (
              <FileResultsEditor
                isOpen={showFileResultsEditor}
                onClose={() => {
                  setShowFileResultsEditor(false);
                  setSelectedFileForResultsEdit(null);
                }}
                fileId={selectedFileForResultsEdit.id}
                filename={selectedFileForResultsEdit.filename}
                initialResults={selectedFileForResultsEdit.result}
                onSuccess={(updatedResults) => {
                  handleEditResults(
                    selectedFileForResultsEdit.id,
                    updatedResults
                  );
                  setShowFileResultsEditor(false);
                  setSelectedFileForResultsEdit(null);
                }}
              />
            )}

            {/* Bulk Preview Drawer */}
            <PreviewDrawer
              open={showBulkPreviewDrawer}
              fileIds={selectedFileIds}
              onClose={() => {
                setShowBulkPreviewDrawer(false);
                setSelectedFileIds([]);
              }}
              onSuccess={() => {
                setShowBulkPreviewDrawer(false);
                setSelectedFileIds([]);
                refreshJobData();
              }}
            />

            {/* Job Configuration Editor */}
            {job && (
              <JobConfigEditor
                open={showConfigEditor}
                onClose={() => setShowConfigEditor(false)}
                jobId={jobId}
                currentConfig={{
                  name: job.name,
                  extraction_mode: job.extraction_mode,
                  processing_config: job.processing_config,
                }}
                onUpdate={handleUpdateJobConfig}
              />
            )}
          </div>
        )}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
