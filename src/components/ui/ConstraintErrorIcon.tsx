"use client";

import React from "react";
import { Tooltip, Badge } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import {
  checkFileConstraints,
  getViolationSeverityColor,
  getConstraintPresentation,
  CheckFileConstraintsOptions,
} from "@/lib/constraintUtils";

interface ConstraintErrorIconProps {
  file: JobFile | null;
  className?: string;
  defaultOpen?: boolean;
  constraintOptions?: CheckFileConstraintsOptions;
}

/**
 * Reusable component that displays a constraint error icon with badge count
 * Shows failed constraints count and details in a tooltip
 */
const ConstraintErrorIcon: React.FC<ConstraintErrorIconProps> = ({
  file,
  className = "",
  defaultOpen = false,
  constraintOptions,
}) => {
  if (
    !file ||
    file.processing_status !== "completed" ||
    !file.result
  ) {
    return null;
  }

  const constraints = checkFileConstraints(file, constraintOptions);
  const failedConstraints = constraints.filter((c) => !c.passed);

  if (failedConstraints.length === 0) {
    return null;
  }

  const countyFailed = failedConstraints.find((c) => c.emphasis === "county");
  const primarySeverity = countyFailed
    ? "critical"
    : failedConstraints.some((c) => c.severity === "error")
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
            Failed Constraints ({failedConstraints.length}):
          </div>
          {failedConstraints.map((check, index) => {
            const presentation = getConstraintPresentation(check);
            return (
              <div key={index} style={{ marginBottom: "4px" }}>
                <div
                  style={{
                    fontWeight: "bold",
                    color:
                      check.emphasis === "county"
                        ? presentation.color
                        : undefined,
                  }}
                >
                  {presentation.badgeLetter
                    ? `[${presentation.badgeLetter}] `
                    : ""}
                  {check.name}
                </div>
                <div style={{ fontSize: "12px", color: "#ccc" }}>
                  {check.message}
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
          count={failedConstraints.length}
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
