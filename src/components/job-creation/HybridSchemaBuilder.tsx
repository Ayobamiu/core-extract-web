"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import { SchemaBuilder, SchemaProperty } from "./SchemaBuilder";
import { RecursiveSchemaProperty } from "./RecursiveSchemaProperty";
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  XMarkIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
  schemaPreview?: GeneratedSchema;
}

interface GeneratedSchema {
  properties: Array<{
    key: string;
    type: string;
    description: string;
    examples?: string[];
  }>;
  confidence: number;
  reasoning: string;
}

interface HybridSchemaBuilderProps {
  schema: SchemaProperty[];
  onSchemaChange: (schema: SchemaProperty[]) => void;
  onNext: () => void;
  onBack?: () => void;
  jobName?: string;
  schemaName?: string;
  onJobNameChange?: (jobName: string) => void;
  onSchemaNameChange?: (schemaName: string) => void;
}

export function HybridSchemaBuilder({
  schema,
  onSchemaChange,
  onNext,
  onBack,
  jobName = "",
  schemaName = "",
  onJobNameChange,
  onSchemaNameChange,
}: HybridSchemaBuilderProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "ai-intro",
      type: "ai",
      content:
        "👋 Hi! I'm your AI schema assistant. I can help you generate, modify, or enhance your schema. Just describe what you need!",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] =
    useState<GeneratedSchema | null>(null);
  const [showTips, setShowTips] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Handle Escape key to close chat panel
  useEffect(() => {
    const handleEscapeKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && isChatOpen) {
        setIsChatOpen(false);
      }
    };

    if (isChatOpen) {
      document.addEventListener("keydown", handleEscapeKey);
      return () => document.removeEventListener("keydown", handleEscapeKey);
    }
  }, [isChatOpen]);

  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9);
  }, []);

  // Tree management functions
  const addProperty = useCallback(() => {
    const newProperty: SchemaProperty = {
      id: generateId(),
      key: "",
      type: "text",
      description: "",
      required: false,
      depth: 0,
      path: "",
    };
    onSchemaChange([...schema, newProperty]);
  }, [schema, onSchemaChange, generateId]);

  const updateProperty = useCallback(
    (updatedProperty: SchemaProperty) => {
      const updatedSchema = schema.map((prop) =>
        prop.id === updatedProperty.id ? updatedProperty : prop
      );
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const deleteProperty = useCallback(
    (propertyId: string) => {
      // Delete property and all its children
      const deleteRecursive = (id: string): string[] => {
        const children = schema.filter((prop) => prop.parentId === id);
        const childIds = children.flatMap((child) => deleteRecursive(child.id));
        return [id, ...childIds];
      };

      const idsToDelete = deleteRecursive(propertyId);
      const updatedSchema = schema.filter(
        (prop) => !idsToDelete.includes(prop.id)
      );
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const addChildProperty = useCallback(
    (parentId: string, childProperty: SchemaProperty) => {
      onSchemaChange([...schema, childProperty]);
    },
    [schema, onSchemaChange]
  );

  const getRootProperties = useCallback(() => {
    return schema.filter((prop) => !prop.parentId);
  }, [schema]);

  const simulateAIResponse = useCallback(
    async (userMessage: string): Promise<string> => {
      await new Promise((resolve) =>
        setTimeout(resolve, 1500 + Math.random() * 1000)
      );

      const lowerInput = userMessage.toLowerCase();

      if (lowerInput.includes("well") || lowerInput.includes("drilling")) {
        return "Great! I can see you're working with well/drilling data. Let me create a comprehensive schema for you. I'll include properties like well name, depth, operator, drilling date, casing details, and more. Would you like me to generate this schema now?";
      } else if (
        lowerInput.includes("invoice") ||
        lowerInput.includes("billing")
      ) {
        return "Perfect! I'll create a schema for invoice/billing data extraction. This will include invoice number, date, amount, vendor details, line items, and payment information. Should I proceed with generating this schema?";
      } else if (
        lowerInput.includes("contract") ||
        lowerInput.includes("agreement")
      ) {
        return "Excellent! I'll design a schema for contract/agreement extraction. This will capture parties involved, contract terms, dates, amounts, obligations, and key clauses. Ready to generate this schema?";
      } else if (
        lowerInput.includes("medical") ||
        lowerInput.includes("patient")
      ) {
        return "I'll create a medical/patient data schema for you. This will include patient information, diagnosis, treatment details, medications, dates, and medical history. Shall I generate this schema?";
      } else if (
        lowerInput.includes("add") ||
        lowerInput.includes("property")
      ) {
        return "I can help you add new properties to your existing schema! Tell me what specific data you want to extract, and I'll suggest the best property structure for it.";
      } else if (
        lowerInput.includes("modify") ||
        lowerInput.includes("change")
      ) {
        return "I can help you modify existing properties! Which property would you like to change, and what modifications do you need?";
      } else {
        return "I understand! I'll analyze your requirements and create a custom schema. Based on your description, I'll design properties that capture all the important data points. Should I generate the schema now?";
      }
    },
    []
  );

  const generateSchemaFromMessage = useCallback(
    async (userMessage: string): Promise<GeneratedSchema> => {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const lowerInput = userMessage.toLowerCase();

      if (lowerInput.includes("well") || lowerInput.includes("drilling")) {
        return {
          properties: [
            {
              key: "well_name",
              type: "text",
              description: "Name or identifier of the well",
              examples: ["Well-001", "ABC-123"],
            },
            {
              key: "operator",
              type: "text",
              description: "Company operating the well",
              examples: ["Shell", "ExxonMobil"],
            },
            {
              key: "depth",
              type: "number",
              description: "Total depth of the well in feet",
              examples: ["5000", "7500"],
            },
            {
              key: "drilling_date",
              type: "date",
              description: "Date when drilling started",
              examples: ["2024-01-15"],
            },
            {
              key: "completion_date",
              type: "date",
              description: "Date when well was completed",
              examples: ["2024-02-20"],
            },
            {
              key: "status",
              type: "enum",
              description: "Current status of the well",
              examples: ["active", "inactive", "plugged"],
            },
            {
              key: "casing_details",
              type: "array",
              description: "List of casing strings used",
              examples: ['Surface: 13-3/8", Intermediate: 9-5/8"'],
            },
            {
              key: "production_rate",
              type: "number",
              description: "Daily production rate in barrels",
              examples: ["150", "200"],
            },
          ],
          confidence: 0.92,
          reasoning:
            "Generated comprehensive well data schema based on industry standards, including all essential drilling and production information.",
        };
      } else if (
        lowerInput.includes("invoice") ||
        lowerInput.includes("billing")
      ) {
        return {
          properties: [
            {
              key: "invoice_number",
              type: "text",
              description: "Unique invoice identifier",
              examples: ["INV-2024-001", "BILL-12345"],
            },
            {
              key: "invoice_date",
              type: "date",
              description: "Date the invoice was issued",
              examples: ["2024-01-15"],
            },
            {
              key: "due_date",
              type: "date",
              description: "Payment due date",
              examples: ["2024-02-15"],
            },
            {
              key: "vendor_name",
              type: "text",
              description: "Name of the vendor/supplier",
              examples: ["ABC Corp", "XYZ Ltd"],
            },
            {
              key: "total_amount",
              type: "number",
              description: "Total invoice amount",
              examples: ["1250.00", "5000.00"],
            },
            {
              key: "currency",
              type: "text",
              description: "Currency code",
              examples: ["USD", "EUR"],
            },
            {
              key: "line_items",
              type: "array",
              description: "List of individual line items",
              examples: ["Service A: $500", "Product B: $750"],
            },
            {
              key: "payment_status",
              type: "enum",
              description: "Current payment status",
              examples: ["paid", "pending", "overdue"],
            },
          ],
          confidence: 0.89,
          reasoning:
            "Created invoice schema covering all standard billing fields including line items, dates, and payment tracking.",
        };
      } else {
        return {
          properties: [
            {
              key: "document_id",
              type: "text",
              description: "Unique document identifier",
              examples: ["DOC-001", "REF-123"],
            },
            {
              key: "title",
              type: "text",
              description: "Document title or subject",
              examples: ["Contract Agreement", "Report Summary"],
            },
            {
              key: "date",
              type: "date",
              description: "Document date",
              examples: ["2024-01-15"],
            },
            {
              key: "author",
              type: "text",
              description: "Document author or creator",
              examples: ["John Smith", "Jane Doe"],
            },
            {
              key: "category",
              type: "enum",
              description: "Document category",
              examples: ["contract", "report", "invoice", "other"],
            },
            {
              key: "key_points",
              type: "array",
              description: "Important points or summary",
              examples: ["Point 1", "Point 2"],
            },
          ],
          confidence: 0.75,
          reasoning:
            "Generated a flexible document schema that can capture common data points from various document types.",
        };
      }
    },
    []
  );

  const convertGeneratedToManualSchema = useCallback(
    (generatedSchema: GeneratedSchema): SchemaProperty[] => {
      return generatedSchema.properties.map((prop) => ({
        id: generateId(),
        key: prop.key,
        type: prop.type as any,
        description: prop.description,
        required: false,
        enumValues: prop.type === "enum" ? prop.examples : undefined,
      }));
    },
    [generateId]
  );

  const handleSendMessage = useCallback(async () => {
    if (inputValue.trim() === "") return;

    const userMessage: Message = {
      id: generateId(),
      type: "user",
      content: inputValue.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");
    setIsGenerating(true);

    try {
      const aiResponse = await simulateAIResponse(inputValue);
      const aiMessage: Message = {
        id: generateId(),
        type: "ai",
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      if (aiResponse.includes("generate") || aiResponse.includes("proceed")) {
        const generated = await generateSchemaFromMessage(inputValue);
        setGeneratedSchema(generated);

        const schemaMessage: Message = {
          id: generateId(),
          type: "ai",
          content: `✨ **Schema Generated!**\n\nI've created a schema with ${
            generated.properties.length
          } properties based on your requirements. The confidence level is ${Math.round(
            generated.confidence * 100
          )}%.\n\n**Reasoning:** ${
            generated.reasoning
          }\n\nWould you like to apply this schema to your builder, or would you like me to modify it?`,
          timestamp: new Date(),
          schemaPreview: generated,
        };

        setMessages((prev) => [...prev, schemaMessage]);
      }
    } catch (error) {
      console.error("Error generating response:", error);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "ai",
          content:
            "Oops! Something went wrong while generating the schema. Please try again.",
          timestamp: new Date(),
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  }, [inputValue, generateId, simulateAIResponse, generateSchemaFromMessage]);

  const handleApplyGeneratedSchema = useCallback(() => {
    if (generatedSchema) {
      const manualSchema = convertGeneratedToManualSchema(generatedSchema);
      onSchemaChange(manualSchema);

      // Auto-generate names if they're empty
      const currentDate = new Date().toLocaleDateString();
      const timestamp = new Date()
        .toLocaleTimeString("en-US", {
          hour12: false,
          hour: "2-digit",
          minute: "2-digit",
        })
        .replace(":", "");

      if (!jobName.trim()) {
        onJobNameChange(`AI Generated Job - ${currentDate}`);
      }

      if (!schemaName.trim()) {
        onSchemaNameChange(`ai_schema_${timestamp}`);
      }

      setGeneratedSchema(null);
      setMessages((prev) => [
        ...prev,
        {
          id: generateId(),
          type: "ai",
          content:
            "✅ Schema applied successfully! I've also generated job and schema names for you. You can now edit the schema manually or ask me to make further modifications.",
          timestamp: new Date(),
        },
      ]);
    }
  }, [
    generatedSchema,
    convertGeneratedToManualSchema,
    onSchemaChange,
    generateId,
    jobName,
    schemaName,
    onJobNameChange,
    onSchemaNameChange,
  ]);

  const handleKeyPress = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    },
    [handleSendMessage]
  );

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Main Schema Builder */}
      <div
        className={`flex-1 transition-all duration-300 ${
          isChatOpen ? "mr-80 max-w-none" : ""
        }`}
      >
        <div className="max-w-6xl mx-auto p-6">
          {/* Header */}
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Create New Job
                </h1>
                <p className="text-gray-600 mt-2">
                  Define the structure of data you want to extract
                </p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
                  Step 1 of 2
                </div>
                <Button
                  onClick={() => setIsChatOpen(!isChatOpen)}
                  variant="secondary"
                  className="flex items-center gap-2"
                >
                  <SparklesIcon className="h-5 w-5" />
                  {isChatOpen ? "Hide AI" : "AI Assistant"}
                </Button>
              </div>
            </div>

            {/* Job Name and Schema Name */}
            <Card className="p-6 mb-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Job Name
                  </label>
                  <input
                    type="text"
                    value={jobName}
                    onChange={(e) => onJobNameChange?.(e.target.value)}
                    placeholder="e.g., Well Analysis Job"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Schema Name
                  </label>
                  <input
                    type="text"
                    value={schemaName}
                    onChange={(e) => onSchemaNameChange?.(e.target.value)}
                    placeholder="e.g., well_schema"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>
            </Card>
          </div>

          {/* Schema Builder */}
          <Card className="p-6">
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Schema Builder
              </h2>
              <p className="text-gray-600 mb-4">
                Build your schema by adding properties and configuring their
                keys, types, names, and descriptions. Use the AI Assistant for
                quick generation!
              </p>

              {/* Help Section */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-3 flex-1">
                    <div className="flex-shrink-0">
                      <svg
                        className="h-5 w-5 text-blue-600 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <div className="text-sm text-blue-800">
                      <h3 className="font-medium mb-1">
                        💡 Tips for better extraction:
                      </h3>
                      {showTips && (
                        <ul className="space-y-1 text-blue-700">
                          <li>
                            • Use clear, descriptive property names (e.g.,
                            "well_depth" not "depth1")
                          </li>
                          <li>
                            • Provide detailed descriptions to help the AI
                            understand context
                          </li>
                          <li>
                            • Use enums for status fields with predefined values
                          </li>
                          <li>
                            • Use objects for related data that should be
                            grouped together
                          </li>
                          <li>
                            • Click "AI Assistant" to get help generating or
                            modifying your schema
                          </li>
                        </ul>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowTips(!showTips)}
                    className="ml-3 p-1 text-blue-600 hover:text-blue-800 transition-colors duration-200"
                    title={showTips ? "Hide tips" : "Show tips"}
                  >
                    <svg
                      className={`h-4 w-4 transition-transform duration-200 ${
                        showTips ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Table Header */}
            <div className="grid grid-cols-12 gap-4 py-3 border-b-2 border-gray-200 font-medium text-gray-700">
              <div className="col-span-1"></div>
              <div className="col-span-3 flex items-center gap-2">
                Property Key
                <div className="group relative">
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-full cursor-help transition-colors duration-200">
                    ?
                  </span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    The name of the property (e.g., "well_name", "depth"). Use
                    lowercase with underscores.
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div className="col-span-2 flex items-center gap-2">
                Type
                <div className="group relative">
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-full cursor-help transition-colors duration-200">
                    ?
                  </span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    The data type for this property. Choose from text, number,
                    boolean, date, enum, array, or object.
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div className="col-span-4 flex items-center gap-2">
                Description
                <div className="group relative">
                  <span className="inline-flex items-center justify-center w-5 h-5 text-xs font-medium text-white bg-gray-600 hover:bg-gray-700 rounded-full cursor-help transition-colors duration-200">
                    ?
                  </span>
                  <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                    A clear description of what this property represents. This
                    helps the AI understand what to extract.
                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
                  </div>
                </div>
              </div>
              <div className="col-span-2">Actions</div>
            </div>

            {/* Properties */}
            <div className="space-y-0">
              {getRootProperties().map((property) => (
                <RecursiveSchemaProperty
                  key={property.id}
                  property={property}
                  depth={0}
                  onUpdate={updateProperty}
                  onDelete={deleteProperty}
                  onAddChild={addChildProperty}
                  allProperties={schema}
                />
              ))}
            </div>

            {/* Add Property Button */}
            <div className="mt-6">
              <Button onClick={addProperty} className="flex items-center gap-2">
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Add Property
              </Button>
            </div>
          </Card>

          {/* Navigation */}
          <div className="flex justify-between mt-8">
            {onBack && (
              <Button onClick={onBack} variant="secondary">
                ← Back to Dashboard
              </Button>
            )}
            <Button onClick={onNext} className="ml-auto">
              Continue to File Upload →
            </Button>
          </div>
        </div>
      </div>

      {/* AI Chat Panel */}
      {isChatOpen && (
        <div className="fixed right-0 top-0 h-full w-80 max-w-sm bg-white shadow-xl border-l border-gray-200 flex flex-col z-50">
          {/* Chat Header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-purple-500 to-blue-500 text-white">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5" />
              <h3 className="font-semibold">AI Schema Assistant</h3>
            </div>
            <button
              onClick={() => setIsChatOpen(false)}
              className="p-2 hover:bg-white hover:bg-opacity-20 rounded-lg transition-colors duration-200"
              title="Close AI Assistant"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.type === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 ${
                    message.type === "user"
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 text-gray-900"
                  }`}
                >
                  <div className="text-sm whitespace-pre-wrap">
                    {message.content}
                  </div>
                  {message.schemaPreview && (
                    <div className="mt-2 p-2 bg-gray-50 rounded text-xs">
                      <div className="font-medium mb-1">
                        Generated Schema Preview:
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {message.schemaPreview.properties.map((prop, index) => (
                          <div key={index} className="text-gray-600">
                            <span className="font-mono text-blue-600">
                              {prop.key}
                            </span>
                            : {prop.type}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {isGenerating && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-3 py-2">
                  <div className="flex items-center space-x-1">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.1s" }}
                    ></div>
                    <div
                      className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                      style={{ animationDelay: "0.2s" }}
                    ></div>
                    <span className="text-sm text-gray-500 ml-2">
                      AI is thinking...
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Generated Schema Actions */}
          {generatedSchema && (
            <div className="p-4 border-t border-gray-200 bg-blue-50">
              <div className="mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">
                    Confidence
                  </span>
                  <span className="text-sm font-medium text-green-600">
                    {Math.round(generatedSchema.confidence * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${generatedSchema.confidence * 100}%` }}
                  ></div>
                </div>
              </div>
              <Button
                onClick={handleApplyGeneratedSchema}
                className="w-full bg-green-600 hover:bg-green-700 text-white"
              >
                Apply Schema to Builder
              </Button>
            </div>
          )}

          {/* Input */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Describe what you want to extract..."
                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                disabled={isGenerating}
              />
              <Button
                onClick={handleSendMessage}
                disabled={isGenerating || inputValue.trim() === ""}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Send
              </Button>
            </div>

            {/* Close Panel Button */}
            <Button
              onClick={() => setIsChatOpen(false)}
              variant="secondary"
              className="w-full flex items-center justify-center gap-2 text-gray-600 hover:text-gray-800"
            >
              <XMarkIcon className="h-4 w-4" />
              Close AI Assistant
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
