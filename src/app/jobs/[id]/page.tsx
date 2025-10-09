"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import Navigation from "@/components/layout/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiClient, JobDetails, JobFile } from "@/lib/api";
import { smartCsvExport } from "@/lib/csvExport";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import PreviewSelector from "@/components/preview/PreviewSelector";
import SchemaEditor from "@/components/SchemaEditor";
import { useSocket } from "@/hooks/useSocket";
import {
  PlusIcon,
  DocumentIcon,
  ArrowDownTrayIcon,
  ChevronDownIcon,
  PencilIcon,
} from "@heroicons/react/24/outline";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobDetails | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [showFileResults, setShowFileResults] = useState<
    Record<string, boolean>
  >({});
  const [realtimeMessage, setRealtimeMessage] = useState<string | null>(null);
  const [isAddingFiles, setIsAddingFiles] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [fileList, setFileList] = useState<FileList | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [showPreviewSelector, setShowPreviewSelector] = useState(false);
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<
    string | null
  >(null);
  const [filePreviews, setFilePreviews] = useState<Record<string, any[]>>({});
  const [showSchemaEditor, setShowSchemaEditor] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getJob(jobId);
      setJob(response.job);
      setError(null);

      // Fetch previews for each completed file
      if (response.job?.files) {
        const previewPromises = response.job.files
          .filter((file: JobFile) => file.processing_status === "completed")
          .map(async (file: JobFile) => {
            try {
              const previewResponse = await apiClient.getPreviewsForFile(
                file.id
              );
              return { fileId: file.id, previews: previewResponse.data || [] };
            } catch (error) {
              console.error(
                `Error fetching previews for file ${file.id}:`,
                error
              );
              return { fileId: file.id, previews: [] };
            }
          });

        const previewResults = await Promise.all(previewPromises);
        const previewMap: Record<string, any[]> = {};
        previewResults.forEach(({ fileId, previews }) => {
          previewMap[fileId] = previews;
        });
        setFilePreviews(previewMap);
      }
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch job details";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  // WebSocket event handlers
  const handleJobStatusUpdate = useCallback(
    (data: any) => {
      console.log("📋 Job status update:", data);
      setRealtimeMessage(data.message);

      // Update job status - use functional update to avoid stale closure
      setJob((prev) => (prev ? { ...prev, status: data.status } : null));

      // Clear message after 5 seconds
      setTimeout(() => setRealtimeMessage(null), 5000);
    },
    [] // Remove job dependency to avoid stale closure
  );

  const handleFileStatusUpdate = useCallback(
    (data: any) => {
      console.log("📄 File status update:", data);
      setRealtimeMessage(data.message);

      // Update file status in job data - use functional update to avoid stale closure
      setJob((prev) => {
        if (!prev) {
          console.log("⚠️ No job data available for file update");
          return null;
        }

        console.log(
          "🔄 Updating file:",
          data.fileId,
          "with status:",
          data.extraction_status,
          data.processing_status
        );

        const updatedFiles = prev.files.map((file: JobFile) => {
          if (file.id === data.fileId) {
            console.log("✅ Found matching file, updating:", file.filename);
            return {
              ...file,
              ...(data.extraction_status !== undefined && {
                extraction_status: data.extraction_status,
              }),
              ...(data.processing_status !== undefined && {
                processing_status: data.processing_status,
              }),
              result: data.result || file.result,
              extraction_error: data.error || file.extraction_error,
              processing_error: data.error || file.processing_error,
            };
          }
          return file;
        });

        console.log(
          "📊 Updated files:",
          updatedFiles.map((f) => ({
            id: f.id,
            filename: f.filename,
            extraction_status: f.extraction_status,
            processing_status: f.processing_status,
          }))
        );

        return { ...prev, files: updatedFiles };
      });

      // Clear message after 5 seconds
      setTimeout(() => setRealtimeMessage(null), 5000);
    },
    [] // Remove job dependency to avoid stale closure
  );

  // Set up WebSocket connection
  const { socket, isConnected } = useSocket(jobId, {
    onJobStatusUpdate: handleJobStatusUpdate,
    onFileStatusUpdate: handleFileStatusUpdate,
  });

  const exportResults = async (format: "json" | "csv") => {
    if (!job) return;

    try {
      // Get only completed files
      const completedFiles = job.files.filter(
        (file) => file.processing_status === "completed"
      );

      if (completedFiles.length === 0) {
        alert("No completed files to export");
        return;
      }

      const results = {
        jobId: job.id,
        jobName: job.name,
        status: job.status,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        files: completedFiles.map((file) => ({
          id: file.id,
          filename: file.filename,
          status: file.processing_status,
          result: file.result,
        })),
      };

      const filename = `${job.name
        .replace(/[^a-zA-Z0-9\s-]/g, "_")
        .replace(/\s+/g, "_")}_results`;

      if (format === "json") {
        const blob = new Blob([JSON.stringify(results, null, 2)], {
          type: "application/json",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${filename}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } else if (format === "csv") {
        // Combine all completed files into a single CSV
        const allResults = completedFiles
          .filter((file) => file.result)
          .map((file) => ({
            ...file.result,
            _filename: file.filename,
            _fileId: file.id,
          }));

        if (allResults.length === 0) {
          alert("No valid results to export as CSV");
          return;
        }

        try {
          // Debug: Log the data structure
          console.log("Exporting CSV with data:", allResults);
          console.log("Schema:", job.schema_data);

          // Use the correct function signature: smartCsvExport(data, filename, schema)
          smartCsvExport(allResults, `${filename}.csv`, job.schema_data);
        } catch (error) {
          console.error("Error exporting CSV:", error);
          console.error("Data that failed:", allResults);
          alert("Error exporting CSV. Please check the console for details.");
        }
      }

      setShowExportDropdown(false);
    } catch (err) {
      console.error("Export failed:", err);
    }
  };

  const handleAddToPreview = (fileId: string) => {
    setSelectedFileForPreview(fileId);
    setShowPreviewSelector(true);
  };

  const handlePreviewSelectorClose = () => {
    setShowPreviewSelector(false);
    setSelectedFileForPreview(null);
  };

  const handlePreviewSuccess = () => {
    // Optionally refresh job details or show success message
    console.log("File added to preview successfully");
  };

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId, fetchJobDetails]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  // Show connection status
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setSelectedFiles(files);
    setFileList(e.target.files);
  };

  const handleAddFiles = async () => {
    if (selectedFiles.length === 0 || !fileList) return;

    try {
      setIsAddingFiles(true);

      await apiClient.addFilesToJob(jobId, fileList);

      // Refresh job details to show new files
      await fetchJobDetails();

      // Clear selected files
      setSelectedFiles([]);
      setFileList(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      setRealtimeMessage(
        `Successfully added ${selectedFiles.length} file(s) to job`
      );
      setTimeout(() => setRealtimeMessage(null), 3000);
    } catch (error) {
      console.error("Error adding files:", error);
      setRealtimeMessage("Failed to add files to job");
      setTimeout(() => setRealtimeMessage(null), 3000);
    } finally {
      setIsAddingFiles(false);
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
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        {/* Check if user has an organization */}
        {!currentOrganization ? (
          <div className="flex items-center justify-center min-h-screen">
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
          <>
            {/* Header */}
            <header className="bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push("/")}
                  >
                    ← Back
                  </Button>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                      {job.name}
                    </h1>
                    <p className="text-gray-600 font-mono text-sm">{job.id}</p>
                    {currentOrganization && (
                      <p className="text-sm text-blue-600 mt-1">
                        Organization: {currentOrganization.name}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <StatusIndicator status={getJobStatusColor(job.status)}>
                    {job.status}
                  </StatusIndicator>

                  {/* Real-time connection indicator */}
                  <div className="flex items-center space-x-2">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        isConnected ? "bg-green-500" : "bg-red-500"
                      }`}
                    ></div>
                    <span className="text-xs text-gray-500">
                      {isConnected ? "Live" : "Offline"}
                    </span>
                  </div>

                  {/* Edit Schema Button */}
                  <Button
                    variant="secondary"
                    onClick={() => setShowSchemaEditor(true)}
                    className="flex items-center gap-2"
                  >
                    <PencilIcon className="w-4 h-4" />
                    Edit Schema
                  </Button>

                  {/* Export Dropdown */}
                  {job.files.some(
                    (file) => file.processing_status === "completed"
                  ) && (
                    <div className="relative" ref={exportDropdownRef}>
                      <Button
                        variant="primary"
                        onClick={() =>
                          setShowExportDropdown(!showExportDropdown)
                        }
                        className="flex items-center gap-2"
                      >
                        <ArrowDownTrayIcon className="w-4 h-4" />
                        Export
                        <ChevronDownIcon className="w-4 h-4" />
                      </Button>

                      {showExportDropdown && (
                        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                          <div className="py-1">
                            <button
                              onClick={() => exportResults("json")}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <DocumentIcon className="w-4 h-4 mr-2" />
                              Export as JSON
                            </button>
                            <button
                              onClick={() => exportResults("csv")}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                            >
                              <DocumentIcon className="w-4 h-4 mr-2" />
                              Export as CSV
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Main Content */}
            <main className="p-6">
              <div className="max-w-6xl mx-auto space-y-6">
                {/* Job Overview */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-gray-900 mb-1">
                          {job.files.length}
                        </div>
                        <div className="text-sm text-gray-500">Files</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="mb-1">
                          <StatusIndicator
                            status={getJobStatusColor(job.status)}
                          >
                            {job.status}
                          </StatusIndicator>
                        </div>
                        <div className="text-sm text-gray-500">Status</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {formatDate(job.created_at)}
                        </div>
                        <div className="text-sm text-gray-500">Created</div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="text-center">
                        <div className="text-sm font-medium text-gray-900 mb-1">
                          {job.schema_data?.schemaName || "Extraction Schema"}
                        </div>
                        <div className="text-sm text-gray-500">Schema Name</div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Extraction Schema */}
                <Card>
                  {/* <CardHeader> */}
                  <div className="flex items-center justify-between">
                    <CardTitle>Extraction Schema</CardTitle>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => setShowSchema(!showSchema)}
                    >
                      {showSchema ? "Hide" : "Show"}
                    </Button>
                  </div>
                  {/* </CardHeader> */}
                  {showSchema && (
                    <CardContent>
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
                    </CardContent>
                  )}
                </Card>

                {/* Add Files Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <PlusIcon className="h-5 w-5" />
                      <span>Add More Files</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div className="flex items-center space-x-4">
                        <input
                          ref={fileInputRef}
                          type="file"
                          multiple
                          accept=".pdf,.doc,.docx,.txt"
                          onChange={handleFileSelect}
                          className="hidden"
                        />
                        <Button
                          variant="secondary"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center space-x-2"
                        >
                          <DocumentIcon className="h-4 w-4" />
                          <span>Select Files</span>
                        </Button>
                        {selectedFiles.length > 0 && (
                          <span className="text-sm text-gray-600">
                            {selectedFiles.length} file(s) selected
                          </span>
                        )}
                      </div>

                      {selectedFiles.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-gray-700">
                            Selected Files:
                          </h4>
                          <div className="space-y-1">
                            {selectedFiles.map((file, index) => (
                              <div
                                key={index}
                                className="flex items-center space-x-2 text-sm text-gray-600"
                              >
                                <DocumentIcon className="h-4 w-4" />
                                <span>{file.name}</span>
                                <span className="text-gray-400">
                                  ({(file.size / 1024 / 1024).toFixed(2)} MB)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex items-center space-x-2">
                        <Button
                          variant="primary"
                          onClick={handleAddFiles}
                          disabled={selectedFiles.length === 0 || isAddingFiles}
                          loading={isAddingFiles}
                        >
                          {isAddingFiles
                            ? "Adding Files..."
                            : "Add Files to Job"}
                        </Button>
                        {selectedFiles.length > 0 && (
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setSelectedFiles([]);
                              setFileList(null);
                              if (fileInputRef.current) {
                                fileInputRef.current.value = "";
                              }
                            }}
                          >
                            Clear Selection
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Files List */}
                <div className="space-y-6">
                  {/* Processing Files */}
                  {job.files.filter(
                    (file) =>
                      file.extraction_status === "processing" ||
                      file.processing_status === "processing"
                  ).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <span>
                            Processing Files (
                            {
                              job.files.filter(
                                (file) =>
                                  file.extraction_status === "processing" ||
                                  file.processing_status === "processing"
                              ).length
                            }
                            )
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {job.files
                            .filter(
                              (file) =>
                                file.extraction_status === "processing" ||
                                file.processing_status === "processing"
                            )
                            .map((file) => (
                              <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0 h-8 w-8">
                                      <div className="h-8 w-8 rounded bg-gradient-to-br from-yellow-500 to-orange-600 flex items-center justify-center">
                                        <span className="text-xs font-medium text-white">
                                          {file.filename
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {file.filename}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <div className="flex flex-col space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-medium">
                                          Extraction:
                                        </span>
                                        <StatusIndicator
                                          status={getFileStatusColor(
                                            file.extraction_status
                                          )}
                                        >
                                          {file.extraction_status}
                                        </StatusIndicator>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-medium">
                                          Processing:
                                        </span>
                                        <StatusIndicator
                                          status={getFileStatusColor(
                                            file.processing_status
                                          )}
                                        >
                                          {file.processing_status}
                                        </StatusIndicator>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Failed Files */}
                  {job.files.filter(
                    (file) =>
                      file.extraction_status === "failed" ||
                      file.processing_status === "failed"
                  ).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <span>
                            Failed Files (
                            {
                              job.files.filter(
                                (file) =>
                                  file.extraction_status === "failed" ||
                                  file.processing_status === "failed"
                              ).length
                            }
                            )
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {job.files
                            .filter(
                              (file) =>
                                file.extraction_status === "failed" ||
                                file.processing_status === "failed"
                            )
                            .map((file) => (
                              <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                              >
                                {/* File Header */}
                                <div className="flex items-center justify-between p-4 bg-red-50 border border-red-200 rounded-lg">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0 h-8 w-8">
                                      <div className="h-8 w-8 rounded bg-gradient-to-br from-red-500 to-pink-600 flex items-center justify-center">
                                        <span className="text-xs font-medium text-white">
                                          {file.filename
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {file.filename}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <div className="flex flex-col space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-medium">
                                          Extraction:
                                        </span>
                                        <StatusIndicator
                                          status={getFileStatusColor(
                                            file.extraction_status
                                          )}
                                        >
                                          {file.extraction_status}
                                        </StatusIndicator>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-medium">
                                          Processing:
                                        </span>
                                        <StatusIndicator
                                          status={getFileStatusColor(
                                            file.processing_status
                                          )}
                                        >
                                          {file.processing_status}
                                        </StatusIndicator>
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Error Messages */}
                                {file.extraction_error && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="text-sm font-medium text-red-800 mb-1">
                                      Extraction Error
                                    </div>
                                    <div className="text-xs text-red-700">
                                      {file.extraction_error}
                                    </div>
                                  </div>
                                )}

                                {file.processing_error && (
                                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                                    <div className="text-sm font-medium text-red-800 mb-1">
                                      Processing Error
                                    </div>
                                    <div className="text-xs text-red-700">
                                      {file.processing_error}
                                    </div>
                                  </div>
                                )}
                              </motion.div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Completed Files */}
                  {job.files.filter(
                    (file) =>
                      file.extraction_status === "completed" &&
                      file.processing_status === "completed"
                  ).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <span>
                            Completed Files (
                            {
                              job.files.filter(
                                (file) =>
                                  file.extraction_status === "completed" &&
                                  file.processing_status === "completed"
                              ).length
                            }
                            )
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {job.files
                            .filter(
                              (file) =>
                                file.extraction_status === "completed" &&
                                file.processing_status === "completed"
                            )
                            .map((file) => (
                              <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="space-y-3"
                              >
                                {/* File Header */}
                                <div className="bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
                                  {/* Main File Info */}
                                  <div className="p-4 border-b border-gray-100">
                                    <div className="flex items-start justify-between">
                                      <div className="flex items-center space-x-3 flex-1">
                                        <div className="flex-shrink-0 h-10 w-10">
                                          <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center">
                                            <svg
                                              className="w-6 h-6 text-red-600"
                                              fill="currentColor"
                                              viewBox="0 0 20 20"
                                              xmlns="http://www.w3.org/2000/svg"
                                            >
                                              <path
                                                fillRule="evenodd"
                                                d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z"
                                                clipRule="evenodd"
                                              />
                                            </svg>
                                          </div>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                          <h3 className="text-sm font-semibold text-gray-900 truncate">
                                            {file.filename}
                                          </h3>
                                          <div className="flex items-center space-x-4 mt-1">
                                            <span className="text-xs text-gray-500">
                                              {(file.size / 1024).toFixed(1)} KB
                                            </span>
                                            {file.processing_metadata
                                              ?.processing_time && (
                                              <span className="text-xs text-gray-500">
                                                Processed:{" "}
                                                {new Date(
                                                  file.processing_metadata.processing_time
                                                ).toLocaleTimeString()}
                                              </span>
                                            )}
                                          </div>
                                        </div>
                                      </div>

                                      {/* Action Buttons */}
                                      {file.processing_status === "completed" &&
                                        file.result && (
                                          <div className="flex items-center space-x-2 ml-4">
                                            <Button
                                              variant="default"
                                              size="sm"
                                              className="bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                                              onClick={() =>
                                                setShowFileResults((prev) => ({
                                                  ...prev,
                                                  [file.id]: !prev[file.id],
                                                }))
                                              }
                                            >
                                              {showFileResults[file.id]
                                                ? "Hide"
                                                : "Show"}{" "}
                                              Results
                                            </Button>
                                            <Button
                                              variant="default"
                                              size="sm"
                                              className="bg-green-600 hover:bg-green-700 text-white shadow-sm"
                                              onClick={() =>
                                                handleAddToPreview(file.id)
                                              }
                                            >
                                              Add to Preview
                                            </Button>
                                          </div>
                                        )}
                                    </div>
                                  </div>

                                  {/* Status and Preview Info */}
                                  <div className="p-4 bg-gray-50">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                      {/* Status Section */}
                                      <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                            Status
                                          </span>
                                        </div>
                                        <div className="flex items-center space-x-4">
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">
                                              Extraction:
                                            </span>
                                            <StatusIndicator
                                              status={getFileStatusColor(
                                                file.extraction_status
                                              )}
                                            >
                                              {file.extraction_status}
                                            </StatusIndicator>
                                          </div>
                                          <div className="flex items-center space-x-2">
                                            <span className="text-xs text-gray-500">
                                              Processing:
                                            </span>
                                            <StatusIndicator
                                              status={getFileStatusColor(
                                                file.processing_status
                                              )}
                                            >
                                              {file.processing_status}
                                            </StatusIndicator>
                                          </div>
                                        </div>
                                      </div>

                                      {/* Preview Section */}
                                      <div className="space-y-2">
                                        <div className="flex items-center space-x-2">
                                          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                                            Previews
                                          </span>
                                        </div>
                                        {filePreviews[file.id] &&
                                        filePreviews[file.id].length > 0 ? (
                                          <div className="flex flex-wrap gap-1">
                                            {filePreviews[file.id].map(
                                              (preview) => (
                                                <a
                                                  key={preview.id}
                                                  href={`/preview/${preview.id}`}
                                                  target="_blank"
                                                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                                                >
                                                  {preview.name}
                                                </a>
                                              )
                                            )}
                                          </div>
                                        ) : (
                                          <span className="text-xs text-gray-400 italic">
                                            Not in any previews
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>

                                {/* Results Viewer */}
                                {file.processing_status === "completed" &&
                                  file.result &&
                                  showFileResults[file.id] && (
                                    <div className="mt-3">
                                      <TabbedDataViewer
                                        data={file.result}
                                        filename={file.filename}
                                        schema={
                                          typeof job.schema_data === "string"
                                            ? JSON.parse(job.schema_data)
                                            : job.schema_data
                                        }
                                      />
                                    </div>
                                  )}
                              </motion.div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Pending Files */}
                  {job.files.filter(
                    (file) =>
                      file.extraction_status === "pending" &&
                      file.processing_status === "pending"
                  ).length > 0 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center space-x-2">
                          <span>
                            Pending Files (
                            {
                              job.files.filter(
                                (file) =>
                                  file.extraction_status === "pending" &&
                                  file.processing_status === "pending"
                              ).length
                            }
                            )
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {job.files
                            .filter(
                              (file) =>
                                file.extraction_status === "pending" &&
                                file.processing_status === "pending"
                            )
                            .map((file) => (
                              <motion.div
                                key={file.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="p-4 bg-gray-50 border border-gray-200 rounded-lg"
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0 h-8 w-8">
                                      <div className="h-8 w-8 rounded bg-gradient-to-br from-gray-500 to-gray-600 flex items-center justify-center">
                                        <span className="text-xs font-medium text-white">
                                          {file.filename
                                            .charAt(0)
                                            .toUpperCase()}
                                        </span>
                                      </div>
                                    </div>
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {file.filename}
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        {(file.size / 1024).toFixed(1)} KB
                                      </div>
                                    </div>
                                  </div>
                                  <div className="flex items-center space-x-3">
                                    <div className="flex flex-col space-y-1">
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-medium">
                                          Extraction:
                                        </span>
                                        <StatusIndicator
                                          status={getFileStatusColor(
                                            file.extraction_status
                                          )}
                                        >
                                          {file.extraction_status}
                                        </StatusIndicator>
                                      </div>
                                      <div className="flex items-center space-x-2">
                                        <span className="text-xs text-gray-500 font-medium">
                                          Processing:
                                        </span>
                                        <StatusIndicator
                                          status={getFileStatusColor(
                                            file.processing_status
                                          )}
                                        >
                                          {file.processing_status}
                                        </StatusIndicator>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            </main>

            {/* Floating Real-time Message */}
            {realtimeMessage && (
              <motion.div
                initial={{ opacity: 0, x: 100, scale: 0.8 }}
                animate={{ opacity: 1, x: 0, scale: 1 }}
                exit={{ opacity: 0, x: 100, scale: 0.8 }}
                transition={{
                  type: "spring",
                  stiffness: 300,
                  damping: 30,
                  duration: 0.3,
                }}
                className="fixed bottom-6 right-6 z-50 max-w-sm"
              >
                <div className="bg-white border border-gray-200 rounded-xl shadow-xl p-4 backdrop-blur-sm bg-white/95 ring-1 ring-gray-100">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse"></div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-semibold text-gray-900">
                          Live Update
                        </p>
                      </div>
                      <p className="text-sm text-gray-600 mt-1 leading-relaxed">
                        {realtimeMessage}
                      </p>
                    </div>
                    <div className="flex-shrink-0">
                      <button
                        onClick={() => setRealtimeMessage(null)}
                        className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-full hover:bg-gray-100"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </>
        )}
      </div>

      {/* Preview Selector Modal */}
      {showPreviewSelector && selectedFileForPreview && (
        <PreviewSelector
          fileId={selectedFileForPreview}
          onClose={handlePreviewSelectorClose}
          onSuccess={handlePreviewSuccess}
        />
      )}

      {/* Schema Editor Modal */}
      {showSchemaEditor && job && (
        <SchemaEditor
          jobId={job.id}
          currentSchema={
            typeof job.schema_data === "string"
              ? job.schema_data
              : job.schema_data?.schema || job.schema_data || {}
          }
          onClose={() => setShowSchemaEditor(false)}
          onSuccess={(updatedSchema) => {
            setJob((prev) =>
              prev
                ? {
                    ...prev,
                    schema_data: updatedSchema,
                  }
                : null
            );
            setShowSchemaEditor(false);
          }}
        />
      )}
    </ProtectedRoute>
  );
}
