"use client";

import React from "react";
import { Typography } from "antd";
import { ExclamationCircleOutlined } from "@ant-design/icons";
import { JobFile } from "@/lib/api";
import { getConstraintPresentation } from "@/lib/constraintUtils";

const { Text } = Typography;

interface ConstraintListProps {
  file: JobFile | null;
  className?: string;
}

/**
 * Reusable component that displays a full list of failed constraints.
 * Phase 3: reads flags directly from the file record (server-computed).
 */
const ConstraintList: React.FC<ConstraintListProps> = ({
  file,
  className = "",
}) => {
  if (!file) {
    return null;
  }

  const flags = file.flags || [];

  if (flags.length === 0) {
    return null;
  }

  const failedFlags = flags.filter((f) => !f.passed);

  if (failedFlags.length === 0) {
    return null;
  }

  const sortedFailed = [...failedFlags].sort((a, b) => {
    if (a.emphasis === "county" && b.emphasis !== "county") return -1;
    if (b.emphasis === "county" && a.emphasis !== "county") return 1;
    return 0;
  });

  return (
    <div className={className}>
      <h3 className="text-lg font-semibold mb-3">
        Failed Constraints ({failedFlags.length})
      </h3>
      <div className="space-y-2">
        {sortedFailed.map((flag, index) => {
          const presentation = getConstraintPresentation(flag);
          const isCounty = flag.emphasis === "county";

          return (
            <div
              key={`failed-${index}`}
              className={`flex items-start space-x-2 p-2 rounded border ${
                isCounty
                  ? "bg-violet-50 border-violet-400 ring-2 ring-violet-200"
                  : "bg-red-50 border-red-200"
              }`}
            >
              {isCounty && presentation.badgeLetter ? (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    backgroundColor: presentation.color,
                    color: "#fff",
                    fontSize: 12,
                    fontWeight: 800,
                    flexShrink: 0,
                    marginTop: 2,
                  }}
                >
                  {presentation.badgeLetter}
                </span>
              ) : (
                <ExclamationCircleOutlined
                  style={{
                    color: presentation.color,
                    marginTop: "2px",
                  }}
                />
              )}
              <div className="flex-1">
                <Text
                  strong
                  className="text-sm"
                  style={isCounty ? { color: presentation.color } : undefined}
                >
                  {flag.name}
                </Text>
                <div className="text-xs text-gray-600 mt-1">{flag.message}</div>
                {flag.details && (
                  <div className="text-xs text-gray-500 mt-1">
                    {Object.entries(flag.details).map(([key, value]) => (
                      <span key={key} className="mr-3">
                        {key}: {String(value) || "N/A"}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ConstraintList;
