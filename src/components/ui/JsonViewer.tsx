"use client";

import React from "react";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import { JsonViewer as UnifiedJsonViewer } from "@/components/json";

interface JsonViewerProps {
  data: unknown;
  title?: string;
  className?: string;
}

/**
 * @deprecated Use `@/components/json` directly. This wrapper exists to keep
 * legacy call sites working while we migrate.
 */
const JsonViewer: React.FC<JsonViewerProps> = ({
  data,
  title = "JSON Data",
  className = "",
}) => {
  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>
          <span>{title}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <UnifiedJsonViewer
          value={data}
          readOnly
          bordered={false}
          showStatusBar={false}
          height={420}
          toolbar={["mode", "search", "copy", "download"]}
        />
      </CardContent>
    </Card>
  );
};

export default JsonViewer;
