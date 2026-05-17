"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  Button,
  Card,
  Empty,
  Select,
  Spin,
  Statistic,
  Table,
  Tag,
  Typography,
} from "antd";
import type { ColumnsType } from "antd/es/table";
import { ArrowLeftOutlined, ReloadOutlined } from "@ant-design/icons";
import { apiClient, PreviewAnalyticsReport } from "@/lib/api";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { useAuth } from "@/contexts/AuthContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import moment from "moment";

const { Text, Title } = Typography;

function formatEventLabel(type: string) {
  const labels: Record<string, string> = {
    preview_visit: "Preview visit",
    well_view: "Well viewed",
    wellbore_open: "Diagram opened",
    wellbore_fullscreen: "Fullscreen / tab",
    wellbore_print: "Print view",
  };
  return labels[type] || type;
}

export default function PreviewAnalyticsPage() {
  const params = useParams();
  const previewId = params?.id as string;
  const { user } = useAuth();
  const isAdmin = canPerformAdminActions(user);

  const [days, setDays] = useState(30);
  const [report, setReport] = useState<PreviewAnalyticsReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!previewId) return;
    try {
      setLoading(true);
      setError(null);
      const res = await apiClient.getPreviewAnalytics(previewId, {
        days,
        sessionLimit: 75,
        eventLimit: 150,
      });
      if (res.success && res.data) {
        setReport(res.data);
      } else {
        setError(res.message || "Failed to load analytics");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to load analytics");
    } finally {
      setLoading(false);
    }
  }, [previewId, days]);

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin, load]);

  const topWellColumns: ColumnsType<PreviewAnalyticsReport["topWells"][0]> = [
    {
      title: "Well / file",
      dataIndex: "well_label",
      key: "well_label",
      ellipsis: true,
    },
    {
      title: "Views",
      dataIndex: "view_count",
      key: "view_count",
      width: 80,
      sorter: (a, b) => a.view_count - b.view_count,
    },
    {
      title: "Unique visitors",
      dataIndex: "unique_sessions",
      key: "unique_sessions",
      width: 120,
    },
    {
      title: "Last viewed",
      dataIndex: "last_viewed_at",
      key: "last_viewed_at",
      width: 160,
      render: (v: string) => moment(v).format("MMM D, HH:mm"),
    },
  ];

  const sessionColumns: ColumnsType<PreviewAnalyticsReport["sessions"][0]> = [
    {
      title: "Last seen",
      dataIndex: "last_seen_at",
      key: "last_seen_at",
      width: 150,
      render: (v: string) => moment(v).format("MMM D, HH:mm"),
    },
    {
      title: "IP",
      dataIndex: "ip_address",
      key: "ip_address",
      width: 130,
      render: (v: string | null, row) => (
        <span title={row.user_agent || undefined}>{v || "—"}</span>
      ),
    },
    {
      title: "Location",
      key: "location",
      width: 100,
      render: (_, row) => {
        const parts = [row.country_code, row.region].filter(Boolean);
        return parts.length ? parts.join(" · ") : "—";
      },
    },
    {
      title: "Events",
      dataIndex: "event_count",
      key: "event_count",
      width: 72,
    },
    {
      title: "Wellbore",
      dataIndex: "wellbore_event_count",
      key: "wellbore_event_count",
      width: 88,
      render: (n: number) =>
        n > 0 ? <Tag color="blue">{n}</Tag> : <Text type="secondary">0</Text>,
    },
    {
      title: "First seen",
      dataIndex: "first_seen_at",
      key: "first_seen_at",
      width: 150,
      render: (v: string) => moment(v).format("MMM D, HH:mm"),
    },
  ];

  const eventColumns: ColumnsType<PreviewAnalyticsReport["recentEvents"][0]> = [
    {
      title: "When",
      dataIndex: "created_at",
      key: "created_at",
      width: 150,
      render: (v: string) => moment(v).format("MMM D, HH:mm:ss"),
    },
    {
      title: "Event",
      dataIndex: "event_type",
      key: "event_type",
      width: 140,
      render: (t: string) => formatEventLabel(t),
    },
    {
      title: "Well",
      dataIndex: "well_label",
      key: "well_label",
      ellipsis: true,
      render: (v: string | null) => v || "—",
    },
    {
      title: "IP",
      dataIndex: "ip_address",
      key: "ip_address",
      width: 120,
      render: (v: string | null, row) => (
        <span>
          {v || "—"}
          {row.country_code ? ` (${row.country_code})` : ""}
        </span>
      ),
    },
  ];

  if (!isAdmin) {
    return (
      <ProtectedRoute>
        <SidebarLayout pageTitle="Preview monitoring">
          <Empty description="Admin access required" />
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarLayout
        pageTitle="Preview monitoring"
        headerActions={
          <div className="flex items-center gap-2">
            <Select
              size="small"
              value={days}
              onChange={setDays}
              options={[
                { value: 7, label: "Last 7 days" },
                { value: 30, label: "Last 30 days" },
                { value: 90, label: "Last 90 days" },
              ]}
              style={{ width: 130 }}
            />
            <Button
              size="small"
              icon={<ReloadOutlined />}
              onClick={load}
              loading={loading}
            >
              Refresh
            </Button>
            {report?.preview && (
              <Link href={`/preview/${previewId}`} target="_blank">
                <Button size="small" type="link">
                  Open preview
                </Button>
              </Link>
            )}
          </div>
        }
      >
        <div className="max-w-6xl mx-auto space-y-4 p-4">
          <Link
            href="/files"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeftOutlined className="mr-1" /> Back
          </Link>

          {report?.preview && (
            <div>
              <Title level={4} className="!mb-0">
                {report.preview.name}
              </Title>
              <Text type="secondary" className="text-xs font-mono">
                {report.preview.id}
              </Text>
            </div>
          )}

          {loading && !report ? (
            <div className="flex justify-center py-16">
              <Spin size="large" />
            </div>
          ) : error ? (
            <Empty description={error} />
          ) : report ? (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Card size="small">
                  <Statistic
                    title="Unique visitors"
                    value={report.summary.uniqueSessions}
                  />
                </Card>
                <Card size="small">
                  <Statistic
                    title="Preview visits"
                    value={report.summary.previewVisits}
                  />
                </Card>
                <Card size="small">
                  <Statistic
                    title="Wells viewed"
                    value={report.summary.uniqueWellsViewed}
                  />
                </Card>
                <Card size="small">
                  <Statistic
                    title="Wellbore usage"
                    value={report.summary.wellboreAdoptionRate}
                    suffix="%"
                  />
                  <Text type="secondary" className="text-xs">
                    {report.summary.sessionsUsingWellbore} of{" "}
                    {report.summary.uniqueSessions} sessions opened diagram
                  </Text>
                </Card>
              </div>

              {report.wellboreBreakdown.length > 0 && (
                <Card size="small" title="Wellbore diagram actions">
                  <div className="flex flex-wrap gap-2">
                    {report.wellboreBreakdown.map((row) => (
                      <Tag key={row.event_type}>
                        {formatEventLabel(row.event_type)}: {row.count}
                      </Tag>
                    ))}
                  </div>
                </Card>
              )}

              <Card size="small" title="Most viewed wells">
                <Table
                  size="small"
                  rowKey={(r) => `${r.job_file_id}-${r.well_label}`}
                  columns={topWellColumns}
                  dataSource={report.topWells}
                  pagination={false}
                  locale={{ emptyText: "No well views yet" }}
                />
              </Card>

              <Card size="small" title="Visitors (sessions)">
                <Table
                  size="small"
                  rowKey="id"
                  columns={sessionColumns}
                  dataSource={report.sessions}
                  pagination={{ pageSize: 15, size: "small" }}
                  scroll={{ x: 800 }}
                />
              </Card>

              <Card size="small" title="Recent activity">
                <Table
                  size="small"
                  rowKey="id"
                  columns={eventColumns}
                  dataSource={report.recentEvents}
                  pagination={{ pageSize: 20, size: "small" }}
                  scroll={{ x: 700 }}
                />
              </Card>
            </>
          ) : null}
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
