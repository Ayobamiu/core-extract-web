"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { App as AntdApp, ConfigProvider, theme as antdTheme } from "antd";
import { openSearchPanel } from "@codemirror/search";
import type { ReactCodeMirrorRef } from "@uiw/react-codemirror";
import JsonCodeEditor from "./core/JsonCodeEditor";
import JsonTreeView from "./core/JsonTreeView";
import JsonDiffView from "./core/JsonDiffView";
import Toolbar from "./core/Toolbar";
import StatusBar from "./core/StatusBar";
import { useJsonEditor } from "./hooks/useJsonEditor";
import type { JsonMode, JsonViewerCommonProps, ToolbarItem } from "./types";

const DEFAULT_TOOLBAR: ToolbarItem[] = [
  "mode",
  "format",
  "minify",
  "wrap",
  "search",
  "copy",
  "download",
];

const READONLY_TOOLBAR: ToolbarItem[] = [
  "mode",
  "wrap",
  "search",
  "copy",
  "download",
];

export interface JsonViewerProps extends JsonViewerCommonProps {
  /** Internal: when true, toolbar gets save/cancel by default. */
  withSaveCancel?: boolean;
  /** dot.path -> field description; shows a hover tooltip on keys (tree mode). */
  descriptions?: Record<string, string>;
}

function deriveMode(opts: {
  mode?: JsonMode | "auto";
  defaultMode?: JsonMode;
  hasCompare: boolean;
  size: number;
}): JsonMode {
  if (opts.mode && opts.mode !== "auto") return opts.mode;
  if (opts.defaultMode) return opts.defaultMode;
  if (opts.hasCompare) return "diff";
  // Default: tree for moderately-sized data, code for huge.
  if (opts.size > 200_000) return "code";
  return "tree";
}

/** CodeMirror / @uiw default is light; only use dark when explicitly requested. */
function resolveEditorTheme(theme: "light" | "dark" | "auto"): "light" | "dark" {
  return theme === "dark" ? "dark" : "light";
}

const JsonViewer: React.FC<JsonViewerProps> = (props) => {
  const {
    value,
    defaultValue,
    text: textProp,
    defaultText,
    onChange,
    onValueChange,
    readOnly = false,
    mode: modeProp,
    defaultMode,
    onModeChange,
    compareWith,
    compareLabel,
    currentLabel,
    height,
    maxHeight,
    minHeight,
    size = "comfortable",
    title,
    description,
    toolbar,
    extraActions,
    showStatusBar = true,
    showLineNumbers = true,
    lineWrap: lineWrapProp,
    defaultLineWrap = false,
    onLineWrapChange,
    bordered = true,
    onSave,
    onCancel,
    saveLabel,
    cancelLabel,
    saving,
    theme = "light",
    placeholder,
    emptyText,
    className,
    bodyClassName,
    withSaveCancel,
    descriptions,
  } = props;

  const editor = useJsonEditor({
    value,
    defaultValue,
    text: textProp,
    defaultText,
    readOnly,
    onChange,
    onValueChange,
  });

  const hasCompare = compareWith !== undefined;
  const initialMode = useMemo(
    () =>
      deriveMode({
        mode: modeProp,
        defaultMode,
        hasCompare,
        size: editor.text.length,
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [mode, setMode] = useState<JsonMode>(initialMode);
  const [internalLineWrap, setInternalLineWrap] = useState(defaultLineWrap);
  const lineWrap = lineWrapProp ?? internalLineWrap;
  const setLineWrap = useCallback(
    (wrap: boolean) => {
      if (lineWrapProp === undefined) setInternalLineWrap(wrap);
      onLineWrapChange?.(wrap);
    },
    [lineWrapProp, onLineWrapChange],
  );

  useEffect(() => {
    if (lineWrapProp !== undefined) setInternalLineWrap(lineWrapProp);
  }, [lineWrapProp]);

  useEffect(() => {
    if (modeProp && modeProp !== "auto" && modeProp !== mode) {
      setMode(modeProp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeProp]);

  const changeMode = useCallback(
    (next: JsonMode) => {
      setMode(next);
      onModeChange?.(next);
    },
    [onModeChange],
  );

  const codeRef = useRef<ReactCodeMirrorRef | null>(null);
  const themeMode = resolveEditorTheme(theme);

  const resolvedToolbarItems = useMemo<ToolbarItem[]>(() => {
    if (toolbar === false) return [];
    if (Array.isArray(toolbar)) return toolbar;
    const base = readOnly ? READONLY_TOOLBAR : DEFAULT_TOOLBAR;
    if (withSaveCancel || onSave || onCancel) {
      const extras: ToolbarItem[] = [];
      if (onCancel) extras.push("cancel");
      if (onSave && !readOnly) extras.push("save");
      return [...base, ...extras];
    }
    return base;
  }, [toolbar, readOnly, withSaveCancel, onSave, onCancel]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(editor.text);
    } catch {
      // ignored
    }
  }, [editor.text]);

  const handleDownload = useCallback(() => {
    const blob = new Blob([editor.text], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "data.json";
    a.click();
    URL.revokeObjectURL(url);
  }, [editor.text]);

  const handleUpload = useCallback(
    async (file: File) => {
      const text = await file.text();
      editor.setText(text);
    },
    [editor],
  );

  const handleSearch = useCallback(() => {
    if (codeRef.current?.view) openSearchPanel(codeRef.current.view);
  }, []);

  const handleSave = useCallback(async () => {
    if (!onSave) return;
    if (!editor.isValid) return;
    await onSave({ text: editor.text, value: editor.value });
    editor.markPristine(editor.text);
  }, [onSave, editor]);

  // Treat dirty saving with Cmd+S
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        if (onSave && editor.isValid && !readOnly) {
          e.preventDefault();
          void handleSave();
        }
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onSave, readOnly, editor.isValid, handleSave]);

  const modesEnabled = useMemo(
    () => ({
      code: true,
      tree: true,
      diff: hasCompare,
    }),
    [hasCompare],
  );

  // Ensure diff mode isn't active when there is no comparison.
  useEffect(() => {
    if (mode === "diff" && !hasCompare) setMode("tree");
  }, [mode, hasCompare]);

  const padding = size === "compact" ? "p-2" : "p-3";

  const containerStyle: React.CSSProperties = {
    height:
      typeof height === "number" ? `${height}px` : height ?? undefined,
    maxHeight:
      typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
    minHeight:
      typeof minHeight === "number" ? `${minHeight}px` : minHeight,
  };

  const isEmptyValue =
    editor.text.trim() === "" || editor.text.trim() === "null";

  return (
    <ConfigProvider
      theme={{
        algorithm:
          themeMode === "dark"
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
      }}
    >
      <AntdApp component={false}>
        <div
          className={[
            "json-viewer flex flex-col min-h-0 w-full overflow-hidden",
            bordered
              ? "border border-[var(--ant-color-border,#e5e7eb)] rounded-md"
              : "",
            "bg-[var(--ant-color-bg-container,#ffffff)]",
            className ?? "",
          ].join(" ")}
          style={containerStyle}
          data-theme={themeMode}
        >
          {(title || description) && (
            <div
              className={`flex-shrink-0 flex items-start justify-between gap-3 ${padding} border-b border-[var(--ant-color-border,#e5e7eb)] bg-[var(--ant-color-bg-container,#fafafa)]`}
            >
              <div className="min-w-0">
                {title && (
                  <div className="text-sm font-semibold text-[var(--ant-color-text,#1f2937)] truncate">
                    {title}
                  </div>
                )}
                {description && (
                  <div className="text-xs text-[var(--ant-color-text-secondary,#6b7280)] mt-0.5">
                    {description}
                  </div>
                )}
              </div>
              {extraActions && <div className="flex-shrink-0">{extraActions}</div>}
            </div>
          )}

          {resolvedToolbarItems.length > 0 && (
            <Toolbar
              items={resolvedToolbarItems}
              mode={mode}
              onModeChange={changeMode}
              modesEnabled={modesEnabled}
              text={editor.text}
              isValid={editor.isValid}
              readOnly={readOnly}
              saving={saving}
              saveLabel={saveLabel}
              cancelLabel={cancelLabel}
              onFormat={editor.format}
              onMinify={editor.minify}
              onCopy={handleCopy}
              onDownload={handleDownload}
              onUpload={handleUpload}
              onSearch={handleSearch}
              lineWrap={lineWrap}
              onLineWrapChange={setLineWrap}
              onSave={onSave ? handleSave : undefined}
              onCancel={onCancel}
            />
          )}

          <div
            className={[
              "flex-1 min-h-0 overflow-hidden",
              bodyClassName ?? "",
            ].join(" ")}
          >
            {mode === "code" && (
              <JsonCodeEditor
                value={editor.text}
                onChange={editor.setText}
                readOnly={readOnly}
                theme={themeMode}
                lineWrap={lineWrap}
                placeholder={placeholder}
                editorRef={codeRef}
                showLineNumbers={showLineNumbers}
              />
            )}
            {mode === "tree" && (
              <>
                {isEmptyValue ? (
                  <div className="text-sm text-[var(--ant-color-text-tertiary,#6b7280)] p-4">
                    {emptyText ?? "No data to display."}
                  </div>
                ) : (
                  <JsonTreeView
                    value={editor.value}
                    theme={themeMode}
                    emptyText={emptyText}
                    descriptions={descriptions}
                  />
                )}
              </>
            )}
            {mode === "diff" && hasCompare && (
              <JsonDiffView
                original={compareWith}
                current={editor.value}
                originalLabel={compareLabel}
                currentLabel={currentLabel}
                theme={themeMode}
              />
            )}
          </div>

          {showStatusBar && (
            <StatusBar
              isValid={editor.isValid}
              error={editor.error}
              bytes={editor.stats.bytes}
              lines={editor.stats.lines}
              dirty={editor.dirty && !readOnly}
            />
          )}
        </div>
      </AntdApp>
    </ConfigProvider>
  );
};

export default JsonViewer;
