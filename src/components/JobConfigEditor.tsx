"use client";

import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Select, message, Divider, Switch, Tag } from "antd";
import { apiClient, DocumentTypeInfo, ProcessingConfig } from "@/lib/api";
import {
  PROCESSING_METHODS,
  getModelsForMethod,
  getDefaultModel,
  getModelDisplayName,
  getMethodDisplayName,
} from "@/lib/processingConfig";
import Button from "@/components/ui/Button";

const { Option } = Select;

interface JobConfigEditorProps {
  open: boolean;
  onClose: () => void;
  jobId: string;
  currentConfig: {
    name: string;
    extraction_mode?: "full_extraction" | "text_only";
    processing_config?: ProcessingConfig;
  };
  onUpdate: (updates: {
    name?: string;
    extraction_mode?: "full_extraction" | "text_only";
    processing_config?: Partial<ProcessingConfig>;
  }) => Promise<void>;
}

export default function JobConfigEditor({
  open,
  onClose,
  jobId,
  currentConfig,
  onUpdate,
}: JobConfigEditorProps) {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [selectedProcessingMethod, setSelectedProcessingMethod] = useState<
    "openai" | "qwen"
  >(PROCESSING_METHODS.OPENAI);

  // Initialize form with current values when modal opens
  useEffect(() => {
    if (open && currentConfig) {
      const processingMethod =
        currentConfig.processing_config?.processing?.method ||
        PROCESSING_METHODS.OPENAI;
      const defaultModel = getDefaultModel(processingMethod);
      const processingModel =
        currentConfig.processing_config?.processing?.model || defaultModel;

      setSelectedProcessingMethod(processingMethod);
      form.setFieldsValue({
        name: currentConfig.name,
        extraction_mode: currentConfig.extraction_mode || "full_extraction",
        extraction_method:
          currentConfig.processing_config?.extraction?.method || "paddleocr",
        processing_method: processingMethod,
        processing_model: processingModel,
        use_page_detection:
          currentConfig.processing_config?.usePageDetection !== false, // Default to true
        use_visual_classifier:
          currentConfig.processing_config?.useVisualClassifier === true,
        document_type_slugs:
          currentConfig.processing_config?.documentTypeSlugs ?? [],
      });
    }
  }, [open, currentConfig, form]);

  // Load registered document types for the visual-classifier multi-select.
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeInfo[]>([]);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getDocumentTypes();
        if (cancelled) return;
        if (res.success && Array.isArray((res as any).documentTypes)) {
          setDocumentTypes((res as any).documentTypes);
        }
      } catch {
        // Non-fatal: editor still works, multi-select will just be empty.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  const handleProcessingMethodChange = (method: "openai" | "qwen") => {
    setSelectedProcessingMethod(method);
    const defaultModel = getDefaultModel(method);
    form.setFieldsValue({
      processing_method: method,
      processing_model: defaultModel,
    });
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Build processing_config updates
      const processingConfig: Partial<ProcessingConfig> = {
        extraction: {
          method:
            values.extraction_method ||
            currentConfig.processing_config?.extraction?.method ||
            "paddleocr",
          options: currentConfig.processing_config?.extraction?.options || {},
        },
        processing: {
          method: values.processing_method || PROCESSING_METHODS.OPENAI,
          model:
            values.processing_model ||
            getDefaultModel(
              values.processing_method || PROCESSING_METHODS.OPENAI
            ),
          options: currentConfig.processing_config?.processing?.options || {},
        },
        usePageDetection: values.use_page_detection !== false, // Default to true if not explicitly set
        useVisualClassifier: values.use_visual_classifier === true,
        documentTypeSlugs:
          values.use_visual_classifier === true &&
          Array.isArray(values.document_type_slugs) &&
          values.document_type_slugs.length > 0
            ? values.document_type_slugs
            : undefined,
      };

      // Prepare updates
      const updates: {
        name?: string;
        extraction_mode?: "full_extraction" | "text_only";
        processing_config?: Partial<ProcessingConfig>;
      } = {};

      if (values.name !== currentConfig.name) {
        updates.name = values.name;
      }

      if (values.extraction_mode !== currentConfig.extraction_mode) {
        updates.extraction_mode = values.extraction_mode;
      }

      // Check if processing_config changed
      const currentExtractionMethod =
        currentConfig.processing_config?.extraction?.method || "paddleocr";
      const currentProcessingMethod =
        currentConfig.processing_config?.processing?.method ||
        PROCESSING_METHODS.OPENAI;
      const currentProcessingModel =
        currentConfig.processing_config?.processing?.model ||
        getDefaultModel(currentProcessingMethod);
      const currentUsePageDetection =
        currentConfig.processing_config?.usePageDetection !== false; // Default to true
      const currentUseVisualClassifier =
        currentConfig.processing_config?.useVisualClassifier === true;
      const currentSlugs = (
        currentConfig.processing_config?.documentTypeSlugs ?? []
      )
        .slice()
        .sort()
        .join(",");
      const newSlugs = (values.document_type_slugs ?? [])
        .slice()
        .sort()
        .join(",");

      if (
        values.extraction_method !== currentExtractionMethod ||
        values.processing_method !== currentProcessingMethod ||
        values.processing_model !== currentProcessingModel ||
        values.use_page_detection !== currentUsePageDetection ||
        values.use_visual_classifier !== currentUseVisualClassifier ||
        currentSlugs !== newSlugs
      ) {
        updates.processing_config = processingConfig;
      }

      if (Object.keys(updates).length === 0) {
        message.info("No changes to save");
        onClose();
        return;
      }

      await onUpdate(updates);
      message.success("Job configuration updated successfully");
      onClose();
    } catch (error: any) {
      console.error("Error updating job config:", error);
      if (error?.errorFields) {
        // Form validation errors
        return;
      }
      message.error(error?.message || "Failed to update job configuration");
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    form.resetFields();
    onClose();
  };

  const availableModels = getModelsForMethod(selectedProcessingMethod);

  return (
    <Modal
      title="Edit Job Configuration"
      open={open}
      onCancel={handleCancel}
      footer={null}
      width={600}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        className="mt-4"
        onFinish={handleSubmit}
      >
        {/* Job Name */}
        <Form.Item
          label="Job Name"
          name="name"
          rules={[
            { required: true, message: "Job name is required" },
            { max: 255, message: "Job name must be less than 255 characters" },
          ]}
        >
          <Input placeholder="Enter job name" />
        </Form.Item>

        <Divider className="my-4" />

        {/* Extraction Mode */}
        <Form.Item
          label="Extraction Mode"
          name="extraction_mode"
          tooltip="full_extraction: Extract text and process with AI. text_only: Extract text only."
        >
          <Select placeholder="Select extraction mode">
            <Option value="full_extraction">Full Extraction</Option>
            <Option value="text_only">Text Only</Option>
          </Select>
        </Form.Item>

        <Divider className="my-4" />

        {/* Processing Configuration */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Processing Configuration
          </h3>

          {/* Extraction Method */}
          <Form.Item
            label="Extraction Method"
            name="extraction_method"
            tooltip="Method used to extract text from documents"
          >
            <Select placeholder="Select extraction method">
              <Option value="paddleocr">PaddleOCR</Option>
              <Option value="mineru">MinerU</Option>
              <Option value="documentai">Document AI</Option>
              <Option value="extendai">Extend AI</Option>
            </Select>
          </Form.Item>

          {/* Processing Method */}
          <Form.Item
            label="Processing Method"
            name="processing_method"
            tooltip="AI processing method"
          >
            <Select
              placeholder="Select processing method"
              onChange={handleProcessingMethodChange}
            >
              <Option value={PROCESSING_METHODS.OPENAI}>
                {getMethodDisplayName(PROCESSING_METHODS.OPENAI)}
              </Option>
              <Option value={PROCESSING_METHODS.QWEN}>
                {getMethodDisplayName(PROCESSING_METHODS.QWEN)}
              </Option>
            </Select>
          </Form.Item>

          {/* Processing Model */}
          <Form.Item
            label="AI Model"
            name="processing_model"
            tooltip="AI model to use for processing"
          >
            <Select placeholder="Select AI model">
              {availableModels.map((model) => (
                <Option key={model} value={model}>
                  {getModelDisplayName(model)}
                </Option>
              ))}
            </Select>
          </Form.Item>
        </div>

        <Divider className="my-4" />

        {/* Page Detection Configuration */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Page Detection Configuration
          </h3>

          <Form.Item
            label="Enable Smart Page Filtering"
            name="use_page_detection"
            tooltip="When enabled, only processes pages identified as relevant (Formation, LOG, Plugging Record). When disabled, processes the entire document."
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          <div className="text-xs text-gray-500 mt-1 mb-4">
            Smart page filtering automatically identifies and processes only
            relevant pages (Formation, LOG OF OIL/GAS, Well Plugging Record),
            reducing processing costs and improving accuracy. Disable to process
            the entire document.
          </div>
        </div>

        <Divider className="my-4" />

        {/* Visual Page Classifier */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
            Visual Page Classifier
            <Tag color="blue" style={{ marginInlineEnd: 0 }}>BETA</Tag>
          </h3>

          <Form.Item
            label="Use visual page classifier"
            name="use_visual_classifier"
            tooltip="Classifies each page from its image BEFORE extraction so the OCR/AI step only runs on the pages that matter. Big cost win on long documents."
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) =>
              prev.use_visual_classifier !== curr.use_visual_classifier
            }
          >
            {({ getFieldValue }) =>
              getFieldValue("use_visual_classifier") ? (
                <Form.Item
                  label="Restrict to document types (optional)"
                  name="document_type_slugs"
                  tooltip="Leave empty to consider all registered types. Restrict when you know the document family up front."
                >
                  <Select
                    mode="multiple"
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    placeholder="Leave empty to consider all registered types"
                    options={documentTypes.map((dt) => ({
                      value: dt.slug,
                      label: `${dt.display_name} — ${dt.slug}`,
                    }))}
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <div className="text-xs text-gray-500 mt-1 mb-4">
            Falls back to extracting the full document if the classifier fails
            or finds no usable pages — never silently drops files.
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex justify-end space-x-3 mt-6 pt-4 border-t border-gray-200">
          <Button
            type="button"
            variant="secondary"
            onClick={handleCancel}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" variant="primary" loading={loading}>
            Save Changes
          </Button>
        </div>
      </Form>
    </Modal>
  );
}
