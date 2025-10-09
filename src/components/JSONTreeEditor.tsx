"use client";

import React, { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronRightIcon,
  ChevronDownIcon,
  PlusIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

interface JSONTreeEditorProps {
  data: any;
  onChange: (newData: any) => void;
  onError?: (error: string | null) => void;
  readOnly?: boolean;
}

interface TreeNodeProps {
  keyPath: (string | number)[];
  nodeKey: string | number;
  value: any;
  data: any;
  onChange: (newData: any) => void;
  onError?: (error: string | null) => void;
  readOnly?: boolean;
}

const TreeNode: React.FC<TreeNodeProps> = ({
  keyPath,
  nodeKey,
  value,
  data,
  onChange,
  onError,
  readOnly = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const [editKey, setEditKey] = useState("");

  const isObject =
    typeof value === "object" && value !== null && !Array.isArray(value);
  const isArray = Array.isArray(value);
  const isPrimitive = !isObject && !isArray;

  const handleExpandToggle = () => {
    setIsExpanded(!isExpanded);
  };

  const handleValueChange = useCallback(
    (newValue: any) => {
      const newData = { ...data };
      let current = newData;

      // Navigate to the parent of the target key
      for (let i = 0; i < keyPath.length - 1; i++) {
        current = current[keyPath[i]];
      }

      // Update the value
      current[keyPath[keyPath.length - 1]] = newValue;
      onChange(newData);
    },
    [data, onChange, keyPath]
  );

  const handleKeyChange = useCallback(
    (oldKey: string | number, newKey: string | number) => {
      const newData = { ...data };
      let current = newData;

      // Navigate to the parent
      for (let i = 0; i < keyPath.length - 1; i++) {
        current = current[keyPath[i]];
      }

      // Remove old key and add new key
      const value = current[oldKey];
      delete current[oldKey];
      current[newKey] = value;

      onChange(newData);
    },
    [data, onChange, keyPath]
  );

  const handleAddItem = useCallback(() => {
    const newData = { ...data };
    let current = newData;

    // Navigate to the target
    for (let i = 0; i < keyPath.length; i++) {
      current = current[keyPath[i]];
    }

    if (isArray) {
      current.push("");
    } else if (isObject) {
      current["newKey"] = "";
    }

    onChange(newData);
  }, [data, onChange, keyPath, isArray, isObject]);

  const handleRemoveItem = useCallback(() => {
    const newData = { ...data };
    let current = newData;

    // Navigate to the parent
    for (let i = 0; i < keyPath.length - 1; i++) {
      current = current[keyPath[i]];
    }

    // Remove the item
    if (isArray) {
      current.splice(nodeKey as number, 1);
    } else {
      delete current[nodeKey];
    }

    onChange(newData);
  }, [data, onChange, keyPath, nodeKey, isArray]);

  const startEditKey = () => {
    setEditKey(String(nodeKey));
    setIsEditing(true);
  };

  const startEditValue = () => {
    if (isPrimitive) {
      setEditValue(String(value));
      setIsEditing(true);
    }
  };

  const saveEdit = () => {
    if (editKey !== String(nodeKey)) {
      handleKeyChange(nodeKey, editKey);
    }
    if (editValue !== String(value)) {
      let newValue: any = editValue;

      // Try to parse as JSON if it looks like JSON
      if (editValue === "true") newValue = true;
      else if (editValue === "false") newValue = false;
      else if (editValue === "null") newValue = null;
      else if (!isNaN(Number(editValue)) && editValue !== "")
        newValue = Number(editValue);
      else if (editValue.startsWith('"') && editValue.endsWith('"')) {
        try {
          newValue = JSON.parse(editValue);
        } catch {
          newValue = editValue.slice(1, -1); // Remove quotes
        }
      }

      handleValueChange(newValue);
    }
    setIsEditing(false);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditValue("");
    setEditKey("");
  };

  const getValueDisplay = () => {
    if (isObject) {
      const keys = Object.keys(value);
      return `{${keys.length} ${
        keys.length === 1 ? "property" : "properties"
      }}`;
    } else if (isArray) {
      return `[${value.length} ${value.length === 1 ? "item" : "items"}]`;
    } else if (typeof value === "string") {
      return `"${value}"`;
    } else if (value === null) {
      return "null";
    } else {
      return String(value);
    }
  };

  const getValueType = () => {
    if (isObject) return "object";
    if (isArray) return "array";
    if (typeof value === "string") return "string";
    if (typeof value === "number") return "number";
    if (typeof value === "boolean") return "boolean";
    if (value === null) return "null";
    return "unknown";
  };

  return (
    <div className="select-none">
      <div className="flex items-center group hover:bg-gray-50 rounded px-1 py-0.5">
        {/* Expand/Collapse Button */}
        {(isObject || isArray) && (
          <button
            onClick={handleExpandToggle}
            className="p-0.5 hover:bg-gray-200 rounded mr-1"
          >
            {isExpanded ? (
              <ChevronDownIcon className="w-3 h-3 text-gray-600" />
            ) : (
              <ChevronRightIcon className="w-3 h-3 text-gray-600" />
            )}
          </button>
        )}

        {/* Key */}
        <div className="flex items-center mr-2">
          {isEditing ? (
            <input
              type="text"
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="px-1 py-0.5 text-xs border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
              autoFocus
            />
          ) : (
            <span
              className="text-blue-600 font-medium cursor-pointer hover:bg-blue-50 px-1 py-0.5 rounded text-xs"
              onClick={startEditKey}
              title="Click to edit key"
            >
              {typeof nodeKey === "number" ? `[${nodeKey}]` : `"${nodeKey}"`}
            </span>
          )}
        </div>

        {/* Separator */}
        <span className="text-gray-400 mr-2">:</span>

        {/* Value */}
        <div className="flex items-center flex-1">
          {isEditing ? (
            <input
              type="text"
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              onBlur={saveEdit}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="px-1 py-0.5 text-xs border border-green-300 rounded focus:outline-none focus:ring-1 focus:ring-green-500 flex-1"
              autoFocus
            />
          ) : (
            <span
              className={`text-xs cursor-pointer hover:bg-gray-100 px-1 py-0.5 rounded ${
                getValueType() === "string"
                  ? "text-green-600"
                  : getValueType() === "number"
                  ? "text-purple-600"
                  : getValueType() === "boolean"
                  ? "text-orange-600"
                  : getValueType() === "null"
                  ? "text-gray-500"
                  : "text-gray-700"
              }`}
              onClick={startEditValue}
              title="Click to edit value"
            >
              {getValueDisplay()}
            </span>
          )}
        </div>

        {/* Actions */}
        {!readOnly && (
          <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              onClick={handleAddItem}
              className="p-0.5 hover:bg-green-100 rounded text-green-600"
              title="Add item"
            >
              <PlusIcon className="w-3 h-3" />
            </button>
            <button
              onClick={handleRemoveItem}
              className="p-0.5 hover:bg-red-100 rounded text-red-600"
              title="Remove item"
            >
              <TrashIcon className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Children */}
      <AnimatePresence>
        {isExpanded && (isObject || isArray) && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="ml-4 border-l border-gray-200 pl-2"
          >
            {isObject
              ? Object.entries(value).map(([key, val]) => (
                  <TreeNode
                    key={key}
                    keyPath={[...keyPath, key]}
                    nodeKey={key}
                    value={val}
                    data={data}
                    onChange={onChange}
                    onError={onError}
                    readOnly={readOnly}
                  />
                ))
              : value.map((val: any, index: number) => (
                  <TreeNode
                    key={index}
                    keyPath={[...keyPath, index]}
                    nodeKey={index}
                    value={val}
                    data={data}
                    onChange={onChange}
                    onError={onError}
                    readOnly={readOnly}
                  />
                ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const JSONTreeEditor: React.FC<JSONTreeEditorProps> = ({
  data,
  onChange,
  onError,
  readOnly = false,
}) => {
  const handleChange = useCallback(
    (newData: any) => {
      try {
        onChange(newData);
        onError?.(null);
      } catch (err) {
        onError?.(err instanceof Error ? err.message : "Invalid JSON");
      }
    },
    [onChange, onError]
  );

  return (
    <div className="w-full h-full overflow-auto p-4 bg-white border border-gray-300 rounded-lg">
      <div className="font-mono text-xs">
        <TreeNode
          keyPath={[]}
          nodeKey="root"
          value={data}
          data={data}
          onChange={handleChange}
          onError={onError}
          readOnly={readOnly}
        />
      </div>
    </div>
  );
};

export default JSONTreeEditor;
