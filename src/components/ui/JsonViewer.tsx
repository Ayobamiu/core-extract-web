"use client";

import React from "react";
import JsonView from "@uiw/react-json-view";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";

interface JsonViewerProps {
  data: any;
  title?: string;
  className?: string;
}

const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title = "JSON Data",
  className = "",
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          {/* <svg
            className="w-5 h-5 text-blue-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
            />
          </svg> */}
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-gray-50 rounded-lg p-4 overflow-auto">
          <JsonView
            value={data}
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
            theme="light"
          />
        </div>
      </CardContent>
    </Card>
  );
};

export default JsonViewer;
