"use client";

import React from "react";
import { Drawer, Button, Typography } from "antd";
import {
  FilePdfOutlined,
  CheckCircleOutlined,
  FileTextOutlined,
  ReloadOutlined,
  InfoCircleOutlined,
} from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import TabbedDataViewer from "@/components/ui/TabbedDataViewer";
import ConstraintErrorIcon from "@/components/ui/ConstraintErrorIcon";
import { Loader } from "lucide-react";
import { ExclamationCircleOutlined } from "@ant-design/icons";

const { Text } = Typography;

interface FileResultsDrawerProps {
  file: JobFile | null;
  open: boolean;
  onClose: () => void;
  onOpenFileDetails: (file: JobFile) => void;
  onUpdateReviewStatus: (
    fileId: string,
    status: "reviewed" | "pending"
  ) => void;
  onVerifyFile: (fileId: string, verified: boolean) => void;
  onReviewAndVerifyFile: (fileId: string) => void;
  onReprocessFile: (fileId: string) => void;
  onUpdateResults: (fileId: string, updatedData: any) => Promise<void>;
  onDataUpdate?: (() => void) | (() => Promise<void>);
  reviewingFileId: string | null;
  verifyingFileId: string | null;
  reprocessingFileId: string | null;
  isAdmin: boolean;
  comments: Array<{
    id: string;
    userId: string;
    userEmail: string;
    text: string;
    createdAt: string;
  }>;
  onAddComment: (text: string) => Promise<void>;
  jobSchema: any;
}

const FileResultsDrawer: React.FC<FileResultsDrawerProps> = ({
  file,
  open,
  onClose,
  onOpenFileDetails,
  onUpdateReviewStatus,
  onVerifyFile,
  onReviewAndVerifyFile,
  onReprocessFile,
  onUpdateResults,
  onDataUpdate,
  reviewingFileId,
  verifyingFileId,
  reprocessingFileId,
  isAdmin,
  comments,
  onAddComment,
  jobSchema,
}) => {
  const handleUpdate = async (updatedData: any) => {
    if (!file) return;
    await onUpdateResults(file.id, updatedData);
    if (onDataUpdate) {
      const result = onDataUpdate();
      if (result instanceof Promise) {
        await result;
      }
    }
  };

  return (
    <Drawer
      title={
        file ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center space-x-2">
              <FilePdfOutlined className="text-blue-500" />
              <span className="font-medium">{file.filename}</span>
            </div>
            <div className="flex items-center space-x-2">
              <ConstraintErrorIcon file={file} />
              <Button
                type="text"
                icon={<InfoCircleOutlined />}
                onClick={() => onOpenFileDetails(file)}
                title="View File Details"
              />
            </div>
          </div>
        ) : (
          "File Results"
        )
      }
      placement="right"
      size="large"
      onClose={onClose}
      open={open}
      width={800}
      extra={
        <div className="flex items-center space-x-2">
          {file && (
            <>
              <Button
                type={file.review_status === "reviewed" ? "default" : "primary"}
                icon={
                  reviewingFileId === file.id ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : file.review_status === "reviewed" ? (
                    <CheckCircleOutlined style={{ color: "#52c41a" }} />
                  ) : (
                    <FileTextOutlined />
                  )
                }
                onClick={() =>
                  onUpdateReviewStatus(
                    file.id,
                    file.review_status === "reviewed" ? "pending" : "reviewed"
                  )
                }
                disabled={reviewingFileId === file.id}
                loading={reviewingFileId === file.id}
                style={
                  file.review_status === "reviewed"
                    ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                    : {}
                }
              >
                {reviewingFileId === file.id
                  ? "Updating..."
                  : file.review_status === "reviewed"
                  ? "Reviewed"
                  : "Mark as Reviewed"}
              </Button>
              {isAdmin && (
                <Button
                  type={file.admin_verified ? "default" : "primary"}
                  icon={
                    verifyingFileId === file.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : file.admin_verified ? (
                      <CheckCircleOutlined style={{ color: "#52c41a" }} />
                    ) : (
                      <CheckCircleOutlined />
                    )
                  }
                  onClick={() => onVerifyFile(file.id, !file.admin_verified)}
                  disabled={file.admin_verified || verifyingFileId === file.id}
                  loading={verifyingFileId === file.id}
                  style={
                    file.admin_verified
                      ? { backgroundColor: "#f6ffed", borderColor: "#52c41a" }
                      : {}
                  }
                >
                  {verifyingFileId === file.id
                    ? "Verifying..."
                    : file.admin_verified
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
                    reviewingFileId === file.id ||
                    verifyingFileId === file.id ? (
                      <Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircleOutlined />
                    )
                  }
                  onClick={() => onReviewAndVerifyFile(file.id)}
                  disabled={
                    reviewingFileId === file.id || verifyingFileId === file.id
                  }
                  loading={
                    reviewingFileId === file.id || verifyingFileId === file.id
                  }
                >
                  {reviewingFileId === file.id || verifyingFileId === file.id
                    ? "Updating..."
                    : "Review & Verify"}
                </Button>
              )}
              <Button
                type="default"
                icon={
                  reprocessingFileId === file.id ||
                  file.extraction_status === "processing" ||
                  file.processing_status === "processing" ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <ReloadOutlined />
                  )
                }
                onClick={() => onReprocessFile(file.id)}
                disabled={
                  reprocessingFileId === file.id ||
                  file.extraction_status === "processing" ||
                  file.processing_status === "processing"
                }
                loading={
                  reprocessingFileId === file.id ||
                  file.extraction_status === "processing" ||
                  file.processing_status === "processing"
                }
              >
                {reprocessingFileId === file.id ||
                file.extraction_status === "processing" ||
                file.processing_status === "processing"
                  ? "Processing..."
                  : "Reprocess"}
              </Button>
            </>
          )}
          <Button type="text" onClick={onClose}>
            Close
          </Button>
        </div>
      }
    >
      {file && (
        <div className="h-full">
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
              onUpdate={handleUpdate}
              comments={comments}
              onAddComment={onAddComment}
              fileId={file.id}
            />
          )}
        </div>
      )}
    </Drawer>
  );
};

export default FileResultsDrawer;
