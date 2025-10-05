"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import {
  SparklesIcon,
  ChatBubbleLeftRightIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  PencilIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";

interface Message {
  id: string;
  type: "user" | "ai";
  content: string;
  timestamp: Date;
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

interface ConversationalSchemaBuilderProps {
  onSchemaGenerated: (schema: GeneratedSchema) => void;
  onNext: () => void;
  onBack?: () => void;
}

export function ConversationalSchemaBuilder({
  onSchemaGenerated,
  onNext,
  onBack,
}: ConversationalSchemaBuilderProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      type: "ai",
      content:
        "👋 Hi! I'm your AI schema assistant. Tell me what kind of data you want to extract from your documents, and I'll create a perfect schema for you!\n\nFor example: \"I want to extract well information like depth, operator name, drilling date, and casing details\"",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedSchema, setGeneratedSchema] =
    useState<GeneratedSchema | null>(null);
  const [isEditingSchema, setIsEditingSchema] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9);
  }, []);

  const simulateAIResponse = useCallback(
    async (userMessage: string): Promise<string> => {
      // Simulate AI processing time
      await new Promise((resolve) =>
        setTimeout(resolve, 1500 + Math.random() * 1000)
      );

      // Mock AI responses based on user input
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
      } else {
        return "I understand! I'll analyze your requirements and create a custom schema. Based on your description, I'll design properties that capture all the important data points. Should I generate the schema now?";
      }
    },
    []
  );

  const generateSchemaFromMessage = useCallback(
    async (userMessage: string): Promise<GeneratedSchema> => {
      // Simulate AI schema generation
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
        // Generic schema
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

  const handleSendMessage = useCallback(async () => {
    if (!inputValue.trim() || isGenerating) return;

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
      // Get AI response
      const aiResponse = await simulateAIResponse(userMessage.content);
      const aiMessage: Message = {
        id: generateId(),
        type: "ai",
        content: aiResponse,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, aiMessage]);

      // Generate schema if user seems ready
      if (aiResponse.includes("generate") || aiResponse.includes("proceed")) {
        const schema = await generateSchemaFromMessage(userMessage.content);
        setGeneratedSchema(schema);

        const schemaMessage: Message = {
          id: generateId(),
          type: "ai",
          content: `✨ **Schema Generated!**\n\nI've created a schema with ${
            schema.properties.length
          } properties based on your requirements. The confidence level is ${Math.round(
            schema.confidence * 100
          )}%.\n\n**Reasoning:** ${
            schema.reasoning
          }\n\nWould you like to review and edit the schema, or proceed with it as-is?`,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, schemaMessage]);
      }
    } catch (error) {
      console.error("Error generating response:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [
    inputValue,
    isGenerating,
    generateId,
    simulateAIResponse,
    generateSchemaFromMessage,
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

  const handleAcceptSchema = useCallback(() => {
    if (generatedSchema) {
      onSchemaGenerated(generatedSchema);
      onNext();
    }
  }, [generatedSchema, onSchemaGenerated, onNext]);

  const handleEditSchema = useCallback(() => {
    setIsEditingSchema(true);
  }, []);

  const handleRegenerateSchema = useCallback(async () => {
    if (messages.length < 2) return;

    const lastUserMessage = messages.filter((m) => m.type === "user").pop();
    if (!lastUserMessage) return;

    setIsGenerating(true);
    try {
      const schema = await generateSchemaFromMessage(lastUserMessage.content);
      setGeneratedSchema(schema);

      const message: Message = {
        id: generateId(),
        type: "ai",
        content: `🔄 **Schema Regenerated!**\n\nI've created a new schema with ${
          schema.properties.length
        } properties. Confidence: ${Math.round(
          schema.confidence * 100
        )}%.\n\n**Reasoning:** ${schema.reasoning}`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, message]);
    } catch (error) {
      console.error("Error regenerating schema:", error);
    } finally {
      setIsGenerating(false);
    }
  }, [messages, generateId, generateSchemaFromMessage]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                AI Schema Generator
              </h1>
              <p className="text-slate-300 mt-2">
                Describe what you want to extract, and I'll create the perfect
                schema for you
              </p>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-sm text-slate-400 bg-slate-800/50 px-3 py-1 rounded-full">
                Step 1 of 2
              </div>
              {onBack && (
                <Button
                  onClick={onBack}
                  variant="secondary"
                  className="bg-slate-800/50 border-slate-700 text-slate-300 hover:bg-slate-700/50"
                >
                  ← Back
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Chat Interface */}
          <div className="lg:col-span-2">
            <Card className="h-[600px] bg-slate-800/50 border-slate-700 backdrop-blur-lg">
              <div className="h-full flex flex-col">
                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${
                        message.type === "user"
                          ? "justify-end"
                          : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                          message.type === "user"
                            ? "bg-gradient-to-r from-blue-500 to-purple-500 text-white"
                            : "bg-slate-700/50 text-slate-200 border border-slate-600"
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {message.type === "ai" && (
                            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                              <SparklesIcon className="w-4 h-4 text-white" />
                            </div>
                          )}
                          <div className="flex-1">
                            <div className="whitespace-pre-wrap text-sm leading-relaxed">
                              {message.content}
                            </div>
                            <div
                              className={`text-xs mt-2 ${
                                message.type === "user"
                                  ? "text-blue-100"
                                  : "text-slate-400"
                              }`}
                            >
                              {message.timestamp.toLocaleTimeString()}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}

                  {isGenerating && (
                    <div className="flex justify-start">
                      <div className="bg-slate-700/50 text-slate-200 border border-slate-600 rounded-2xl px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center">
                            <SparklesIcon className="w-4 h-4 text-white animate-pulse" />
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="flex space-x-1">
                              <div className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"></div>
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0.1s" }}
                              ></div>
                              <div
                                className="w-2 h-2 bg-blue-400 rounded-full animate-bounce"
                                style={{ animationDelay: "0.2s" }}
                              ></div>
                            </div>
                            <span className="text-sm text-slate-400">
                              AI is thinking...
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="p-6 border-t border-slate-700">
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <textarea
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={handleKeyPress}
                        placeholder="Describe what data you want to extract from your documents..."
                        className="w-full px-4 py-3 bg-slate-700/50 border border-slate-600 rounded-xl text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                        rows={3}
                        disabled={isGenerating}
                      />
                    </div>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!inputValue.trim() || isGenerating}
                      className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 disabled:opacity-50"
                    >
                      <ArrowRightIcon className="w-5 h-5" />
                    </Button>
                  </div>
                </div>
              </div>
            </Card>
          </div>

          {/* Schema Preview */}
          <div className="lg:col-span-1">
            <Card className="h-[600px] bg-slate-800/50 border-slate-700 backdrop-blur-lg">
              <div className="h-full flex flex-col">
                <div className="p-6 border-b border-slate-700">
                  <h3 className="text-lg font-semibold text-slate-200 flex items-center gap-2">
                    <ChatBubbleLeftRightIcon className="w-5 h-5 text-blue-400" />
                    Generated Schema
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                  {generatedSchema ? (
                    <div className="space-y-4">
                      {/* Schema Stats */}
                      <div className="bg-slate-700/30 rounded-lg p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-sm text-slate-300">
                            Confidence
                          </span>
                          <span className="text-sm font-medium text-green-400">
                            {Math.round(generatedSchema.confidence * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-600 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-green-400 to-green-500 h-2 rounded-full transition-all duration-500"
                            style={{
                              width: `${generatedSchema.confidence * 100}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      {/* Properties */}
                      <div className="space-y-3">
                        <h4 className="text-sm font-medium text-slate-300">
                          Properties ({generatedSchema.properties.length})
                        </h4>
                        {generatedSchema.properties.map((prop, index) => (
                          <div
                            key={index}
                            className="bg-slate-700/30 rounded-lg p-3"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-blue-400">
                                {prop.key}
                              </span>
                              <span className="text-xs text-slate-400 bg-slate-600 px-2 py-1 rounded">
                                {prop.type}
                              </span>
                            </div>
                            <p className="text-xs text-slate-300 mb-2">
                              {prop.description}
                            </p>
                            {prop.examples && prop.examples.length > 0 && (
                              <div className="text-xs text-slate-400">
                                Examples: {prop.examples.slice(0, 2).join(", ")}
                                {prop.examples.length > 2 &&
                                  ` +${prop.examples.length - 2} more`}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      {/* Actions */}
                      <div className="space-y-3 pt-4">
                        <Button
                          onClick={handleAcceptSchema}
                          className="w-full bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                        >
                          <CheckCircleIcon className="w-4 h-4 mr-2" />
                          Use This Schema
                        </Button>

                        <div className="flex gap-2">
                          <Button
                            onClick={handleEditSchema}
                            variant="secondary"
                            className="flex-1 bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50"
                          >
                            <PencilIcon className="w-4 h-4 mr-2" />
                            Edit
                          </Button>
                          <Button
                            onClick={handleRegenerateSchema}
                            variant="secondary"
                            className="flex-1 bg-slate-700/50 border-slate-600 text-slate-300 hover:bg-slate-600/50"
                            disabled={isGenerating}
                          >
                            <ArrowPathIcon className="w-4 h-4 mr-2" />
                            Regenerate
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center text-slate-400">
                        <ChatBubbleLeftRightIcon className="w-12 h-12 mx-auto mb-4 opacity-50" />
                        <p className="text-sm">
                          Start a conversation to generate your schema
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
