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

  useEffect(() => {
    const fetchPreviews = async () => {
      try {
        const response = await apiClient.getPreviews();
        if (response.success) {
          setPreviews(response.data || []);
        }
      } catch (error) {
        console.error("Error fetching previews:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchPreviews();
  }, []);

  const handleAddToPreview = async () => {
    if (!selectedPreviewId) return;

    try {
      setAdding(true);
      const response = await apiClient.addItemsToPreview(selectedPreviewId, [
        fileId,
      ]);

      if (response.success) {
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error adding file to preview:", error);
    } finally {
      setAdding(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPreviewName.trim()) return;

    try {
      setCreating(true);

      // Create a basic schema for the new preview
      const basicSchema = {
        type: "object",
        properties: {
          filename: { type: "string", title: "Filename" },
          extracted_data: { type: "object", title: "Extracted Data" },
        },
      };

      const response = await apiClient.createPreview(
        newPreviewName,
        basicSchema
      );

      if (response.success) {
        // Add the file to the newly created preview
        await apiClient.addItemsToPreview(response.data.id, [fileId]);
        onSuccess();
        onClose();
      }
    } catch (error) {
      console.error("Error creating preview:", error);
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
                  {previews.map((preview) => (
                    <div
                      key={preview.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        selectedPreviewId === preview.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      }`}
                      onClick={() => setSelectedPreviewId(preview.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {preview.name}
                          </p>
                          <p className="text-sm text-gray-500">
                            {preview.item_count || 0} items
                          </p>
                        </div>
                        {selectedPreviewId === preview.id && (
                          <CheckIcon className="h-5 w-5 text-blue-600" />
                        )}
                      </div>
                    </div>
                  ))}

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
                  disabled={!selectedPreviewId || adding}
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PreviewSelector;
