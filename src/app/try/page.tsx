"use client";

import React, { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { createDemoSession } from "@/lib/demoApi";

export default function TryLandingPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const start = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setError(null);
      setBusy(true);
      try {
        const session = await createDemoSession(file);
        router.push(`/try/${session.sessionId}`);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Upload failed");
        setBusy(false);
      }
    },
    [busy, router],
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6 py-16">
      <p className="text-sm font-medium tracking-wide text-neutral-500">
        Core Extract
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight text-neutral-950 sm:text-5xl">
        Upload a boring log or well record.
        <span className="mt-2 block text-neutral-500">
          See structured data in about a minute.
        </span>
      </h1>

      <label
        className={`mt-10 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition ${
          dragOver
            ? "border-neutral-900 bg-neutral-50"
            : "border-neutral-300 hover:border-neutral-500"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          start(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => start(e.target.files?.[0])}
        />
        <p className="text-lg font-medium text-neutral-900">
          {busy ? "Starting…" : "Drop a PDF here, or click to browse"}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          No signup. PDF, up to 12 pages. Files are deleted in 7 days and are
          not used for training.
        </p>
      </label>

      {error && (
        <p className="mt-4 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
