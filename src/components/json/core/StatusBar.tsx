"use client";

import React from "react";

interface StatusBarProps {
  isValid: boolean;
  error?: string;
  bytes: number;
  lines: number;
  dirty?: boolean;
  hint?: React.ReactNode;
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

const StatusBar: React.FC<StatusBarProps> = ({
  isValid,
  error,
  bytes,
  lines,
  dirty,
  hint,
}) => {
  return (
    <div className="flex-shrink-0 flex items-center gap-3 px-3 py-1.5 border-t border-[var(--ant-color-border,#e5e7eb)] bg-[var(--ant-color-bg-container,#fafafa)] text-[11px] text-[var(--ant-color-text-tertiary,#6b7280)]">
      {isValid ? (
        <span className="inline-flex items-center gap-1 text-[var(--ant-color-success,#52c41a)]">
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          Valid JSON
        </span>
      ) : (
        <span
          className="inline-flex items-center gap-1 text-[var(--ant-color-error,#ff4d4f)]"
          title={error}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current" />
          Invalid: {error}
        </span>
      )}
      <span className="text-[var(--ant-color-text-quaternary,#9ca3af)]">
        {formatBytes(bytes)} · {lines.toLocaleString()} lines
      </span>
      {dirty && (
        <span className="text-[var(--ant-color-warning,#faad14)]">
          • unsaved
        </span>
      )}
      <div className="flex-1" />
      {hint}
    </div>
  );
};

export default StatusBar;
