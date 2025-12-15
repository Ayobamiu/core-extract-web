"use client";

import React, { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { apiClient, PreviewJobFile } from "@/lib/api";
import { WellboreDiagramPrint } from "@/components/well/WellboreDiagramPrint";
import { Button } from "antd";
import { ArrowLeftOutlined, PrinterOutlined } from "@ant-design/icons";

const WellborePrintContent: React.FC = () => {
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
      document.title = `${filename} - Wellbore Diagram Print`;
    }
    return () => {
      // Reset title when component unmounts
      document.title = "Wellbore Diagram Print";
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

        const response = await apiClient.getPreviewData(previewId);

        if (!response.data?.jobFiles) {
          setError("No preview data found");
          setLoading(false);
          return;
        }

        const records = response.data.jobFiles;
        const record = Array.isArray(records)
          ? records.find((r: PreviewJobFile) => r.filename === filename)
          : null;

        if (!record) {
          setError(`File "${filename}" not found in preview data`);
          setLoading(false);
          return;
        }

        const wellData = record.result;

        if (!wellData) {
          setError("No result data found for this file");
          setLoading(false);
          return;
        }

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

  // Optional: Auto-print when page loads (commented out - uncomment if desired)
  // useEffect(() => {
  //   if (wellData && !loading) {
  //     const timer = setTimeout(() => {
  //       window.print();
  //     }, 500);
  //     return () => clearTimeout(timer);
  //   }
  // }, [wellData, loading]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white print:bg-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading print view...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white print:bg-white">
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
      <div className="min-h-screen flex items-center justify-center bg-white print:bg-white">
        <div className="text-center">
          <p className="text-gray-600">No well data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white print:bg-white">
      {/* Print controls - hidden in print */}
      <div className="print-controls no-print p-4 bg-gray-50 border-b print:hidden">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Print View</h1>
            <p className="text-sm text-gray-600">{filename}</p>
          </div>
          <div className="flex gap-2">
            {/* <Button icon={<ArrowLeftOutlined />} onClick={() => router.back()}>
              Back
            </Button> */}
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => window.print()}
            >
              Print
            </Button>
          </div>
        </div>
      </div>

      {/* Print content */}
      <div className="p-8 print:p-4">
        <div className="max-w-7xl mx-auto">
          <WellboreDiagramPrint data={wellData} size="medium" />
        </div>
      </div>
    </div>
  );
};

const WellborePrintPage: React.FC = () => {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-white print:bg-white">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      }
    >
      <WellborePrintContent />
    </Suspense>
  );
};

export default WellborePrintPage;
