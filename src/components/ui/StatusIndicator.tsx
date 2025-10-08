import React from "react";

interface StatusIndicatorProps {
  status: "success" | "warning" | "error" | "info" | "neutral";
  children: React.ReactNode;
  className?: string;
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  children,
  className = "",
}) => {
  const baseClasses =
    "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium";

  const statusClasses = {
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    error: "bg-red-100 text-red-800",
    info: "bg-blue-100 text-blue-800",
    neutral: "bg-gray-100 text-gray-800",
  };

  const classes = `${baseClasses} ${statusClasses[status]} ${className}`;

  return <span className={classes}>{children}</span>;
};

export default StatusIndicator;
