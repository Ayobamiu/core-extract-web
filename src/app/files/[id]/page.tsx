"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Spin } from "antd";
import { apiClient, JobFile } from "@/lib/api";
import ProtectedRoute from "@/components/auth/ProtectedRoute";

/** Legacy /files/:id URLs redirect to the job page with ?file= for the modal viewer. */
export default function FilePageRedirect() {
  const params = useParams();
  const router = useRouter();
  const fileId = params?.id as string;

  useEffect(() => {
    if (!fileId) return;

    let cancelled = false;

    (async () => {
      try {
        const response = await apiClient.getFileResult(fileId);
        if (cancelled) return;

        const fileData =
          (response as { file?: JobFile }).file ||
          (response.data as { file?: JobFile })?.file ||
          (response.data as JobFile | undefined);

        const jobId = fileData?.job_id;
        if (jobId) {
          router.replace(
            `/jobs/${jobId}?file=${encodeURIComponent(fileId)}`,
          );
        } else {
          router.replace("/");
        }
      } catch {
        if (!cancelled) router.replace("/");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [fileId, router]);

  return (
    <ProtectedRoute>
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="Opening file viewer…" />
      </div>
    </ProtectedRoute>
  );
}
