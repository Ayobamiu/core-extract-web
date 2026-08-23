"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useParams } from "next/navigation";
import { Loader } from "lucide-react";
import { RecordView } from "@/components/record/RecordView";
import { useSocket } from "@/hooks/useSocket";
import type { JsonSchemaNode } from "@/components/record/recordSchema";
import {
  getDemoPdfUrl,
  getDemoSession,
  loadDemoToken,
  submitDemoLead,
  type DemoSession,
} from "@/lib/demoApi";
import DemoThumbnails from "@/components/demo/DemoThumbnails";
import { COMPANY_EMAIL_ERROR, isCompanyEmail } from "@/lib/companyEmail";

const PdfViewer = dynamic(() => import("@/components/file/PdfViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center">
      <Loader className="h-6 w-6 animate-spin text-neutral-400" />
    </div>
  ),
});

const PHASE_LABEL: Record<string, string> = {
  queued: "Queued",
  classifying: "Identifying the document",
  extracting: "Reading the scan",
  ai_extraction: "Extracting depths, lithology, SPT, coordinates",
  post_processing: "Finishing up",
  done: "Done",
  failed: "Could not extract",
  skipped: "Skipped",
};

export default function DemoSessionPage() {
  const params = useParams();
  const sessionId = String(params?.sessionId || "");
  const [token, setToken] = useState<string | null | undefined>(undefined);

  const [session, setSession] = useState<DemoSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [emailOpen, setEmailOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [devDownloadUrl, setDevDownloadUrl] = useState<string | null>(null);
  const [activeRecord, setActiveRecord] = useState(0);
  const [mobilePane, setMobilePane] = useState<"pdf" | "fields">("fields");

  useEffect(() => {
    if (!sessionId) return;
    setToken(loadDemoToken(sessionId));
  }, [sessionId]);

  const refresh = useCallback(async () => {
    if (!sessionId || !token) return;
    const next = await getDemoSession(sessionId, token);
    setSession(next);
    return next;
  }, [sessionId, token]);

  useEffect(() => {
    if (!sessionId) return;
    if (token === undefined) return;
    if (!token) {
      setError("This demo link only works in the browser that uploaded the file.");
      return;
    }
    let cancelled = false;
    refresh().catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : "Could not load session");
    });
    return () => {
      cancelled = true;
    };
  }, [refresh, sessionId, token]);

  useSocket(session?.jobId, {
    onFileStatusUpdate: () => {
      void refresh();
    },
    onFileProcessingEvent: () => {
      void refresh();
    },
  });

  useEffect(() => {
    if (!session || session.status === "completed" || session.status === "failed") return;
    const t = setInterval(() => {
      void refresh();
    }, 2500);
    return () => clearInterval(t);
  }, [refresh, session]);

  useEffect(() => {
    if (!sessionId || !token || !session?.fileId) return;
    if (session.status !== "completed") return;
    if (pdfUrl) return;
    let cancelled = false;
    getDemoPdfUrl(sessionId, token)
      .then((url) => {
        if (!cancelled) setPdfUrl(url);
      })
      .catch(() => {
        /* PDF can load after S3 is ready */
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId, token, session?.fileId, session?.status, pdfUrl]);

  useEffect(() => {
    const lock =
      session?.status === "completed" && (session.records?.length || 0) > 0;
    if (!lock) return;
    const html = document.documentElement;
    const prevHtml = html.style.overflow;
    const prevBody = document.body.style.overflow;
    html.style.overflow = "hidden";
    document.body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      document.body.style.overflow = prevBody;
    };
  }, [session?.status, session?.records?.length]);

  const headline = session?.classification?.headline;
  const classifiedPages = session?.classification?.types?.[0]?.pages;
  const pagesForThumbs = useMemo(() => {
    if (classifiedPages && classifiedPages.length > 0) return classifiedPages;
    const n = session?.pageCount || 0;
    return Array.from({ length: Math.min(n, 12) }, (_, i) => i + 1);
  }, [classifiedPages, session?.pageCount]);

  const current = session?.records?.[activeRecord];
  const targetPage = Array.isArray(current?.pages) && current.pages.length > 0
    ? current.pages[0]
    : undefined;

  const latestPhase = session?.events?.length
    ? session.events[session.events.length - 1]
    : null;
  const phaseLabel =
    PHASE_LABEL[latestPhase?.phase || ""] ||
    latestPhase?.message ||
    (session?.status === "queued" ? "Starting…" : "Working…");

  function openEmailGate(message?: string) {
    setEmailError(message || null);
    setEmailSentTo(null);
    setDevDownloadUrl(null);
    setEmailOpen(true);
  }

  function handleDownload() {
    if (!sessionId || !token || !session) return;
    openEmailGate();
  }

  async function handleEmailSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!sessionId || !token) return;
    if (!isCompanyEmail(email)) {
      setEmailError(COMPANY_EMAIL_ERROR);
      return;
    }
    setEmailError(null);
    setEmailBusy(true);
    try {
      const result = await submitDemoLead(sessionId, token, email, "download");
      setEmailSentTo(result.email);
      setDevDownloadUrl(result.devDownloadUrl || null);
      await refresh();
    } catch (err) {
      setEmailError(err instanceof Error ? err.message : "Could not send the download link");
      if (err && typeof err === "object" && "devDownloadUrl" in err) {
        const url = (err as { devDownloadUrl?: string }).devDownloadUrl;
        if (url) setDevDownloadUrl(url);
      }
    } finally {
      setEmailBusy(false);
    }
  }

  if (error && !session) {
    return (
      <main className="mx-auto max-w-xl px-6 py-24 text-center">
        <p className="text-neutral-700">{error}</p>
        <a href="/try" className="mt-6 inline-block text-sm text-neutral-500 underline">
          Try another file
        </a>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader className="h-6 w-6 animate-spin text-neutral-400" />
      </main>
    );
  }

  const done = session.status === "completed";
  const failed = session.status === "failed";
  const locked = done && session.records.length > 0;

  const archiveMailto = `mailto:hello@coreextract.app?subject=${encodeURIComponent("Archive conversion")}&body=${encodeURIComponent(`I'd like to convert a file set.\n\nDemo file: ${session.filename}\nSession: ${session.sessionId}\n`)}`;

  return (
    <main
      className={
        locked
          ? "fixed inset-0 z-10 flex flex-col overflow-hidden bg-white"
          : "mx-auto min-h-screen w-full max-w-[1400px] px-4 py-6 sm:px-6"
      }
    >
      {locked ? (
        <header className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-200 px-3 sm:gap-3 sm:px-4">
          <a
            href="/try"
            className="shrink-0 text-[13px] font-medium text-neutral-500 hover:text-neutral-800"
          >
            Core Extract
          </a>
          <h1
            className="min-w-0 flex-1 truncate text-[13px] font-semibold text-neutral-950 sm:text-sm"
            title={session.filename}
          >
            {headline || session.filename}
          </h1>
          <a
            href={archiveMailto}
            title="$1.50/record, 500 record minimum"
            className="shrink-0 text-[12px] text-neutral-600 underline underline-offset-2"
          >
            <span className="sm:hidden">Archive</span>
            <span className="hidden sm:inline">Convert an archive</span>
          </a>
          <button
            type="button"
            onClick={() => void handleDownload()}
            disabled={emailBusy}
            className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-[13px] font-semibold text-white hover:bg-neutral-800 disabled:opacity-60"
          >
            {emailBusy ? "Sending…" : "Download Excel"}
          </button>
        </header>
      ) : (
      <header className="mb-3 flex shrink-0 flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <a href="/try" className="text-sm text-neutral-500">
            Core Extract
          </a>
          <h1 className="mt-1 truncate text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
            {headline || session.filename}
          </h1>
          <p className="truncate text-sm text-neutral-500">{session.filename}</p>
        </div>
        {!done && !failed ? (
          <p className="text-sm text-neutral-600">{phaseLabel}</p>
        ) : null}
      </header>
      )}

      {!done && !failed && (
        <section className="mb-8">
          <div className="h-1 w-full overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full w-1/2 animate-pulse rounded-full bg-neutral-900" />
          </div>
          {session.classification && token && (
            <DemoThumbnails
              sessionId={sessionId}
              token={token}
              pages={pagesForThumbs}
            />
          )}
        </section>
      )}

      {failed && (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">
          {session.error ||
            "We couldn’t find a boring log or well record in this file. Email hello@coreextract.app and we’ll take a look."}
        </p>
      )}

      {done && session.records.length === 0 && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          We couldn’t find a boring log or well record in this file. Email{" "}
          <a className="underline" href="mailto:hello@coreextract.app">
            hello@coreextract.app
          </a>{" "}
          and we’ll take a look.
        </p>
      )}

      {done && session.records.length > 0 && (
        <div className="flex min-h-0 flex-1 flex-col">
          <div
            className={`flex shrink-0 items-center gap-2 overflow-x-auto border-b border-neutral-200 px-3 sm:px-4 ${
              session.records.length > 1 ? "" : "md:hidden"
            }`}
          >
            <div className="flex md:hidden">
              {(
                [
                  ["fields", "Extracted"],
                  ["pdf", "Original"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setMobilePane(id)}
                  className={`px-3 py-2 text-[13px] font-medium ${
                    mobilePane === id
                      ? "border-b-2 border-neutral-900 text-neutral-950"
                      : "text-neutral-500"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            {session.records.length > 1 && (
              <div className="ml-auto flex gap-1 py-1.5">
                {session.records.map((r, i) => (
                  <button
                    key={`${r.slug}-${i}`}
                    type="button"
                    onClick={() => setActiveRecord(i)}
                    className={`rounded-full px-2.5 py-0.5 text-xs ${
                      i === activeRecord
                        ? "bg-neutral-900 text-white"
                        : "bg-neutral-100 text-neutral-700"
                    }`}
                  >
                    {r.displayName}
                    {` ${i + 1}`}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="grid min-h-0 flex-1 grid-cols-1 md:grid-cols-2">
            <div
              className={`h-full min-h-0 flex-col overflow-hidden bg-neutral-50 md:flex md:border-r md:border-neutral-200 ${
                mobilePane === "pdf" ? "flex" : "hidden"
              }`}
            >
              {pdfUrl ? (
                <PdfViewer
                  url={pdfUrl}
                  fileKey={session.fileId}
                  targetPage={targetPage}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-neutral-400">
                  Loading original pages…
                </div>
              )}
            </div>
            <div
              className={`h-full min-h-0 overflow-y-auto bg-white px-3 py-2 md:block md:px-4 ${
                mobilePane === "fields" ? "block" : "hidden"
              }`}
            >
              {current ? (
                <RecordView
                  data={current.data}
                  schema={current.schema as JsonSchemaNode | undefined}
                  slug={current.slug || undefined}
                  emptyLabel="—"
                  compact
                />
              ) : (
                <p className="p-8 text-center text-sm text-neutral-400">
                  No structured fields for this file.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {emailOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          {emailSentTo ? (
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold">Check your inbox</h2>
              <p className="mt-2 text-sm text-neutral-600">
                We sent a download link to <span className="font-medium text-neutral-900">{emailSentTo}</span>.
                Open it from that inbox to get the spreadsheet — that confirms the address.
              </p>
              {devDownloadUrl && (
                <p className="mt-3 text-sm text-amber-800">
                  Email isn’t configured locally.{" "}
                  <a className="underline" href={devDownloadUrl}>
                    Open the download link
                  </a>
                  .
                </p>
              )}
              <div className="mt-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEmailOpen(false)}
                  className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
          <form
            onSubmit={(e) => void handleEmailSubmit(e)}
            className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl"
          >
            <h2 className="text-lg font-semibold">Work email for the spreadsheet</h2>
            <p className="mt-1 text-sm text-neutral-500">
              We’ll email a download link to confirm the address. Company email only — not Gmail, Yahoo, or Outlook.
            </p>
            <input
              type="email"
              required
              autoFocus
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setEmailError(null);
              }}
              placeholder="you@company.com"
              className="mt-4 w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-neutral-900"
            />
            {emailError && (
              <p className="mt-2 text-sm text-red-700">{emailError}</p>
            )}
            {devDownloadUrl && (
              <p className="mt-3 text-sm text-amber-800">
                Local fallback:{" "}
                <a className="underline" href={devDownloadUrl}>
                  open the download link
                </a>
              </p>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setEmailOpen(false)}
                className="px-3 py-2 text-sm text-neutral-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={emailBusy}
                className="rounded-lg bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {emailBusy ? "Sending…" : "Email me the link"}
              </button>
            </div>
          </form>
          )}
        </div>
      )}

      {error && session && (
        <p className="shrink-0 px-3 py-1.5 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}
    </main>
  );
}
