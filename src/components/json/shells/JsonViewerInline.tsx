"use client";

import React from "react";
import JsonViewer, { type JsonViewerProps } from "../JsonViewer";

const JsonViewerInline: React.FC<JsonViewerProps> = (props) => {
  return <JsonViewer {...props} />;
};

export default JsonViewerInline;
