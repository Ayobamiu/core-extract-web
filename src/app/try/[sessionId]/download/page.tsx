"use client";

import React, { Suspense, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { Loader } from "lucide-react";
import { downloadDemoExcelByToken } from "@/lib/demoApi";

function DownloadInner() {
  const params = useParams();
  const search = useSearchParams();
  const sessionId = String(params?.sessionId || "");
  const token = search.get("token") || "";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(
    token ? null : "This download link is missing a token.",
  );
  const [done, setDone] = useState(false);

  async function handleDownload() {
    if (!sessionId || !token || busy) return;
    setBusy(true);
    setError(null);
    try {
      await downloadDemoExcelByToken(sessionId, token);
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Download failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16 text-center">
      <p className="text-sm font-medium tracking-wide text-neutral-500">
        Core Extract
      </p>
      <h1 className="mt-3 text-2xl font-semibold tracking-tight text-neutral-950">
        Your spreadsheet is ready
      </h1>
      <p className="mt-2 text-sm text-neutral-600">
        Opening this page from your inbox confirms the email. Click below to
        download the Excel file.
      </p>
      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
      {done && !error && (
        <p className="mt-4 text-sm text-neutral-600">Download started.</p>
      )}
      <button
        type="button"
        onClick={() => void handleDownload()}
        disabled={busy || !token}
        className="mt-8 rounded-lg bg-neutral-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
      >
        {busy ? "Downloading…" : "Download spreadsheet"}
      </button>
      <a href="/try" className="mt-6 text-sm text-neutral-500 underline">
        Try another file
      </a>
    </main>
  );
}

export default function DemoDownloadPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center">
          <Loader className="h-6 w-6 animate-spin text-neutral-400" />
        </main>
      }
    >
      <DownloadInner />
    </Suspense>
  );
}
