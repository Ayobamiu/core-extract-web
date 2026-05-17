"use client";

import React from "react";
import { Modal } from "antd";
import JsonViewer, { type JsonViewerProps } from "../JsonViewer";

export interface JsonViewerModalProps extends JsonViewerProps {
  open: boolean;
  onClose: () => void;
  modalTitle?: React.ReactNode;
  width?: number | string;
  maskClosable?: boolean;
  destroyOnHidden?: boolean;
}

const JsonViewerModal: React.FC<JsonViewerModalProps> = ({
  open,
  onClose,
  modalTitle,
  width = "min(960px, 92vw)",
  maskClosable = false,
  destroyOnHidden = true,
  height = "70vh",
  onCancel,
  ...rest
}) => {
  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={modalTitle ?? rest.title ?? "JSON"}
      footer={null}
      width={width}
      maskClosable={maskClosable}
      destroyOnHidden={destroyOnHidden}
      styles={{ body: { padding: 0 } }}
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
    </Modal>
  );
};

export default JsonViewerModal;
