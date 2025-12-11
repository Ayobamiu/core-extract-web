"use client";

import React from "react";
import { Drawer, Button } from "antd";
import { ExportOutlined } from "@ant-design/icons";
import { useParams } from "next/navigation";
import { WellboreDiagram } from "./WellboreDiagram";

interface MGSWellData {
  formations?: Array<{
    from: number | null;
    to: number | null;
    name: string | null;
  }>;
  casing?: Array<{
    type: "Drive" | "Surface" | "Intermediate" | "Production" | null;
    size: number | null;
    Interval: number | null;
    cement_type?: string | null;
    bags_of_cement?: number | null;
  }>;
  perforation_intervals?: Array<{ from: number | null; to: number | null }>;
  pluggings?: Array<{
    depth: number | null;
    interval: string | null;
    type: string | null;
    details?: string | null;
  }>;
  shows_depths?: Array<{
    depth: number | string | null;
    formation: string | null;
    oil_or_gas: "oil" | "gas" | null;
  }>;
  target_zone?: string | null;
  true_depth?: number | null;
  measured_depth?: number | null;
  deviation?: "Straight" | "Deviated" | "Horizontal" | null;
  elevation?: number | null;
  elevation_datum?: string | null;
}

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
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleOpenInNewWindow}
            size="small"
            className="ml-4 flex-shrink-0"
          >
            New Window
          </Button>
        </div>
      }
      placement="right"
      onClose={onClose}
      open={open}
      width={900}
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
