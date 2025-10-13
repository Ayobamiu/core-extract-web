"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiClient, PreviewDataTable, PreviewJobFile } from "@/lib/api";
import Button from "@/components/ui/Button";
import { Table, Input, Modal, Button as AntButton, Dropdown } from "antd";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import { SearchOutlined, DownloadOutlined } from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";

// Styles for truncation and proper spacing
const tableStyles = `
  /* Truncation styles - more specific selectors */
  .ant-table-custom .ant-table-tbody > tr > td {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 0 !important;
  }
  
  .ant-table-custom .ant-table-tbody > tr > td > span,
  .ant-table-custom .ant-table-tbody > tr > td > div {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    display: block !important;
    max-width: 100% !important;
  }
  
  .ant-table-custom .ant-table-tbody > tr > td .ant-btn-link {
    max-width: 100% !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    white-space: nowrap !important;
    padding: 0 !important;
    height: auto !important;
    line-height: 1.4 !important;
  }
  
  /* Force truncation on all text content */
  .ant-table-custom .ant-table-tbody > tr > td * {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  
  /* Additional truncation rules */
  .ant-table-custom .ant-table-tbody > tr > td {
    table-layout: fixed !important;
  }
  
  .ant-table-custom .ant-table {
    table-layout: fixed !important;
  }
  
  .ant-table-custom .ant-table-tbody > tr > td > span.truncate {
    display: block !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 100% !important;
  }
  
  /* Target Ant Design's internal table structure */
  .ant-table-custom .ant-table-content .ant-table-tbody > tr > td {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
  }
  
  .ant-table-custom .ant-table-content .ant-table-tbody > tr > td > * {
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    display: block !important;
  }
  
  /* Ensure proper table spacing without gaps */
  .ant-table-custom .ant-table-thead > tr > th {
    border-bottom: 1px solid #f0f0f0 !important;
  }
  
  .ant-table-custom .ant-table-tbody > tr > td {
    border-bottom: 1px solid #f0f0f0 !important;
  }
  
  /* Remove any extra spacing that might cause gaps */
  .ant-table-custom .ant-table-thead {
    margin-bottom: 0 !important;
  }
  
  .ant-table-custom .ant-table-tbody {
    margin-top: 0 !important;
  }
`;

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
        <AntButton
          type="link"
          size="small"
          onClick={() =>
            onArrayClick({
              columnKey,
              items: value,
              title: `${columnKey} (${value.length} items)`,
            })
          }
          className="p-0 h-auto text-blue-600 hover:text-blue-800"
        >
          {value.length} items
        </AntButton>
      );
    }

    // For arrays of primitives
    if (value.length === 1) {
      return (
        <span className="truncate block" title={String(value[0])}>
          {String(value[0])}
        </span>
      );
    }

    // Multiple primitive items - show first + count
    return (
      <AntButton
        type="link"
        size="small"
        onClick={() =>
          onArrayClick({
            columnKey,
            items: value,
            title: `${columnKey} (${value.length} items)`,
          })
        }
        className="p-0 h-auto text-blue-600 hover:text-blue-800"
      >
        {String(value[0])} +{value.length - 1} more
      </AntButton>
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
      <div className="text-xs truncate block" title={JSON.stringify(value)}>
        <span className="truncate block">
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
        </span>
      </div>
    );
  }

  // Handle primitive values
  return (
    <span className="truncate block" title={String(value)}>
      {String(value)}
    </span>
  );
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
  const [currentPage, setCurrentPage] = useState(1);
  const [arrayPopup, setArrayPopup] = useState<ArrayPopupData | null>(null);

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

  const handleArrayClick = (data: ArrayPopupData) => {
    setArrayPopup(data);
  };

  // Create Ant Design table columns
  const tableColumns: ColumnsType<any> = useMemo(() => {
    const baseColumns: ColumnsType<any> = [
      {
        title: "File ID",
        dataIndex: "_fileId",
        key: "_fileId",
        width: 120,
        fixed: "left",
        ellipsis: true,
        sorter: (a, b) => a._fileId.localeCompare(b._fileId),
        render: (text: string) => (
          <span
            className="text-gray-500 font-mono text-sm truncate block"
            title={text}
          >
            {text}
          </span>
        ),
      },
      {
        title: "File",
        dataIndex: "_filename",
        key: "_filename",
        width: 200,
        fixed: "left",
        ellipsis: true,
        sorter: (a, b) => a._filename.localeCompare(b._filename),
        render: (text: string) => (
          <span className="text-gray-900 truncate block" title={text}>
            {text}
          </span>
        ),
      },
      {
        title: "Job",
        dataIndex: "_jobName",
        key: "_jobName",
        width: 150,
        ellipsis: true,
        sorter: (a, b) => a._jobName.localeCompare(b._jobName),
        render: (text: string) => (
          <span className="text-gray-900 truncate block" title={text}>
            {text}
          </span>
        ),
      },
      {
        title: "Created",
        dataIndex: "_createdAt",
        key: "_createdAt",
        width: 120,
        ellipsis: true,
        sorter: (a, b) =>
          new Date(a._createdAt).getTime() - new Date(b._createdAt).getTime(),
        render: (text: string) => (
          <span className="text-gray-500 text-sm truncate block" title={text}>
            {new Date(text).toLocaleDateString()}
          </span>
        ),
      },
    ];

    // Add dynamic columns from schema
    const dynamicColumns = columns.map((column) => ({
      title: column.label,
      dataIndex: column.key,
      key: column.key,
      width: 200,
      ellipsis: true,
      sorter: (a: any, b: any) => {
        const aVal = a[column.key];
        const bVal = b[column.key];
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        return String(aVal).localeCompare(String(bVal));
      },
      render: (value: any) => (
        <ComplexDataCell
          value={value}
          columnKey={column.key}
          onArrayClick={handleArrayClick}
        />
      ),
    }));

    return [...baseColumns, ...dynamicColumns];
  }, [columns, handleArrayClick]);

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

    return data;
  }, [previewData?.jobFiles, searchTerm]);

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
      <style dangerouslySetInnerHTML={{ __html: tableStyles }} />
      {/* Fixed Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="h-8 w-8 flex items-center justify-center">
                {previewData.preview.logo ? (
                  <img
                    src={previewData.preview.logo}
                    alt={`${previewData.preview.name} Logo`}
                    className="h-8 w-8 object-contain"
                    onError={(e) => {
                      // Fallback to Core Extract logo if custom logo fails to load
                      e.currentTarget.src = "/core-extract-logo.svg";
                      e.currentTarget.alt = "Core Extract Logo";
                    }}
                  />
                ) : (
                  <img
                    src="/globe.svg"
                    alt="Core Extract Logo"
                    className="h-8 w-8"
                  />
                )}
              </div>
              <span className="text-lg font-semibold text-gray-900">
                {previewData.preview.name}
              </span>
            </div>

            <div className="h-6 w-px bg-gray-300"></div>

            <div>
              <p className="text-sm text-gray-500">
                {processedData.length} items • {columns.length} columns
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <Input
              placeholder="Search data..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              prefix={<SearchOutlined />}
              style={{ width: 320 }}
              allowClear
            />

            <Dropdown
              menu={{
                items: [
                  {
                    key: "csv",
                    label: "Export as CSV",
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport("csv"),
                  },
                  {
                    key: "json",
                    label: "Export as JSON",
                    icon: <DownloadOutlined />,
                    onClick: () => handleExport("json"),
                  },
                ],
              }}
              trigger={["click"]}
              disabled={!processedData.length}
            >
              <AntButton icon={<DownloadOutlined />}>Export</AntButton>
            </Dropdown>
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-hidden">
        <Table
          columns={tableColumns}
          bordered
          dataSource={processedData}
          rowKey={(record) => `${record._fileId}-${record._filename}`}
          scroll={{ x: "max-content", y: "calc(100vh - 200px)" }}
          pagination={{
            current: currentPage,
            total: processedData.length,
            showSizeChanger: true,
            showQuickJumper: false,
            showTotal: (total, range) =>
              `${range[0]}-${range[1]} of ${total} items`,
            onChange: (page) => setCurrentPage(page),
            size: "small",
            hideOnSinglePage: true,
            position: ["bottomCenter"],
            defaultPageSize: 20,
          }}
          size="small"
          className="ant-table-custom h-full"
        />
      </div>

      {/* Array Items Popup */}
      <Modal
        title={arrayPopup?.title}
        open={!!arrayPopup}
        onCancel={closeArrayPopup}
        footer={[
          <AntButton key="close" onClick={closeArrayPopup}>
            Close
          </AntButton>,
        ]}
        width="80%"
        style={{ top: 20 }}
      >
        <div className="max-h-[60vh] overflow-y-auto">
          <div className="divide-y divide-gray-200">
            {arrayPopup?.items.map((item, index) => (
              <div key={index} className="px-4 py-3 hover:bg-gray-50">
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
      </Modal>
    </div>
  );
};

export default PreviewPage;
