"use client";

import React, { useEffect, useRef, useState } from "react";
import { submitDemoLead, trackDemoEvent } from "@/lib/demoApi";
import { INVALID_EMAIL_ERROR, isValidEmail } from "@/lib/companyEmail";

export type ReviewReason = "failed" | "empty" | "thin";

const COPY: Record<ReviewReason, { title: string; body: string }> = {
  failed: {
    title: "This one didn’t go through.",
    body: "Leave your email and an engineer will run it by hand and send you the results within one business day.",
  },
  empty: {
    title: "We couldn’t pull structured data from this file.",
    body: "Leave your email and an engineer will run it by hand and send you the results within one business day.",
  },
  thin: {
    title: "We only got a few fields from this file.",
    body: "Long or unusual layouts sometimes need a hand. Leave your email and an engineer will run it and send you the full results within one business day.",
  },
};

/**
 * Turns a failed or weak demo run into a lead: the visitor with a hard file
 * is the customer we want, so offer a human pass instead of a dead end.
 */
export default function DemoReviewOffer({
  sessionId,
  token,
  reason,
  defaultEmail,
  requestedEmail,
  onRequested,
  compact = false,
}: {
  sessionId: string;
  token: string;
  reason: ReviewReason;
  defaultEmail?: string | null;
  /** Set when a review was already requested for this session. */
  requestedEmail?: string | null;
  onRequested?: () => void;
  compact?: boolean;
}) {
  const [email, setEmail] = useState(defaultEmail || "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(requestedEmail || null);
  const tracked = useRef(false);

  useEffect(() => {
    if (tracked.current || requestedEmail) return;
    tracked.current = true;
    trackDemoEvent("review_offer_shown", { sessionId, token, detail: { reason } });
  }, [reason, requestedEmail, sessionId, token]);

  useEffect(() => {
    if (requestedEmail) setSentTo(requestedEmail);
  }, [requestedEmail]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const value = email.trim();
    if (!isValidEmail(value)) {
      setError(INVALID_EMAIL_ERROR);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await submitDemoLead(sessionId, token, value, "review", reason);
      setSentTo(result.email);
      onRequested?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send. Try again.");
    } finally {
      setBusy(false);
    }
  }

  const tone =
    reason === "thin"
      ? "border-amber-200 bg-amber-50 text-amber-950"
      : "border-neutral-200 bg-neutral-50 text-neutral-900";

  if (sentTo) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${tone}`} role="status">
        Got it. We&apos;ll run this file by hand and email{" "}
        <span className="font-medium">{sentTo}</span> within one business day.
      </div>
    );
  }

  const copy = COPY[reason];
  return (
    <form
      onSubmit={(e) => void submit(e)}
      className={`rounded-lg border ${compact ? "px-3 py-2" : "px-4 py-4"} ${tone}`}
    >
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="mt-0.5 text-sm opacity-80">{copy.body}</p>
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError(null);
          }}
          placeholder="you@company.com"
          aria-label="Email for the hand-run results"
          className="min-w-0 flex-1 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-900 outline-none focus:border-neutral-900"
        />
        <button
          type="submit"
          disabled={busy}
          className="shrink-0 rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-60"
        >
          {busy ? "Sending…" : "Run it by hand"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-sm text-red-700">{error}</p>}
    </form>
  );
}
