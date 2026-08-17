"use client";

import React, { useMemo } from "react";
import JsonView from "@uiw/react-json-view";
import { Tooltip } from "antd";
import type { JsonValue } from "../types";
import { descriptionForPath } from "@/lib/schemaDescriptions";
import { joinFieldPath } from "@/lib/goldSetPaths";
import type { GoldLabel, GoldVerdict } from "@/lib/api";
import GoldVerdictControl from "@/components/gold/GoldVerdictControl";

/**
 * Gold-set review, hung off the tree.
 *
 * Reviewing in the tree rather than in a separate checklist means a field is
 * judged where it actually lives — at any depth, inside arrays, next to its
 * siblings. What the tree must NOT become is the thing that decides scope: the
 * seeded batch decides that, and `labelFor` is how a node learns it was
 * sampled. A field nobody sampled simply gets no control.
 */
export interface JsonTreeReview {
  /** The seeded label for a path, if the sample drew it. */
  labelFor: (fieldPath: string) => GoldLabel | undefined;
  /** Seeded leaves a verdict on this path would write (0 = nothing to judge). */
  targetCountFor: (fieldPath: string) => number;
  savingIds: Set<string>;
  onReview: (
    fieldPath: string,
    verdict: GoldVerdict | null,
    opts?: { trueValue?: string | null; notes?: string | null },
  ) => void;
  /** Path whose popover is open — lets the keyboard fast path drive the tree. */
  openPath?: string | null;
  onOpenPathChange?: (path: string | null) => void;
}

export interface JsonTreeViewProps {
  value: JsonValue;
  theme?: "light" | "dark";
  collapsed?: number | boolean;
  emptyText?: React.ReactNode;
  /** dot.path -> field description; renders a hover tooltip on matching keys. */
  descriptions?: Record<string, string>;
  /** Present only in gold-set review mode. */
  review?: JsonTreeReview;
}

const JsonTreeView: React.FC<JsonTreeViewProps> = ({
  value,
  theme = "light",
  collapsed = 2,
  emptyText,
  descriptions,
  review,
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
        {(hasDescriptions || !!review) && (
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
              const desc =
                isIndex || !hasDescriptions
                  ? undefined
                  : descriptionForPath(fullPath, descriptions!);

              const keyEl = desc ? (
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
              ) : (
                <span {...rest}>{children}</span>
              );

              if (!review) return keyEl;

              // A path the sample never drew gets no control at all — that is
              // what keeps the reviewer's attention on the drawn sample rather
              // than on whatever happens to look interesting.
              const path = joinFieldPath(fullPath);
              const label = review.labelFor(path);
              const targetCount = label ? 1 : review.targetCountFor(path);
              if (targetCount === 0) return keyEl;

              return (
                <span className="inline-flex items-center">
                  {keyEl}
                  <GoldVerdictControl
                    label={label}
                    fieldPath={path}
                    targetCount={targetCount}
                    saving={!!label && review.savingIds.has(label.id)}
                    onReview={review.onReview}
                    open={review.openPath === path}
                    onOpenChange={(next) =>
                      review.onOpenPathChange?.(next ? path : null)
                    }
                  />
                </span>
              );
            }}
          />
        )}
      </JsonView>
    </div>
  );
};

export default JsonTreeView;
