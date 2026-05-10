"use client";

import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "@/components/ui/Button";
import JSONTreeEditor from "@/components/JSONTreeEditor";
import { XMarkIcon, CheckIcon } from "@heroicons/react/24/outline";
import {
  isV2ResultEnvelope,
  type SectionResult,
  type V2ResultEnvelope,
} from "@/lib/api";

interface FileResultsEditorProps {
  isOpen: boolean;
  onClose: () => void;
  fileId: string;
  filename: string;
  initialResults: any;
  onSuccess: (updatedResults: any) => void;
  // Per-section extraction (v2 envelope) provenance. When present, the
  // editor shows a section summary banner so the user understands they're
  // editing a multi-section result, not a flat field bag.
  resultEnvelope?: "v1" | "v2";
  sectionResults?: SectionResult[];
}

interface V2SectionSummary {
  slug: string;
  instanceCount: number;
  fieldCount: number;
}

function summarizeV2Envelope(envelope: V2ResultEnvelope): V2SectionSummary[] {
  return Object.entries(envelope).map(([slug, instances]) => {
    const firstInstance =
      Array.isArray(instances) && instances[0] && typeof instances[0] === "object"
        ? instances[0]
        : null;
    return {
      slug,
      instanceCount: Array.isArray(instances) ? instances.length : 0,
      fieldCount: firstInstance ? Object.keys(firstInstance).length : 0,
    };
  });
}

export default function FileResultsEditor({
  isOpen,
  onClose,
  fileId,
  filename,
  initialResults,
  onSuccess,
  resultEnvelope,
  sectionResults,
}: FileResultsEditorProps) {
  const [results, setResults] = useState<any>(null);
  const [isValid, setIsValid] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  // Detect v2 envelope so we can show a section summary banner above the
  // tree editor. The editor itself doesn't change behaviour — the JSON tree
  // already handles nested arrays — but the banner makes the structure
  // discoverable instead of forcing the user to go fishing inside arrays.
  const isV2 = useMemo(
    () =>
      isV2ResultEnvelope(results, {
        result_envelope: resultEnvelope,
        section_results: sectionResults,
      }),
    [results, resultEnvelope, sectionResults]
  );
  const v2Summaries = useMemo<V2SectionSummary[]>(
    () => (isV2 && results ? summarizeV2Envelope(results as V2ResultEnvelope) : []),
    [isV2, results]
  );

  // Initialize results when modal opens
  useEffect(() => {
    if (isOpen && initialResults) {
      try {
        const parsedResults =
          typeof initialResults === "string"
            ? JSON.parse(initialResults)
            : initialResults;
        setResults(parsedResults);
        setError(null);
        setIsValid(true);
        setHasChanges(false);
        setSuccess(false);
      } catch (err) {
        setError("Invalid JSON format in results");
        setIsValid(false);
        setResults(null);
      }
    }
  }, [isOpen, initialResults]);

  // Save changes
  const handleSave = async () => {
    if (!isValid || !results) {
      setError("Please fix JSON errors before saving");
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      // Import API client dynamically to avoid circular imports
      const { apiClient } = await import("@/lib/api");

      const response = await apiClient.updateFileResults(fileId, results);

      if (response.status === "success") {
        setSuccess(true);
        setHasChanges(false);

        // Call success callback with updated results
        onSuccess(results);

        // Close modal after a short delay
        setTimeout(() => {
          onClose();
        }, 1500);
      } else {
        setError(response.message || "Failed to update file results");
      }
    } catch (err) {
      setError("An unexpected error occurred while saving");
      console.error("Error saving file results:", err);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle modal close
  const handleClose = () => {
    if (hasChanges && !success) {
      if (
        confirm("You have unsaved changes. Are you sure you want to close?")
      ) {
        onClose();
      }
    } else {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4"
        onClick={handleClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          className="bg-white rounded-lg shadow-xl w-full h-full max-w-7xl max-h-[95vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Edit File Results
              </h2>
              <p className="text-sm text-gray-500 mt-1">{filename}</p>
            </div>
            <div className="flex items-center space-x-3">
              {hasChanges && (
                <span className="text-sm text-orange-600 font-medium">
                  Unsaved changes
                </span>
              )}
              <Button
                variant="default"
                size="sm"
                onClick={handleClose}
                disabled={isSaving}
                className="border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
              >
                <XMarkIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isValid ? "bg-green-500" : "bg-red-500"
                    }`}
                  />
                  <span className="text-sm text-gray-600">
                    {isValid ? "Valid JSON" : "Invalid JSON"}
                  </span>
                </div>
              </div>

              <Button
                variant="default"
                size="sm"
                onClick={handleSave}
                disabled={!isValid || !results || isSaving || !hasChanges}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : success ? (
                  <>
                    <CheckIcon className="w-4 h-4 mr-2" />
                    Saved!
                  </>
                ) : (
                  "Save Results"
                )}
              </Button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="text-sm text-red-700">{error}</div>
              </div>
            )}

            {success && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                <div className="text-sm text-green-700">
                  File results updated successfully!
                </div>
              </div>
            )}

            {/* v2 envelope summary banner — only when this file's result was
                produced by per-section extraction. Tells the user up-front
                that this is a multi-section result so they don't expect a
                flat field bag. */}
            {isV2 && v2Summaries.length > 0 && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="text-sm text-blue-900 font-medium mb-1">
                  Per-section result ({v2Summaries.length} document type
                  {v2Summaries.length === 1 ? "" : "s"})
                </div>
                <div className="flex flex-wrap gap-2">
                  {v2Summaries.map((s) => (
                    <span
                      key={s.slug}
                      className="px-2 py-0.5 bg-white border border-blue-200 rounded text-xs text-blue-800"
                      title={`${s.fieldCount} field${s.fieldCount === 1 ? "" : "s"} per instance`}
                    >
                      {s.slug}
                      {s.instanceCount > 1 ? ` ×${s.instanceCount}` : ""}
                    </span>
                  ))}
                </div>
                <div className="text-xs text-blue-700 mt-2">
                  Expand each top-level key below to edit that section&apos;s data.
                </div>
              </div>
            )}

            {/* JSON Tree Editor */}
            <div className="flex-1 border border-gray-300 rounded-lg overflow-hidden">
              {results ? (
                <JSONTreeEditor
                  data={results}
                  onChange={(newData) => {
                    setResults(newData);
                    setHasChanges(true);
                    setError(null);
                    setIsValid(true);
                  }}
                  onError={(error) => {
                    setError(error);
                    setIsValid(!error);
                  }}
                  readOnly={isSaving}
                />
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500">
                  <p>No results data available</p>
                </div>
              )}
            </div>

            {/* Footer Info */}
            <div className="mt-4 text-xs text-gray-500">
              <p>
                • Click on keys and values to edit them inline • Use
                expand/collapse arrows to navigate large objects • Hover over
                items to see add/remove buttons • Changes are automatically
                validated • Press Enter to save edits, Escape to cancel
              </p>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
