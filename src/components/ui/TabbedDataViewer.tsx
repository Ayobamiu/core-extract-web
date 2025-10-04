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
}

type TabType = "json" | "csv";

const TabbedDataViewer: React.FC<TabbedDataViewerProps> = ({
  data,
  filename,
  schema,
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<TabType>("json");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

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

  return (
    <div className={`bg-white rounded-lg border border-gray-200 ${className}`}>
      {/* Tab Headers */}
      <div className="flex items-center justify-between border-b border-gray-200">
        <div className="flex space-x-1">
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
          {activeTab === "json" && (
            <div className="bg-gray-50 rounded-lg p-4 overflow-auto max-h-96">
              <JsonView
                value={data}
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
        </motion.div>
      </div>
    </div>
  );
};

export default TabbedDataViewer;
