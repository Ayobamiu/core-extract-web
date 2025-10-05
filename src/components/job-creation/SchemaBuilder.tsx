"use client";

import React, { useState, useCallback } from "react";
import Button from "../ui/Button";
import Card from "../ui/Card";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  PlusIcon,
  TrashIcon,
  EllipsisVerticalIcon,
} from "@heroicons/react/24/outline";

export interface SchemaProperty {
  id: string;
  key: string;
  type: PropertyType;
  description: string;
  required: boolean;
  enumValues?: string[];
  properties?: SchemaProperty[]; // For nested objects/arrays
  arrayItemType?: PropertyType; // For array items
  parentId?: string; // For tree structure
  depth?: number; // For visualization
  path?: string; // Full path like "user.address.street"
}

export type PropertyType =
  | "text"
  | "number"
  | "boolean"
  | "date"
  | "enum"
  | "array"
  | "object";

interface SchemaBuilderProps {
  schema: SchemaProperty[];
  onSchemaChange: (schema: SchemaProperty[]) => void;
  onNext: () => void;
  onBack?: () => void;
  jobName?: string;
  schemaName?: string;
  onJobNameChange?: (jobName: string) => void;
  onSchemaNameChange?: (schemaName: string) => void;
}

const PROPERTY_TYPES: {
  value: PropertyType;
  label: string;
  description: string;
  examples: string;
}[] = [
  {
    value: "text",
    label: "Text",
    description: "String of characters",
    examples: "well_name, operator, location",
  },
  {
    value: "number",
    label: "Number",
    description: "Numeric value",
    examples: "depth, temperature, pressure",
  },
  {
    value: "boolean",
    label: "Boolean",
    description: "True or false value",
    examples: "is_active, has_permit, completed",
  },
  {
    value: "date",
    label: "Date",
    description: "Date and time value",
    examples: "drilled_date, completion_date",
  },
  {
    value: "enum",
    label: "Enum",
    description: "One of predefined values",
    examples: "status: active, inactive, pending",
  },
  {
    value: "array",
    label: "Array",
    description: "List of values",
    examples: "casing_sizes, equipment_list",
  },
  {
    value: "object",
    label: "Object",
    description: "Nested object with properties",
    examples: "well_details, contact_info",
  },
];

export function SchemaBuilder({
  schema,
  onSchemaChange,
  onNext,
  onBack,
  jobName = "",
  schemaName = "",
  onJobNameChange,
  onSchemaNameChange,
}: SchemaBuilderProps) {
  const [expandedProperties, setExpandedProperties] = useState<Set<string>>(
    new Set()
  );

  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9);
  }, []);

  const addProperty = useCallback(() => {
    const newProperty: SchemaProperty = {
      id: generateId(),
      key: "",
      type: "text",
      description: "",
      required: false,
    };
    onSchemaChange([...schema, newProperty]);
  }, [schema, onSchemaChange, generateId]);

  const updateProperty = useCallback(
    (id: string, updates: Partial<SchemaProperty>) => {
      const updatedSchema = schema.map((prop) =>
        prop.id === id ? { ...prop, ...updates } : prop
      );
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const removeProperty = useCallback(
    (id: string) => {
      const updatedSchema = schema.filter((prop) => prop.id !== id);
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const duplicateProperty = useCallback(
    (id: string) => {
      const property = schema.find((prop) => prop.id === id);
      if (property) {
        const duplicatedProperty: SchemaProperty = {
          ...property,
          id: generateId(),
          key: `${property.key}_copy`,
        };
        onSchemaChange([...schema, duplicatedProperty]);
      }
    },
    [schema, onSchemaChange, generateId]
  );

  const toggleExpanded = useCallback(
    (id: string) => {
      const newExpanded = new Set(expandedProperties);
      if (newExpanded.has(id)) {
        newExpanded.delete(id);
      } else {
        newExpanded.add(id);
      }
      setExpandedProperties(newExpanded);
    },
    [expandedProperties]
  );

  const addNestedProperty = useCallback(
    (parentId: string) => {
      const newProperty: SchemaProperty = {
        id: generateId(),
        key: "",
        type: "text",
        description: "",
        required: false,
      };

      const updatedSchema = schema.map((prop) => {
        if (prop.id === parentId) {
          return {
            ...prop,
            properties: [...(prop.properties || []), newProperty],
          };
        }
        return prop;
      });
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange, generateId]
  );

  const updateNestedProperty = useCallback(
    (parentId: string, childId: string, updates: Partial<SchemaProperty>) => {
      const updatedSchema = schema.map((prop) => {
        if (prop.id === parentId && prop.properties) {
          return {
            ...prop,
            properties: prop.properties.map((childProp) =>
              childProp.id === childId
                ? { ...childProp, ...updates }
                : childProp
            ),
          };
        }
        return prop;
      });
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const removeNestedProperty = useCallback(
    (parentId: string, childId: string) => {
      const updatedSchema = schema.map((prop) => {
        if (prop.id === parentId && prop.properties) {
          return {
            ...prop,
            properties: prop.properties.filter(
              (childProp) => childProp.id !== childId
            ),
          };
        }
        return prop;
      });
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const addEnumValue = useCallback(
    (propertyId: string, value: string) => {
      const updatedSchema = schema.map((prop) => {
        if (prop.id === propertyId) {
          const currentValues = prop.enumValues || [];
          if (!currentValues.includes(value)) {
            return {
              ...prop,
              enumValues: [...currentValues, value],
            };
          }
        }
        return prop;
      });
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const removeEnumValue = useCallback(
    (propertyId: string, value: string) => {
      const updatedSchema = schema.map((prop) => {
        if (prop.id === propertyId) {
          return {
            ...prop,
            enumValues: (prop.enumValues || []).filter((v) => v !== value),
          };
        }
        return prop;
      });
      onSchemaChange(updatedSchema);
    },
    [schema, onSchemaChange]
  );

  const renderPropertyRow = (
    property: SchemaProperty,
    isNested = false,
    parentId?: string
  ) => {
    const isExpanded = expandedProperties.has(property.id);
    const hasNestedConfig =
      property.type === "object" || property.type === "array";
    const hasEnumConfig = property.type === "enum";

    return (
      <div
        key={property.id}
        className={`${isNested ? "ml-6 border-l-2 border-gray-200 pl-4" : ""}`}
      >
        <div className="flex items-center gap-3 py-3 border-b border-gray-100">
          {/* Drag Handle */}
          <div className="cursor-move text-gray-400 hover:text-gray-600">
            <EllipsisVerticalIcon className="h-4 w-4" />
          </div>

          {/* Property Key */}
          <div className="flex-1">
            <input
              type="text"
              value={property.key}
              onChange={(e) => {
                if (parentId) {
                  updateNestedProperty(parentId, property.id, {
                    key: e.target.value,
                  });
                } else {
                  updateProperty(property.id, { key: e.target.value });
                }
              }}
              placeholder={
                PROPERTY_TYPES.find((t) => t.value === property.type)
                  ?.examples || "Property key (e.g., well_name)"
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type */}
          <div className="w-32">
            <select
              value={property.type}
              onChange={(e) => {
                const updates = { type: e.target.value as PropertyType };
                if (parentId) {
                  updateNestedProperty(parentId, property.id, updates);
                } else {
                  updateProperty(property.id, updates);
                }
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              title={
                PROPERTY_TYPES.find((t) => t.value === property.type)
                  ?.description
              }
            >
              {PROPERTY_TYPES.map((type) => (
                <option
                  key={type.value}
                  value={type.value}
                  title={`${type.description} - Examples: ${type.examples}`}
                >
                  {type.label}
                </option>
              ))}
            </select>
          </div>

          {/* Description */}
          <div className="flex-1">
            <input
              type="text"
              value={property.description}
              onChange={(e) => {
                if (parentId) {
                  updateNestedProperty(parentId, property.id, {
                    description: e.target.value,
                  });
                } else {
                  updateProperty(property.id, { description: e.target.value });
                }
              }}
              placeholder={`Describe what this ${property.type} represents`}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            {/* Expand/Collapse for nested configs */}
            {(hasNestedConfig || hasEnumConfig) && (
              <button
                onClick={() => toggleExpanded(property.id)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                {isExpanded ? (
                  <ChevronDownIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
            )}

            {/* Duplicate */}
            <button
              onClick={() => {
                if (parentId) {
                  // Handle nested duplication
                  const property = schema
                    .find((p) => p.id === parentId)
                    ?.properties?.find((p) => p.id === property.id);
                  if (property) {
                    const duplicated: SchemaProperty = {
                      ...property,
                      id: generateId(),
                      key: `${property.key}_copy`,
                    };
                    const updatedSchema = schema.map((p) => {
                      if (p.id === parentId && p.properties) {
                        return {
                          ...p,
                          properties: [...p.properties, duplicated],
                        };
                      }
                      return p;
                    });
                    onSchemaChange(updatedSchema);
                  }
                } else {
                  duplicateProperty(property.id);
                }
              }}
              className="p-1 text-gray-400 hover:text-blue-600"
              title="Duplicate property"
            >
              <PlusIcon className="h-4 w-4" />
            </button>

            {/* Delete */}
            <button
              onClick={() => {
                if (parentId) {
                  removeNestedProperty(parentId, property.id);
                } else {
                  removeProperty(property.id);
                }
              }}
              className="p-1 text-gray-400 hover:text-red-600"
              title="Delete property"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Nested Configuration */}
        {isExpanded && hasNestedConfig && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">
                Configure {property.type === "array" ? "Array Items" : "Object"}{" "}
                Schema for {property.key}
              </h4>
              <Button
                onClick={() => addNestedProperty(property.id)}
                variant="secondary"
                size="sm"
                className="flex items-center gap-2"
              >
                <PlusIcon className="h-4 w-4" />
                Add property
              </Button>
            </div>

            {property.properties && property.properties.length > 0 && (
              <div className="space-y-2">
                {property.properties.map((childProp) =>
                  renderPropertyRow(childProp, true, property.id)
                )}
              </div>
            )}
          </div>
        )}

        {/* Enum Configuration */}
        {isExpanded && hasEnumConfig && (
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-gray-900">
                Configure Enum Values for {property.key}
              </h4>
            </div>

            <div className="space-y-2">
              {property.enumValues?.map((value, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={value}
                    onChange={(e) => {
                      const newValues = [...(property.enumValues || [])];
                      newValues[index] = e.target.value;
                      updateProperty(property.id, { enumValues: newValues });
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button
                    onClick={() => removeEnumValue(property.id, value)}
                    className="p-1 text-gray-400 hover:text-red-600"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => addEnumValue(property.id, "")}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-700"
              >
                <PlusIcon className="h-4 w-4" />
                Add value
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create New Job</h1>
            <p className="text-gray-600 mt-2">
              Define the structure of data you want to extract
            </p>
          </div>
          <div className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
            Step 1 of 2
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
            Build your schema by adding properties and configuring their keys,
            types, names, and descriptions.
          </p>

          {/* Help Section */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
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
                <ul className="space-y-1 text-blue-700">
                  <li>
                    • Use clear, descriptive property names (e.g., "well_depth"
                    not "depth1")
                  </li>
                  <li>
                    • Provide detailed descriptions to help the AI understand
                    context
                  </li>
                  <li>• Use enums for status fields with predefined values</li>
                  <li>
                    • Use objects for related data that should be grouped
                    together
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 py-3 border-b-2 border-gray-200 font-medium text-gray-700">
          <div className="col-span-1"></div>
          <div className="col-span-3 flex items-center gap-2">
            Property Key
            <div className="group relative">
              <span className="text-gray-400 cursor-help">?</span>
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
              <span className="text-gray-400 cursor-help">?</span>
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
              <span className="text-gray-400 cursor-help">?</span>
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-sm rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-10">
                A clear description of what this property represents. This helps
                the AI understand what to extract.
                <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-transparent border-t-gray-900"></div>
              </div>
            </div>
          </div>
          <div className="col-span-2">Actions</div>
        </div>

        {/* Properties */}
        <div className="space-y-0">
          {schema.map((property) => renderPropertyRow(property))}
        </div>

        {/* Add Property Button */}
        <div className="mt-6">
          <Button
            onClick={addProperty}
            variant="secondary"
            className="flex items-center gap-2"
          >
            <PlusIcon className="h-5 w-5" />
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
  );
}
