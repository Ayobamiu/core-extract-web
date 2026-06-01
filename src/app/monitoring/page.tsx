"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Card, Table, Tag, Input, Select, Tooltip, Spin } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  AlertTriangle,
  Scissors,
  FileText,
  Activity,
  RefreshCw,
  Search,
} from "lucide-react";
import SidebarLayout from "@/components/layout/SidebarLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { apiClient } from "@/lib/api";
import type { MonitoringSection, MonitoringSummary } from "@/lib/api";

/* ── helpers ─────────────────────────────────────────────── */

function formatTokens(n: number | null): string {
  if (n == null) return "-";
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatDuration(ms: number | null): string {
  if (ms == null) return "-";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function pageRangeLabel(pr: [number | null, number | null] | null): string {
  if (!pr) return "-";
  const [a, b] = pr;
  if (a == null && b == null) return "-";
  if (a === b) return `p${a}`;
  return `p${a ?? "?"}-${b ?? "?"}`;
}

/* ── summary card ─────────────────────────────────────────── */

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
  subtitle,
}: {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  subtitle?: string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-start gap-3 min-w-0">
      <div
        className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${color}`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-gray-900 leading-tight">
          {value}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">{label}</p>
        {subtitle && (
          <p className="text-[11px] text-gray-400 mt-0.5">{subtitle}</p>
        )}
      </div>
    </div>
  );
}

/* ── main page ────────────────────────────────────────────── */

export default function MonitoringPage() {
  const [sections, setSections] = useState<MonitoringSection[]>([]);
  const [summary, setSummary] = useState<MonitoringSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.getMonitoringSections({ limit: 500 });
      if (res.status === "success" && res.data) {
        setSections(res.data.sections);
        setSummary(res.data.summary);
      }
    } catch (err) {
      console.error("Monitoring fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ── filtered rows ── */
  const filteredSections = sections.filter((s) => {
    if (searchText) {
      const q = searchText.toLowerCase();
      const matchesFile = s.filename?.toLowerCase().includes(q);
      const matchesSlug = s.slug?.toLowerCase().includes(q);
      const matchesJob = s.job_name?.toLowerCase().includes(q);
      const matchesRecord = s.record_id?.toLowerCase().includes(q);
      if (!matchesFile && !matchesSlug && !matchesJob && !matchesRecord)
        return false;
    }
    if (statusFilter !== "all" && s.status !== statusFilter) return false;
    if (flagFilter === "large" && !s.large_section) return false;
    if (flagFilter === "truncated" && !s.response_truncated) return false;
    if (flagFilter === "flagged" && !s.large_section && !s.response_truncated)
      return false;
    return true;
  });

  /* ── columns ── */
  const columns: ColumnsType<MonitoringSection> = [
    {
      title: "File",
      key: "file",
      width: 200,
      ellipsis: true,
      render: (_, r) => (
        <Tooltip title={`Job: ${r.job_name}`}>
          <span className="text-xs font-medium text-gray-800 cursor-default">
            {r.filename}
          </span>
        </Tooltip>
      ),
    },
    {
      title: "Section",
      key: "section",
      width: 160,
      render: (_, r) => (
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-gray-900">
            {r.slug}
          </span>
          {r.record_id && (
            <span className="text-[10px] text-gray-400">{r.record_id}</span>
          )}
        </div>
      ),
    },
    {
      title: "Pages",
      key: "pages",
      width: 90,
      render: (_, r) => (
        <span className="text-xs text-gray-600">
          {pageRangeLabel(r.page_range)}{" "}
          <span className="text-gray-400">({r.section_page_count}p)</span>
        </span>
      ),
    },
    {
      title: "Est. Tokens",
      dataIndex: "estimated_input_tokens",
      key: "tokens",
      width: 100,
      sorter: (a, b) =>
        (a.estimated_input_tokens ?? 0) - (b.estimated_input_tokens ?? 0),
      render: (v: number | null) => (
        <span
          className={`text-xs font-mono ${v && v > 25000 ? "text-amber-600 font-semibold" : "text-gray-600"}`}
        >
          {formatTokens(v)}
        </span>
      ),
    },
    {
      title: "Duration",
      dataIndex: "duration_ms",
      key: "duration",
      width: 80,
      sorter: (a, b) => (a.duration_ms ?? 0) - (b.duration_ms ?? 0),
      render: (v: number | null) => (
        <span className="text-xs text-gray-600">{formatDuration(v)}</span>
      ),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 90,
      render: (v: string) => {
        const colorMap: Record<string, string> = {
          success: "green",
          failed: "red",
          skipped_no_schema: "orange",
          skipped_no_content: "default",
          skipped_no_pages: "default",
        };
        return (
          <Tag color={colorMap[v] ?? "default"} className="text-[10px]">
            {v}
          </Tag>
        );
      },
    },
    {
      title: "Flags",
      key: "flags",
      width: 130,
      render: (_, r) => (
        <div className="flex items-center gap-1.5">
          {r.large_section && (
            <Tooltip title="Large section — may need chunking">
              <Tag
                color="warning"
                className="text-[10px] flex items-center gap-1 !m-0"
              >
                <AlertTriangle className="w-3 h-3" />
                Large
              </Tag>
            </Tooltip>
          )}
          {r.response_truncated && (
            <Tooltip title="AI response was truncated (finish_reason=length)">
              <Tag
                color="error"
                className="text-[10px] flex items-center gap-1 !m-0"
              >
                <Scissors className="w-3 h-3" />
                Truncated
              </Tag>
            </Tooltip>
          )}
          {!r.large_section && !r.response_truncated && (
            <span className="text-[10px] text-gray-300">-</span>
          )}
        </div>
      ),
    },
    {
      title: "Error",
      dataIndex: "error",
      key: "error",
      width: 180,
      ellipsis: true,
      render: (v: string | null) =>
        v ? (
          <Tooltip title={v}>
            <span className="text-[10px] text-red-500">{v}</span>
          </Tooltip>
        ) : (
          <span className="text-[10px] text-gray-300">-</span>
        ),
    },
  ];

  return (
    <ProtectedRoute>
      <SidebarLayout pageTitle="Section Monitoring">
        <div className="max-w-[1400px] mx-auto space-y-5">
          {/* header */}
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Section Monitoring
              </h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Track large sections, truncated responses, and extraction health
                across all files.
              </p>
            </div>
            <button
              type="button"
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>

          {/* summary cards */}
          {summary && (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              <SummaryCard
                label="Total Sections"
                value={summary.total_sections}
                icon={FileText}
                color="bg-blue-50 text-blue-600"
              />
              <SummaryCard
                label="Large Sections"
                value={summary.large_sections}
                icon={AlertTriangle}
                color="bg-amber-50 text-amber-600"
                subtitle={
                  summary.total_sections > 0
                    ? `${((summary.large_sections / summary.total_sections) * 100).toFixed(1)}%`
                    : undefined
                }
              />
              <SummaryCard
                label="Truncated"
                value={summary.truncated}
                icon={Scissors}
                color="bg-red-50 text-red-600"
                subtitle={
                  summary.total_sections > 0
                    ? `${((summary.truncated / summary.total_sections) * 100).toFixed(1)}%`
                    : undefined
                }
              />
              <SummaryCard
                label="Failed"
                value={summary.failed}
                icon={AlertTriangle}
                color="bg-rose-50 text-rose-600"
              />
              <SummaryCard
                label="Avg Tokens"
                value={formatTokens(summary.avg_estimated_tokens)}
                icon={Activity}
                color="bg-purple-50 text-purple-600"
              />
              <SummaryCard
                label="Max Tokens"
                value={formatTokens(summary.max_estimated_tokens)}
                icon={Activity}
                color="bg-indigo-50 text-indigo-600"
              />
            </div>
          )}

          {/* filters */}
          <Card size="small" className="!shadow-none !border-gray-200">
            <div className="flex items-center gap-3 flex-wrap">
              <Input
                placeholder="Search file, section, job..."
                prefix={<Search className="w-3.5 h-3.5 text-gray-400" />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
                className="!w-60"
                size="small"
              />
              <Select
                size="small"
                value={statusFilter}
                onChange={setStatusFilter}
                className="!w-36"
                options={[
                  { value: "all", label: "All statuses" },
                  { value: "success", label: "Success" },
                  { value: "failed", label: "Failed" },
                  { value: "skipped_no_schema", label: "No schema" },
                  { value: "skipped_no_content", label: "No content" },
                  { value: "skipped_no_pages", label: "No pages" },
                ]}
              />
              <Select
                size="small"
                value={flagFilter}
                onChange={setFlagFilter}
                className="!w-36"
                options={[
                  { value: "all", label: "All flags" },
                  { value: "flagged", label: "Any flag" },
                  { value: "large", label: "Large only" },
                  { value: "truncated", label: "Truncated only" },
                ]}
              />
              <span className="text-[11px] text-gray-400 ml-auto">
                {filteredSections.length} of {sections.length} sections
              </span>
            </div>
          </Card>

          {/* table */}
          <Card
            size="small"
            className="!shadow-none !border-gray-200"
            styles={{ body: { padding: 0 } }}
          >
            {loading && sections.length === 0 ? (
              <div className="flex items-center justify-center h-48">
                <Spin />
              </div>
            ) : (
              <Table
                dataSource={filteredSections}
                columns={columns}
                rowKey={(r) =>
                  `${r.file_id}-${r.slug}-${r.record_id ?? ""}-${r.extraction_pages?.[0] ?? ""}`
                }
                size="small"
                pagination={{
                  pageSize: 50,
                  showSizeChanger: true,
                  pageSizeOptions: ["25", "50", "100", "200"],
                  showTotal: (total) => (
                    <span className="text-xs text-gray-500">
                      {total} sections
                    </span>
                  ),
                }}
                scroll={{ x: 1000 }}
                rowClassName={(r) =>
                  r.response_truncated
                    ? "!bg-red-50/50"
                    : r.large_section
                      ? "!bg-amber-50/30"
                      : ""
                }
              />
            )}
          </Card>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
