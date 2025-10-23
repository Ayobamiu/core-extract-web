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
  Progress,
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
  Upload,
  Trash2,
  RotateCcw,
  BarChart3,
} from "lucide-react";
import { apiClient, Job, QueueStats } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import SidebarLayout from "@/components/layout/SidebarLayout";
import { ArrowsAltOutlined } from "@ant-design/icons";

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

interface FileWithJob {
  id: string;
  filename: string;
  size: number;
  extraction_status: string;
  processing_status: string;
  extraction_time_seconds?: number;
  ai_processing_time_seconds?: number;
  created_at: string;
  processed_at?: string;
  job_id?: string;
  job_name?: string;
  result?: any;
  extraction_error?: string;
  processing_error?: string;
}

export default function FilesPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { currentOrganization } = useOrganization();
  const [files, setFiles] = useState<FileWithJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dateRange, setDateRange] = useState<any>(null);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);

  console.log({ files });
  const fetchFiles = async () => {
    try {
      setLoading(true);
      const response = await apiClient.getAllFiles(100);
      console.log({ response });
      setFiles(response.files || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to fetch files");
      setFiles([]);
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
    fetchFiles();
    fetchQueueStats();
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "success";
      case "processing":
        return "processing";
      case "failed":
        return "error";
      case "pending":
        return "default";
      default:
        return "default";
    }
  };

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
  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds.toFixed(1)}s`;
    if (seconds < 3600) return `${(seconds / 60).toFixed(1)}m`;
    return `${(seconds / 3600).toFixed(1)}h`;
  };

  const columns = [
    {
      title: "File ID",
      dataIndex: "id",
      key: "id",
      width: 100,
      ellipsis: true,
      render: (id: string) => (
        <div className="font-mono text-gray-600">{id.slice(0, 8)}...</div>
      ),
    },
    {
      title: "File Name",
      dataIndex: "filename",
      key: "filename",
      ellipsis: true,
      width: 100,
      render: (text: string) => (
        <div className="text-gray-900 truncate" title={text}>
          {text}
        </div>
      ),
      sorter: (a: FileWithJob, b: FileWithJob) =>
        a.filename.localeCompare(b.filename),
    },
    {
      title: "Job",
      dataIndex: "job_name",
      key: "job_name",
      width: 100,
      ellipsis: true,
      render: (jobName: string, record: FileWithJob) => (
        <div className="text-sm text-gray-600 truncate" title={jobName}>
          <Button
            type="text"
            size="small"
            icon={<ArrowsAltOutlined className="w-4 h-4 mr-1" />}
            onClick={() => router.push(`/jobs/${record.job_id}`)}
          />
          <span className="truncate">{record.job_name}</span>
        </div>
      ),
    },
    {
      title: "Size",
      dataIndex: "size",
      key: "size",
      width: 80,
      render: (size: number) => (
        <div className="font-mono text-sm">{formatFileSize(size)}</div>
      ),
      sorter: (a: FileWithJob, b: FileWithJob) => a.size - b.size,
    },
    {
      title: "Extraction",
      dataIndex: "extraction_status",
      key: "extraction_status",
      width: 70,
      render: (status: string) => (
        <div className="flex items-center gap-1 justify-center">
          <Tooltip title={status.charAt(0).toUpperCase() + status.slice(1)}>
            {getStatusIcon(status)}
          </Tooltip>
        </div>
      ),
      filters: [
        { text: "Completed", value: "completed" },
        { text: "Processing", value: "processing" },
        { text: "Failed", value: "failed" },
        { text: "Pending", value: "pending" },
      ],
      onFilter: (value: any, record: FileWithJob) =>
        record.extraction_status === value,
    },
    {
      title: "Processing",
      dataIndex: "processing_status",
      key: "processing_status",
      width: 80,
      render: (status: string) => (
        <div className="flex items-center gap-1 ">
          <Tooltip title={status.charAt(0).toUpperCase() + status.slice(1)}>
            {getStatusIcon(status)}
          </Tooltip>
        </div>
      ),
      filters: [
        { text: "Completed", value: "completed" },
        { text: "Processing", value: "processing" },
        { text: "Failed", value: "failed" },
        { text: "Pending", value: "pending" },
      ],
      onFilter: (value: any, record: FileWithJob) =>
        record.processing_status === value,
    },
    {
      title: "Total Time",
      key: "processingTime",
      width: 80,
      render: (record: FileWithJob) => {
        const extractionTime = record.extraction_time_seconds || 0;
        const aiTime = record.ai_processing_time_seconds || 0;
        const totalTime = extractionTime + aiTime;
        return (
          <div className="text-sm">
            {totalTime > 0 ? formatDuration(totalTime) : "-"}
          </div>
        );
      },
      sorter: (a: FileWithJob, b: FileWithJob) => {
        const aTime =
          (a.extraction_time_seconds || 0) +
          (a.ai_processing_time_seconds || 0);
        const bTime =
          (b.extraction_time_seconds || 0) +
          (b.ai_processing_time_seconds || 0);
        return aTime - bTime;
      },
    },
    {
      title: "Created",
      dataIndex: "created_at",
      key: "created_at",
      width: 120,
      render: (date: string) => (
        <div className="text-sm">
          {new Date(date).toLocaleDateString()}{" "}
          {new Date(date).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      ),
      sorter: (a: FileWithJob, b: FileWithJob) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    },
  ];

  const filteredFiles = files.filter((file) => {
    const matchesSearch =
      file.filename.toLowerCase().includes(searchText.toLowerCase()) ||
      file.job_name?.toLowerCase().includes(searchText.toLowerCase());
    const matchesStatus =
      statusFilter === "all" ||
      file.extraction_status === statusFilter ||
      file.processing_status === statusFilter;
    const matchesDate =
      !dateRange ||
      (new Date(file.created_at) >= dateRange[0].startOf("day") &&
        new Date(file.created_at) <= dateRange[1].endOf("day"));

    return matchesSearch && matchesStatus && matchesDate;
  });

  const stats = {
    total: files.length,
    completed: files.filter((f) => f.processing_status === "completed").length,
    processing: files.filter((f) => f.processing_status === "processing")
      .length,
    failed: files.filter((f) => f.processing_status === "failed").length,
    avgProcessingTime:
      files.reduce((acc, file) => {
        const extractionTime = file.extraction_time_seconds || 0;
        const aiTime = file.ai_processing_time_seconds || 0;
        return acc + extractionTime + aiTime;
      }, 0) / files.length,
  };

  if (loading) {
    return (
      <ProtectedRoute>
        <SidebarLayout>
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
        <SidebarLayout>
          <Card>
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={fetchFiles}>
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
        pageTitle="Files"
        pageDescription="Manage and monitor your document files"
      >
        <div className="flex flex-col h-full space-y-4">
          {/* Stats Cards */}
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Total Files"
                  value={stats.total}
                  prefix={<FileText className="w-4 h-4" />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Completed"
                  value={stats.completed}
                  prefix={<CheckCircle className="w-4 h-4" />}
                  valueStyle={{ color: "#52c41a" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Processing"
                  value={stats.processing}
                  prefix={<Loader className="w-4 h-4" />}
                  valueStyle={{ color: "#1890ff" }}
                />
              </Card>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Card size="small">
                <Statistic
                  title="Failed"
                  value={stats.failed}
                  prefix={<XCircle className="w-4 h-4" />}
                  valueStyle={{ color: "#ff4d4f" }}
                />
              </Card>
            </Col>
          </Row>

          {/* Filters and Actions */}
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search files..."
              prefix={<Search className="w-4 h-4" />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-64"
            />
            <Select
              placeholder="Filter by status"
              value={statusFilter}
              onChange={setStatusFilter}
              className="w-40"
            >
              <Select.Option value="all">All Status</Select.Option>
              <Select.Option value="completed">Completed</Select.Option>
              <Select.Option value="processing">Processing</Select.Option>
              <Select.Option value="failed">Failed</Select.Option>
              <Select.Option value="pending">Pending</Select.Option>
            </Select>
            <RangePicker
              placeholder={["Start Date", "End Date"]}
              value={dateRange}
              onChange={setDateRange}
              className="w-64"
            />
            <Button
              icon={<RefreshCw className="w-4 h-4" />}
              onClick={fetchFiles}
            >
              Refresh
            </Button>
            <div className="flex-1" />
            <Button
              type="primary"
              icon={<Upload className="w-4 h-4" />}
              onClick={() => router.push("/upload")}
            >
              Upload Files
            </Button>
          </div>

          {/* Files Table */}
          <div className="border border-gray-200 rounded-lg flex-1">
            <Table
              columns={columns}
              dataSource={filteredFiles}
              rowKey="id"
              size="small"
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                showQuickJumper: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} of ${total} files`,
              }}
              scroll={{ x: 300, y: "calc(100vh - 380px)" }}
            />
          </div>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
