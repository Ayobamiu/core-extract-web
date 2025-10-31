"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Typography, Button, Spin, Empty, message } from "antd";
import {
  ShrinkOutlined,
  LeftOutlined,
  RightOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  FilePdfOutlined,
} from "@ant-design/icons";
import { apiClient, JobFile } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import { useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { Loader } from "lucide-react";

const { Text } = Typography;

export default function FilePage() {
  const params = useParams();
  const router = useRouter();
  const fileId = params?.id as string;
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";

  const [file, setFile] = useState<JobFile | null>(null);
  console.log({ fileId, file });
  const [jobSchema, setJobSchema] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [pdfUrlLoading, setPdfUrlLoading] = useState(false);
  const [allFiles, setAllFiles] = useState<JobFile[]>([]);
  const [currentFileIndex, setCurrentFileIndex] = useState<number>(0);

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

          // Fetch all files from the same job for navigation
          const jobId = fileData.job_id;
          if (jobId) {
            try {
              const jobResponse = await apiClient.getJobStatus(jobId);
              if (jobResponse.status === "success" && jobResponse.data) {
                const jobData =
                  (jobResponse.data as any).job || jobResponse.data;
                const files = jobData.files;
                if (!files) return;
                setAllFiles(files);

                // Find current file index
                const index = files.findIndex((f: JobFile) => f.id === fileId);
                if (index !== -1) {
                  setCurrentFileIndex(index);
                }
              }
            } catch (jobErr) {
              console.warn("Failed to fetch job files for navigation:", jobErr);
              // Continue without navigation - not critical
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
    try {
      await apiClient.verifyFile(fileId, verified, undefined);
      setFile((prev) => (prev ? { ...prev, admin_verified: verified } : null));
      message.success(`File ${verified ? "verified" : "unverified"}`);
    } catch (err: any) {
      message.error(err.message || "Failed to update verification status");
    }
  };

  const handleNavigateFile = (direction: "prev" | "next") => {
    if (allFiles.length === 0) return;

    const newIndex =
      direction === "prev" ? currentFileIndex - 1 : currentFileIndex + 1;

    if (newIndex >= 0 && newIndex < allFiles.length) {
      const nextFile = allFiles[newIndex];
      // Navigate to new file - this will trigger useEffect to fetch new file
      router.push(`/files/${nextFile.id}`);
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
        <div className="flex flex-col h-screen overflow-hidden">
          {/* Navigation Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0 bg-white">
            <div className="flex items-center space-x-4 flex-1">
              <div className="flex items-center space-x-2">
                <Button
                  type="default"
                  icon={<LeftOutlined />}
                  onClick={() => handleNavigateFile("prev")}
                  disabled={currentFileIndex === 0}
                >
                  Previous
                </Button>
                <Button
                  type="default"
                  icon={<RightOutlined />}
                  iconPosition="end"
                  onClick={() => handleNavigateFile("next")}
                  disabled={currentFileIndex === allFiles.length - 1}
                >
                  Next
                </Button>
              </div>
              <div className="flex items-center space-x-2 text-sm text-gray-600">
                <FilePdfOutlined className="text-blue-500" />
                <span className="font-medium">{file.filename}</span>
                {allFiles.length > 0 && (
                  <span className="text-gray-400">
                    ({currentFileIndex + 1} of {allFiles.length})
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center space-x-2">
              {isAdmin && (
                <Button
                  type={file.admin_verified ? "default" : "primary"}
                  icon={
                    file.admin_verified ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CheckCircleOutlined />
                    )
                  }
                  onClick={() =>
                    handleVerifyFile(file.id, !file.admin_verified)
                  }
                  disabled={file.admin_verified}
                  style={
                    file.admin_verified
                      ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                      : {}
                  }
                >
                  {file.admin_verified ? "Verified" : "Verify"}
                </Button>
              )}
              <Button
                type="default"
                icon={<ShrinkOutlined />}
                onClick={() => router.back()}
              >
                Back
              </Button>
            </div>
          </div>

          {/* Content Area - Two Pane Layout */}
          <div className="flex flex-1 overflow-hidden min-h-0">
            {/* Left Pane - PDF Viewer */}
            <div className="w-1/2 border-r border-gray-200 bg-gray-100 flex flex-col min-w-0 overflow-hidden">
              <div className="px-4 py-2 bg-white border-b border-gray-200 flex-shrink-0">
                <Text strong className="text-sm">
                  PDF Document
                </Text>
                {file.pages && typeof file.pages === "number" && (
                  <Text className="text-xs text-gray-500 ml-2">
                    ({file.pages} pages)
                  </Text>
                )}
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

            {/* Right Pane - Results Viewer */}
            <div className="w-1/2 bg-white flex flex-col min-w-0 overflow-hidden">
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <Text strong className="text-sm">
                  Extracted Results
                </Text>
              </div>
              <div className="flex-1 overflow-hidden min-h-0">
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
                  <div className="h-full overflow-hidden">
                    <TabbedDataViewer
                      data={file.result}
                      filename={file.filename}
                      schema={jobSchema}
                      editable={true}
                      markdown={file.markdown}
                      actual_result={file.actual_result}
                      onUpdate={handleUpdateResults}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
