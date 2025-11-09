"use client";

import React, { useState, useEffect } from "react";
import {
  Drawer,
  Button,
  List,
  Checkbox,
  Space,
  Typography,
  Alert,
  Spin,
} from "antd";
import { apiClient, PreviewDataTable } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions } from "@/utils/roleUtils";

const { Text, Title } = Typography;

interface PreviewDrawerProps {
  fileIds: string[];
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const PreviewDrawer: React.FC<PreviewDrawerProps> = ({
  fileIds,
  open,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);
  const [previews, setPreviews] = useState<PreviewDataTable[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPreviewId, setSelectedPreviewId] = useState<string>("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPreviewName, setNewPreviewName] = useState("");
  const [creating, setCreating] = useState(false);
  const [adding, setAdding] = useState(false);
  const [useMGSData, setUseMGSData] = useState(false);
  const [mgsLoading, setMgsLoading] = useState(false);
  const [mgsError, setMgsError] = useState<string | null>(null);

  // Check if any of the selected files are already in a preview
  const isFileInPreview = (preview: PreviewDataTable) => {
    return fileIds.some((fileId) => preview.items_ids?.includes(fileId));
  };

  const fetchPreviews = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getPreviews();
      setPreviews(response.data || []);
    } catch (error) {
      console.error("Error fetching previews:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchPreviews();
      setSelectedPreviewId("");
      setShowCreateForm(false);
      setNewPreviewName("");
      setUseMGSData(false);
      setMgsError(null);
    }
  }, [open]);

  const handleAddToPreview = async () => {
    if (!selectedPreviewId) return;

    try {
      setAdding(true);
      setMgsError(null);

      // Enrich with MGS data if requested
      if (useMGSData) {
        setMgsLoading(true);
        try {
          const mgsResponse = await apiClient.bulkEnrichFilesWithMGSData(
            fileIds
          );
          console.log("🔍 MGS Response:", mgsResponse);
          if (!mgsResponse.success) {
            setMgsError(
              mgsResponse.message || "Failed to enrich files with MGS data"
            );
            return;
          }
          const { summary } = mgsResponse.data || {};
          console.log("📊 MGS Summary:", summary);

          if (summary?.failed && summary.failed > 0) {
            setMgsError(
              `${summary.successful} of ${summary.total} files enriched with MGS data. ${summary.failed} failed.`
            );
          } else if (summary?.skipped && summary.skipped > 0) {
            setMgsError(
              `${summary.successful} of ${summary.total} files enriched with MGS data. ${summary.skipped} skipped (no permit number or MGS data).`
            );
          }
        } catch (error) {
          console.error("❌ Error enriching files with MGS data:", error);
          setMgsError("Failed to enrich files with MGS data");
          return;
        } finally {
          setMgsLoading(false);
        }
      }

      // Add files to preview
      await apiClient.addItemsToPreview(selectedPreviewId, fileIds);

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding files to preview:", error);
      setMgsError("Failed to add files to preview");
    } finally {
      setAdding(false);
    }
  };

  const handleCreateAndAdd = async () => {
    if (!newPreviewName.trim()) return;

    try {
      setCreating(true);
      setMgsError(null);

      // Enrich with MGS data if requested
      if (useMGSData) {
        setMgsLoading(true);
        try {
          const mgsResponse = await apiClient.bulkEnrichFilesWithMGSData(
            fileIds
          );
          console.log("🔍 MGS Response:", mgsResponse);
          if (!mgsResponse.success) {
            setMgsError(
              mgsResponse.message || "Failed to enrich files with MGS data"
            );
            return;
          }
          const { summary } = mgsResponse.data || {};
          console.log("📊 MGS Summary:", summary);

          if (summary?.failed && summary.failed > 0) {
            setMgsError(
              `${summary.successful} of ${summary.total} files enriched with MGS data. ${summary.failed} failed.`
            );
          } else if (summary?.skipped && summary.skipped > 0) {
            setMgsError(
              `${summary.successful} of ${summary.total} files enriched with MGS data. ${summary.skipped} skipped (no permit number or MGS data).`
            );
          }
        } catch (error) {
          console.error("❌ Error enriching files with MGS data:", error);
          setMgsError("Failed to enrich files with MGS data");
          return;
        } finally {
          setMgsLoading(false);
        }
      }

      // Get schema from first file
      let fileSchema = null;
      try {
        const schemaResponse = await apiClient.getFileSchema(fileIds[0]);
        fileSchema = schemaResponse.data?.schema || null;
      } catch (error) {
        console.error("Error fetching file schema:", error);
      }

      // Create new preview
      const createResponse = await apiClient.createPreview(
        newPreviewName,
        fileSchema || {
          type: "object",
          properties: {},
          required: [],
        },
        ""
      );

      // Add files to the new preview
      if (createResponse.data?.id) {
        await apiClient.addItemsToPreview(createResponse.data.id, fileIds);
      } else {
        throw new Error("Failed to create preview");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error creating preview and adding files:", error);
      setMgsError("Failed to create preview and add files");
    } finally {
      setCreating(false);
    }
  };

  return (
    <Drawer
      title={`Add ${fileIds.length} File(s) to Preview`}
      placement="right"
      width={500}
      open={open}
      onClose={onClose}
      footer={
        isAdmin ? (
          <div className="flex justify-end space-x-2">
            <Button onClick={onClose}>Cancel</Button>
            {!showCreateForm ? (
              <Button
                type="primary"
                onClick={handleAddToPreview}
                disabled={
                  !selectedPreviewId ||
                  adding ||
                  mgsLoading ||
                  (!!selectedPreviewId &&
                    isFileInPreview(
                      previews.find((p) => p.id === selectedPreviewId)!
                    ))
                }
                loading={adding}
              >
                {adding
                  ? "Adding..."
                  : `Add ${fileIds.length} File(s) to Preview`}
              </Button>
            ) : (
              <Button
                type="primary"
                onClick={handleCreateAndAdd}
                disabled={!newPreviewName.trim() || creating || mgsLoading}
                loading={creating}
              >
                {creating
                  ? "Creating..."
                  : `Create & Add ${fileIds.length} File(s)`}
              </Button>
            )}
          </div>
        ) : (
          <div className="flex justify-end space-x-2">
            <Button onClick={onClose}>Close</Button>
          </div>
        )
      }
    >
      <div className="space-y-6">
        {/* MGS Data Option */}
        <div className="bg-gray-50 p-4 rounded-lg">
          <Checkbox
            checked={useMGSData}
            onChange={(e) => {
              setUseMGSData(e.target.checked);
              setMgsError(null);
            }}
          >
            Prefill with MGS data?
          </Checkbox>
          <Text type="secondary" className="block mt-2 text-sm">
            This will enrich the selected files with Michigan Geological Survey
            data based on their permit numbers before adding to the preview.
          </Text>
        </div>

        {/* MGS Error Display */}
        {mgsError && (
          <Alert
            message={mgsError}
            type="warning"
            showIcon
            closable
            onClose={() => setMgsError(null)}
          />
        )}

        {/* MGS Loading */}
        {mgsLoading && (
          <div className="text-center py-4">
            <Spin size="small" />
            <Text className="ml-2">Enriching files with MGS data...</Text>
          </div>
        )}

        {/* Preview Selection */}
        {!showCreateForm ? (
          <div>
            <div className="flex items-center justify-between mb-4">
              <Title level={5} className="mb-0">
                Select Existing Preview
              </Title>
              {isAdmin && (
                <Button
                  type="link"
                  onClick={() => setShowCreateForm(true)}
                  className="p-0"
                >
                  New
                </Button>
              )}
            </div>

            {loading ? (
              <div className="text-center py-8">
                <Spin />
                <Text className="block mt-2">Loading previews...</Text>
              </div>
            ) : (
              <List
                dataSource={previews}
                renderItem={(preview) => {
                  const alreadyAdded = isFileInPreview(preview);
                  return (
                    <List.Item
                      className={`cursor-pointer p-3 rounded-lg border transition-colors ${
                        selectedPreviewId === preview.id
                          ? "border-blue-500 bg-blue-50"
                          : "border-gray-200 hover:border-gray-300"
                      } ${alreadyAdded ? "opacity-60 cursor-not-allowed" : ""}`}
                      onClick={() => {
                        if (!alreadyAdded) {
                          setSelectedPreviewId(preview.id);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <div>
                          <Text strong>{preview.name}</Text>
                          <Text type="secondary" className="block text-sm">
                            {preview.items_ids?.length || 0} files
                          </Text>
                        </div>
                        <div className="flex items-center space-x-2">
                          {alreadyAdded && (
                            <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">
                              Already added
                            </span>
                          )}
                          <Checkbox
                            checked={selectedPreviewId === preview.id}
                            disabled={alreadyAdded}
                          />
                        </div>
                      </div>
                    </List.Item>
                  );
                }}
              />
            )}
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-4">
              <Title level={5} className="mb-0">
                Create New Preview
              </Title>
              <Button
                type="link"
                onClick={() => setShowCreateForm(false)}
                className="p-0"
              >
                Back
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <Text strong className="block mb-2">
                  Preview Name
                </Text>
                <input
                  type="text"
                  value={newPreviewName}
                  onChange={(e) => setNewPreviewName(e.target.value)}
                  placeholder="Enter preview name"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default PreviewDrawer;
