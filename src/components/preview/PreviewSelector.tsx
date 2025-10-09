"use client";

import React, { useState, useEffect } from "react";
import { apiClient, PreviewDataTable } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { PlusIcon, CheckIcon } from "@heroicons/react/24/outline";

interface PreviewSelectorProps {
  fileId: string;
  onClose: () => void;
  onSuccess: () => void;
}

const PreviewSelector: React.FC<PreviewSelectorProps> = ({
  fileId,
  onClose,
  onSuccess,
}) => {
  const [previews, setPreviews] = useState<PreviewDataTable[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string | null>(
    null
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPreviewName, setNewPreviewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [fileInPreviews, setFileInPreviews] = useState<Record<string, boolean>>(
    {}
  );
  const [useMGSData, setUseMGSData] = useState(false);
  const [mgsError, setMgsError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPreviews = async () => {
      try {
        const response = await apiClient.getPreviews();
        if (response.success) {
          setPreviews(response.data || []);

          // Check which previews already contain this file
          const previewChecks =
            response.data?.map(async (preview) => {
              try {
                const checkResponse = await apiClient.isFileInPreview(
                  fileId,
                  preview.id
                );
                return {
                  previewId: preview.id,
                  exists: checkResponse.data?.exists || false,
                };
              } catch (error) {
                console.error(
                  `Error checking if file is in preview ${preview.id}:`,
                  error
                );
                return { previewId: preview.id, exists: false };
              }
            }) || [];

          const results = await Promise.all(previewChecks);
          const fileInPreviewsMap: Record<string, boolean> = {};
          results.forEach(({ previewId, exists }) => {
            fileInPreviewsMap[previewId] = exists;
          });
          setFileInPreviews(fileInPreviewsMap);
        }
      } catch (error) {
        console.error("Error fetching previews:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviews();
  }, [fileId]);

  const handleAddToPreview = async () => {
    if (!selectedPreviewId) return;

    try {
      setAdding(true);
      setMgsError(null);

      // If MGS data is requested, enrich the file first
      if (useMGSData) {
        const mgsResponse = await apiClient.enrichFileWithMGSData(fileId);
        if (!mgsResponse.success) {
          setMgsError(
            mgsResponse.message || "Failed to enrich file with MGS data"
          );
          return;
        }
      }

      const response = await apiClient.addItemsToPreview(selectedPreviewId, [
        fileId,
      ]);

      if (response.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error adding file to preview:", error);
      // Check if it's an API error with a specific message
      if (error && typeof error === "object" && "message" in error) {
        setMgsError(String(error.message));
      } else {
        setMgsError("An unexpected error occurred");
      }
    } finally {
      setAdding(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPreviewName.trim()) return;

    try {
      setCreating(true);
      setMgsError(null);

      // If MGS data is requested, enrich the file first
      if (useMGSData) {
        const mgsResponse = await apiClient.enrichFileWithMGSData(fileId);
        if (!mgsResponse.success) {
          setMgsError(
            mgsResponse.message || "Failed to enrich file with MGS data"
          );
          return;
        }
      }

      // Get the file's schema from its job
      let fileSchema = {
        type: "object",
        properties: {
          filename: { type: "string", title: "Filename" },
          extracted_data: { type: "object", title: "Extracted Data" },
        },
      };

      try {
        const schemaResponse = await apiClient.getFileSchema(fileId);
        if (schemaResponse.success && schemaResponse.data?.schema) {
          fileSchema = schemaResponse.data.schema.schema;
        }
      } catch (error) {
        console.warn("Could not fetch file schema, using default:", error);
      }

      const response = await apiClient.createPreview(
        newPreviewName,
        fileSchema
      );

      if (response.success && response.data) {
        // Add the file to the newly created preview
        await apiClient.addItemsToPreview(response.data.id, [fileId]);
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error creating preview:", error);
      // Check if it's an API error with a specific message
      if (error && typeof error === "object" && "message" in error) {
        setMgsError(String(error.message));
      } else {
        setMgsError("An unexpected error occurred");
      }
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
          <div className="p-6 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading previews...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">
              Add to Preview
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ×
            </button>
          </div>

          {!showCreateForm ? (
            <div>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Select existing preview:
                </h4>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {previews.map((preview) => {
                    const isAlreadyAdded = fileInPreviews[preview.id];
                    const isDisabled = isAlreadyAdded;

                    return (
                      <div
                        key={preview.id}
                        className={`p-3 border rounded-lg transition-colors ${
                          isDisabled
                            ? "border-gray-200 bg-gray-50 cursor-not-allowed opacity-60"
                            : selectedPreviewId === preview.id
                            ? "border-blue-500 bg-blue-50 cursor-pointer"
                            : "border-gray-200 hover:border-gray-300 cursor-pointer"
                        }`}
                        onClick={() =>
                          !isDisabled && setSelectedPreviewId(preview.id)
                        }
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p
                              className={`font-medium ${
                                isDisabled ? "text-gray-500" : "text-gray-900"
                              }`}
                            >
                              {preview.name}
                            </p>
                            <div className="flex items-center space-x-2">
                              <p
                                className={`text-sm ${
                                  isDisabled ? "text-gray-400" : "text-gray-500"
                                }`}
                              >
                                {preview.item_count || 0} items
                              </p>
                              {isAlreadyAdded && (
                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                  Already added
                                </span>
                              )}
                            </div>
                          </div>
                          {selectedPreviewId === preview.id && !isDisabled && (
                            <CheckIcon className="h-5 w-5 text-blue-600" />
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {previews.length === 0 && (
                    <div className="text-center py-8 text-gray-500">
                      <p>No previews found</p>
                      <p className="text-sm">Create a new one below</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleAddToPreview}
                  disabled={
                    !selectedPreviewId ||
                    adding ||
                    (!!selectedPreviewId && fileInPreviews[selectedPreviewId])
                  }
                  className="flex-1"
                >
                  {adding ? "Adding..." : "Add to Preview"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setShowCreateForm(true)}
                  className="flex items-center space-x-2"
                >
                  <PlusIcon className="h-4 w-4" />
                  <span>New</span>
                </Button>
              </div>

              {/* MGS Data Checkbox */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMGSData}
                    onChange={(e) => {
                      setUseMGSData(e.target.checked);
                      setMgsError(null); // Clear error when checkbox changes
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Prefill with MGS data?
                  </span>
                </label>
                {mgsError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ⚠ {mgsError}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div>
              <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-700 mb-3">
                  Create new preview:
                </h4>
                <input
                  type="text"
                  placeholder="Preview name..."
                  value={newPreviewName}
                  onChange={(e) => setNewPreviewName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="flex space-x-3">
                <Button
                  onClick={handleCreateAndAdd}
                  disabled={!newPreviewName.trim() || creating}
                  className="flex-1"
                >
                  {creating ? "Creating..." : "Create & Add"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => setShowCreateForm(false)}
                >
                  Back
                </Button>
              </div>

              {/* MGS Data Checkbox */}
              <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMGSData}
                    onChange={(e) => {
                      setUseMGSData(e.target.checked);
                      setMgsError(null); // Clear error when checkbox changes
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    Prefill with MGS data?
                  </span>
                </label>
                {mgsError && (
                  <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-700">
                    ⚠ {mgsError}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewSelector;
