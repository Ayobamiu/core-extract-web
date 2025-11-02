"use client";

import React from "react";
import { ProcessingConfig } from "@/lib/api";

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

  const handleProcessingModelChange = (
    model: "gpt-4o" | "gpt-4" | "gpt-3.5-turbo"
  ) => {
    onChange({
      ...config,
      processing: {
        ...config.processing,
        model,
      },
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
                OCR-based extraction with layout parsing and table detection (Default)
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Processing Model Selection */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          AI Processing Model
        </label>
        <div className="space-y-2">
          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="processing_model"
              value="gpt-4o"
              checked={config.processing.model === "gpt-4o"}
              onChange={() => handleProcessingModelChange("gpt-4o")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">GPT-4o</div>
              <div className="text-sm text-gray-500">
                Best accuracy and speed (Default)
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="processing_model"
              value="gpt-4"
              checked={config.processing.model === "gpt-4"}
              onChange={() => handleProcessingModelChange("gpt-4")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">GPT-4</div>
              <div className="text-sm text-gray-500">
                High accuracy, thorough analysis
              </div>
            </div>
          </label>

          <label className="flex items-center space-x-3 p-3 border rounded-md hover:bg-white cursor-pointer transition-colors">
            <input
              type="radio"
              name="processing_model"
              value="gpt-3.5-turbo"
              checked={config.processing.model === "gpt-3.5-turbo"}
              onChange={() => handleProcessingModelChange("gpt-3.5-turbo")}
              disabled={disabled}
              className="h-4 w-4 text-blue-600"
            />
            <div>
              <div className="font-medium text-gray-900">GPT-3.5 Turbo</div>
              <div className="text-sm text-gray-500">
                Fast and cost-effective
              </div>
            </div>
          </label>
        </div>
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
          + OpenAI {config.processing.model}
        </div>
      </div>
    </div>
  );
};

export default ProcessingConfigSelector;
