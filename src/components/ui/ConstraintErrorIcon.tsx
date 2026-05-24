"use client";

import React from "react";
import { Tooltip, Badge } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import {
  getViolationSeverityColor,
  getConstraintPresentation,
} from "@/lib/constraintUtils";

interface ConstraintErrorIconProps {
  file: JobFile | null;
  className?: string;
  defaultOpen?: boolean;
}

/**
 * Reusable component that displays a constraint error icon with badge count.
 * Phase 3: reads flags directly from file record (server-computed).
 */
const ConstraintErrorIcon: React.FC<ConstraintErrorIconProps> = ({
  file,
  className = "",
  defaultOpen = false,
}) => {
  if (!file) {
    return null;
  }

  const flags = file.flags || [];
  const failedFlags = flags.filter((f) => !f.passed);

  if (failedFlags.length === 0) {
    return null;
  }

  const countyFailed = failedFlags.find((f) => f.emphasis === "county");
  const primarySeverity = countyFailed
    ? "critical"
    : failedFlags.some((f) => f.severity === "error")
      ? "error"
      : "warning";
  const countyPresentation = countyFailed
    ? getConstraintPresentation(countyFailed)
    : null;

  return (
    <Tooltip
      open={defaultOpen}
      title={
        <div>
          <div
            style={{
              fontWeight: "bold",
              marginBottom: "8px",
            }}
          >
            Failed Constraints ({failedFlags.length}):
          </div>
          {failedFlags.map((flag, index) => {
            const presentation = getConstraintPresentation(flag);
            return (
              <div key={index} style={{ marginBottom: "4px" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    color:
                      flag.emphasis === "county"
                        ? presentation.color
                        : undefined,
                  }}
                >
                  {presentation.badgeLetter
                    ? `[${presentation.badgeLetter}] `
                    : ""}
                  {flag.name}
                </div>
                <div style={{ fontSize: "12px", color: "#ccc" }}>
                  {flag.message}
                </div>
              </div>
            );
          })}
        </div>
      }
    >
      <div className={`flex items-center gap-1 ${className}`}>
        {countyFailed && countyPresentation?.badgeLetter && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 20,
              height: 20,
              borderRadius: 4,
              backgroundColor: countyPresentation.color,
              color: "#fff",
              fontSize: 12,
              fontWeight: 800,
              boxShadow: "0 0 0 2px #ede9fe",
            }}
          >
            {countyPresentation.badgeLetter}
          </span>
        )}
        <ExclamationCircleOutlined
          style={{
            color: getViolationSeverityColor(primarySeverity),
            fontSize: "16px",
          }}
        />
        <Badge
          count={failedFlags.length}
          style={{
            backgroundColor: getViolationSeverityColor(primarySeverity),
            minWidth: "18px",
            height: "18px",
            lineHeight: "18px",
            fontSize: "11px",
          }}
        />
      </div>
    </Tooltip>
  );
};

export default ConstraintErrorIcon;
