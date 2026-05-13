"use client";

import React, { useMemo, useRef, useState } from "react";
import { diffJson } from "diff";
import JsonView from "@uiw/react-json-view";
import type { JsonValue } from "../types";

export interface JsonDiffViewProps {
  original: JsonValue;
  current: JsonValue;
  originalLabel?: string;
  currentLabel?: string;
  theme?: "light" | "dark";
}

const JsonDiffView: React.FC<JsonDiffViewProps> = ({
  original,
  current,
  originalLabel = "Original",
  currentLabel = "Current",
}) => {
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);
  const [syncing, setSyncing] = useState(false);

  const stats = useMemo(() => {
    if (original === undefined || current === undefined) return null;
    const a = JSON.stringify(original, null, 2);
    const b = JSON.stringify(current, null, 2);
    if (a === b) return { added: 0, removed: 0, modified: 0, equal: true };
    const parts = diffJson(a, b);
    let added = 0;
    let removed = 0;
    let modified = 0;
    parts.forEach((p, idx) => {
      if (p.added) added++;
      else if (p.removed) removed++;
      else {
        const next = parts[idx + 1];
        const prev = parts[idx - 1];
        if (
          (next && (next.added || next.removed)) ||
          (prev && (prev.added || prev.removed))
        ) {
          modified++;
        }
      }
    });
    return { added, removed, modified, equal: false };
  }, [original, current]);

  const renderable = (val: JsonValue): val is object =>
    val !== null && val !== undefined && typeof val === "object";

  const handleLeftScroll = () => {
    if (syncing || !leftRef.current || !rightRef.current) return;
    setSyncing(true);
    rightRef.current.scrollTop = leftRef.current.scrollTop;
    setTimeout(() => setSyncing(false), 10);
  };
  const handleRightScroll = () => {
    if (syncing || !leftRef.current || !rightRef.current) return;
    setSyncing(true);
    leftRef.current.scrollTop = rightRef.current.scrollTop;
    setTimeout(() => setSyncing(false), 10);
  };

  if (stats?.equal) {
    return (
      <div className="flex items-center justify-center h-full p-8 text-center text-[var(--ant-color-text-secondary,#4b5563)]">
        <div>
          <div className="text-3xl mb-2">✓</div>
          <div className="text-base font-medium">No changes detected</div>
          <div className="text-sm text-[var(--ant-color-text-tertiary,#6b7280)]">
            {currentLabel} matches {originalLabel}.
          </div>
        </div>
      </div>
    );
  }

  const baseStyle: React.CSSProperties = {
    backgroundColor: "transparent",
    fontSize: "13px",
    fontFamily:
      'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
  };

  return (
    <div className="flex flex-col h-full">
      {stats && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-[var(--ant-color-border,#e5e7eb)] bg-[var(--ant-color-fill-quaternary,rgba(0,0,0,0.02))]">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="font-semibold text-[var(--ant-color-text-secondary,#4b5563)]">
              Changes:
            </span>
            {stats.modified > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#fef3c7] text-[#854d0e]">
                {stats.modified} modified
              </span>
            )}
            {stats.added > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#dcfce7] text-[#166534]">
                {stats.added} added
              </span>
            )}
            {stats.removed > 0 && (
              <span className="px-2 py-0.5 rounded bg-[#fee2e2] text-[#991b1b]">
                {stats.removed} removed
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex flex-1 overflow-hidden min-h-0">
        <div className="w-1/2 border-r border-[var(--ant-color-border,#e5e7eb)] flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-3 py-2 bg-[var(--ant-color-fill-quaternary,rgba(0,0,0,0.02))] border-b border-[var(--ant-color-border,#e5e7eb)] text-xs font-semibold text-[var(--ant-color-text-secondary,#4b5563)]">
            {originalLabel}
          </div>
          <div
            ref={leftRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-auto p-3 min-h-0"
          >
            {renderable(original) ? (
              <JsonView
                value={original}
                style={baseStyle}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
              />
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(original, null, 2)}
              </pre>
            )}
          </div>
        </div>
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-3 py-2 bg-[var(--ant-color-fill-quaternary,rgba(0,0,0,0.02))] border-b border-[var(--ant-color-border,#e5e7eb)] text-xs font-semibold text-[var(--ant-color-text-secondary,#4b5563)]">
            {currentLabel}
          </div>
          <div
            ref={rightRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-auto p-3 min-h-0"
          >
            {renderable(current) ? (
              <JsonView
                value={current}
                style={baseStyle}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
              />
            ) : (
              <pre className="text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(current, null, 2)}
              </pre>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default JsonDiffView;
