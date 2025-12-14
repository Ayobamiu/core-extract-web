"use client";

import React from "react";
import { Drawer, Button } from "antd";
import { ExportOutlined, FullscreenOutlined } from "@ant-design/icons";
import { useParams } from "next/navigation";
import { WellboreDiagram } from "./WellboreDiagram";

// Import the interface from WellboreDiagram to ensure consistency
import type { MGSWellData } from "./WellboreDiagram";

// Re-export for backward compatibility
export type { MGSWellData };

interface WellboreDiagramDrawerProps {
  open: boolean;
  onClose: () => void;
  data: MGSWellData | null;
  filename?: string;
  previewId?: string; // Preview/job ID for navigation
}

export const WellboreDiagramDrawer: React.FC<WellboreDiagramDrawerProps> = ({
  open,
  onClose,
  data,
  filename,
  previewId,
}) => {
  const params = useParams();

  if (!data) return null;

  const handleOpenInNewWindow = () => {
    // Use previewId prop if provided, otherwise try to get from params
    const id = previewId || (params?.id as string);

    if (!id) {
      console.error("No preview ID available for navigation");
      return;
    }

    // Build URL with filename query parameter
    const url = `/wellbore/${id}${
      filename ? `?filename=${encodeURIComponent(filename)}` : ""
    }`;

    // Open in new tab
    window.open(url, "_blank");
  };

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between w-full pr-4">
          <span className="flex-1 truncate">
            Wellbore Diagram{filename ? ` - ${filename}` : ""}
          </span>
          <Button
            type="text"
            icon={<FullscreenOutlined />}
            onClick={handleOpenInNewWindow}
            size="small"
            className="ml-4 flex-shrink-0"
          >
            Open in new tab
          </Button>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width="90vw"
      mask={true}
      maskClosable={true}
      destroyOnClose
    >
      <div className="flex justify-center py-4 overflow-auto">
        <WellboreDiagram data={data} size="large" />
      </div>
    </Drawer>
  );
};

// Keep the old export name for backward compatibility
export const WellboreDiagramModal = WellboreDiagramDrawer;
