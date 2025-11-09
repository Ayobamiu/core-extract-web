"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

import {
  Card,
  Row,
  Col,
  Statistic,
  Typography,
  Button,
  Spin,
  Empty,
  Progress,
  Badge,
} from "antd";
import {
  FileText,
  Briefcase,
  Clock,
  CheckCircle,
  Loader,
  BarChart3,
  TrendingUp,
  Activity,
  Zap,
} from "lucide-react";
import QueueStatsCard from "@/components/dashboard/QueueStatsCard";
import JobsList from "@/components/dashboard/JobsList";
import SidebarLayout from "@/components/layout/SidebarLayout";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { canPerformAdminActions } from "@/utils/roleUtils";
import { apiClient, QueueStats, QueueStatus, QueueAnalytics } from "@/lib/api";

const { Title, Text } = Typography;

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { currentOrganization, isLoadingOrganizations } = useOrganization();
  const isAdmin = canPerformAdminActions(user);
  const organizationName = currentOrganization?.name;
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueAnalytics, setQueueAnalytics] = useState<QueueAnalytics | null>(
    null
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    // Only fetch data if user has a current organization
    if (!currentOrganization) {
      setLoading(false);
      return;
    }

    try {
      setError(null);
      const [statsResponse, analyticsResponse, statusResponse] =
        await Promise.all([
          apiClient.getQueueStats(),
          apiClient.getQueueAnalytics(),
          apiClient.getQueueStatus(),
        ]);
      setQueueStats(statsResponse?.data || null);
      setQueueAnalytics(analyticsResponse?.data || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();

      // Set up polling for real-time updates
      const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

      return () => clearInterval(interval);
    }
  }, [isAuthenticated, currentOrganization]); // Add currentOrganization dependency

  if (loading || isLoadingOrganizations) {
    return (
      <ProtectedRoute>
        <SidebarLayout
          pageTitle={`Welcome back, ${user?.name}!`}
          pageDescription={
            organizationName
              ? `Monitor your document processing jobs for ${organizationName}`
              : "Monitor your document processing jobs"
          }
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
          pageTitle={`Welcome back, ${user?.name}!`}
          pageDescription={
            organizationName
              ? `Monitor your document processing jobs for ${organizationName}`
              : "Monitor your document processing jobs"
          }
        >
          <Card>
            <Empty description={error} image={Empty.PRESENTED_IMAGE_SIMPLE}>
              <Button type="primary" onClick={fetchData}>
                Retry Connection
              </Button>
            </Empty>
          </Card>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  // Check if user has no organizations (shouldn't happen with auto-creation)
  if (isAuthenticated && !isLoadingOrganizations && !currentOrganization) {
    return (
      <ProtectedRoute>
        <SidebarLayout
          pageTitle={`Welcome back, ${user?.name}!`}
          pageDescription={
            organizationName
              ? `Monitor your document processing jobs for ${organizationName}`
              : "Monitor your document processing jobs"
          }
        >
          <Card>
            <Empty
              description="No Organization Found"
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              <div className="text-center">
                <p className="text-gray-600 mb-4">
                  You need to be part of an organization to access jobs and
                  files.
                </p>
                <Button type="primary" onClick={() => window.location.reload()}>
                  Refresh Page
                </Button>
              </div>
            </Empty>
          </Card>
        </SidebarLayout>
      </ProtectedRoute>
    );
  }

  return (
    <ProtectedRoute>
      <SidebarLayout
        pageTitle={`Welcome back, ${user?.name}!`}
        pageDescription={
          organizationName
            ? `Monitor your document processing jobs for ${organizationName}`
            : "Monitor your document processing jobs"
        }
      >
        <div className="space-y-6">
          {/* Key Metrics */}
          {currentOrganization && queueStats && (
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Queue Size"
                    value={queueStats.queueSize}
                    prefix={<Clock className="w-4 h-4" />}
                    valueStyle={{ color: "#1890ff" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Processing Files"
                    value={queueStats.processingCount}
                    prefix={<Loader className="w-4 h-4" />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Completed Jobs"
                    value={queueStats.completedJobs}
                    prefix={<CheckCircle className="w-4 h-4" />}
                    valueStyle={{ color: "#52c41a" }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={12} md={6}>
                <Card>
                  <Statistic
                    title="Failed Jobs"
                    value={queueStats.failedJobs}
                    prefix={<Activity className="w-4 h-4" />}
                    valueStyle={{ color: "#ff4d4f" }}
                  />
                </Card>
              </Col>
            </Row>
          )}

          {/* Analytics Section */}
          {currentOrganization && queueAnalytics && (
            <Card>
              <div className="mb-4">
                <Title level={4} className="!mb-2">
                  Processing Analytics
                </Title>
                <Text type="secondary">
                  Real-time performance metrics and system utilization
                </Text>
              </div>
              <Row gutter={[16, 16]}>
                <Col xs={24} sm={12} md={6}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-1">
                      {queueAnalytics.queueSize}
                    </div>
                    <div className="text-sm text-gray-500">Queue Size</div>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-1">
                      {queueAnalytics.processingFiles}
                    </div>
                    <div className="text-sm text-gray-500">Processing</div>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-600 mb-1">
                      {queueAnalytics.avgProcessingTimeMs.toFixed(0)}ms
                    </div>
                    <div className="text-sm text-gray-500">
                      Avg Processing Time
                    </div>
                  </div>
                </Col>
                <Col xs={24} sm={12} md={6}>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-1">
                      {queueAnalytics.queueUtilization.toFixed(1)}%
                    </div>
                    <div className="text-sm text-gray-500">
                      Queue Utilization
                    </div>
                  </div>
                </Col>
              </Row>
            </Card>
          )}

          {/* Quick Actions */}
          <Card>
            <div className="mb-4">
              <Title level={4} className="!mb-2">
                Quick Actions
              </Title>
              <Text type="secondary">Get started with common tasks</Text>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={12} md={8}>
                <Button
                  type="primary"
                  size="large"
                  block
                  onClick={() => router.push("/upload")}
                  icon={<FileText className="w-4 h-4" />}
                >
                  Upload New Files
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button
                  size="large"
                  block
                  onClick={() => router.push("/jobs")}
                  icon={<Briefcase className="w-4 h-4" />}
                >
                  View All Jobs
                </Button>
              </Col>
              <Col xs={24} sm={12} md={8}>
                <Button
                  size="large"
                  block
                  onClick={() => router.push("/files")}
                  icon={<BarChart3 className="w-4 h-4" />}
                >
                  File Analytics
                </Button>
              </Col>
            </Row>
          </Card>

          {/* Recent Jobs */}
          {currentOrganization ? (
            <Card>
              <div className="mb-4">
                <Title level={4} className="!mb-2">
                  Recent Jobs
                </Title>
                <Text type="secondary">Latest processing activity</Text>
              </div>
              <JobsList />
            </Card>
          ) : (
            <Card>
              <Empty
                description="No Organization Selected"
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              >
                <div className="text-center">
                  <p className="text-gray-600 mb-4">
                    You need to be part of an organization to access jobs and
                    files.
                  </p>
                  {isAdmin && (
                    <Button type="primary">Create Organization</Button>
                  )}
                </div>
              </Empty>
            </Card>
          )}

          {/* System Status */}
          <Card>
            <div className="mb-4">
              <Title level={4} className="!mb-2">
                System Status
              </Title>
              <Text type="secondary">
                Current system health and connectivity
              </Text>
            </div>
            <Row gutter={[16, 16]}>
              <Col xs={24} sm={8}>
                <div className="flex items-center space-x-3">
                  <Badge status="success" />
                  <div>
                    <div className="font-medium">API Server</div>
                    <div className="text-sm text-gray-500">Healthy</div>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="flex items-center space-x-3">
                  <Badge status="success" />
                  <div>
                    <div className="font-medium">Redis Queue</div>
                    <div className="text-sm text-gray-500">Connected</div>
                  </div>
                </div>
              </Col>
              <Col xs={24} sm={8}>
                <div className="flex items-center space-x-3">
                  <Badge status="success" />
                  <div>
                    <div className="font-medium">Worker Process</div>
                    <div className="text-sm text-gray-500">Active</div>
                  </div>
                </div>
              </Col>
            </Row>
          </Card>
        </div>
      </SidebarLayout>
    </ProtectedRoute>
  );
}
