"use client";

import React from "react";
import { Drawer } from "antd";
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
}

export const WellboreDiagramDrawer: React.FC<WellboreDiagramDrawerProps> = ({
  open,
  onClose,
  data,
  filename,
}) => {
  if (!data) return null;

  return (
    <Drawer
      title={`Wellbore Diagram${filename ? ` - ${filename}` : ""}`}
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
