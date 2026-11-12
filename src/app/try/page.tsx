"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  DemoApiError,
  createDemoSession,
  getDemoEligibility,
  loadDemoEmail,
  trackDemoEvent,
} from "@/lib/demoApi";
import { INVALID_EMAIL_ERROR, isValidEmail } from "@/lib/companyEmail";

export default function TryLandingPage() {
  const router = useRouter();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // "First file free": after one run, we ask for an email before the next.
  const [storedEmail, setStoredEmail] = useState<string | null>(null);
  const [gate, setGate] = useState(false);
  const [email, setEmail] = useState("");
  const [pendingFile, setPendingFile] = useState<File | null>(null);

  const gateTracked = useRef(false);

  const showGate = useCallback((reason: string) => {
    setGate(true);
    if (gateTracked.current) return;
    gateTracked.current = true;
    trackDemoEvent("email_gate_shown", { detail: { reason } });
  }, []);

  useEffect(() => {
    const remembered = loadDemoEmail();
    if (remembered) {
      setStoredEmail(remembered);
      return;
    }
    let cancelled = false;
    getDemoEligibility().then((r) => {
      if (!cancelled && r.emailRequired && !r.hasEmail) showGate("second_file");
    });
    return () => {
      cancelled = true;
    };
  }, [showGate]);

  const start = useCallback(
    async (file: File | undefined) => {
      if (!file || busy) return;
      setError(null);
      const typed = email.trim();
      if (gate && !storedEmail && !isValidEmail(typed)) {
        setPendingFile(file);
        setError(typed ? INVALID_EMAIL_ERROR : "Add your email above to run this file.");
        return;
      }
      setBusy(true);
      try {
        const session = await createDemoSession(file, storedEmail || (gate ? typed : null));
        router.push(`/try/${session.sessionId}`);
      } catch (err) {
        if (err instanceof DemoApiError && err.code === "EMAIL_REQUIRED") {
          setPendingFile(file);
          showGate("upload_blocked");
          setError(null);
        } else {
          setError(err instanceof Error ? err.message : "Upload failed");
        }
        setBusy(false);
      }
    },
    [busy, email, gate, router, showGate, storedEmail],
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

      {gate && !storedEmail && (
        <form
          className="mt-10 rounded-2xl border border-neutral-200 bg-neutral-50 p-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (pendingFile) void start(pendingFile);
          }}
        >
          <label htmlFor="demo-email" className="text-sm font-medium text-neutral-900">
            Your first file was on us. Add your email to keep going.
          </label>
          <p className="mt-1 text-sm text-neutral-500">
            We&apos;ll send the spreadsheet there too. No account, no newsletter.
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <input
              id="demo-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError(null);
              }}
              placeholder="you@company.com"
              className="min-w-0 flex-1 rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            {pendingFile && (
              <button
                type="submit"
                disabled={busy}
                className="shrink-0 truncate rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60 sm:max-w-[16rem]"
                title={pendingFile.name}
              >
                {busy ? "Starting…" : `Run ${pendingFile.name}`}
              </button>
            )}
          </div>
        </form>
      )}

      <label
        className={`${gate && !storedEmail ? "mt-4" : "mt-10"} flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-16 text-center transition ${
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
          void start(e.dataTransfer.files[0]);
        }}
      >
        <input
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={busy}
          onChange={(e) => void start(e.target.files?.[0])}
        />
        <p className="text-lg font-medium text-neutral-900">
          {busy ? "Starting…" : "Drop a PDF here, or click to browse"}
        </p>
        <p className="mt-2 text-sm text-neutral-500">
          {gate && !storedEmail ? "First file free, no signup." : "No signup."} PDF, up
          to 12 pages. Files are deleted in 7 days and are not used for training.
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
