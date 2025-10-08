"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import QueueStatsCard from "@/components/dashboard/QueueStatsCard";
import JobsList from "@/components/dashboard/JobsList";
import Navigation from "@/components/layout/Navigation";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import { useAuth } from "@/contexts/AuthContext";
import { useOrganization } from "@/contexts/OrganizationContext";
import { apiClient, QueueStats, QueueStatus, QueueAnalytics } from "@/lib/api";

export default function Dashboard() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const { currentOrganization, isLoadingOrganizations } = useOrganization();
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent>
            <div className="text-center">
              <div className="text-red-600 text-6xl mb-4">⚠️</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                Connection Error
              </h2>
              <p className="text-gray-600 mb-4">{error}</p>
              <Button onClick={fetchData} variant="primary">
                Retry Connection
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Check if user has no organizations (shouldn't happen with auto-creation)
  if (isAuthenticated && !isLoadingOrganizations && !currentOrganization) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent>
            <div className="text-center">
              <div className="text-yellow-600 text-6xl mb-4">🏢</div>
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                No Organization Found
              </h2>
              <p className="text-gray-600 mb-4">
                You need to be part of an organization to access jobs and files.
              </p>
              <Button
                onClick={() => window.location.reload()}
                variant="primary"
              >
                Refresh Page
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-gray-50">
        <Navigation />

        {/* Main Content */}
        <main className="p-6">
          {/* Welcome Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">
              Welcome back, {user?.name}!
            </h1>
            <p className="text-gray-600">
              {currentOrganization
                ? `Monitor your document processing jobs for ${currentOrganization.name}`
                : "Monitor your document processing jobs"}
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-1 gap-6">
            {/* Queue Stats - Only show if user has an organization */}
            {currentOrganization && queueStats && (
              <div>
                <QueueStatsCard stats={queueStats} />
              </div>
            )}
          </div>

          {/* Analytics Section - Only show if user has an organization */}
          {currentOrganization && queueAnalytics && (
            <div className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Processing Analytics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {queueAnalytics.queueSize}
                      </div>
                      <div className="text-sm text-gray-500">Queue Size</div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {queueAnalytics.processingFiles}
                      </div>
                      <div className="text-sm text-gray-500">Processing</div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-yellow-600">
                        {queueAnalytics.avgProcessingTimeMs.toFixed(0)}ms
                      </div>
                      <div className="text-sm text-gray-500">
                        Avg Processing Time
                      </div>
                    </div>

                    <div className="text-center">
                      <div className="text-3xl font-bold text-purple-600">
                        {queueAnalytics.queueUtilization.toFixed(1)}%
                      </div>
                      <div className="text-sm text-gray-500">
                        Queue Utilization
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Jobs List - Only show if user has an organization */}
          {currentOrganization ? (
            <div className="mt-6">
              <JobsList />
            </div>
          ) : (
            <div className="mt-6">
              <Card className="p-8 text-center">
                <div className="max-w-md mx-auto">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                      />
                    </svg>
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Organization Selected
                  </h3>
                  <p className="text-gray-600 mb-6">
                    You need to be part of an organization to access jobs and
                    files. Create a new organization or ask your administrator
                    to invite you.
                  </p>
                  <div className="space-y-3">
                    <Button
                      onClick={() => {
                        /* This will be handled by the organization selector */
                      }}
                      className="w-full"
                    >
                      Create Organization
                    </Button>
                    <p className="text-sm text-gray-500">
                      Or select an existing organization from the dropdown above
                    </p>
                  </div>
                </div>
              </Card>
            </div>
          )}

          {/* System Status */}
          <div className="mt-6">
            <Card>
              <CardHeader>
                <CardTitle>System Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center space-x-3">
                    <StatusIndicator status="success">Healthy</StatusIndicator>
                    <span className="text-sm text-gray-600">API Server</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <StatusIndicator status="success">
                      Connected
                    </StatusIndicator>
                    <span className="text-sm text-gray-600">Redis Queue</span>
                  </div>

                  <div className="flex items-center space-x-3">
                    <StatusIndicator status="success">Active</StatusIndicator>
                    <span className="text-sm text-gray-600">
                      Worker Process
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </ProtectedRoute>
  );
}
