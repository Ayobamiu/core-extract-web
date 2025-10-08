"use client";

import React, { useState } from "react";
import { motion } from "framer-motion";
import Card, { CardHeader, CardTitle, CardContent } from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusIndicator from "@/components/ui/StatusIndicator";
import { apiClient, QueueStatus } from "@/lib/api";

interface QueueControlsProps {
  queueStatus: QueueStatus;
  onStatusChange: (status: QueueStatus) => void;
  className?: string;
}

const QueueControls: React.FC<QueueControlsProps> = ({
  queueStatus,
  onStatusChange,
  className = "",
}) => {
  const [loading, setLoading] = useState<string | null>(null);

  const handlePause = async () => {
    setLoading("pause");
    try {
      await apiClient.pauseQueue();
      onStatusChange({ paused: true, status: "paused" });
    } catch (error) {
      console.error("Failed to pause queue:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleResume = async () => {
    setLoading("resume");
    try {
      await apiClient.resumeQueue();
      onStatusChange({ paused: false, status: "running" });
    } catch (error) {
      console.error("Failed to resume queue:", error);
    } finally {
      setLoading(null);
    }
  };

  const handleClear = async () => {
    if (
      !confirm(
        "Are you sure you want to clear the entire queue? This action cannot be undone."
      )
    ) {
      return;
    }

    setLoading("clear");
    try {
      await apiClient.clearQueue();
      // Refresh the page or update state to reflect cleared queue
      window.location.reload();
    } catch (error) {
      console.error("Failed to clear queue:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <Card className={className} hover>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Queue Controls</CardTitle>
          <StatusIndicator status={queueStatus.paused ? "warning" : "success"}>
            {queueStatus.status}
          </StatusIndicator>
        </div>
      </CardHeader>

      <CardContent>
        <div className="space-y-3">
          {queueStatus.paused ? (
            <Button
              variant="success"
              onClick={handleResume}
              loading={loading === "resume"}
              className="w-full"
            >
              Resume Processing
            </Button>
          ) : (
            <Button
              variant="warning"
              onClick={handlePause}
              loading={loading === "pause"}
              className="w-full"
            >
              Pause Processing
            </Button>
          )}

          <Button
            variant="error"
            onClick={handleClear}
            loading={loading === "clear"}
            className="w-full"
          >
            Clear Queue
          </Button>
        </div>

        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <div>• Pause: Stops processing new files</div>
            <div>• Resume: Continues processing from queue</div>
            <div>• Clear: Removes all queued files</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default QueueControls;
