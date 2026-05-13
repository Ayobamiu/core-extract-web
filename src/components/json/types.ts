import type React from "react";

export type JsonValue = unknown;

export type JsonMode = "code" | "tree" | "diff";

export type ToolbarItem =
  | "mode"
  | "format"
  | "minify"
  | "copy"
  | "download"
  | "upload"
  | "search"
  | "expand-all"
  | "collapse-all"
  | "save"
  | "cancel";

export interface JsonChangePayload {
  text: string;
  value: JsonValue;
  isValid: boolean;
  error?: string;
}

export interface JsonViewerCommonProps {
  // Value — either provide `value` (object form, will be stringified) OR `text`
  // (raw text form, preserves user formatting). Use `text` for schema-style
  // editors where invalid intermediate JSON is allowed during typing.
  value?: JsonValue;
  defaultValue?: JsonValue;
  text?: string;
  defaultText?: string;

  // Editing
  onChange?: (payload: JsonChangePayload) => void;
  onValueChange?: (value: JsonValue) => void;
  readOnly?: boolean;

  // Mode control
  mode?: JsonMode | "auto";
  defaultMode?: JsonMode;
  onModeChange?: (mode: JsonMode) => void;

  // Diff
  compareWith?: JsonValue;
  compareLabel?: string;
  currentLabel?: string;

  // Schema (Phase 2 — accepted now so callers can pass it without API churn)
  schema?: Record<string, unknown>;

  // Layout
  height?: number | string;
  maxHeight?: number | string;
  minHeight?: number | string;
  size?: "compact" | "comfortable";

  // Toolbar / chrome
  title?: React.ReactNode;
  description?: React.ReactNode;
  toolbar?: ToolbarItem[] | boolean;
  extraActions?: React.ReactNode;
  showSearch?: boolean;
  showStatusBar?: boolean;
  showLineNumbers?: boolean;
  bordered?: boolean;

  // Save / Cancel hooks
  onSave?: (payload: { text: string; value: JsonValue }) => void | Promise<void>;
  onCancel?: () => void;
  saveLabel?: string;
  cancelLabel?: string;
  saving?: boolean;

  // Theming
  theme?: "light" | "dark" | "auto";

  // Misc
  placeholder?: string;
  emptyText?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
}
