"use client";

import React, { useEffect, useState } from "react";
import { Select, Tag } from "antd";
import { apiClient, DocumentTypeInfo, ProcessingConfig } from "@/lib/api";
import {
  PROCESSING_METHODS,
  getModelsForMethod,
  getDefaultModel,
  getModelDisplayName,
  getMethodDisplayName,
} from "@/lib/processingConfig";

interface ProcessingConfigSelectorProps {
  config: ProcessingConfig;
  onChange: (config: ProcessingConfig) => void;
  disabled?: boolean;
}

const ProcessingConfigSelector: React.FC<ProcessingConfigSelectorProps> = ({
  config,
  onChange,
  disabled = false,
}) => {
  // Update model to default when method changes
  useEffect(() => {
    const currentMethod = config.processing.method || PROCESSING_METHODS.OPENAI;
    const availableModels = getModelsForMethod(currentMethod);
    const currentModel = config.processing.model;

    // If current model is not valid for current method, reset to default
    if (!availableModels.includes(currentModel)) {
      const defaultModel = getDefaultModel(currentMethod);
      onChange({
        ...config,
        processing: {
          ...config.processing,
          method: currentMethod,
          model: defaultModel,
        },
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.processing.method]);

  const handleExtractionMethodChange = (
    method: "mineru" | "documentai" | "extendai" | "paddleocr"
  ) => {
    onChange({
      ...config,
      extraction: {
        ...config.extraction,
        method,
      },
    });
  };

  const handleProcessingMethodChange = (method: "openai" | "qwen") => {
    const defaultModel = getDefaultModel(method);
    onChange({
      ...config,
      processing: {
        ...config.processing,
        method,
        model: defaultModel,
      },
    });
  };

  const handleProcessingModelChange = (model: string) => {
    onChange({
      ...config,
      processing: {
        ...config.processing,
        model,
      },
    });
  };

  const currentMethod = config.processing.method || PROCESSING_METHODS.OPENAI;
  const availableModels = getModelsForMethod(currentMethod);

  // Document types for the visual classifier multi-select. Loaded lazily
  // on mount so the form is usable even if the registry call is slow / 404.
  const [documentTypes, setDocumentTypes] = useState<DocumentTypeInfo[]>([]);
  const [docTypesError, setDocTypesError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiClient.getDocumentTypes();
        if (cancelled) return;
        if (res.success && Array.isArray((res as any).documentTypes)) {
          setDocumentTypes((res as any).documentTypes);
        } else {
          setDocTypesError(res.message || "Failed to load document types");
        }
      } catch (err: any) {
        if (!cancelled) setDocTypesError(err?.message || "Failed to load document types");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const useVisualClassifier = config.useVisualClassifier === true;
  const handleVisualClassifierToggle = (enabled: boolean) => {
    onChange({
      ...config,
      useVisualClassifier: enabled,
      // Reset slug restriction when disabling so it's not silently retained.
      documentTypeSlugs: enabled ? config.documentTypeSlugs : undefined,
    });
  };
  const handleSlugsChange = (slugs: string[]) => {
    onChange({
      ...config,
      documentTypeSlugs: slugs.length > 0 ? slugs : undefined,
    });
  };

  return (
    <div className="space-y-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Processing Configuration
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          Select extraction and processing methods for optimal results
        </p>
      </div>

      {/* Extraction Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Text Extraction Method
        </label>
        <div className="space-y-2">
          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="extraction_method"
              value="mineru"
              checked={config.extraction.method === "mineru"}
              onChange={() => handleExtractionMethodChange("mineru")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">MinerU</div>
              <div className="text-sm text-gray-500">
                High-quality extraction with formatting preservation
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="extraction_method"
              value="documentai"
              checked={config.extraction.method === "documentai"}
              onChange={() => handleExtractionMethodChange("documentai")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">
                Google Document AI
              </div>
              <div className="text-sm text-gray-500">
                Fast extraction with table detection
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="extraction_method"
              value="extendai"
              checked={config.extraction.method === "extendai"}
              onChange={() => handleExtractionMethodChange("extendai")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">Extend AI</div>
              <div className="text-sm text-gray-500">
                Cloud-based extraction with automatic fallback to MinerU
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="extraction_method"
              value="paddleocr"
              checked={config.extraction.method === "paddleocr"}
              onChange={() => handleExtractionMethodChange("paddleocr")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">PaddleOCR</div>
              <div className="text-sm text-gray-500">
                OCR-based extraction with layout parsing and table detection
                (Default)
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Processing Method Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Processing Method
        </label>
        <div className="space-y-2">
          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="processing_method"
              value={PROCESSING_METHODS.OPENAI}
              checked={currentMethod === PROCESSING_METHODS.OPENAI}
              onChange={() =>
                handleProcessingMethodChange(PROCESSING_METHODS.OPENAI)
              }
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">
                {getMethodDisplayName(PROCESSING_METHODS.OPENAI)}
              </div>
              <div className="text-sm text-gray-500">
                OpenAI GPT models (Default)
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="processing_method"
              value={PROCESSING_METHODS.QWEN}
              checked={currentMethod === PROCESSING_METHODS.QWEN}
              onChange={() =>
                handleProcessingMethodChange(PROCESSING_METHODS.QWEN)
              }
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">
                {getMethodDisplayName(PROCESSING_METHODS.QWEN)}
              </div>
              <div className="text-sm text-gray-500">
                Alibaba Cloud Qwen models
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Processing Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Model
        </label>
        <select
          value={config.processing.model}
          onChange={(e) => handleProcessingModelChange(e.target.value)}
          disabled={disabled}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          {availableModels.map((model) => (
            <option key={model} value={model}>
              {getModelDisplayName(model)}
            </option>
          ))}
        </select>
      </div>

      {/* Visual Page Classifier */}
      <div className="pt-4 border-t border-gray-200">
        <label className="flex items-start space-x-3 cursor-pointer">
          <input
            type="checkbox"
            checked={useVisualClassifier}
            onChange={(e) => handleVisualClassifierToggle(e.target.checked)}
            disabled={disabled}
            className="h-4 w-4 mt-1 text-blue-600"
          />
          <div className="flex-1">
            <div className="font-medium text-gray-900 flex items-center gap-2">
              Use visual page classifier
              <Tag color="blue" style={{ marginInlineEnd: 0 }}>BETA</Tag>
            </div>
            <div className="text-sm text-gray-500">
              Classifies each page from its image BEFORE extraction (no OCR
              required) and only sends the relevant pages to the extractor.
              Big cost win on long documents — typically reduces OCR pages by
              50-80%. Falls back to extracting the full document if the
              classifier fails or finds no usable pages.
            </div>
          </div>
        </label>

        {useVisualClassifier && (
          <div className="mt-4 ml-7 space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              Restrict to document types{" "}
              <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <Select
              mode="multiple"
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="Leave empty to consider all registered types"
              value={config.documentTypeSlugs ?? []}
              onChange={handleSlugsChange}
              disabled={disabled}
              className="w-full"
              options={documentTypes.map((dt) => ({
                value: dt.slug,
                label: `${dt.display_name} — ${dt.slug}`,
              }))}
              notFoundContent={
                docTypesError
                  ? `Failed to load: ${docTypesError}`
                  : "No registered document types yet"
              }
            />
            <div className="text-xs text-gray-500">
              When set, the classifier only considers these types when deciding
              what each page is. Useful when you know the document family up
              front and want to suppress noise from unrelated types.
            </div>
          </div>
        )}
      </div>

      {/* Current Configuration Summary */}
      <div className="pt-4 border-t border-gray-200">
        <div className="text-sm text-gray-600">
          <span className="font-medium">Current configuration:</span>{" "}
          {config.extraction.method === "documentai"
            ? "Document AI"
            : config.extraction.method === "extendai"
            ? "Extend AI"
            : config.extraction.method === "paddleocr"
            ? "PaddleOCR"
            : "MinerU"}{" "}
          + {getMethodDisplayName(currentMethod)}{" "}
          {getModelDisplayName(config.processing.model)}
          {useVisualClassifier && (
            <>
              {" "}
              · classifier on
              {config.documentTypeSlugs && config.documentTypeSlugs.length > 0
                ? ` (${config.documentTypeSlugs.length} type${
                    config.documentTypeSlugs.length === 1 ? "" : "s"
                  })`
                : " (all types)"}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProcessingConfigSelector;
