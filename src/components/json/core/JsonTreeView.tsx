"use client";

import React, { useMemo } from "react";
import JsonView from "@uiw/react-json-view";
import type { JsonValue } from "../types";

export interface JsonTreeViewProps {
  value: JsonValue;
  theme?: "light" | "dark";
  collapsed?: number | boolean;
  emptyText?: React.ReactNode;
}

const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  value,
  theme = "light",
  collapsed = 2,
  emptyText,
}) => {
  const isObjectLike = useMemo(() => {
    return value !== undefined && value !== null && typeof value === "object";
  }, [value]);

  if (!isObjectLike) {
    if (value === undefined || value === null) {
      return (
        <div
          className="text-sm text-[var(--ant-color-text-tertiary,#6b7280)] p-4"
          aria-live="polite"
        >
          {emptyText ?? "No data to display."}
        </div>
      );
    }
    return (
      <div className="font-mono text-sm p-4 break-all text-[var(--ant-color-text,#1f2937)]">
        {JSON.stringify(value)}
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-auto p-3 json-tree-view">
      <JsonView
        value={value as object}
        collapsed={collapsed}
        displayDataTypes={false}
        displayObjectSize={false}
        enableClipboard={true}
        style={{
          backgroundColor: "transparent",
          fontSize: "13px",
          fontFamily:
            'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
          // CSS var consumed by react-json-view for default text color
          ...(theme === "dark"
            ? ({ ["--w-rjv-color" as string]: "rgb(229, 231, 235)" } as Record<
                string,
                string
              >)
            : {}),
        }}
      />
    </div>
  );
};

export default JsonTreeView;
