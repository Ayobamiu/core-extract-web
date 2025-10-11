"use client";

import React, { useState, useMemo } from "react";
import { motion } from "framer-motion";
import JsonView from "@uiw/react-json-view";
import { jsonToCsv } from "@/lib/csvExport";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  createColumnHelper,
  flexRender,
  SortingState,
  ColumnFiltersState,
} from "@tanstack/react-table";

interface TabbedDataViewerProps {
  data: unknown;
  filename: string;
  schema?: unknown;
  className?: string;
  onUpdate?: (updatedData: unknown) => void;
  editable?: boolean;
}

type TabType = "preview" | "json" | "csv" | "edit";

const TabbedDataViewer: React.FC<TabbedDataViewerProps> = ({
  data,
  filename,
  schema,
  className = "",
  onUpdate,
  editable = false,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("preview");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [editableJson, setEditableJson] = useState<string>("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Initialize editable JSON when data changes
  React.useEffect(() => {
    if (data) {
      setEditableJson(JSON.stringify(data, null, 2));
      setJsonError(null);
    }
  }, [data]);

  // Handle JSON editing
  const handleJsonChange = (value: string) => {
    setEditableJson(value);
    setJsonError(null);

    // Validate JSON in real-time
    try {
      JSON.parse(value);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Invalid JSON");
    }
  };

  // Save changes
  const handleSave = async (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!onUpdate) return;

    try {
      setIsSaving(true);
      const parsedData = JSON.parse(editableJson);
      await onUpdate(parsedData);
      setJsonError(null);
    } catch (error) {
      setJsonError(error instanceof Error ? error.message : "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  // Convert data to CSV format
  const csvData = useMemo(() => {
    try {
      const csvString = jsonToCsv(data, {
        includeHeaders: true,
        flattenNested: true,
      });
      return csvString;
    } catch (error) {
      console.error("Error converting to CSV:", error);
      return "";
    }
  }, [data]);

  // Parse CSV line handling quoted values
  const parseCsvLine = (line: string): string[] => {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          // Escaped quote
          current += '"';
          i++; // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes;
        }
      } else if (char === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }

    result.push(current.trim());
    return result;
  };

  // Parse CSV data for table display
  const tableData = useMemo(() => {
    if (!csvData) return [];

    const lines = csvData.split("\n").filter((line) => line.trim());
    if (lines.length === 0) return [];

    const headers = lines[0]
      .split(",")
      .map((header) => header.replace(/^"|"$/g, "").trim());

    const rows = lines.slice(1).map((line) => {
      const values = parseCsvLine(line);
      const row: Record<string, string> = {};
      headers.forEach((header, index) => {
        row[header] = values[index] || "";
      });
      return row;
    });

    return rows;
  }, [csvData]);

  // Create table columns dynamically
  const columns = useMemo(() => {
    if (tableData.length === 0) return [];

    const columnHelper = createColumnHelper<Record<string, string>>();
    const headers = Object.keys(tableData[0] || {});

    return headers.map((header) =>
      columnHelper.accessor(header, {
        header: header,
        cell: ({ getValue }) => {
          const value = getValue();
          const stringValue = String(value);
          return (
            <div
              className="max-w-xs truncate"
              title={stringValue.length > 50 ? stringValue : undefined}
            >
              {stringValue}
            </div>
          );
        },
      })
    );
  }, [tableData]);

  // Initialize table
  const table = useReactTable({
    data: tableData,
    columns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  // Export handlers
  const handleJsonExport = () => {
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}_results.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCsvExport = () => {
    const blob = new Blob([csvData], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${filename.replace(/\.[^/.]+$/, "")}_results.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Render preview data in a collapsible tree format
  const renderPreviewData = (data: unknown): React.ReactNode => {
    if (!data || typeof data !== "object") {
      return (
        <div className="text-center py-8 text-gray-500">
          <p>No data available for preview</p>
        </div>
      );
    }

    return (
      <div className="font-mono text-sm">
        {Object.entries(data as Record<string, unknown>).map(([key, value]) => (
          <div key={key}>{renderTreeItem(key, value, "")}</div>
        ))}
      </div>
    );
  };

  // Toggle expansion state for a key
  const toggleExpanded = (key: string) => {
    setExpandedKeys((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        newSet.add(key);
      }
      return newSet;
    });
  };

  // Render a single tree item
  const renderTreeItem = (
    key: string,
    value: unknown,
    path: string
  ): React.ReactNode => {
    const fullPath = path ? `${path}.${key}` : key;
    const isExpanded = expandedKeys.has(fullPath);

    if (value === null) {
      return (
        <div className="flex items-center py-1">
          <span className="text-gray-600 font-medium">{key}:</span>
          <span className="ml-2 text-gray-400">null</span>
        </div>
      );
    }

    if (value === undefined) {
      return (
        <div className="flex items-center py-1">
          <span className="text-gray-600 font-medium">{key}:</span>
          <span className="ml-2 text-gray-400">undefined</span>
        </div>
      );
    }

    if (typeof value === "string") {
      return (
        <div className="flex items-center py-1">
          <span className="text-gray-600 font-medium">{key}:</span>
          <span className="ml-2 text-gray-800">&quot;{value}&quot;</span>
        </div>
      );
    }

    if (typeof value === "number") {
      return (
        <div className="flex items-center py-1">
          <span className="text-gray-600 font-medium">{key}:</span>
          <span className="ml-2 text-blue-600">{value}</span>
        </div>
      );
    }

    if (typeof value === "boolean") {
      return (
        <div className="flex items-center py-1">
          <span className="text-gray-600 font-medium">{key}:</span>
          <span className={`ml-2 ${value ? "text-green-600" : "text-red-600"}`}>
            {value ? "true" : "false"}
          </span>
        </div>
      );
    }

    if (Array.isArray(value)) {
      const isEmpty = value.length === 0;
      const canExpand = !isEmpty;

      return (
        <div>
          <div
            className="flex items-center py-1 cursor-pointer hover:bg-gray-50 rounded"
            onClick={() => canExpand && toggleExpanded(fullPath)}
          >
            {canExpand && (
              <svg
                className={`w-3 h-3 mr-1 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {!canExpand && <div className="w-3 h-3 mr-1" />}
            <span className="text-gray-600 font-medium">{key}:</span>
            <span className="ml-2 text-gray-500">
              [{isEmpty ? "" : value.length}]
            </span>
          </div>

          {isExpanded && (
            <div className="ml-4 border-l border-gray-200 pl-2">
              {value.map((item, index) => (
                <div key={index}>
                  {renderTreeItem(index.toString(), item, fullPath)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (typeof value === "object") {
      const obj = value as Record<string, unknown>;
      const entries = Object.entries(obj);
      const isEmpty = entries.length === 0;
      const canExpand = !isEmpty;

      return (
        <div>
          <div
            className="flex items-center py-1 cursor-pointer hover:bg-gray-50 rounded"
            onClick={() => canExpand && toggleExpanded(fullPath)}
          >
            {canExpand && (
              <svg
                className={`w-3 h-3 mr-1 transition-transform ${
                  isExpanded ? "rotate-90" : ""
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
            {!canExpand && <div className="w-3 h-3 mr-1" />}
            <span className="text-gray-600 font-medium">{key}:</span>
            <span className="ml-2 text-gray-500">
              {isEmpty ? "{}" : `{${entries.length}}`}
            </span>
          </div>

          {isExpanded && (
            <div className="ml-4 border-l border-gray-200 pl-2">
              {entries.map(([nestedKey, nestedValue]) => (
                <div key={nestedKey}>
                  {renderTreeItem(nestedKey, nestedValue, fullPath)}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="flex items-center py-1">
        <span className="text-gray-600 font-medium">{key}:</span>
        <span className="ml-2 text-gray-800">{String(value)}</span>
      </div>
    );
  };

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Tab Headers */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex space-x-1">
          <button
            onClick={() => setActiveTab("preview")}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              activeTab === "preview"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            Preview
          </button>
          <button
            onClick={() => setActiveTab("json")}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              activeTab === "json"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            JSON
          </button>
          <button
            onClick={() => setActiveTab("csv")}
            className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
              activeTab === "csv"
                ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            CSV
          </button>
          {editable && (
            <button
              onClick={() => setActiveTab("edit")}
              className={`px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                activeTab === "edit"
                  ? "text-blue-600 border-b-2 border-blue-600 bg-blue-50"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              Edit
            </button>
          )}
        </div>

        {/* Export Buttons */}
        <div className="flex space-x-2 pr-4">
          <button
            onClick={handleJsonExport}
            className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors duration-200"
          >
            Export JSON
          </button>
          <button
            onClick={handleCsvExport}
            className="px-3 py-1 text-xs bg-green-100 hover:bg-green-200 text-green-700 rounded transition-colors duration-200"
          >
            Export CSV
          </button>
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-4">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "preview" && (
            <div className="overflow-auto max-h-96">
              <div className="space-y-4">{renderPreviewData(data)}</div>
            </div>
          )}

          {activeTab === "json" && (
            <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
              <JsonView
                value={data as object}
                style={{
                  backgroundColor: "transparent",
                  fontSize: "14px",
                  fontFamily:
                    'ui-monospace, SFMono-Regular, "SF Mono", Consolas, "Liberation Mono", Menlo, monospace',
                }}
                displayDataTypes={false}
                displayObjectSize={false}
                enableClipboard={true}
                collapsed={false}
              />
            </div>
          )}

          {activeTab === "csv" && (
            <div className="overflow-auto max-h-96">
              {tableData.length > 0 ? (
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        {table.getHeaderGroups().map((headerGroup) => (
                          <tr key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                              <th
                                key={header.id}
                                className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 whitespace-nowrap"
                                onClick={header.column.getToggleSortingHandler()}
                              >
                                <div className="flex items-center space-x-1">
                                  <span>
                                    {header.isPlaceholder
                                      ? null
                                      : flexRender(
                                          header.column.columnDef.header,
                                          header.getContext()
                                        )}
                                  </span>
                                  {header.column.getIsSorted() === "asc" && (
                                    <svg
                                      className="w-3 h-3"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                  {header.column.getIsSorted() === "desc" && (
                                    <svg
                                      className="w-3 h-3"
                                      fill="currentColor"
                                      viewBox="0 0 20 20"
                                    >
                                      <path
                                        fillRule="evenodd"
                                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                                        clipRule="evenodd"
                                      />
                                    </svg>
                                  )}
                                </div>
                              </th>
                            ))}
                          </tr>
                        ))}
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {table.getRowModel().rows.map((row) => (
                          <tr key={row.id} className="hover:bg-gray-50">
                            {row.getVisibleCells().map((cell) => (
                              <td
                                key={cell.id}
                                className="px-4 py-3 text-sm text-gray-900 whitespace-nowrap"
                              >
                                {flexRender(
                                  cell.column.columnDef.cell,
                                  cell.getContext()
                                )}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  <p>No data available for CSV view</p>
                </div>
              )}
            </div>
          )}

          {activeTab === "edit" && editable && (
            <div className="space-y-4">
              {/* Error Display */}
              {jsonError && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center">
                    <svg
                      className="w-4 h-4 text-red-500 mr-2"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <span className="text-red-700 text-sm font-medium">
                      JSON Error:
                    </span>
                  </div>
                  <p className="text-red-600 text-sm mt-1">{jsonError}</p>
                </div>
              )}

              {/* JSON Editor */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <textarea
                  value={editableJson}
                  onChange={(e) => handleJsonChange(e.target.value)}
                  className="w-full h-96 p-4 font-mono text-sm bg-gray-50 border-0 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  placeholder="Edit JSON data..."
                  spellCheck={false}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-between">
                <div className="text-sm text-gray-500">
                  Edit the JSON data above. Changes will be saved when you click
                  "Update".
                </div>
                <div
                  className="flex space-x-2"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setEditableJson(JSON.stringify(data, null, 2));
                      return false;
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="px-4 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded transition-colors duration-200"
                    disabled={isSaving}
                  >
                    Reset
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSave();
                      return false;
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    disabled={!!jsonError || isSaving || !onUpdate}
                    className="px-4 py-2 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors duration-200"
                  >
                    {isSaving ? "Saving..." : "Update"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default TabbedDataViewer;
