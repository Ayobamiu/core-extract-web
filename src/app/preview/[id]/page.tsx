"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient, PreviewDataTable, PreviewJobFile } from "@/lib/api";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import {
  ChevronLeftIcon,
  ArrowDownTrayIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";

interface PreviewData {
  preview: PreviewDataTable;
  jobFiles: PreviewJobFile[];
}

interface TableColumn {
  key: string;
  label: string;
  type: string;
}

interface ArrayPopupData {
  columnKey: string;
  items: any[];
  title: string;
}

// Component for displaying complex data (arrays and objects)
const ComplexDataCell: React.FC<{
  value: any;
  columnKey: string;
  onArrayClick: (data: ArrayPopupData) => void;
}> = ({ value, columnKey, onArrayClick }) => {
  if (value === null || value === undefined) {
    return <span className="text-gray-400">-</span>;
  }

  // Handle arrays
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400">[]</span>;
    }

    // Check if it's an array of objects
    const isArrayOfObjects = value.every(
      (item) => typeof item === "object" && item !== null
    );

    if (isArrayOfObjects) {
      // For arrays of objects, just show the count
      return (
        <button
          onClick={() =>
            onArrayClick({
              columnKey,
              items: value,
              title: `${columnKey} (${value.length} items)`,
            })
          }
          className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
        >
          {value.length} items
        </button>
      );
    }

    // For arrays of primitives
    if (value.length === 1) {
      return <span>{String(value[0])}</span>;
    }

    // Multiple primitive items - show first + count
    return (
      <button
        onClick={() =>
          onArrayClick({
            columnKey,
            items: value,
            title: `${columnKey} (${value.length} items)`,
          })
        }
        className="text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
      >
        {String(value[0])} +{value.length - 1} more
      </button>
    );
  }

  // Handle objects
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-400">{"{}"}</span>;
    }

    // Show first 2 key-value pairs + count if more
    const maxDisplay = 2;
    const displayEntries = entries.slice(0, maxDisplay);
    const remainingCount = entries.length - maxDisplay;

    return (
      <div className="text-xs truncate">
        {displayEntries.map(([key, val], index) => (
          <span key={index}>
            <span className="font-medium text-gray-600">{key}:</span>{" "}
            <span className="text-gray-900">"{String(val)}"</span>
            {index < displayEntries.length - 1 && ", "}
          </span>
        ))}
        {remainingCount > 0 && (
          <span className="text-blue-600 font-medium">
            {" "}
            +{remainingCount} more
          </span>
        )}
      </div>
    );
  }

  // Handle primitive values
  return <span className="truncate block">{String(value)}</span>;
};

const PreviewPage: React.FC = () => {
  const params = useParams();
  const router = useRouter();
  const previewId = params.id as string;

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  console.log("previewData", previewData);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(50);
  const [arrayPopup, setArrayPopup] = useState<ArrayPopupData | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const exportDropdownRef = useRef<HTMLDivElement>(null);

  // Extract columns from schema
  const columns: TableColumn[] = useMemo(() => {
    if (!previewData?.preview.schema?.properties) return [];

    return Object.entries(previewData.preview.schema.properties).map(
      ([key, value]: [string, any]) => ({
        key,
        label: value.title || key,
        type: value.type || "string",
      })
    );
  }, [previewData?.preview.schema]);

  // Process and filter data
  const processedData = useMemo(() => {
    if (!previewData?.jobFiles) return [];

    let data = previewData.jobFiles.map((file) => ({
      _filename: file.filename,
      _fileId: file.id,
      _jobName: file.job_name,
      _createdAt: file.created_at,
      ...file.result,
    }));

    // Apply search filter
    if (searchTerm) {
      data = data.filter((item) =>
        Object.values(item).some((value) =>
          String(value).toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }

    // Apply sorting
    if (sortColumn) {
      data.sort((a, b) => {
        const aVal = a[sortColumn];
        const bVal = b[sortColumn];

        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;

        const comparison = String(aVal).localeCompare(String(bVal));
        return sortDirection === "asc" ? comparison : -comparison;
      });
    }

    return data;
  }, [previewData?.jobFiles, searchTerm, sortColumn, sortDirection]);

  // Pagination
  const totalPages = Math.ceil(processedData.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedData = processedData.slice(
    startIndex,
    startIndex + itemsPerPage
  );

  useEffect(() => {
    const fetchPreviewData = async () => {
      try {
        setLoading(true);
        const response = await apiClient.getPreviewData(previewId);

        if (response.success && response.data) {
          setPreviewData(response.data);
        } else {
          setError("Failed to load preview data");
        }
      } catch (err) {
        console.error("Error fetching preview data:", err);
        setError("Error loading preview data");
      } finally {
        setLoading(false);
      }
    };

    if (previewId) {
      fetchPreviewData();
    }
  }, [previewId]);

  // Close export dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        exportDropdownRef.current &&
        !exportDropdownRef.current.contains(event.target as Node)
      ) {
        setShowExportDropdown(false);
      }
    };

    if (showExportDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportDropdown]);

  const handleSort = (columnKey: string) => {
    if (sortColumn === columnKey) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(columnKey);
      setSortDirection("asc");
    }
    setCurrentPage(1);
  };

  const handleArrayClick = (data: ArrayPopupData) => {
    setArrayPopup(data);
  };

  const closeArrayPopup = () => {
    setArrayPopup(null);
  };

  // Helper function to serialize complex data for CSV
  const serializeValueForCSV = (value: any): string => {
    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";
      // For arrays, show the first few items
      const maxItems = 3;
      const displayItems = value.slice(0, maxItems).map((item) => {
        return extractAllPrimitiveValues(item);
      });
      const remainingCount = value.length - maxItems;
      const result = displayItems.join(", ");
      return remainingCount > 0 ? `${result} +${remainingCount} more` : result;
    }

    if (typeof value === "object") {
      return extractAllPrimitiveValues(value);
    }

    return String(value);
  };

  // Helper function to extract all primitive values from objects recursively
  const extractAllPrimitiveValues = (
    obj: any,
    maxDepth: number = 2,
    currentDepth: number = 0
  ): string => {
    if (obj === null || obj === undefined) return "";

    if (
      typeof obj === "string" ||
      typeof obj === "number" ||
      typeof obj === "boolean"
    ) {
      return String(obj);
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return "[]";
      if (currentDepth >= maxDepth) return `[${obj.length} items]`;

      const items = obj
        .slice(0, 3)
        .map((item) =>
          extractAllPrimitiveValues(item, maxDepth, currentDepth + 1)
        );
      const remaining = obj.length - 3;
      const result = items.join(", ");
      return remaining > 0 ? `${result} +${remaining} more` : result;
    }

    if (typeof obj === "object") {
      if (currentDepth >= maxDepth) return "{...}";

      const entries = Object.entries(obj);
      if (entries.length === 0) return "{}";

      const values = entries.slice(0, 3).map(([key, val]) => {
        const extracted = extractAllPrimitiveValues(
          val,
          maxDepth,
          currentDepth + 1
        );
        return `${key}: ${extracted}`;
      });

      const remaining = entries.length - 3;
      const result = values.join(", ");
      return remaining > 0 ? `${result} +${remaining} more` : result;
    }

    return String(obj);
  };

  const handleExport = (format: "csv" | "json") => {
    if (!processedData.length) return;

    // Debug: Log the first item to see the data structure
    console.log("Sample data for export:", processedData[0]);

    const headers = [
      "_filename",
      "_fileId",
      "_jobName",
      "_createdAt",
      ...columns.map((col) => col.key),
    ];

    if (format === "csv") {
      const csvContent = [
        headers.join(","),
        ...processedData.map((item) =>
          headers
            .map((header) => {
              const value = serializeValueForCSV(item[header]);
              // Escape CSV values that contain commas or quotes
              return typeof value === "string" &&
                (value.includes(",") || value.includes('"'))
                ? `"${value.replace(/"/g, '""')}"`
                : value;
            })
            .join(",")
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${previewData?.preview.name || "preview"}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === "json") {
      const jsonData = {
        preview: previewData?.preview.name,
        exportedAt: new Date().toISOString(),
        totalItems: processedData.length,
        data: processedData,
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${previewData?.preview.name || "preview"}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading preview...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !previewData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error || "Preview not found"}</p>
            <Button onClick={() => router.back()}>
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col">
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Core Extract Logo */}
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">CE</span>
              </div>
              <span className="text-lg font-semibold text-gray-900">
                Core Extract
              </span>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                {previewData.preview.name}
              </h1>
              <p className="text-sm text-gray-500">
                {processedData.length} items • {columns.length} columns
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <div className="relative">
              <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search data..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-80 pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div className="relative" ref={exportDropdownRef}>
              {/* <Button
                onClick={() => setShowExportDropdown(!showExportDropdown)}
                disabled={!processedData.length}
              >
                <ArrowDownTrayIcon className="h-4 w-4 mr-2" />
                Export
              </Button> */}

              {showExportDropdown && (
                <div className="absolute right-0 top-full mt-1 w-32 bg-white border border-gray-200 rounded-md shadow-lg z-10">
                  <button
                    onClick={() => {
                      handleExport("csv");
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                  >
                    Export as CSV
                  </button>
                  <button
                    onClick={() => {
                      handleExport("json");
                      setShowExportDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-md last:rounded-b-md"
                  >
                    Export as JSON
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-auto">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-20">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 sticky left-0 bg-gray-50 z-30">
                  File ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  File
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Job
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200">
                  Created
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border-r border-gray-200 cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort(column.key)}
                  >
                    <div className="flex items-center space-x-1">
                      <span>{column.label}</span>
                      {sortColumn === column.key && (
                        <span className="text-blue-600">
                          {sortDirection === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedData.map((item, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-200 sticky left-0 bg-white z-20 hover:bg-gray-50">
                    {item._fileId}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 truncate max-w-xs">
                    {item._filename}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 truncate max-w-xs">
                    {item._jobName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border-r border-gray-200">
                    {new Date(item._createdAt).toLocaleDateString()}
                  </td>
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-6 py-4 text-sm text-gray-900 border-r border-gray-200 truncate max-w-xs"
                    >
                      <ComplexDataCell
                        value={item[column.key]}
                        columnKey={column.key}
                        onArrayClick={handleArrayClick}
                      />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>

          {paginatedData.length === 0 && (
            <div className="text-center py-12">
              <p className="text-gray-500">No data found</p>
            </div>
          )}
        </div>
      </div>

      {/* Fixed Footer */}
      <div className="bg-white border-t border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-700">
            Showing {startIndex + 1} to{" "}
            {Math.min(startIndex + itemsPerPage, processedData.length)} of{" "}
            {processedData.length} items
          </div>

          <div className="flex items-center space-x-2">
            <Button
              variant="secondary"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
            >
              Previous
            </Button>

            <span className="text-sm text-gray-700">
              Page {currentPage} of {totalPages}
            </span>

            <Button
              variant="secondary"
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
            >
              Next
            </Button>
          </div>
        </div>
      </div>

      {/* Array Items Popup */}
      {arrayPopup && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white shadow-xl max-w-4xl w-full mx-4 max-h-[80vh] overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900">
                {arrayPopup.title}
              </h3>
              <button
                onClick={closeArrayPopup}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto max-h-[60vh]">
              <div className="divide-y divide-gray-200">
                {arrayPopup.items.map((item, index) => (
                  <div key={index} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-500 uppercase tracking-wider">
                        Item {index + 1}
                      </span>
                    </div>
                    <div className="text-sm text-gray-900">
                      {typeof item === "object" && item !== null ? (
                        <div className="space-y-2">
                          {Object.entries(item).map(([key, val]) => (
                            <div
                              key={key}
                              className="flex border-b border-gray-100 pb-1 last:border-b-0"
                            >
                              <span className="font-medium text-gray-600 flex-shrink-0 mr-3 w-24">
                                {key}:
                              </span>
                              <span className="text-gray-900 break-words">
                                {String(val)}
                              </span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <span className="break-words">{String(item)}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end px-6 py-4 border-t border-gray-200 bg-gray-50">
              <Button onClick={closeArrayPopup}>Close</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PreviewPage;
