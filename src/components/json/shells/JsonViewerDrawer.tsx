"use client";

import React from "react";
import { Drawer } from "antd";
import JsonViewer, { type JsonViewerProps } from "../JsonViewer";

export interface JsonViewerDrawerProps extends JsonViewerProps {
  open: boolean;
  onClose: () => void;
  drawerTitle?: React.ReactNode;
  width?: number | string;
  placement?: "left" | "right" | "top" | "bottom";
  destroyOnClose?: boolean;
}

const JsonViewerDrawer: React.FC<JsonViewerDrawerProps> = ({
  open,
  onClose,
  drawerTitle,
  width = "min(720px, 92vw)",
  placement = "right",
  destroyOnClose = true,
  height = "100%",
  onCancel,
  ...rest
}) => {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={drawerTitle ?? rest.title ?? "JSON"}
      width={width}
      placement={placement}
      destroyOnClose={destroyOnClose}
      styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
    >
      <JsonViewer
        {...rest}
        title={undefined}
        height={height}
        bordered={false}
        onCancel={() => {
          onCancel?.();
          onClose();
        }}
        withSaveCancel
      />
    </Drawer>
  );
};

export default JsonViewerDrawer;
