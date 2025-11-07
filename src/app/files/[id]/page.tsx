"use client";

import React, { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Typography, Button, Spin, Empty, message } from "antd";
import {
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
  const [isVerifying, setIsVerifying] = useState(false);
  const [splitPosition, setSplitPosition] = useState(50); // Percentage
  const [isResizing, setIsResizing] = useState(false);
  const splitPositionRef = React.useRef(50);
  const leftPaneRef = React.useRef<HTMLDivElement>(null);
  const rightPaneRef = React.useRef<HTMLDivElement>(null);

  const pageCountDisplay = React.useMemo(() => {
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
          isAdmin ? (
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
          ) : undefined
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
              <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex-shrink-0">
                <Text strong className="text-sm">
                  Extracted Results
                </Text>
              </div>
              <div className="flex-1 overflow-auto min-h-0">
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
                    editable={true}
                    markdown={file.markdown}
                    actual_result={file.actual_result}
                    pages={Array.isArray(file.pages) ? file.pages : undefined}
                    onUpdate={handleUpdateResults}
                  />
                )}
              </div>
            </div>
          </div>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
