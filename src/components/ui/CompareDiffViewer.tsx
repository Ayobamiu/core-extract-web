"use client";

import React, { useMemo, useRef } from "react";
import { diffJson } from "diff";
import JsonView from "@uiw/react-json-view";

interface CompareDiffViewerProps {
  original: any;
  current: any;
}

const CompareDiffViewer: React.FC<CompareDiffViewerProps> = ({
  original,
  current,
}) => {
  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const [syncing, setSyncing] = React.useState(false);

  // Calculate diff statistics
  const stats = useMemo(() => {
    if (!original || !current) return null;

    const originalStr = JSON.stringify(original, null, 2);
    const currentStr = JSON.stringify(current, null, 2);
    const changes = diffJson(originalStr, currentStr);

    let added = 0;
    let removed = 0;
    let modified = 0;

    changes.forEach((part) => {
      if (part.added) added++;
      if (part.removed) removed++;
      if (!part.added && !part.removed) {
        // Check if this part has actual content changes nearby
        const index = changes.indexOf(part);
        const nextPart = changes[index + 1];
        const prevPart = changes[index - 1];
        if (
          (nextPart && (nextPart.added || nextPart.removed)) ||
          (prevPart && (prevPart.added || prevPart.removed))
        ) {
          modified++;
        }
      }
    });

    return { added, removed, modified };
  }, [original, current]);

  // Sync scrolling between left and right columns
  const handleLeftScroll = () => {
    if (syncing || !leftScrollRef.current || !rightScrollRef.current) return;
    setSyncing(true);
    rightScrollRef.current.scrollTop = leftScrollRef.current.scrollTop;
    setTimeout(() => setSyncing(false), 10);
  };

  const handleRightScroll = () => {
    if (syncing || !leftScrollRef.current || !rightScrollRef.current) return;
    setSyncing(true);
    leftScrollRef.current.scrollTop = rightScrollRef.current.scrollTop;
    setTimeout(() => setSyncing(false), 10);
  };

  // Check if there are any differences
  const hasChanges = useMemo(() => {
    if (!original || !current) return false;
    return JSON.stringify(original) !== JSON.stringify(current);
  }, [original, current]);

  if (!hasChanges) {
    return (
      <div className="flex items-center justify-center h-full p-8">
        <div className="text-center">
          <div className="text-green-500 text-6xl mb-4">✅</div>
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            No Changes Detected
          </h3>
          <p className="text-gray-600">
            The current result matches the original AI extraction.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Statistics Header */}
      {stats && (
        <div className="flex-shrink-0 px-4 py-3 bg-blue-50 border-b border-blue-200">
          <div className="flex items-center space-x-6 text-sm">
            <div className="flex items-center space-x-2">
              <span className="font-semibold text-gray-700">📊 Changes:</span>
              {stats.modified > 0 && (
                <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded">
                  {stats.modified} modified
                </span>
              )}
              {stats.added > 0 && (
                <span className="px-2 py-1 bg-green-100 text-green-800 rounded">
                  {stats.added} added
                </span>
              )}
              {stats.removed > 0 && (
                <span className="px-2 py-1 bg-red-100 text-red-800 rounded">
                  {stats.removed} removed
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500">
              Scroll to compare side-by-side
            </div>
          </div>
        </div>
      )}

      {/* Side-by-side Comparison */}
      <div className="flex flex-1 overflow-hidden min-h-0">
        {/* Left Column - Original */}
        <div className="w-1/2 border-r border-gray-300 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2 bg-gray-100 border-b border-gray-300">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700">
                Original (AI)
              </span>
              <span className="text-xs text-gray-500">Initial extraction</span>
            </div>
          </div>
          <div
            ref={leftScrollRef}
            onScroll={handleLeftScroll}
            className="flex-1 overflow-auto p-4 bg-white min-h-0"
          >
            <JsonView
              value={original as object}
              style={{
                backgroundColor: "transparent",
                fontSize: "14px",
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }}
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={true}
              collapsed={false}
            />
          </div>
        </div>

        {/* Right Column - Current */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="flex-shrink-0 px-4 py-2 bg-gray-100 border-b border-gray-300">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-gray-700">
                Current (Updated)
              </span>
              <span className="text-xs text-gray-500">After edits</span>
            </div>
          </div>
          <div
            ref={rightScrollRef}
            onScroll={handleRightScroll}
            className="flex-1 overflow-auto p-4 bg-white min-h-0"
          >
            <JsonView
              value={current as object}
              style={{
                backgroundColor: "transparent",
                fontSize: "14px",
                fontFamily:
                  'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
              }}
              displayDataTypes={false}
              displayObjectSize={false}
              enableClipboard={true}
              collapsed={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompareDiffViewer;
