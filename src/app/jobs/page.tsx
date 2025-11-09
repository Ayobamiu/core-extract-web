"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Table,
  Card,
  Button,
  Tag,
  Space,
  Tooltip,
  Dropdown,
  Menu,
  Input,
  Select,
  DatePicker,
  Statistic,
  Row,
  Col,
  Badge,
  Typography,
  Spin,
  Empty,
} from "antd";
import {
  Eye,
  MoreHorizontal,
  Calendar,
  Clock,
  FileText,
  CheckCircle,
  XCircle,
  Loader,
  Filter,
  Search,
  Download,
  RefreshCw,
  Briefcase,
  ArrowRight,
} from "lucide-react";
import { apiClient, Job, QueueStats } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { ArrowsPointingOutIcon } from "@heroicons/react/24/outline";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface JobWithStats extends Job {
  totalFiles: number;
  completedFiles: number;
  failedFiles: number;
  avgProcessingTime?: number;
}

export default function JobsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const isAdmin = canPerformAdminActions(user);
  const [jobs, setJobs] = useState<JobWithStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<any>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  console.log({ jobs });

  const fetchJobs = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getJobs(30);
      setJobs(response.jobs || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch jobs");
      setJobs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchQueueStats = async () => {
    try {
      const response = await apiClient.getQueueStats();
      setQueueStats(response?.data || null);
    } catch (err) {
      console.error("Failed to fetch queue stats:", err);
    }
  };
  useEffect(() => {
    fetchJobs();
    fetchQueueStats();
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle
            aria-label="Completed"
            className="w-4 h-4 text-green-500"
          />
        );
      case "processing":
        return (
          <Loader
            aria-label="Processing"
            className="w-4 h-4 animate-spin text-yellow-500"
          />
        );
      case "failed":
        return <XCircle aria-label="Failed" className="w-4 h-4 text-red-500" />;
      case "queued":
        return <Clock aria-label="Queued" className="w-4 h-4 text-gray-500" />;
      default:
        return <Clock aria-label="Pending" className="w-4 h-4 text-gray-500" />;
    }
  };

  const columns = [
    {
      title: "Job ID",
      dataIndex: "id",
      key: "id",
      width: 120,
      ellipsis: true,
      truncate: true,
      render: (id: string) => (
        <div className="font-mono text-xs text-gray-600">
          <Button
            type="text"
            size="small"
            icon={<ArrowsPointingOutIcon className="w-4 h-4 mr-1" />}
            onClick={() => router.push(`/jobs/${id}`)}
          />
          <span className="truncate">{id}</span>
        </div>
      ),
    },
    {
      width: 120,
      title: "Job Name",
      dataIndex: "name",
      key: "name",
      ellipsis: true,
      render: (text: string) => (
        <div className=" text-gray-900 truncate" title={text}>
          {text}
        </div>
      ),
      sorter: (a: JobWithStats, b: JobWithStats) =>
        a.name.localeCompare(b.name),
    },
    {
      title: "Status",
      dataIndex: "status",
      key: "status",
      width: 100,
      render: (status: string) => (
        <div title={status} className="flex items-center gap-1">
          <Tooltip title={status.charAt(0).toUpperCase() + status.slice(1)}>
            {getStatusIcon(status)}
          </Tooltip>
        </div>
      ),
      filters: [
        { text: "Completed", value: "completed" },
        { text: "Processing", value: "processing" },
        { text: "Failed", value: "failed" },
        { text: "Queued", value: "queued" },
      ],
      onFilter: (value: any, record: JobWithStats) => record.status === value,
    },
    {
      title: "Files",
      key: "file_count",
      width: 80,
      render: (record: JobWithStats) => (
        <div className=" text-sm">{record.file_count}</div>
      ),
      sorter: (a: JobWithStats, b: JobWithStats) => a.totalFiles - b.totalFiles,
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 100,
      render: (date: string) => (
        <div className="">
          {new Date(date).toLocaleDateString()}{" "}
          {new Date(date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ),
      sorter: (a: JobWithStats, b: JobWithStats) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch = job.name
      .toLowerCase()
      .includes(searchText.toLowerCase());
    const matchesStatus = statusFilter === "all" || job.status === statusFilter;
    const matchesDate =
      !dateRange ||
      (new Date(job.created_at) >= dateRange[0].startOf("day") &&
        new Date(job.created_at) <= dateRange[1].endOf("day"));

    return matchesSearch && matchesStatus && matchesDate;
  });

  if (loading) {
    return (
      <ProtectedRoute>
        <SidebarLayout
          pageTitle="Jobs"
          pageDescription="Monitor and manage your document processing jobs"
        >
          <div className="flex items-center justify-center h-64">
            <Spin size="large" />
          </div>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  if (error) {
    return (
      <ProtectedRoute>
        <SidebarLayout
          pageTitle="Jobs"
          pageDescription="Monitor and manage your document processing jobs"
        >
          <Card>
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={fetchJobs}>
                Retry
              </Button>
            </Empty>
          </Card>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarLayout
        pageTitle="Jobs"
        pageDescription="Monitor and manage your document processing jobs"
      >
        <div className="space-y-4">
          {/* Stats Cards */}
          {queueStats && (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Total Jobs"
                    value={jobs.length}
                    prefix={<Briefcase className="w-4 h-4" />}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Processing"
                    value={jobs.filter((j) => j.status === "processing").length}
                    prefix={<Loader className="w-4 h-4" />}
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Completed"
                    value={jobs.filter((j) => j.status === "completed").length}
                    prefix={<CheckCircle className="w-4 h-4" />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card size="small">
                  <Statistic
                    title="Queue Size"
                    value={queueStats.queueSize}
                    prefix={<Clock className="w-4 h-4" />}
                    valueStyle={{ color: "#faad14" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Filters and Actions */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search jobs..."
              prefix={<Search className="w-4 h-6" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
              size="small"
            />
            <Select
              placeholder="Status"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-32"
              size="small"
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="processing">Processing</Select.Option>
              <Select.Option value="failed">Failed</Select.Option>
              <Select.Option value="queued">Queued</Select.Option>
            </Select>
            <RangePicker
              placeholder={["Start Date", "End Date"]}
              value={dateRange}
              onChange={setDateRange}
              size="small"
            />
            <Button
              icon={<RefreshCw className="w-4 h-6" />}
              onClick={fetchJobs}
              size="small"
            >
              Refresh
            </Button>
            <div className="flex-1" />
            {isAdmin && (
              <Button
                type="primary"
                size="small"
                onClick={() => router.push("/upload")}
              >
                <FileText className="w-4 h-6 mr-2" />
                New Job
              </Button>
            )}
          </div>

          {/* Jobs Table */}
          {/* <div className="bg-white rounded-lg border"> */}
          <Table
            columns={columns}
            dataSource={filteredJobs}
            rowKey="id"
            pagination={{
              pageSize: 20,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) =>
                `${range[0]}-${range[1]} of ${total} jobs`,
              size: "small",
            }}
            scroll={{ x: 800 }}
            size="small"
            className="border border-gray-200 ant-table-custom"
          />
          {/* </div> */}
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
