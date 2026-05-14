"use client";

import React, { useEffect, useMemo, useState } from "react";
import { message } from "antd";
import { apiClient } from "@/lib/api";
import { JsonViewer } from "@/components/json";

interface InlineSchemaEditorProps {
  jobId: string;
  currentSchema: unknown;
  // Schema shape varies by caller; keep `any` to preserve the contract from
  // the textarea-based implementation.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onSuccess: (updatedSchema: any) => void;
}

function initialText(schema: unknown): string {
  try {
    if (typeof schema === "string") {
      const parsed = JSON.parse(schema);
      return JSON.stringify(parsed, null, 2);
    }
    return JSON.stringify(schema ?? {}, null, 2);
  } catch {
    return typeof schema === "string" ? schema : "{}";
  }
}

const InlineSchemaEditor: React.FC<InlineSchemaEditorProps> = ({
  jobId,
  currentSchema,
  onSuccess,
}) => {
  const initial = useMemo(() => initialText(currentSchema), [currentSchema]);
  const [text, setText] = useState<string>(initial);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setText(initialText(currentSchema));
  }, [currentSchema]);

  const handleSave = async ({ value }: { text: string; value: unknown }) => {
    try {
      setSaving(true);
      const response = await apiClient.updateJobSchema(jobId, value as Record<string, unknown>);
      if (response.status === "success") {
        onSuccess(value);
        message.success("Schema updated");
      } else {
        message.error(response.message || "Failed to update schema");
      }
    } catch (err) {
      message.error(err instanceof Error ? err.message : "Unexpected error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <JsonViewer
      title="JSON Schema"
      text={text}
      onChange={({ text: t }) => setText(t)}
      defaultMode="code"
      mode="code"
      onSave={handleSave}
      saving={saving}
      saveLabel="Save Schema"
      height={420}
    />
  );
};

export default InlineSchemaEditor;
