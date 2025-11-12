"use client";

import React from "react";
import { Tooltip, Badge } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import {
  checkFileConstraints,
  getViolationSeverityColor,
} from "@/lib/constraintUtils";

interface ConstraintErrorIconProps {
  file: JobFile | null;
  className?: string;
}

/**
 * Reusable component that displays a constraint error icon with badge count
 * Shows failed constraints count and details in a tooltip
 */
const ConstraintErrorIcon: React.FC<ConstraintErrorIconProps> = ({
  file,
  className = "",
}) => {
  if (
    !file ||
    file.processing_status !== "completed" ||
    !file.result
  ) {
    return null;
  }

  const constraints = checkFileConstraints(file);
  const failedConstraints = constraints.filter((c) => !c.passed);

  if (failedConstraints.length === 0) {
    return null;
  }

  return (
    <Tooltip
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
          {failedConstraints.map((check, index) => (
            <div key={index} style={{ marginBottom: "4px" }}>
              <div style={{ fontWeight: "bold" }}>{check.name}</div>
              <div style={{ fontSize: "12px", color: "#ccc" }}>
                {check.message}
              </div>
            </div>
          ))}
        </div>
      }
    >
      <div className={`flex items-center space-x-1 ${className}`}>
        <ExclamationCircleOutlined
          style={{
            color: getViolationSeverityColor("error"),
            fontSize: "16px",
          }}
        />
        <Badge
          count={failedConstraints.length}
          style={{
            backgroundColor: getViolationSeverityColor("error"),
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

