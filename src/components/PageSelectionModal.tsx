"use client";

import React, { useState, useEffect } from "react";
import { Modal, Checkbox, Button, Spin, message, Input } from "antd";
import PDFViewer from "./PDFViewer";

interface PageSelectionModalProps {
  open: boolean;
  file: File | null;
  initialSelectedPages?: number[];
  onClose: () => void;
  onConfirm: (selectedPages: number[]) => void;
}

const PageSelectionModal: React.FC<PageSelectionModalProps> = ({
  open,
  file,
  initialSelectedPages = [],
  onClose,
  onConfirm,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [selectedPages, setSelectedPages] =
    useState<number[]>(initialSelectedPages);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pageCountInput, setPageCountInput] = useState<string>("");
  console.log({ numPages, selectedPages, file });

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    console.log("PDF loaded successfully, pages:", numPages);
    setNumPages(numPages);
    setLoading(false);
    setError(null);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error("PDF load error in PageSelectionModal:", error);
    const errorMessage = error.message || error.toString() || "Unknown error";
    console.error("Error details:", {
      message: errorMessage,
      name: error.name,
      stack: error.stack,
    });
    setError(`Failed to load PDF: ${errorMessage}`);
    setLoading(false);
  };

  const togglePage = (pageNumber: number) => {
    setSelectedPages((prev) => {
      if (prev.includes(pageNumber)) {
        return prev.filter((p) => p !== pageNumber);
      } else {
        return [...prev, pageNumber].sort((a, b) => a - b);
      }
    });
  };

  const selectAll = () => {
    if (numPages) {
      setSelectedPages(Array.from({ length: numPages }, (_, i) => i + 1));
    }
  };

  const clearAll = () => {
    setSelectedPages([]);
  };

  const handleConfirm = () => {
    if (selectedPages.length === 0) {
      message.warning("Please select at least one page");
      return;
    }
    onConfirm(selectedPages);
    onClose();
  };

  const handleCancel = () => {
    setSelectedPages(initialSelectedPages);
    onClose();
  };

  if (!file) {
    return null;
  }

  return (
    <Modal
      open={open}
      onCancel={handleCancel}
      title={`Select Pages - ${file.name}`}
      width="100%"
      style={{ top: 0, paddingBottom: 0 }}
      styles={{
        body: { height: "calc(100vh - 110px)", padding: "24px" },
        content: { height: "100vh", maxHeight: "100vh" },
      }}
      footer={[
        <Button key="cancel" onClick={handleCancel}>
          Cancel
        </Button>,
        <Button key="select-all" onClick={selectAll}>
          Select All
        </Button>,
        <Button key="clear-all" onClick={clearAll}>
          Clear All
        </Button>,
        <Button
          key="confirm"
          type="primary"
          onClick={handleConfirm}
          disabled={selectedPages.length === 0}
        >
          Confirm ({selectedPages.length} page
          {selectedPages.length !== 1 ? "s" : ""} selected)
        </Button>,
      ]}
      destroyOnHidden
    >
      <div className="flex gap-4" style={{ height: "calc(100vh - 180px)" }}>
        {/* Left Side - PDF Preview */}
        <div className="flex-1 bg-gray-100 rounded-lg overflow-hidden relative">
          {error ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center text-red-600">
                <p className="font-medium mb-2">Error loading PDF</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          ) : (
            <PDFViewer
              file={file}
              numPages={numPages}
              selectedPages={selectedPages}
              onLoadSuccess={onDocumentLoadSuccess}
              onLoadError={onDocumentLoadError}
              onTogglePage={togglePage}
            />
          )}
        </div>

        {/* Right Side - Page List with Checkboxes */}
        <div className="w-64 bg-white border border-gray-200 rounded-lg p-4 overflow-auto">
          <div className="mb-4">
            <h3 className="font-semibold text-gray-700 mb-2">
              Pages ({numPages || "Loading..."})
            </h3>
            <div className="text-sm text-gray-500 mb-3">
              {selectedPages.length > 0
                ? `${selectedPages.length} page${
                    selectedPages.length !== 1 ? "s" : ""
                  } selected`
                : "No pages selected"}
            </div>
            {numPages && numPages > 0 && (
              <div className="flex gap-2 mb-3">
                <Button size="small" onClick={selectAll}>
                  Select All
                </Button>
                <Button size="small" onClick={clearAll}>
                  Clear All
                </Button>
              </div>
            )}
          </div>
          {!numPages ? (
            <div className="text-center py-6">
              <p className="text-sm text-gray-700 mb-3 font-medium">
                Enter Page Count
              </p>
              <p className="text-xs text-gray-500 mb-3">
                View the PDF on the left and enter the total number of pages
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="number"
                  min="1"
                  placeholder="e.g., 42"
                  value={pageCountInput}
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-center text-lg font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const value = parseInt(pageCountInput);
                      if (value > 0 && !isNaN(value)) {
                        setNumPages(value);
                        onDocumentLoadSuccess({ numPages: value });
                        setPageCountInput("");
                      }
                    }
                  }}
                  onChange={(e) => {
                    setPageCountInput(e.target.value);
                  }}
                />
                <Button
                  type="primary"
                  onClick={() => {
                    const value = parseInt(pageCountInput);
                    if (value > 0 && !isNaN(value)) {
                      setNumPages(value);
                      onDocumentLoadSuccess({ numPages: value });
                      setPageCountInput("");
                    } else {
                      message.warning("Please enter a valid page count");
                    }
                  }}
                  disabled={
                    !pageCountInput ||
                    isNaN(parseInt(pageCountInput)) ||
                    parseInt(pageCountInput) <= 0
                  }
                >
                  Submit
                </Button>
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Or wait for automatic detection...
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {Array.from({ length: numPages }, (_, index) => {
                const pageNumber = index + 1;
                return (
                  <div
                    key={pageNumber}
                    className={`p-2 rounded cursor-pointer transition-colors ${
                      selectedPages.includes(pageNumber)
                        ? "bg-blue-50 border border-blue-200"
                        : "hover:bg-gray-50 border border-transparent"
                    }`}
                    onClick={() => togglePage(pageNumber)}
                  >
                    <Checkbox
                      checked={selectedPages.includes(pageNumber)}
                      onChange={(e) => {
                        e.stopPropagation();
                        togglePage(pageNumber);
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                    >
                      <span className="text-sm">Page {pageNumber}</span>
                    </Checkbox>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default PageSelectionModal;
