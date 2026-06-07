"use client";

import React, { useMemo } from "react";
import JsonView from "@uiw/react-json-view";
import { Tooltip } from "antd";
import type { JsonValue } from "../types";
import { descriptionForPath } from "@/lib/schemaDescriptions";

export interface JsonTreeViewProps {
  value: JsonValue;
  theme?: "light" | "dark";
  collapsed?: number | boolean;
  emptyText?: React.ReactNode;
  /** dot.path -> field description; renders a hover tooltip on matching keys. */
  descriptions?: Record<string, string>;
}

const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  value,
  theme = "light",
  collapsed = 2,
  emptyText,
  descriptions,
}) => {
  const hasDescriptions = !!descriptions && Object.keys(descriptions).length > 0;
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
      >
        {hasDescriptions && (
          <JsonView.KeyName
            render={(props, { keyName, keys }) => {
              const { children, ...rest } = props as React.HTMLAttributes<HTMLSpanElement> & {
                children?: React.ReactNode;
              };
              // `keys` is the full path INCLUDING this node's own key. Array
              // element indices come through as numeric keys — they're not
              // schema fields, so skip the tooltip on them.
              const isIndex = typeof keyName === "number";
              const fullPath = ((keys as Array<string | number>) ??
                (keyName != null ? [keyName as string | number] : [])) as Array<string | number>;
              const desc = isIndex ? undefined : descriptionForPath(fullPath, descriptions!);
              if (!desc) return <span {...rest}>{children}</span>;
              return (
                <Tooltip title={desc} mouseEnterDelay={0.3} placement="top">
                  <span
                    {...rest}
                    style={{
                      ...(rest.style || {}),
                      borderBottom: "1px dotted currentColor",
                      cursor: "help",
                    }}
                  >
                    {children}
                  </span>
                </Tooltip>
              );
            }}
          />
        )}
      </JsonView>
    </div>
  );
};

export default JsonTreeView;
