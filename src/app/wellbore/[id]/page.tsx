"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { apiClient, PreviewDataTable, PreviewJobFile } from "@/lib/api";
import { WellboreDiagram } from "@/components/well/WellboreDiagram";
import { Button } from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";

interface PreviewData {
  preview: PreviewDataTable;
  jobFiles: PreviewJobFile[];
}

const WellborePreviewContent: React.FC = () => {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const previewId = params.id as string;
  const filename = searchParams.get("filename");

  const [wellData, setWellData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Set document title when filename is available
  useEffect(() => {
    if (filename) {
      document.title = `${filename} - Wellbore Diagram`;
    }
    return () => {
      // Reset title when component unmounts
      document.title = "Wellbore Diagram";
    };
  }, [filename]);

  useEffect(() => {
    const fetchWellData = async () => {
      if (!previewId || !filename) {
        setError("Missing preview ID or filename");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Fetch preview data
        const response = await apiClient.getPreviewData(previewId);

        if (!response.data?.jobFiles) {
          setError("No preview data found");
          setLoading(false);
          return;
        }

        // Find the record with matching filename
        const records = response.data.jobFiles;
        const record = Array.isArray(records)
          ? records.find((r: PreviewJobFile) => r.filename === filename)
          : null;

        if (!record) {
          setError(`File "${filename}" not found in preview data`);
          setLoading(false);
          return;
        }

        // Well data is in the result field of PreviewJobFile
        const wellData = record.result;

        if (!wellData) {
          setError("No result data found for this file");
          setLoading(false);
          return;
        }

        // Check if record has well data
        const hasWellData =
          wellData.formations ||
          wellData.casing ||
          wellData.perforation_intervals ||
          wellData.pluggings ||
          wellData.shows_depths ||
          wellData.true_depth ||
          wellData.measured_depth;

        if (!hasWellData) {
          setError("No wellbore data found for this file");
          setLoading(false);
          return;
        }

        setWellData(wellData);
      } catch (err: any) {
        console.error("Error fetching well data:", err);
        setError(
          err.response?.data?.message ||
            err.message ||
            "Failed to load well data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchWellData();
  }, [previewId, filename]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading wellbore diagram...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center max-w-md">
          <div className="text-red-500 text-6xl mb-4">⚠️</div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">Error</h1>
          <p className="text-gray-600 mb-6">{error}</p>
          <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
            Go Back
          </Button>
        </div>
      </div>
    );
  }

  if (!wellData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <p className="text-gray-600">No well data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Fullscreen Diagram Container */}
      <div className="flex-1 overflow-auto p-8 flex items-center justify-center">
        <div className="w-full max-w-7xl">
          <WellboreDiagram data={wellData} size="large" />
        </div>
      </div>
    </div>
  );
};

const WellborePreviewPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-gray-50">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <WellborePreviewContent />
    </Suspense>
  );
};

export default WellborePreviewPage;
