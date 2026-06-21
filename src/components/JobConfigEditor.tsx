"use client";

import React, { useState, useEffect } from "react";
import { App, Drawer, Form, Input, Select, Divider, Switch, Tag } from "antd";
import {
  apiClient,
  DocumentTypeInfo,
  ProcessingConfig,
  PostProcessingOverride,
  RunServiceResult,
} from "@/lib/api";
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
  const { message } = App.useApp();
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
        use_per_section_extraction:
          currentConfig.processing_config?.usePerSectionExtraction === true,
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

  // ── Post-processing services (auto-run config + manual backfill) ──
  // Registered services available to enable per job.
  const [ppServices, setPpServices] = useState<{ name: string; version: string }[]>([]);
  // Per-job override state per service: 'default' (inherit doc-type default),
  // 'on' (force enabled), 'off' (force disabled).
  const [ppState, setPpState] = useState<Record<string, "default" | "on" | "off">>({});
  // Manual "run now" backfill controls.
  const [runService, setRunService] = useState<string | undefined>();
  const [runSlug, setRunSlug] = useState<string | undefined>();
  const [runBusy, setRunBusy] = useState(false);
  const [runResult, setRunResult] = useState<(RunServiceResult & { applied: boolean }) | null>(null);

  useEffect(() => {
    if (!open) return;
    // Seed override state from the saved per-job config.
    const overrides = currentConfig.processing_config?.postProcessing ?? [];
    const seeded: Record<string, "default" | "on" | "off"> = {};
    for (const o of overrides) {
      if (o && typeof o.name === "string") {
        seeded[o.name] = o.enabled === true ? "on" : o.enabled === false ? "off" : "default";
      }
    }
    setPpState(seeded);
    setRunResult(null);

    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getJobServices(jobId);
        if (cancelled) return;
        const services = (res.data as any)?.services;
        if (res.success && Array.isArray(services)) setPpServices(services);
      } catch {
        // Non-fatal: section just shows no services.
      }
    })();
    return () => {
      cancelled = true;
    };
    // Seed once per open (not on every currentConfig identity change) so we don't
    // clobber the user's in-progress toggle edits while the modal is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  // Build the postProcessing override array from tri-state (omit 'default').
  const buildPostProcessing = (): PostProcessingOverride[] =>
    Object.entries(ppState)
      .filter(([, v]) => v !== "default")
      .map(([name, v]) => ({ name, enabled: v === "on" }));

  const handleRunService = async (apply: boolean) => {
    if (!runService || !runSlug) {
      message.warning("Pick a service and a document type first.");
      return;
    }
    setRunBusy(true);
    setRunResult(null);
    try {
      const res = await apiClient.runJobService(jobId, {
        name: runService,
        slug: runSlug,
        apply,
      });
      if (res.success && res.data) {
        setRunResult({ ...res.data, applied: apply });
        message.success(apply ? "Backfill applied." : "Dry-run complete.");
      } else {
        message.error(res.message || "Run failed.");
      }
    } catch (e: any) {
      message.error(e?.message || "Run failed.");
    } finally {
      setRunBusy(false);
    }
  };

  // Slugs offered for backfill: the job's restricted set, else all registered types.
  const runSlugOptions =
    (currentConfig.processing_config?.documentTypeSlugs?.length
      ? currentConfig.processing_config.documentTypeSlugs.map((s) => ({ value: s, label: s }))
      : documentTypes.map((dt) => ({ value: dt.slug, label: `${dt.display_name} — ${dt.slug}` })));

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
        usePerSectionExtraction: values.use_per_section_extraction === true,
        documentTypeSlugs:
          values.use_visual_classifier === true &&
          Array.isArray(values.document_type_slugs) &&
          values.document_type_slugs.length > 0
            ? values.document_type_slugs
            : undefined,
        postProcessing: buildPostProcessing(),
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
      const currentUsePerSectionExtraction =
        currentConfig.processing_config?.usePerSectionExtraction === true;
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

      // Normalize postProcessing overrides for change detection (order-insensitive).
      const normPP = (list: PostProcessingOverride[] | undefined) =>
        (list ?? [])
          .map((o) => `${o.name}:${o.enabled === true ? 1 : o.enabled === false ? 0 : "-"}`)
          .sort()
          .join(",");
      const currentPP = normPP(currentConfig.processing_config?.postProcessing);
      const newPP = normPP(processingConfig.postProcessing);

      if (
        values.extraction_method !== currentExtractionMethod ||
        values.processing_method !== currentProcessingMethod ||
        values.processing_model !== currentProcessingModel ||
        values.use_page_detection !== currentUsePageDetection ||
        values.use_visual_classifier !== currentUseVisualClassifier ||
        values.use_per_section_extraction !== currentUsePerSectionExtraction ||
        currentSlugs !== newSlugs ||
        currentPP !== newPP
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
    <Drawer
      title="Edit Job Configuration"
      open={open}
      onClose={handleCancel}
      width={760}
      destroyOnClose
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

          <Form.Item
            label="Per-section extraction"
            name="use_per_section_extraction"
            tooltip="Fan out one AI call per classified section with its own registry-resolved schema. Produces a v2 result envelope. Requires the visual page classifier."
            valuePropName="checked"
            initialValue={false}
          >
            <Switch />
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev: any, curr: any) =>
              prev.use_per_section_extraction !== curr.use_per_section_extraction ||
              prev.use_visual_classifier !== curr.use_visual_classifier
            }
          >
            {({ getFieldValue, setFieldsValue }: any) => {
              const vpc = getFieldValue("use_visual_classifier");
              const perSection = getFieldValue("use_per_section_extraction");
              if (perSection && !vpc) {
                setTimeout(() => setFieldsValue({ use_visual_classifier: true }), 0);
              }
              if (!vpc && perSection) {
                setTimeout(() => setFieldsValue({ use_per_section_extraction: false }), 0);
              }
              return null;
            }}
          </Form.Item>

          <div className="text-xs text-gray-500 mt-1 mb-4">
            When off, the classifier still narrows the page set but extraction
            uses the single job schema (v1 flat result). Turn on for multi-schema
            fan-out with the v2 envelope.
          </div>
        </div>

        <Divider className="my-4" />

        {/* Post-processing services (auto-run + manual backfill) */}
        <div className="mb-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">
            Post-processing
          </h3>
          <div className="text-xs text-gray-500 mb-3">
            Services that run automatically after extraction (e.g. geocoding).
            “Default” inherits the document-type setting; choose On/Off to override
            it for this job.
          </div>

          {ppServices.length === 0 ? (
            <div className="text-xs text-gray-400">No services registered.</div>
          ) : (
            <div className="space-y-2">
              {ppServices.map((svc) => (
                <div key={svc.name} className="flex items-center justify-between gap-3">
                  <div className="text-sm text-gray-700">
                    <span className="font-mono">{svc.name}</span>
                    <span className="text-xs text-gray-400 ml-2">v{svc.version}</span>
                  </div>
                  <Select
                    size="small"
                    style={{ width: 130 }}
                    value={ppState[svc.name] ?? "default"}
                    onChange={(v) =>
                      setPpState((prev) => ({ ...prev, [svc.name]: v }))
                    }
                  >
                    <Option value="default">Default</Option>
                    <Option value="on">On</Option>
                    <Option value="off">Off</Option>
                  </Select>
                </div>
              ))}
            </div>
          )}

          <Divider className="my-4" />

          {/* Run now (backfill over already-extracted files) */}
          <h4 className="text-xs font-semibold text-gray-600 mb-2">
            Run now (backfill existing files)
          </h4>
          <div className="text-xs text-gray-500 mb-2">
            Applies a service to files already processed in this job.{" "}
            <span className="font-medium text-gray-700">Dry run</span> previews
            the result — how many records would change — and writes nothing.{" "}
            <span className="font-medium text-gray-700">Apply</span> performs the
            change and saves it. Start with Dry run.
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select
              size="small"
              style={{ minWidth: 170 }}
              placeholder="Service"
              value={runService}
              onChange={setRunService}
              options={ppServices.map((s) => ({ value: s.name, label: s.name }))}
            />
            <Select
              size="small"
              style={{ minWidth: 200 }}
              placeholder="Document type"
              value={runSlug}
              onChange={setRunSlug}
              options={runSlugOptions}
              showSearch
              optionFilterProp="label"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => handleRunService(false)}
              loading={runBusy}
            >
              Dry run
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={() => handleRunService(true)}
              loading={runBusy}
            >
              Apply
            </Button>
          </div>

          {runResult && (
            <div className="text-xs text-gray-600 mt-3 p-2 rounded bg-gray-50 border border-gray-200">
              <div className="font-medium mb-1">
                {runResult.applied ? "Applied" : "Dry-run"} · {runResult.filesScanned} file(s) scanned ·{" "}
                {runResult.recordsMatched} record(s) matched
                {runResult.applied ? ` · ${runResult.filesUpdated} file(s) updated` : ""}
              </div>
              <div>summary: {JSON.stringify(runResult.summary)}</div>
              {runResult.precisionTiers && (
                <div>precision: {JSON.stringify(runResult.precisionTiers)}</div>
              )}
            </div>
          )}
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
    </Drawer>
  );
}
