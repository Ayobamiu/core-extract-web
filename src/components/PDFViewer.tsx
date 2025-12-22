"use client";

import React, { useEffect, useState } from "react";
import { Spin } from "antd";

interface PDFViewerProps {
  file: File;
  numPages: number | null;
  selectedPages: number[];
  onLoadSuccess: (data: { numPages: number }) => void;
  onLoadError?: (error: Error) => void;
  onTogglePage: (pageNumber: number) => void;
}

const PDFViewer: React.FC<PDFViewerProps> = ({
  file,
  numPages,
  selectedPages,
  onLoadSuccess,
  onTogglePage,
}) => {
  const [fileUrl, setFileUrl] = useState<string | null>(null);

  // Create blob URL from file for iframe
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      return () => {
        URL.revokeObjectURL(url);
      };
    }
  }, [file]);

  if (!fileUrl) {
    return (
      <div className="flex items-center justify-center h-full">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <iframe
      src={fileUrl}
      className="w-full h-full border-0"
      style={{ minHeight: "100%" }}
      title={`PDF viewer for ${file.name}`}
    />
  );
};

export default PDFViewer;
