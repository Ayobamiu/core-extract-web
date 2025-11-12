"use client";

import React from "react";
import { Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import {
  checkFileConstraints,
  getViolationSeverityColor,
} from "@/lib/constraintUtils";

const { Text } = Typography;

interface ConstraintListProps {
  file: JobFile | null;
  className?: string;
}

/**
 * Reusable component that displays a full list of failed constraints
 * Shows constraint name, message, and details in an expandable list format
 */
const ConstraintList: React.FC<ConstraintListProps> = ({
  file,
  className = "",
}) => {
  if (!file) {
    return null;
  }

  const constraints = checkFileConstraints(file);

  if (constraints.length === 0) {
    return null;
  }

  const failedConstraints = constraints.filter((c) => !c.passed);

  if (failedConstraints.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-3">
        Failed Constraints ({failedConstraints.length})
      </h3>
      <div className="space-y-2">
        {failedConstraints.map((check, index) => (
          <div
            key={`failed-${index}`}
            className="flex items-start space-x-2 p-2 bg-red-50 border border-red-200 rounded"
          >
            <ExclamationCircleOutlined
              style={{
                color: getViolationSeverityColor(check.severity),
                marginTop: "2px",
              }}
            />
            <div className="flex-1">
              <Text strong className="text-sm">
                {check.name}
              </Text>
              <div className="text-xs text-gray-600 mt-1">
                {check.message}
              </div>
              {check.details && (
                <div className="text-xs text-gray-500 mt-1">
                  {Object.entries(check.details).map(([key, value]) => (
                    <span key={key} className="mr-3">
                      {key}: {String(value) || "N/A"}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ConstraintList;

