"use client";

import React, { useCallback, useMemo } from "react";
import CodeMirror, {
  EditorView,
  type ReactCodeMirrorRef,
} from "@uiw/react-codemirror";
import { json, jsonParseLinter } from "@codemirror/lang-json";
import { linter, lintGutter } from "@codemirror/lint";
import { search, openSearchPanel } from "@codemirror/search";
import { foldGutter } from "@codemirror/language";
import { getCodeMirrorTheme } from "./theme";

export interface JsonCodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  theme?: "light" | "dark";
  height?: string | number;
  minHeight?: string | number;
  maxHeight?: string | number;
  showLineNumbers?: boolean;
  placeholder?: string;
  editorRef?: React.RefObject<ReactCodeMirrorRef | null>;
  autoFocus?: boolean;
}

const JsonCodeEditor: React.FC<JsonCodeEditorProps> = ({
  value,
  onChange,
  readOnly,
  theme = "light",
  height,
  minHeight,
  maxHeight,
  showLineNumbers = true,
  placeholder,
  editorRef,
  autoFocus = false,
}) => {
  const extensions = useMemo(
    () => [
      json(),
      linter(jsonParseLinter()),
      lintGutter(),
      search({ top: true }),
      foldGutter(),
      EditorView.lineWrapping,
      ...getCodeMirrorTheme(theme),
    ],
    [theme],
  );

  const handleChange = useCallback(
    (next: string) => {
      onChange?.(next);
    },
    [onChange],
  );

  return (
    <div
      className="json-code-editor"
      style={{
        height: typeof height === "number" ? `${height}px` : height ?? "100%",
        minHeight:
          typeof minHeight === "number" ? `${minHeight}px` : minHeight,
        maxHeight:
          typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
        position: "relative",
        overflow: "hidden",
      }}
      onKeyDownCapture={(e) => {
        // Cmd/Ctrl + F to open CodeMirror's search panel
        if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "f") {
          if (editorRef?.current?.view) {
            e.preventDefault();
            openSearchPanel(editorRef.current.view);
          }
        }
      }}
    >
      <CodeMirror
        ref={editorRef}
        value={value}
        extensions={extensions}
        onChange={handleChange}
        readOnly={readOnly}
        editable={!readOnly}
        height="100%"
        basicSetup={{
          lineNumbers: showLineNumbers,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: false,
          autocompletion: false,
          searchKeymap: true,
          drawSelection: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          syntaxHighlighting: false,
          dropCursor: true,
        }}
        placeholder={placeholder}
        theme="none"
        autoFocus={autoFocus}
        style={{ height: "100%" }}
      />
    </div>
  );
};

export default JsonCodeEditor;
