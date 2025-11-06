"use client";

import React, { useEffect } from "react";
import { ProcessingConfig } from "@/lib/api";
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
        </div>
      </div>
    </div>
  );
};

export default ProcessingConfigSelector;
