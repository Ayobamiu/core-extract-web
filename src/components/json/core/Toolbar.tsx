"use client";

import React from "react";
import { Button, Segmented, Space, Tooltip, message } from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  UploadOutlined,
  SaveOutlined,
  CloseOutlined,
  FormatPainterOutlined,
  CompressOutlined,
  SearchOutlined,
  AppstoreOutlined,
  CodeOutlined,
  DiffOutlined,
} from "@ant-design/icons";
import type { JsonMode, ToolbarItem } from "../types";

interface ToolbarProps {
  items: ToolbarItem[];
  mode: JsonMode;
  onModeChange: (mode: JsonMode) => void;
  modesEnabled: { code: boolean; tree: boolean; diff: boolean };
  text: string;
  isValid: boolean;
  readOnly?: boolean;
  saving?: boolean;
  saveLabel?: string;
  cancelLabel?: string;
  onFormat: () => boolean;
  onMinify: () => boolean;
  onCopy: () => void;
  onDownload: () => void;
  onUpload: (file: File) => Promise<void>;
  onSearch?: () => void;
  onSave?: () => void;
  onCancel?: () => void;
  size?: "small" | "middle";
  extra?: React.ReactNode;
}

const Toolbar: React.FC<ToolbarProps> = ({
  items,
  mode,
  onModeChange,
  modesEnabled,
  isValid,
  readOnly,
  saving,
  saveLabel = "Save",
  cancelLabel = "Cancel",
  onFormat,
  onMinify,
  onCopy,
  onDownload,
  onUpload,
  onSearch,
  onSave,
  onCancel,
  size = "small",
  extra,
}) => {
  const includes = (item: ToolbarItem) => items.includes(item);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const modeOptions = [
    modesEnabled.code && {
      label: (
        <Tooltip title="Code">
          <CodeOutlined />
        </Tooltip>
      ),
      value: "code",
    },
    modesEnabled.tree && {
      label: (
        <Tooltip title="Tree">
          <AppstoreOutlined />
        </Tooltip>
      ),
      value: "tree",
    },
    modesEnabled.diff && {
      label: (
        <Tooltip title="Diff">
          <DiffOutlined />
        </Tooltip>
      ),
      value: "diff",
    },
  ].filter(Boolean) as Array<{ label: React.ReactNode; value: string }>;

  return (
    <div className="flex-shrink-0 flex items-center flex-wrap gap-2 px-3 py-2 border-b border-[var(--ant-color-border,#e5e7eb)] bg-[var(--ant-color-bg-container,#fafafa)]">
      {includes("mode") && modeOptions.length > 1 && (
        <Segmented
          size={size}
          value={mode}
          onChange={(v) => onModeChange(v as JsonMode)}
          options={modeOptions}
        />
      )}
      <Space size={4} wrap>
        {includes("format") && mode === "code" && !readOnly && (
          <Tooltip title="Format JSON">
            <Button
              size={size}
              type="text"
              icon={<FormatPainterOutlined />}
              onClick={() => {
                const ok = onFormat();
                if (!ok) message.error("Cannot format invalid JSON");
              }}
              disabled={!isValid}
            />
          </Tooltip>
        )}
        {includes("minify") && mode === "code" && !readOnly && (
          <Tooltip title="Minify JSON">
            <Button
              size={size}
              type="text"
              icon={<CompressOutlined />}
              onClick={() => {
                const ok = onMinify();
                if (!ok) message.error("Cannot minify invalid JSON");
              }}
              disabled={!isValid}
            />
          </Tooltip>
        )}
        {includes("search") && mode === "code" && (
          <Tooltip title="Search (⌘/Ctrl + F)">
            <Button
              size={size}
              type="text"
              icon={<SearchOutlined />}
              onClick={onSearch}
            />
          </Tooltip>
        )}
        {includes("copy") && (
          <Tooltip title="Copy JSON">
            <Button
              size={size}
              type="text"
              icon={<CopyOutlined />}
              onClick={onCopy}
            />
          </Tooltip>
        )}
        {includes("download") && (
          <Tooltip title="Download .json">
            <Button
              size={size}
              type="text"
              icon={<DownloadOutlined />}
              onClick={onDownload}
            />
          </Tooltip>
        )}
        {includes("upload") && !readOnly && (
          <Tooltip title="Upload .json">
            <Button
              size={size}
              type="text"
              icon={<UploadOutlined />}
              onClick={() => fileRef.current?.click()}
            />
            <input
              ref={fileRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) {
                  await onUpload(file);
                  e.target.value = "";
                }
              }}
            />
          </Tooltip>
        )}
      </Space>
      <div className="flex-1" />
      {extra}
      {(includes("cancel") || includes("save")) && (
        <Space size={4}>
          {includes("cancel") && (
            <Button
              size={size}
              icon={<CloseOutlined />}
              onClick={onCancel}
              disabled={saving}
            >
              {cancelLabel}
            </Button>
          )}
          {includes("save") && !readOnly && (
            <Button
              size={size}
              type="primary"
              icon={<SaveOutlined />}
              onClick={onSave}
              loading={saving}
              disabled={!isValid || !onSave}
            >
              {saveLabel}
            </Button>
          )}
        </Space>
      )}
    </div>
  );
};

export default Toolbar;
