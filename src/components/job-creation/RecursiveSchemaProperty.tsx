"use client";

import React, { useState, useCallback } from "react";
import { SchemaProperty, PropertyType } from "./SchemaBuilder";
import { ChevronRightIcon, ChevronDownIcon } from "@heroicons/react/24/outline";

interface RecursiveSchemaPropertyProps {
  property: SchemaProperty;
  depth: number;
  onUpdate: (updatedProperty: SchemaProperty) => void;
  onDelete: (propertyId: string) => void;
  onAddChild: (parentId: string, childProperty: SchemaProperty) => void;
  allProperties: SchemaProperty[];
}

export function RecursiveSchemaProperty({
  property,
  depth,
  onUpdate,
  onDelete,
  onAddChild,
  allProperties,
}: RecursiveSchemaPropertyProps) {
  const [isExpanded, setIsExpanded] = useState(true);
  const [showArrayItemConfig, setShowArrayItemConfig] = useState(false);

  const generateId = useCallback(() => {
    return Math.random().toString(36).substr(2, 9);
  }, []);

  const updateProperty = useCallback(
    (updates: Partial<SchemaProperty>) => {
      onUpdate({ ...property, ...updates });
    },
    [property, onUpdate]
  );

  const addEnumValue = useCallback(() => {
    const updatedEnumValues = [...(property.enumValues || []), ""];
    updateProperty({ enumValues: updatedEnumValues });
  }, [property.enumValues, updateProperty]);

  const updateEnumValue = useCallback(
    (index: number, value: string) => {
      const updatedEnumValues = [...(property.enumValues || [])];
      updatedEnumValues[index] = value;
      updateProperty({ enumValues: updatedEnumValues });
    },
    [property.enumValues, updateProperty]
  );

  const removeEnumValue = useCallback(
    (index: number) => {
      const updatedEnumValues = (property.enumValues || []).filter(
        (_, i) => i !== index
      );
      updateProperty({ enumValues: updatedEnumValues });
    },
    [property.enumValues, updateProperty]
  );

  const addObjectProperty = useCallback(() => {
    const newProperty: SchemaProperty = {
      id: generateId(),
      key: "",
      type: "text",
      description: "",
      required: false,
      parentId: property.id,
      depth: depth + 1,
      path: `${property.path || property.key}.new_property`,
    };
    onAddChild(property.id, newProperty);
  }, [property.id, property.path, property.key, depth, generateId, onAddChild]);

  const addArrayItemProperty = useCallback(() => {
    const newProperty: SchemaProperty = {
      id: generateId(),
      key: "item",
      type: "text",
      description: "Array item property",
      required: false,
      parentId: property.id,
      depth: depth + 1,
      path: `${property.path || property.key}.item`,
    };
    onAddChild(property.id, newProperty);
    setShowArrayItemConfig(true);
  }, [property.id, property.path, property.key, depth, generateId, onAddChild]);

  const getChildProperties = useCallback(() => {
    return allProperties.filter((prop) => prop.parentId === property.id);
  }, [allProperties, property.id]);

  const hasChildren = getChildProperties().length > 0;
  const canHaveChildren =
    property.type === "object" || property.type === "array";

  return (
    <div className="space-y-2">
      {/* Main Property Row */}
      <div
        className={`flex items-center gap-3 py-3 border-b border-gray-100 ${
          depth > 0 ? "bg-gray-50" : "bg-white"
        }`}
        style={{
          paddingLeft: `${depth * 32}px`,
          borderLeft:
            depth > 0
              ? `4px solid ${depth % 2 === 1 ? "#3B82F6" : "#10B981"}`
              : "none",
          marginLeft: depth > 0 ? "8px" : "0px",
        }}
      >
        {/* Hierarchy Indicator */}
        {depth > 0 && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <span className="font-mono">
              {Array.from({ length: depth }, (_, i) => "└").join("")}
            </span>
            <span className="bg-gray-200 px-1 py-0.5 rounded text-gray-600">
              L{depth}
            </span>
          </div>
        )}

        {/* Expand/Collapse Button */}
        {canHaveChildren && (
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="p-1 text-gray-400 hover:text-gray-600 transition-colors duration-200"
            title={isExpanded ? "Collapse" : "Expand"}
          >
            {isExpanded ? (
              <ChevronDownIcon className="h-4 w-4" />
            ) : (
              <ChevronRightIcon className="h-4 w-4" />
            )}
          </button>
        )}

        {/* Drag Handle */}
        <div className="cursor-move text-gray-400 hover:text-gray-600">
          <svg
            className="h-4 w-4"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 10h16M4 14h16M4 18h16"
            />
          </svg>
        </div>

        {/* Property Key */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {/* Type Icon */}
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white ${
                property.type === "text"
                  ? "bg-blue-500"
                  : property.type === "number"
                  ? "bg-green-500"
                  : property.type === "boolean"
                  ? "bg-purple-500"
                  : property.type === "date"
                  ? "bg-orange-500"
                  : property.type === "enum"
                  ? "bg-pink-500"
                  : property.type === "array"
                  ? "bg-indigo-500"
                  : property.type === "object"
                  ? "bg-gray-600"
                  : "bg-gray-400"
              }`}
            >
              {property.type === "text"
                ? "T"
                : property.type === "number"
                ? "N"
                : property.type === "boolean"
                ? "B"
                : property.type === "date"
                ? "D"
                : property.type === "enum"
                ? "E"
                : property.type === "array"
                ? "A"
                : property.type === "object"
                ? "O"
                : "?"}
            </div>
            <input
              type="text"
              value={property.key}
              onChange={(e) => updateProperty({ key: e.target.value })}
              placeholder="Property key (e.g., well_name)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600"
            />
          </div>
        </div>

        {/* Type Selector */}
        <div className="w-32">
          <select
            value={property.type}
            onChange={(e) => {
              const newType = e.target.value as PropertyType;
              updateProperty({
                type: newType,
                // Clear type-specific data when changing types
                enumValues:
                  newType === "enum" ? property.enumValues : undefined,
                arrayItemType:
                  newType === "array" ? property.arrayItemType : undefined,
                properties:
                  newType === "object" ? property.properties : undefined,
              });
            }}
            className="w-full h-10 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="date">Date</option>
            <option value="enum">Enum</option>
            <option value="array">Array</option>
            <option value="object">Object</option>
          </select>
        </div>

        {/* Description */}
        <div className="flex-1">
          <input
            type="text"
            value={property.description}
            onChange={(e) => updateProperty({ description: e.target.value })}
            placeholder="Describe what this property represents"
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Add Child Button */}
          {canHaveChildren && (
            <button
              onClick={() => {
                if (property.type === "object") {
                  addObjectProperty();
                } else if (property.type === "array") {
                  addArrayItemProperty();
                }
              }}
              className="p-1 text-gray-400 hover:text-blue-600"
              title={`Add ${property.type === "object" ? "property" : "item"}`}
            >
              <svg
                className="h-4 w-4"
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
            </button>
          )}

          {/* Delete Button */}
          <button
            onClick={() => onDelete(property.id)}
            className="p-1 text-gray-400 hover:text-red-600"
            title="Delete property"
          >
            <svg
              className="h-4 w-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        </div>
      </div>

      {/* Type Configuration */}
      {isExpanded && (
        <div
          className={`ml-4 p-3 rounded-lg ${
            depth > 0
              ? "bg-blue-50 border border-blue-200"
              : "bg-gray-50 border border-gray-200"
          }`}
          style={{
            marginLeft: `${(depth + 1) * 32}px`,
            borderLeft: `3px solid ${depth % 2 === 1 ? "#3B82F6" : "#10B981"}`,
          }}
        >
          {/* Enum Configuration */}
          {property.type === "enum" && (
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-3">
                Configure Enum Values
              </div>
              <div className="space-y-2">
                {(property.enumValues || []).map((value, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={value}
                      onChange={(e) => updateEnumValue(index, e.target.value)}
                      placeholder={`Value ${index + 1}`}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                    />
                    <button
                      onClick={() => removeEnumValue(index)}
                      className="p-1 text-gray-400 hover:text-red-600"
                      title="Remove value"
                    >
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M6 18L18 6M6 6l12 12"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
                <button
                  onClick={addEnumValue}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800"
                >
                  <svg
                    className="h-4 w-4"
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
                  Add Enum Value
                </button>
              </div>
            </div>
          )}

          {/* Array Configuration */}
          {property.type === "array" && (
            <div className="mt-3 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-3">
                Configure Array Item Type
              </div>
              <div className="space-y-2">
                <select
                  value={property.arrayItemType || "text"}
                  onChange={(e) => {
                    const newItemType = e.target.value as PropertyType;
                    updateProperty({ arrayItemType: newItemType });
                    if (newItemType === "object") {
                      addArrayItemProperty();
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white text-gray-900 dark:bg-gray-800 dark:text-white dark:border-gray-600"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="boolean">Boolean</option>
                  <option value="date">Date</option>
                  <option value="object">Object</option>
                </select>
                {property.arrayItemType === "object" && (
                  <div className="text-xs text-gray-600 mt-2">
                    Object properties will be defined below
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Child Properties */}
      {isExpanded && hasChildren && (
        <div className="space-y-1 relative">
          {/* Connection Line */}
          <div
            className="absolute left-0 top-0 bottom-0 w-px bg-gray-300"
            style={{
              left: `${depth * 32 + 16}px`,
              height: "100%",
            }}
          />
          {getChildProperties().map((childProperty) => (
            <RecursiveSchemaProperty
              key={childProperty.id}
              property={childProperty}
              depth={depth + 1}
              onUpdate={onUpdate}
              onDelete={onDelete}
              onAddChild={onAddChild}
              allProperties={allProperties}
            />
          ))}
        </div>
      )}
    </div>
  );
}
