"use client";

import React, { useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import { JsonViewerModal } from "@/components/json";

interface SchemaEditorProps {
  jobId: string;
  currentSchema: unknown;
  onClose: () => void;
  // Schema shape varies by caller (some pass `{ schema, schemaName }`, others
  // pass the raw schema object). Keep this `any` to preserve the original
  // contract from the textarea-based implementation.
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

const SchemaEditor: React.FC<SchemaEditorProps> = ({
  jobId,
  currentSchema,
  onClose,
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
        onClose();
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <JsonViewerModal
      open
      onClose={onClose}
      modalTitle="Edit Job Schema"
      text={text}
      onChange={({ text: t }) => setText(t)}
      defaultMode="code"
      mode="code"
      onSave={handleSave}
      saving={saving}
      saveLabel="Save Schema"
      width="min(960px, 92vw)"
      height="70vh"
    />
  );
};

export default SchemaEditor;
