"use client";

import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { apiClient } from "@/lib/api";

interface FileUploadProps {
  onUploadSuccess?: (jobId: string) => void;
  className?: string;
}

const FileUpload: React.FC<FileUploadProps> = ({
  onUploadSuccess,
  className = "",
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatus, setUploadStatus] = useState<
    "idle" | "uploading" | "success" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [schema, setSchema] = useState("");
  const [schemaName, setSchemaName] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    handleFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      handleFiles(files);
    }
  };

  const handleFiles = (files: File[]) => {
    // Filter for PDF files only
    const pdfFiles = files.filter((file) => file.type === "application/pdf");

    if (pdfFiles.length !== files.length) {
      setError("Only PDF files are allowed");
      return;
    }

    setSelectedFiles((prev) => [...prev, ...pdfFiles]);
    setError(null);
  };

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      setError("Please select files to upload");
      return;
    }

    if (!schema.trim()) {
      setError("Please provide a JSON schema");
      return;
    }

    try {
      setUploading(true);
      setUploadStatus("uploading");
      setError(null);

      // Validate JSON schema
      let parsedSchema;
      try {
        parsedSchema = JSON.parse(schema);
      } catch (e) {
        throw new Error("Invalid JSON schema format");
      }

      // Process all files in a single request
      console.log(
        `Processing ${selectedFiles.length} files in a single request`
      );

      const response = await apiClient.extractMultiple(
        {
          schema: parsedSchema,
          schemaName: schemaName || "data_extraction",
        },
        selectedFiles as any[]
      );

      console.log("API Response:", response);

      // Capture the job ID from the response
      let lastJobId: string | null = null;
      if (response.metadata?.jobId) {
        lastJobId = response.metadata.jobId;
        console.log("Captured jobId:", lastJobId);
      } else if (response.jobId) {
        lastJobId = response.jobId;
        console.log("Captured jobId from error response:", lastJobId);
      }

      setUploadStatus("success");
      setSelectedFiles([]);
      setSchema("");
      setSchemaName("");

      if (onUploadSuccess && lastJobId) {
        console.log("Calling onUploadSuccess with jobId:", lastJobId);
        onUploadSuccess(lastJobId);
      } else {
        console.log(
          "Not calling onUploadSuccess. lastJobId:",
          lastJobId,
          "onUploadSuccess:",
          !!onUploadSuccess
        );
      }

      // Reset status after 3 seconds
      setTimeout(() => {
        setUploadStatus("idle");
        setUploadProgress(0);
      }, 3000);
    } catch (err: any) {
      setUploadStatus("error");
      setError(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>Upload Files</CardTitle>
      </CardHeader>

      <CardContent>
        <div className="space-y-6">
          {/* Schema Configuration */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Schema Name
              </label>
              <input
                type="text"
                value={schemaName}
                onChange={(e) => setSchemaName(e.target.value)}
                placeholder="e.g., data_extraction"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                JSON Schema
              </label>
              <textarea
                value={schema}
                onChange={(e) => setSchema(e.target.value)}
                placeholder='{"type": "object", "properties": {...}}'
                rows={6}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
              />
            </div>
          </div>

          {/* File Drop Zone */}
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors duration-200 ${
              isDragOver
                ? "border-blue-400 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="text-4xl">📄</div>
              <div>
                <p className="text-lg font-medium text-gray-700">
                  Drop PDF files here or click to browse
                </p>
                <p className="text-sm text-gray-500">
                  Only PDF files are supported
                </p>
              </div>
              <Button
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
              >
                Choose Files
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          </div>

          {/* Selected Files */}
          {selectedFiles.length > 0 && (
            <div className="space-y-2">
              <h4 className="font-medium text-gray-700">Selected Files:</h4>
              <div className="space-y-2">
                {selectedFiles.map((file, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="text-2xl">📄</div>
                      <div>
                        <p className="font-medium text-gray-700">{file.name}</p>
                        <p className="text-sm text-gray-500">
                          {formatFileSize(file.size)}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="error"
                      size="sm"
                      onClick={() => removeFile(index)}
                      disabled={uploading}
                    >
                      Remove
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* Upload Progress */}
          {uploading && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span>Uploading...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            </div>
          )}

          {/* Upload Status */}
          {uploadStatus === "success" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center space-x-2 p-3 bg-green-50 border border-green-200 rounded-lg"
            >
              <StatusIndicator status="success">Success</StatusIndicator>
              <span className="text-green-700">
                Files uploaded successfully!
              </span>
            </motion.div>
          )}

          {uploadStatus === "error" && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-lg"
            >
              <StatusIndicator status="error">Error</StatusIndicator>
              <span className="text-red-700">{error}</span>
            </motion.div>
          )}

          {/* Error Display */}
          {error && uploadStatus !== "error" && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          {/* Upload Button */}
          <Button
            variant="primary"
            onClick={handleUpload}
            loading={uploading}
            disabled={selectedFiles.length === 0 || !schema.trim()}
            className="w-full"
          >
            {uploading ? "Uploading..." : "Upload Files"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default FileUpload;
