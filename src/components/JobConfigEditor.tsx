"use client";

import React, { useState, useEffect } from "react";
import { Modal, Form, Input, Select, message, Divider } from "antd";
import { ProcessingConfig } from "@/lib/api";
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

  // Initialize form with current values when modal opens
  useEffect(() => {
    if (open && currentConfig) {
      form.setFieldsValue({
        name: currentConfig.name,
        extraction_mode: currentConfig.extraction_mode || "full_extraction",
        extraction_method:
          currentConfig.processing_config?.extraction?.method || "paddleocr",
        processing_method:
          currentConfig.processing_config?.processing?.method || "openai",
        processing_model:
          currentConfig.processing_config?.processing?.model || "gpt-4o",
      });
    }
  }, [open, currentConfig, form]);

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
          method: values.processing_method || "openai",
          model: values.processing_model || "gpt-4o",
          options: currentConfig.processing_config?.processing?.options || {},
        },
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
        currentConfig.processing_config?.processing?.method || "openai";
      const currentProcessingModel =
        currentConfig.processing_config?.processing?.model || "gpt-4o";

      if (
        values.extraction_method !== currentExtractionMethod ||
        values.processing_method !== currentProcessingMethod ||
        values.processing_model !== currentProcessingModel
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
            <Select placeholder="Select processing method" disabled>
              <Option value="openai">OpenAI</Option>
            </Select>
          </Form.Item>

          {/* Processing Model */}
          <Form.Item
            label="AI Model"
            name="processing_model"
            tooltip="OpenAI model to use for processing"
          >
            <Select placeholder="Select AI model">
              <Option value="gpt-4o">GPT-4o</Option>
              <Option value="gpt-4">GPT-4</Option>
              <Option value="gpt-3.5-turbo">GPT-3.5 Turbo</Option>
            </Select>
          </Form.Item>
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
