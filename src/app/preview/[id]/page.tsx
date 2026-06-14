"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, useRouter, usePathname, useSearchParams } from "next/navigation";
import { apiClient, PreviewDataTable, PreviewJobFile } from "@/lib/api";
import {
  getCachedPreviewData,
  setCachedPreviewData,
  clearPreviewCache,
} from "@/lib/previewCache";
import Button from "@/components/ui/Button";
import {
  Table,
  Input,
  Modal,
  Button as AntButton,
  Dropdown,
  Drawer,
  Tag,
  Tooltip,
  notification,
  Spin,
} from "antd";
import { RecordView } from "@/components/record/RecordView";
import { humanizeKey } from "@/components/record/recordSchema";
import {
  PreviewRail,
  PreviewView,
  documentTypeLabel,
} from "./PreviewRail";
import { parsePreviewUrl, buildPreviewParams } from "./previewUrlState";
import { ChevronLeftIcon } from "@heroicons/react/24/outline";
import {
  SearchOutlined,
  DownloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  InfoCircleOutlined,
  ExpandOutlined,
  ReloadOutlined,
} from "@ant-design/icons";
import type { ColumnsType } from "antd/es/table";
import { WellboreDiagramDrawer } from "@/components/well/WellboreDiagramModal";
import { trackPreviewAnalytics } from "@/lib/previewAnalytics";

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
  title: string;
  /** For array cells. */
  items?: any[];
  /** For object cells. */
  object?: Record<string, any>;
}

// Recursive, human-readable renderer for nested values in the detail modal —
// primitives, arrays (of primitives → inline; of objects → blocks) and objects
// (key/value rows), so nothing ever shows "[object Object]".
const RenderValue: React.FC<{ value: any; depth?: number }> = ({
  value,
  depth = 0,
}) => {
  if (value === null || value === undefined || value === "") {
    return <span className="text-gray-400 italic">Not recorded</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-gray-900">{value ? "Yes" : "No"}</span>;
  }
  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-gray-400 italic">None</span>;
    }
    const allPrimitive = value.every(
      (v) => v === null || typeof v !== "object",
    );
    if (allPrimitive) {
      return (
        <span className="text-gray-900 break-words">
          {value.map((v) => String(v)).join(", ")}
        </span>
      );
    }
    return (
      <div className="space-y-2">
        {value.map((item, i) => (
          <div
            key={i}
            className="rounded-md border border-gray-100 bg-gray-50/60 p-2"
          >
            <div className="text-[10px] uppercase tracking-wide text-gray-400 mb-1">
              Item {i + 1}
            </div>
            <RenderValue value={item} depth={depth + 1} />
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-400 italic">Empty</span>;
    }
    return (
      <div
        className={
          depth > 0 ? "space-y-1.5 pl-3 border-l border-gray-100" : "space-y-2"
        }
      >
        {entries.map(([k, v]) => (
          <div
            key={k}
            className="grid grid-cols-[minmax(7rem,11rem)_1fr] gap-3 items-start"
          >
            <span className="text-[13px] font-medium text-gray-500 break-words">
              {humanizeKey(k)}
            </span>
            <span className="text-[13.5px] text-gray-900 break-words">
              <RenderValue value={v} depth={depth + 1} />
            </span>
          </div>
        ))}
      </div>
    );
  }
  return <span className="text-gray-900 break-words">{String(value)}</span>;
};

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
      (item) => typeof item === "object" && item !== null,
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
              title: `${humanizeKey(columnKey)} (${value.length} items)`,
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

  // Handle objects — match the array treatment: a count chip that opens the
  // full key/value breakdown in the detail modal.
  if (typeof value === "object" && value !== null) {
    const entries = Object.entries(value);
    if (entries.length === 0) {
      return <span className="text-gray-400">{"{}"}</span>;
    }
    return (
      <AntButton
        type="link"
        size="small"
        onClick={() =>
          onArrayClick({
            columnKey,
            title: `${humanizeKey(columnKey)} (${entries.length} field${entries.length === 1 ? "" : "s"})`,
            object: value,
          })
        }
        className="p-0 h-auto text-blue-600 hover:text-blue-800"
      >
        {entries.length} field{entries.length === 1 ? "" : "s"}
      </AntButton>
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
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const previewId = params.id as string;

  // Initial page/per_page/slug/view come from the URL (so they're shareable).
  const initialUrlRef = React.useRef<ReturnType<typeof parsePreviewUrl> | null>(
    null,
  );
  if (!initialUrlRef.current) {
    initialUrlRef.current = parsePreviewUrl(
      new URLSearchParams(searchParams?.toString() ?? ""),
    );
  }
  const initialUrl = initialUrlRef.current;

  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(initialUrl.page);
  const [pageSize, setPageSize] = useState(initialUrl.pageSize);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [searchInput, setSearchInput] = useState("");
  const [qaStats, setQaStats] = useState({
    total: 0,
    humanVerified: 0,
    reviewed: 0,
    approved: 0,
    inReview: 0,
    pending: 0,
    rejected: 0,
    humanVerifiedPercentage: 0,
    qualityScore: 0,
    allVerified: false,
  });
  const [statsLoading, setStatsLoading] = useState(true);
  const [arrayPopup, setArrayPopup] = useState<ArrayPopupData | null>(null);
  const [qualityScoreModalVisible, setQualityScoreModalVisible] =
    useState(false);
  const [wellboreModalOpen, setWellboreModalOpen] = useState(false);
  const [selectedWellData, setSelectedWellData] = useState<any>(null);
  const [selectedFilename, setSelectedFilename] = useState<string>("");

  // Rail navigation: which lens is active.
  const [view, setView] = useState<PreviewView>(initialUrl.view);
  const [slugs, setSlugs] = useState<
    Array<{ slug: string | null; count: number }>
  >([]);
  const [fileSummaries, setFileSummaries] = useState<any[]>([]);
  const [filesTotal, setFilesTotal] = useState<number>(0);

  // Record detail drawer (RecordView engine + hero). The preview is a PUBLIC
  // page, so we don't fetch the per-type schema from an authed endpoint — we
  // reuse the preview's own (public) schema for labels and let the engine's
  // data-driven fallback + slug-based hero handle the rest.
  const [recordDrawer, setRecordDrawer] = useState<any>(null);

  useEffect(() => {
    document.title = previewData?.preview.name ?? "Preview";
  }, [previewData?.preview.name]);

  // Extract columns from schema
  const columns: TableColumn[] = useMemo(() => {
    if (!previewData?.preview.schema?.properties) return [];

    return Object.entries(previewData.preview.schema.properties).map(
      ([key, value]: [string, any]) => ({
        key,
        label: value.title || key,
        type: value.type || "string",
      }),
    );
  }, [previewData?.preview.schema]);

  const handleArrayClick = (data: ArrayPopupData) => {
    setArrayPopup(data);
  };

  // Create Ant Design table columns
  const tableColumns: ColumnsType<any> = useMemo(() => {
    const baseColumns: ColumnsType<any> = [
      {
        title: "File",
        dataIndex: "_filename",
        key: "_filename",
        width: 200,
        fixed: "left",
        ellipsis: true,
        sorter: (a, b) => a._filename.localeCompare(b._filename),
        render: (text: string, record: any) => {
          // Check if record has well data (formations, casing, etc.)
          const hasWellData =
            record.formations ||
            record.casing ||
            record.perforation_intervals ||
            record.pluggings ||
            record.shows_depths ||
            record.true_depth ||
            record.measured_depth;

          return (
            <div className="flex items-center space-x-2">
              {hasWellData && (
                <Tooltip title="View wellbore diagram">
                  <ExpandOutlined
                    className="text-blue-500 hover:text-blue-700 cursor-pointer flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedWellData(record);
                      setSelectedFilename(text);
                      setWellboreModalOpen(true);
                      trackPreviewAnalytics(previewId, [
                        {
                          type: "wellbore_open",
                          jobFileId: record._fileId,
                          wellLabel: text,
                        },
                        {
                          type: "well_view",
                          jobFileId: record._fileId,
                          wellLabel: text,
                        },
                      ]);
                    }}
                  />
                </Tooltip>
              )}
              <button
                type="button"
                className="text-blue-600 hover:text-blue-800 hover:underline truncate block text-left bg-transparent border-0 p-0 cursor-pointer"
                title={`View ${text}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setRecordDrawer(record);
                }}
              >
                {text}
              </button>
            </div>
          );
        },
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

    // QA Status column - fixed on the right
    const qaStatusColumn: ColumnsType<any>[0] = {
      title: "QA Status",
      key: "_qaStatus",
      width: 150,
      fixed: "right" as const,
      ellipsis: true,
      sorter: (a: any, b: any) => {
        // Sort: Human Verified first, then by review status
        const aIsVerified = a._adminVerified ? 0 : 1;
        const bIsVerified = b._adminVerified ? 0 : 1;
        if (aIsVerified !== bIsVerified) return aIsVerified - bIsVerified;

        const aStatus = a._reviewStatus || "pending";
        const bStatus = b._reviewStatus || "pending";
        const statusOrder: Record<string, number> = {
          reviewed: 0,
          approved: 1,
          in_review: 2,
          pending: 3,
          rejected: 4,
        };
        return (statusOrder[aStatus] || 99) - (statusOrder[bStatus] || 99);
      },
      render: (_: any, record: any) => {
        const isHumanVerified = record._adminVerified;
        const reviewStatus = record._reviewStatus || "pending";

        if (isHumanVerified) {
          return (
            <Tooltip title="This data has been verified by a human expert">
              <div className="flex items-center space-x-2">
                <CheckCircleOutlined
                  className="text-green-600"
                  style={{ fontSize: "16px" }}
                />
                <span className="text-green-700 font-medium">
                  Human Verified
                </span>
              </div>
            </Tooltip>
          );
        }

        // Map review status to display
        const statusConfig: Record<
          string,
          { label: string; color: string; icon?: React.ReactNode }
        > = {
          reviewed: {
            label: "Reviewed",
            color: "success",
            icon: <CheckCircleOutlined />,
          },
          approved: {
            label: "Approved",
            color: "success",
            icon: <CheckCircleOutlined />,
          },
          in_review: {
            label: "In Review",
            color: "processing",
            icon: <ClockCircleOutlined />,
          },
          pending: {
            label: "Pending Review",
            color: "default",
          },
          rejected: {
            label: "Rejected",
            color: "error",
          },
        };

        const config = statusConfig[reviewStatus] || statusConfig.pending;

        return (
          <Tooltip title={`Review status: ${config.label}`}>
            <Tag
              color={config.color}
              icon={config.icon}
              className="flex items-center"
            >
              {config.label}
            </Tag>
          </Tooltip>
        );
      },
    };

    return [...baseColumns, ...dynamicColumns, qaStatusColumn];
  }, [columns, handleArrayClick]);

  // Process data (no client-side filtering since we use server-side search)
  const processedData = useMemo(() => {
    if (!previewData?.jobFiles) return [];

    const data = previewData.jobFiles.map((file) => ({
      // _rowId is unique per record; _fileId is the originating file (V2 files
      // contribute many records, so these differ).
      _rowId: file.id,
      _record: file.result, // raw record, for the RecordView detail drawer
      _filename: file.filename,
      _fileId: file.file_id ?? file.id,
      _slug: file.slug ?? null,
      _sectionId: file.section_result_id ?? null,
      _jobName: file.job_name,
      _createdAt: file.created_at,
      _adminVerified: file.admin_verified || false,
      _reviewStatus: file.review_status || "pending",
      ...file.result,
    }));

    // Ensure data length matches pageSize for server-side pagination
    // This prevents Ant Design warnings when dataSource length doesn't match pageSize
    // On the last page, data.length may be less than pageSize, which is fine
    return data.slice(0, pageSize);
  }, [previewData?.jobFiles, pageSize]);

  // Fetch preview statistics (for all items, not just current page)
  const fetchPreviewStatistics = useCallback(async () => {
    if (!previewId) return;

    try {
      setStatsLoading(true);
      const response = await apiClient.getPreviewStatistics(previewId);

      if (response.success && response.data) {
        setQaStats(response.data);
      }
    } catch (err) {
      console.error("Error fetching preview statistics:", err);
    } finally {
      setStatsLoading(false);
    }
  }, [previewId]);

  // Debounced search function
  const debouncedSearch = useCallback(
    (() => {
      let timeoutId: NodeJS.Timeout;
      return (value: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          setSearchTerm(value);
          setCurrentPage(1); // Reset to first page on search
        }, 500);
      };
    })(),
    [],
  );

  // Fetch preview data with pagination and caching
  const fetchPreviewData = useCallback(
    async (forceRefresh = false) => {
      if (!previewId) return;

      try {
        setLoading(true);
        setError(null);

        // If force refresh, clear cache for current page
        if (forceRefresh) {
          clearPreviewCache(previewId);
        }

        // "By file" lens — file summaries (no record cache).
        if (view.kind === "files") {
          const resp = await apiClient.getPreviewFiles(
            previewId,
            currentPage,
            pageSize,
            searchTerm || undefined,
          );
          if (resp.success && resp.data) {
            setFileSummaries(resp.data.files);
            setFilesTotal(resp.data.pagination.total);
            setTotalItems(resp.data.pagination.total);
            setTotalPages(resp.data.pagination.totalPages);
          } else {
            setError("Failed to load files");
          }
          setLoading(false);
          return;
        }

        // Record lenses (all / by type / scoped to one file).
        const slugFilter = view.kind === "records" ? view.slug : undefined;
        const fileFilter = view.kind === "file" ? view.fileId : undefined;
        // Only the unfiltered "all records" view uses the page cache.
        const useCache =
          !forceRefresh && view.kind === "records" && !view.slug;

        if (useCache) {
          const cached = getCachedPreviewData(
            previewId,
            currentPage,
            pageSize,
            searchTerm || undefined,
          );
          if (cached) {
            setPreviewData({
              preview: cached.preview,
              jobFiles: cached.jobFiles,
            });
            setTotalItems(cached.pagination.total);
            setTotalPages(cached.pagination.totalPages);
            setLoading(false);
            return;
          }
        }

        const response = await apiClient.getPreviewDataPaginated(
          previewId,
          currentPage,
          pageSize,
          searchTerm || undefined,
          { slug: slugFilter, fileId: fileFilter },
        );

        if (response.success && response.data) {
          setPreviewData({
            preview: response.data.preview,
            jobFiles: response.data.jobFiles,
          });
          setTotalItems(response.data.pagination.total);
          setTotalPages(response.data.pagination.totalPages);
          if (response.data.slugs) setSlugs(response.data.slugs);

          if (useCache) {
            setCachedPreviewData(
              previewId,
              currentPage,
              pageSize,
              {
                preview: response.data.preview,
                jobFiles: response.data.jobFiles,
                pagination: response.data.pagination,
              },
              searchTerm || undefined,
            );
          }
        } else {
          setError("Failed to load preview data");
        }
      } catch (err) {
        console.error("Error fetching preview data:", err);
        setError("Error loading preview data");
      } finally {
        setLoading(false);
      }
    },
    [previewId, currentPage, pageSize, searchTerm, view],
  );

  // Reset to the first page whenever the rail view changes (but not on the
  // initial mount, so a `page` restored from the URL isn't clobbered).
  const firstViewRef = React.useRef(true);
  useEffect(() => {
    if (firstViewRef.current) {
      firstViewRef.current = false;
      return;
    }
    setCurrentPage(1);
  }, [view]);

  // Persist page / per_page / slug / view in the URL (shareable, restored on load).
  useEffect(() => {
    const next = buildPreviewParams(new URLSearchParams(), {
      page: currentPage,
      pageSize,
      view,
    });
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }, [currentPage, pageSize, view, pathname, router]);

  // Force refresh function
  const handleRefresh = useCallback(async () => {
    await fetchPreviewData(true);
    // Also refresh statistics
    await fetchPreviewStatistics();
  }, [fetchPreviewData, fetchPreviewStatistics]);

  // Fetch data when dependencies change
  useEffect(() => {
    fetchPreviewData();
  }, [fetchPreviewData]);

  // Fetch statistics separately (once, not on pagination changes)
  useEffect(() => {
    fetchPreviewStatistics();
  }, [fetchPreviewStatistics]);

  // Record preview page visit (once per browser session per preview)
  useEffect(() => {
    if (!previewId || loading) return;
    const key = `preview_visit_tracked_${previewId}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* sessionStorage unavailable */
    }
    trackPreviewAnalytics(previewId, [{ type: "preview_visit" }]);
  }, [previewId, loading]);

  // Handle search input change with debouncing
  useEffect(() => {
    debouncedSearch(searchInput);
  }, [searchInput, debouncedSearch]);

  // Show notification when all items are verified
  useEffect(() => {
    if (qaStats.allVerified && qaStats.total > 0) {
      notification.success({
        message: "All Items Verified",
        description: `All ${qaStats.total} items in this preview are Human Verified. Quality assured by expert review.`,
        icon: <CheckCircleOutlined className="text-green-600" />,
        placement: "bottomRight",
        duration: 4.5,
        key: `all-verified-${previewId}`, // Prevent duplicate notifications
        type: "success",
      });
    }
  }, [qaStats.allVerified, qaStats.total, previewId]);

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
    currentDepth: number = 0,
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
          extractAllPrimitiveValues(item, maxDepth, currentDepth + 1),
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
          currentDepth + 1,
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
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename =
        processedData.length < totalItems
          ? `${previewData?.preview.name || "preview"}_page${currentPage}.csv`
          : `${previewData?.preview.name || "preview"}.csv`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === "json") {
      const jsonData = {
        preview: previewData?.preview.name,
        exportedAt: new Date().toISOString(),
        totalItems: processedData.length,
        totalInPreview: totalItems,
        note:
          processedData.length < totalItems
            ? `Note: Only current page exported (${processedData.length} of ${totalItems} items)`
            : undefined,
        data: processedData,
      };

      const blob = new Blob([JSON.stringify(jsonData, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const filename =
        processedData.length < totalItems
          ? `${previewData?.preview.name || "preview"}_page${currentPage}.json`
          : `${previewData?.preview.name || "preview"}.json`;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  // Only show error if we're not loading and there's actually an error
  if (error && !loading && !previewData) {
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

  // Show loading state if we don't have preview data yet
  if (!previewData && loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <Spin size="large" />
        </div>
      </div>
    );
  }

  // If no preview data and not loading, show error
  if (!previewData && !loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-red-600 mb-4">Preview not found</p>
            <Button onClick={() => router.back()}>
              <ChevronLeftIcon className="h-4 w-4 mr-2" />
              Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // At this point, previewData should exist, but TypeScript needs assurance
  if (!previewData) {
    return null; // This shouldn't happen, but satisfies TypeScript
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
              {statsLoading ? (
                <Spin size="small" />
              ) : (
                <p className="text-sm text-gray-500">
                  {qaStats.total > 0 ? qaStats.total : totalItems} items •{" "}
                  {columns.length} columns
                </p>
              )}
            </div>

            {/* QA Summary Badge */}
            {!statsLoading && qaStats.total > 0 && (
              <>
                <div className="h-6 w-px bg-gray-300"></div>
                <Tooltip
                  title={`${qaStats.humanVerified} of ${qaStats.total} items are Human Verified`}
                >
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-green-50 border border-green-200 rounded-lg">
                    <CheckCircleOutlined className="text-green-600" />
                    {/* <span className="text-sm font-medium text-green-700">
                      {qaStats.humanVerified}/{qaStats.total} Verified
                    </span> */}
                    <span className="text-xs text-green-600">
                      {qaStats.humanVerifiedPercentage}% Verified
                    </span>
                  </div>
                </Tooltip>

                {/* Quality Score Indicator */}
                <div className="flex items-center space-x-2">
                  <Tooltip
                    title={`Quality Score: ${qaStats.qualityScore}% (based on verification and review status)`}
                  >
                    <div
                      className={`flex items-center space-x-2 px-3 py-1.5 border rounded-lg ${
                        qaStats.qualityScore >= 80
                          ? "bg-blue-50 border-blue-200"
                          : qaStats.qualityScore >= 50
                            ? "bg-yellow-50 border-yellow-200"
                            : "bg-orange-50 border-orange-200"
                      }`}
                    >
                      <span
                        className={`text-xs ${
                          qaStats.qualityScore >= 80
                            ? "text-blue-700"
                            : qaStats.qualityScore >= 50
                              ? "text-yellow-700"
                              : "text-orange-700"
                        }`}
                      >
                        Quality: {qaStats.qualityScore}%
                      </span>
                    </div>
                  </Tooltip>
                  <Tooltip title="Learn how Quality Score is calculated">
                    <InfoCircleOutlined
                      className="text-gray-400 hover:text-blue-600 cursor-pointer transition-colors"
                      style={{ fontSize: "16px" }}
                      onClick={() => setQualityScoreModalVisible(true)}
                    />
                  </Tooltip>
                </div>
              </>
            )}
            {statsLoading && (
              <>
                <div className="h-6 w-px bg-gray-300"></div>
                <Spin size="small" />
              </>
            )}
          </div>

          <div className="flex items-center space-x-4">
            {/* Search Bar */}
            <Input
              placeholder="Search data..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
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
              <AntButton icon={<DownloadOutlined />} title="Export Data" />
            </Dropdown>

            <AntButton
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              loading={loading}
              title="Refresh data"
            />
          </div>
        </div>
      </div>

      {/* Scrollable Content with rail */}
      <div className="flex-1 overflow-hidden flex">
        <PreviewRail
          slugs={slugs}
          totalRecords={slugs.reduce((a, s) => a + s.count, 0) || undefined}
          totalFiles={filesTotal || undefined}
          view={view}
          onSelect={setView}
        />
        <div className="flex-1 overflow-hidden flex flex-col">
          {view.kind === "file" && (
            <div className="flex items-center gap-2 px-4 py-2 border-b border-gray-100 text-sm bg-white">
              <button
                type="button"
                className="text-blue-600 hover:underline bg-transparent border-0 p-0 cursor-pointer"
                onClick={() => setView({ kind: "files" })}
              >
                ← Files
              </button>
              <span className="text-gray-400">/</span>
              <span className="text-gray-700 truncate">{view.filename}</span>
            </div>
          )}

          {view.kind === "files" ? (
            <Table
              columns={[
                {
                  title: "File",
                  dataIndex: "filename",
                  key: "filename",
                  ellipsis: true,
                  render: (text: string, f: any) => (
                    <button
                      type="button"
                      className="text-blue-600 hover:text-blue-800 hover:underline text-left bg-transparent border-0 p-0 cursor-pointer truncate block"
                      title={`Open ${text}`}
                      onClick={() =>
                        setView({
                          kind: "file",
                          fileId: f.id,
                          filename: f.filename,
                        })
                      }
                    >
                      {text}
                    </button>
                  ),
                },
                {
                  title: "Contents",
                  key: "contents",
                  render: (_: unknown, f: any) =>
                    f.by_type && f.by_type.length
                      ? f.by_type
                          .map(
                            (t: { slug: string | null; count: number }) =>
                              `${t.count} ${documentTypeLabel(t.slug)}`,
                          )
                          .join(" · ")
                      : `${f.total_records} records`,
                },
                {
                  title: "Records",
                  dataIndex: "total_records",
                  key: "total_records",
                  width: 90,
                  align: "right" as const,
                },
                {
                  title: "Status",
                  dataIndex: "review_status",
                  key: "review_status",
                  width: 120,
                  render: (s: string) => <Tag>{s || "pending"}</Tag>,
                },
              ]}
              dataSource={fileSummaries}
              rowKey="id"
              loading={loading}
              scroll={{ y: "calc(100vh - 200px)" }}
              pagination={
                filesTotal > pageSize
                  ? {
                      current: currentPage,
                      total: filesTotal,
                      pageSize,
                      onChange: (p) => setCurrentPage(p),
                      size: "small",
                      position: ["bottomCenter"],
                    }
                  : false
              }
              size="small"
              className="ant-table-custom"
            />
          ) : (
            <Table
              columns={tableColumns}
              bordered
              dataSource={processedData}
              rowKey={(record) =>
                record._rowId ?? `${record._fileId}-${record._filename}`
              }
              scroll={{ x: "max-content", y: "calc(100vh - 200px)" }}
              loading={loading}
              pagination={
                totalItems > 0 && !loading && processedData.length <= pageSize
                  ? {
                      current: currentPage,
                      total: totalItems,
                      pageSize: pageSize,
                      showSizeChanger: true,
                      showQuickJumper: false,
                      showTotal: (total, range) =>
                        `${range[0]}-${range[1]} of ${total} items`,
                      onChange: (page, size) => {
                        setCurrentPage(page);
                        if (size !== pageSize) {
                          setPageSize(size);
                        }
                      },
                      onShowSizeChange: (current, size) => {
                        setCurrentPage(1);
                        setPageSize(size);
                      },
                      size: "small",
                      hideOnSinglePage: totalPages <= 1,
                      position: ["bottomCenter"],
                      pageSizeOptions: ["10", "20", "50", "100"],
                    }
                  : false
              }
              size="small"
              className="ant-table-custom h-full"
            />
          )}
        </div>
      </div>

      {/* Quality Score Info Modal */}
      <Modal
        title={
          <div className="flex items-center space-x-2">
            <InfoCircleOutlined className="text-blue-600" />
            <span>Quality Score Calculation</span>
          </div>
        }
        open={qualityScoreModalVisible}
        onCancel={() => setQualityScoreModalVisible(false)}
        footer={[
          <AntButton
            key="close"
            onClick={() => setQualityScoreModalVisible(false)}
          >
            Close
          </AntButton>,
        ]}
        width={600}
      >
        <div className="space-y-4">
          <div>
            <p className="text-gray-700 mb-4">
              The Quality Score is a weighted average that reflects the
              verification and review status of all items in this preview. It
              helps you quickly assess the overall data quality and
              trustworthiness.
            </p>
          </div>

          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <h4 className="font-semibold text-gray-900 mb-3">
              Score Breakdown:
            </h4>

            <div className="space-y-2">
              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <CheckCircleOutlined className="text-green-600" />
                  <span className="font-medium text-gray-900">
                    Human Verified
                  </span>
                </div>
                <Tag color="success" className="font-semibold">
                  100 points
                </Tag>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <CheckCircleOutlined className="text-blue-600" />
                  <span className="font-medium text-gray-900">
                    Reviewed / Approved
                  </span>
                </div>
                <Tag color="processing" className="font-semibold">
                  80 points
                </Tag>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <ClockCircleOutlined className="text-yellow-600" />
                  <span className="font-medium text-gray-900">In Review</span>
                </div>
                <Tag color="warning" className="font-semibold">
                  50 points
                </Tag>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-gray-200">
                <div className="flex items-center space-x-2">
                  <span className="text-gray-500">⏳</span>
                  <span className="font-medium text-gray-900">
                    Pending Review
                  </span>
                </div>
                <Tag className="font-semibold">30 points</Tag>
              </div>

              <div className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-2">
                  <span className="text-red-500">✗</span>
                  <span className="font-medium text-gray-900">Rejected</span>
                </div>
                <Tag color="error" className="font-semibold">
                  0 points
                </Tag>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="font-semibold text-blue-900 mb-2">How It Works:</h4>
            <p className="text-sm text-blue-800">
              Each item contributes points based on its status. The total score
              is calculated by summing all points and dividing by the total
              number of items, then converting to a percentage.
            </p>
            <p className="text-sm text-blue-800 mt-2">
              <strong>Example:</strong> If you have 10 items (5 Human Verified,
              3 Reviewed, 2 Pending), the score would be: (5×100 + 3×80 + 2×30)
              ÷ 10 = <strong>74%</strong>
            </p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h4 className="font-semibold text-green-900 mb-2">
              What This Means:
            </h4>
            <ul className="text-sm text-green-800 space-y-1 list-disc list-inside">
              <li>
                <strong>80-100%:</strong> High quality - Most items are verified
                or reviewed
              </li>
              <li>
                <strong>50-79%:</strong> Medium quality - Some items need review
              </li>
              <li>
                <strong>Below 50%:</strong> Needs attention - Many items are
                pending or rejected
              </li>
            </ul>
          </div>
        </div>
      </Modal>

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
          {arrayPopup?.object ? (
            <div className="px-4 py-3">
              <RenderValue value={arrayPopup.object} />
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {arrayPopup?.items?.map((item, index) => (
                <div key={index} className="px-4 py-3 hover:bg-gray-50">
                  <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-2">
                    Item {index + 1}
                  </div>
                  <RenderValue value={item} depth={1} />
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>

      {/* Record detail drawer — the schema-driven RecordView (engine + hero) */}
      <Drawer
        open={!!recordDrawer}
        onClose={() => setRecordDrawer(null)}
        width={920}
        title={recordDrawer?._filename}
        styles={{ body: { background: "#f9fafb" } }}
        destroyOnClose
      >
        {recordDrawer && (
          <RecordView
            data={recordDrawer._record ?? recordDrawer}
            schema={previewData?.preview?.schema as never}
            slug={recordDrawer._slug ?? undefined}
            trust={{
              verification:
                recordDrawer._reviewStatus === "approved"
                  ? "approved"
                  : recordDrawer._reviewStatus === "rejected"
                    ? "rejected"
                    : "pending",
              qa: null,
            }}
          />
        )}
      </Drawer>

      {/* Wellbore Diagram Drawer */}
      <WellboreDiagramDrawer
        open={wellboreModalOpen}
        onClose={() => {
          setWellboreModalOpen(false);
          setSelectedWellData(null);
          setSelectedFilename("");
        }}
        data={selectedWellData}
        filename={selectedFilename}
        previewId={previewId}
      />

      {/* Core Extract Footer Signature */}
      <div className="border-t border-gray-100 px-6 py-3 flex-shrink-0">
        <div className="flex items-center justify-center space-x-2 text-gray-400">
          <span className="text-sm">
            Powered by{" "}
            <a
              href="#"
              className="text-blue-600 hover:text-blue-800 transition-colors duration-200"
              onClick={(e) => {
                e.preventDefault();
                window.open("https://coreextract.app", "_blank");
              }}
            >
              Core Extract
            </a>
          </span>
        </div>
      </div>
    </div>
  );
};

export default PreviewPage;
