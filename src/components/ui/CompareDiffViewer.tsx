"use client";

import React from "react";
import { JsonViewer } from "@/components/json";

interface CompareDiffViewerProps {
  original: unknown;
  current: unknown;
  originalLabel?: string;
  currentLabel?: string;
}

/**
 * @deprecated Use `<JsonViewer compareWith={original} />` from
 * `@/components/json` directly. This wrapper exists to keep legacy call sites
 * working while we migrate.
 */
const CompareDiffViewer: React.FC<CompareDiffViewerProps> = ({
  original,
  current,
  originalLabel = "Original (AI)",
  currentLabel = "Current (Updated)",
}) => {
  return (
    <JsonViewer
      value={current}
      compareWith={original}
      compareLabel={originalLabel}
      currentLabel={currentLabel}
      mode="diff"
      readOnly
      bordered={false}
      showStatusBar={false}
      toolbar={false}
      height="100%"
    />
  );
};

export default CompareDiffViewer;
