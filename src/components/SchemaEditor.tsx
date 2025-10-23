"use client";

import React, { useState, useEffect } from "react";
import { apiClient } from "@/lib/api";
import Button from "@/components/ui/Button";
import { XMarkIcon } from "@heroicons/react/24/outline";

interface SchemaEditorProps {
  jobId: string;
  currentSchema: any;
  onClose: () => void;
  onSuccess: (updatedSchema: any) => void;
}

const SchemaEditor: React.FC<SchemaEditorProps> = ({
  jobId,
  currentSchema,
  onClose,
  onSuccess,
}) => {
  const [schemaText, setSchemaText] = useState("");
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // Initialize with formatted JSON
    try {
      let schemaToFormat = currentSchema;

      // If currentSchema is a string, parse it first
      if (typeof currentSchema === "string") {
        schemaToFormat = JSON.parse(currentSchema);
      }

      // Format the schema with proper indentation
      setSchemaText(JSON.stringify(schemaToFormat, null, 2));
      setIsValid(true);
    } catch (err) {
      // If parsing fails, try to use the string as-is
      if (typeof currentSchema === "string") {
        setSchemaText(currentSchema);
        setIsValid(validateJSON(currentSchema));
      } else {
        setSchemaText("{}");
        setIsValid(false);
      }
    }
  }, [currentSchema]);

  const validateJSON = (text: string): boolean => {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  };

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setSchemaText(text);
    const valid = validateJSON(text);
    setIsValid(valid);
    setError(valid ? null : "Invalid JSON format");
  };

  const formatJSON = () => {
    try {
      const parsed = JSON.parse(schemaText);
      const formatted = JSON.stringify(parsed, null, 2);
      setSchemaText(formatted);
      setIsValid(true);
      setError(null);
    } catch (err) {
      setError("Cannot format invalid JSON");
    }
  };

  const handleSave = async () => {
    if (!isValid) {
      setError("Please fix JSON errors before saving");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const parsedSchema = JSON.parse(schemaText);
      const response = await apiClient.updateJobSchema(jobId, parsedSchema);

      if (response.status === "success") {
        setSuccess("Schema updated successfully!");
        // Close modal after a brief delay to show success message
        setTimeout(() => {
          onSuccess(parsedSchema);
          onClose();
        }, 1000);
      } else {
        setError(response.message || "Failed to update schema");
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Edit Job Schema
          </h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-hidden flex flex-col">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-700">
                JSON Schema:
              </span>
              {!isValid && (
                <span className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                  Invalid JSON
                </span>
              )}
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={formatJSON}
              disabled={!isValid}
            >
              Format JSON
            </Button>
          </div>

          {/* JSON Editor */}
          <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
            <textarea
              value={schemaText}
              onChange={handleTextChange}
              className="w-full h-full p-4 font-mono text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter JSON schema..."
              style={{ minHeight: "400px" }}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-700">
              ⚠ {error}
            </div>
          )}

          {/* Success Display */}
          {success && (
            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded text-sm text-green-700">
              ✅ {success}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end space-x-3 p-6 border-t border-gray-200">
          <Button variant="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!isValid || saving || !!success}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            {saving ? "Saving..." : success ? "Saved!" : "Save Schema"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default SchemaEditor;
