"use client";

import React from "react";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { QueueStats } from "@/lib/api";

interface QueueStatsCardProps {
  stats: QueueStats;
  className?: string;
}

const QueueStatsCard: React.FC<QueueStatsCardProps> = ({
  stats,
  className = "",
}) => {
  const { queueHealth } = stats.metrics;

  const getHealthColor = (score: number) => {
    if (score >= 75) return "success";
    if (score >= 50) return "warning";
    return "error";
  };

  const getHealthStatus = (score: number) => {
    if (score >= 75) return "Healthy";
    if (score >= 50) return "Warning";
    return "Critical";
  };

  const formatTime = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${(ms / 60000).toFixed(1)}m`;
  };

  return (
    <Card className={className} hover>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Queue Health</CardTitle>
          <StatusIndicator status={getHealthColor(queueHealth.score)}>
            {getHealthStatus(queueHealth.score)} ({queueHealth.score}/100)
          </StatusIndicator>
        </div>
      </CardHeader>

      <CardContent>
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.queueSize}
            </div>
            <div className="text-sm text-gray-500">Queued</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {stats.processingCount}
            </div>
            <div className="text-sm text-gray-500">Processing</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatTime(stats.metrics.avgWaitTimeMs)}
            </div>
            <div className="text-sm text-gray-500">Avg Wait</div>
          </div>

          <div className="text-center">
            <div className="text-2xl font-bold text-gray-900">
              {formatTime(stats.metrics.oldestItemAge)}
            </div>
            <div className="text-sm text-gray-500">Oldest Item</div>
          </div>
        </div>

        {stats.nextFiles.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm font-medium text-gray-700 mb-2">
              Next in Queue:
            </div>
            <div className="space-y-1">
              {stats.nextFiles.slice(0, 3).map((file, index) => (
                <div key={index} className="text-xs text-gray-500">
                  {file.filename || `File ${file.fileId}`}
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default QueueStatsCard;
