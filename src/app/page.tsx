"use client";

import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import QueueStatsCard from "@/components/dashboard/QueueStatsCard";
import QueueControls from "@/components/dashboard/QueueControls";
import { apiClient, QueueStats, QueueStatus, QueueAnalytics } from "@/lib/api";

export default function Dashboard() {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [queueAnalytics, setQueueAnalytics] = useState<QueueAnalytics | null>(
    null
  );
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    paused: false,
    status: "running",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    // try {
    //   setError(null);
    //   const [statsResponse, analyticsResponse, statusResponse] =
    //     await Promise.all([
    //       apiClient.getQueueStats(),
    //       apiClient.getQueueAnalytics(),
    //       apiClient.getQueueStatus(),
    //     ]);
    //   setQueueStats(statsResponse.data);
    //   setQueueAnalytics(analyticsResponse.data);
    //   setQueueStatus(statusResponse.data.queueStatus);
    // } catch (err) {
    //   setError(err instanceof Error ? err.message : "Failed to fetch data");
    // } finally {
    //   setLoading(false);
    // }
  };

  useEffect(() => {
    fetchData();

    // Set up polling for real-time updates
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds

    return () => clearInterval(interval);
  }, []);

  const handleQueueStatusChange = (newStatus: QueueStatus) => {
    setQueueStatus(newStatus);
  };

  if (loading) {
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Document Extractor Dashboard
            </h1>
            <p className="text-gray-600">Real-time processing monitor</p>
          </div>
          <div className="flex items-center space-x-4">
            <StatusIndicator status="success">Connected</StatusIndicator>
            <Button variant="secondary" size="sm">
              Settings
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Queue Stats */}
          <div className="lg:col-span-2">
            {queueStats && <QueueStatsCard stats={queueStats} />}
          </div>

          {/* Queue Controls */}
          <div>
            <QueueControls
              queueStatus={queueStatus}
              onStatusChange={handleQueueStatusChange}
            />
          </div>
        </div>

        {/* Analytics Section */}
        {queueAnalytics && (
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
                  <StatusIndicator status="success">Connected</StatusIndicator>
                  <span className="text-sm text-gray-600">Redis Queue</span>
                </div>

                <div className="flex items-center space-x-3">
                  <StatusIndicator status="success">Active</StatusIndicator>
                  <span className="text-sm text-gray-600">Worker Process</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
