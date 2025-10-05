"use client";

import React, { useState, useCallback, useRef } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import {
  DocumentIcon,
  TrashIcon,
  CloudArrowUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

export interface UploadedFile {
  id: string;
  file: File;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress: number;
  error?: string;
}

interface FileUploadStepProps {
  files: UploadedFile[];
  onFilesChange: (files: UploadedFile[]) => void;
  onNext: () => void;
  onBack: () => void;
  jobName?: string;
  schemaName?: string;
}

const SUPPORTED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "image/png",
  "image/jpeg",
];
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

export function FileUploadStep({
  files,
  onFilesChange,
  onNext,
  onBack,
  jobName,
  schemaName,
}: FileUploadStepProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9);
  }, []);

  const validateFile = useCallback((file: File): string | null => {
    if (!SUPPORTED_TYPES.includes(file.type)) {
      return `File type ${file.type} is not supported. Please upload PDF, DOCX, TXT, PNG, or JPG files.`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `File size ${(file.size / 1024 / 1024).toFixed(
        1
      )}MB exceeds the maximum limit of 50MB.`;
    }
    return null;
  }, []);

  const addFiles = useCallback(
    (newFiles: FileList | File[]) => {
      const fileArray = Array.from(newFiles);
      const validFiles: UploadedFile[] = [];
      const errors: string[] = [];

      fileArray.forEach((file) => {
        const error = validateFile(file);
        if (error) {
          errors.push(`${file.name}: ${error}`);
        } else {
          validFiles.push({
            id: generateId(),
            file,
            status: "pending",
            progress: 0,
          });
        }
      });

      if (errors.length > 0) {
        // Show error notification
        console.error("File validation errors:", errors);
      }

      if (validFiles.length > 0) {
        onFilesChange([...files, ...validFiles]);
      }
    },
    [files, onFilesChange, validateFile, generateId]
  );

  const removeFile = useCallback(
    (id: string) => {
      onFilesChange(files.filter((file) => file.id !== id));
    },
    [files, onFilesChange]
  );

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const droppedFiles = e.dataTransfer.files;
      if (droppedFiles.length > 0) {
        addFiles(droppedFiles);
      }
    },
    [addFiles]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = e.target.files;
      if (selectedFiles && selectedFiles.length > 0) {
        addFiles(selectedFiles);
      }
      // Reset input value to allow selecting the same file again
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [addFiles]
  );

  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  }, []);

  const getFileIcon = useCallback((file: File) => {
    if (file.type === "application/pdf") return "📄";
    if (file.type.includes("word")) return "📝";
    if (file.type.includes("text")) return "📃";
    if (file.type.includes("image")) return "🖼️";
    return "📁";
  }, []);

  const getStatusIcon = useCallback((file: UploadedFile) => {
    switch (file.status) {
      case "uploaded":
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      case "error":
        return <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />;
      case "uploading":
        return <ClockIcon className="h-5 w-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="h-5 w-5 text-gray-400" />;
    }
  }, []);

  const getStatusText = useCallback((file: UploadedFile) => {
    switch (file.status) {
      case "uploaded":
        return "Ready";
      case "error":
        return "Error";
      case "uploading":
        return "Uploading...";
      default:
        return "Pending";
    }
  }, []);

  const canProceed =
    files.length > 0 &&
    files.every(
      (file) => file.status === "uploaded" || file.status === "pending"
    );

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Upload Files</h1>
            <p className="text-gray-600 mt-2">
              Select the documents you want to process
            </p>
            {(jobName || schemaName) && (
              <div className="mt-2 text-sm text-gray-500">
                {jobName && (
                  <span>
                    Job: <strong>{jobName}</strong>
                  </span>
                )}
                {schemaName && (
                  <span className="ml-4">
                    Schema: <strong>{schemaName}</strong>
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Step 2 of 2
          </div>
        </div>
      </div>

      {/* Drag & Drop Area */}
      <Card className="p-8 mb-6">
        <div
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragOver
              ? "border-blue-500 bg-blue-50"
              : "border-gray-300 hover:border-gray-400"
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <CloudArrowUpIcon className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Drag & Drop Files Here
          </h3>
          <p className="text-gray-600 mb-4">or click to browse your computer</p>
          <Button
            onClick={() => fileInputRef.current?.click()}
            variant="secondary"
            className="mb-4"
          >
            Choose Files
          </Button>
          <div className="text-sm text-gray-500">
            <p>Supported: PDF, DOCX, TXT, PNG, JPG</p>
            <p>Max size: 50MB per file</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept=".pdf,.docx,.txt,.png,.jpg,.jpeg"
          onChange={handleFileInput}
          className="hidden"
        />
      </Card>

      {/* Selected Files */}
      {files.length > 0 && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">
              Selected Files ({files.length})
            </h3>
            <div className="text-sm text-gray-500">
              Total size:{" "}
              {formatFileSize(
                files.reduce((sum, file) => sum + file.file.size, 0)
              )}
            </div>
          </div>

          <div className="space-y-3">
            {files.map((file) => (
              <div
                key={file.id}
                className="flex items-center gap-4 p-4 border border-gray-200 rounded-lg"
              >
                {/* File Icon */}
                <div className="text-2xl">{getFileIcon(file.file)}</div>

                {/* File Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900 truncate">
                      {file.file.name}
                    </p>
                    {getStatusIcon(file)}
                    <span
                      className={`text-sm ${
                        file.status === "uploaded"
                          ? "text-green-600"
                          : file.status === "error"
                          ? "text-red-600"
                          : file.status === "uploading"
                          ? "text-blue-600"
                          : "text-gray-500"
                      }`}
                    >
                      {getStatusText(file)}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-gray-500">
                    <span>{formatFileSize(file.file.size)}</span>
                    <span>{file.file.type}</span>
                    {file.status === "uploading" && (
                      <div className="flex items-center gap-2">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${file.progress}%` }}
                          />
                        </div>
                        <span>{file.progress}%</span>
                      </div>
                    )}
                  </div>
                  {file.error && (
                    <p className="text-sm text-red-600 mt-1">{file.error}</p>
                  )}
                </div>

                {/* Remove Button */}
                <Button
                  onClick={() => removeFile(file.id)}
                  variant="secondary"
                  size="sm"
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <TrashIcon className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Processing Preview */}
      {files.length > 0 && (
        <Card className="p-6 mt-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Processing Preview
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Files to process:</span>
              <span className="ml-2 font-medium">{files.length}</span>
            </div>
            <div>
              <span className="text-gray-600">Total size:</span>
              <span className="ml-2 font-medium">
                {formatFileSize(
                  files.reduce((sum, file) => sum + file.file.size, 0)
                )}
              </span>
            </div>
            <div>
              <span className="text-gray-600">Estimated time:</span>
              <span className="ml-2 font-medium">
                {Math.ceil(files.length * 0.5)} - {Math.ceil(files.length * 2)}{" "}
                minutes
              </span>
            </div>
            <div>
              <span className="text-gray-600">Schema:</span>
              <span className="ml-2 font-medium">
                {schemaName || "Not specified"}
              </span>
            </div>
          </div>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between mt-8">
        <Button onClick={onBack} variant="secondary">
          ← Back to Schema
        </Button>
        <Button onClick={onNext} disabled={!canProceed} className="ml-auto">
          Start Processing →
        </Button>
      </div>
    </div>
  );
}
