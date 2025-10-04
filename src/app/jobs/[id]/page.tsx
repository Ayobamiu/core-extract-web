"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { apiClient, JobDetails } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";

export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSchema, setShowSchema] = useState(false);
  const [showFileResults, setShowFileResults] = useState<
    Record<string, boolean>
  >({});

  const fetchJobDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.getJob(jobId);
      setJob(response.job);
      setError(null);
    } catch (err: unknown) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch job details";
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  const downloadResults = async () => {
    if (!job) return;

    try {
      // Create a downloadable JSON file with all results
      const results = {
        jobId: job.id,
        jobName: job.name,
        status: job.status,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
        files: job.files.map((file) => ({
          id: file.id,
          filename: file.filename,
          status: file.processing_status,
          result: file.result,
        })),
      };

      const blob = new Blob([JSON.stringify(results, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${job.name.replace(/[^a-z0-9]/gi, "_")}_results.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed:", err);
    }
  };

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }
  }, [jobId, fetchJobDetails]);

  // TODO: Implement WebSocket connection for real-time updates
  // This will replace the polling system for live job status updates

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
    <div className="min-h-screen bg-gray-50">
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
              <h1 className="text-2xl font-bold text-gray-900">{job.name}</h1>
              <p className="text-gray-600 font-mono text-sm">{job.id}</p>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <StatusIndicator status={getJobStatusColor(job.status)}>
              {job.status}
            </StatusIndicator>
            {job.status === "completed" && (
              <Button variant="primary" onClick={downloadResults}>
                Download Results
              </Button>
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
                    <StatusIndicator status={getJobStatusColor(job.status)}>
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
                    {job.schema_data.schemaName}
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
                      typeof job.schema_data.schema === "string"
                        ? JSON.parse(job.schema_data.schema)
                        : job.schema_data.schema
                    }
                    filename="schema"
                    schema={job.schema_data.schema}
                  />
                </div>
              </CardContent>
            )}
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
                                    {file.filename.charAt(0).toUpperCase()}
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
                              <div className="flex space-x-2">
                                <StatusIndicator
                                  status={getFileStatusColor(
                                    file.extraction_status
                                  )}
                                >
                                  {file.extraction_status}
                                </StatusIndicator>
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
                                    {file.filename.charAt(0).toUpperCase()}
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
                              <div className="flex space-x-2">
                                <StatusIndicator
                                  status={getFileStatusColor(
                                    file.extraction_status
                                  )}
                                >
                                  {file.extraction_status}
                                </StatusIndicator>
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
                          <div className="flex items-center justify-between p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0 h-8 w-8">
                                <div className="h-8 w-8 rounded bg-gradient-to-br from-green-500 to-blue-600 flex items-center justify-center">
                                  <span className="text-xs font-medium text-white">
                                    {file.filename.charAt(0).toUpperCase()}
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
                              <div className="flex space-x-2">
                                <StatusIndicator
                                  status={getFileStatusColor(
                                    file.extraction_status
                                  )}
                                >
                                  {file.extraction_status}
                                </StatusIndicator>
                                <StatusIndicator
                                  status={getFileStatusColor(
                                    file.processing_status
                                  )}
                                >
                                  {file.processing_status}
                                </StatusIndicator>
                              </div>
                              {file.processing_status === "completed" &&
                                file.result && (
                                  <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() =>
                                      setShowFileResults((prev) => ({
                                        ...prev,
                                        [file.id]: !prev[file.id],
                                      }))
                                    }
                                  >
                                    {showFileResults[file.id] ? "Hide" : "Show"}{" "}
                                    Results
                                  </Button>
                                )}
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
                                    typeof job.schema_data.schema === "string"
                                      ? JSON.parse(job.schema_data.schema)
                                      : job.schema_data.schema
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
                                    {file.filename.charAt(0).toUpperCase()}
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
                              <div className="flex space-x-2">
                                <StatusIndicator
                                  status={getFileStatusColor(
                                    file.extraction_status
                                  )}
                                >
                                  {file.extraction_status}
                                </StatusIndicator>
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
                        </motion.div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
