"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Progress, Select, Switch, Tag, Tooltip } from "antd";
import { AlertTriangle, ClipboardCheck, SkipForward } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { GoldBatch, GoldQueueEntry } from "@/lib/api";
import type { SectionGoldProgress } from "@/hooks/useGoldReview";

/**
 * The review-mode switch and the batch's progress, sitting above the tree.
 *
 * Progress is all this shows — never a score. Accuracy is only meaningful next
 * to its n and its confidence interval (at n=60 a per-field interval is about
 * ±8pp), and a bare percentage rendered in the app is precisely how "83.7% QA
 * precision" already got repeated as if it were accuracy. The number comes out
 * of `goldSetScore.mjs`, with its intervals attached.
 */

const BATCH_STORAGE_KEY = "goldReview.batch";

export interface GoldReviewBarProps {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  batch: string | null;
  onBatchChange: (batch: string | null) => void;
  /** Progress for the section on screen. */
  section: SectionGoldProgress;
  /** Lets the bar skip the section you're on when finding the next one. */
  currentSectionId?: string | null;
  loading?: boolean;
  error?: string | null;
}

const GoldReviewBar: React.FC<GoldReviewBarProps> = ({
  enabled,
  onEnabledChange,
  batch,
  onBatchChange,
  section,
  currentSectionId,
  loading,
  error,
}) => {
  const router = useRouter();
  const [batches, setBatches] = useState<GoldBatch[]>([]);
  const [queue, setQueue] = useState<GoldQueueEntry[]>([]);

  // Only ask the server once the reviewer actually turns review mode on.
  useEffect(() => {
    if (!enabled || batches.length > 0) return;
    apiClient
      .listGoldBatches()
      .then((res) => {
        const list = ((res.batches ?? []) as GoldBatch[]).filter(
          (b) => b.batch !== "adhoc",
        );
        setBatches(list);
        if (!batch && list.length > 0) {
          const remembered =
            typeof window !== "undefined"
              ? window.localStorage.getItem(BATCH_STORAGE_KEY)
              : null;
          const pick = list.find((b) => b.batch === remembered) ?? list[0];
          onBatchChange(pick.batch);
        }
      })
      .catch(() => setBatches([]));
  }, [enabled, batches.length, batch, onBatchChange]);

  // Re-fetched on every section change so "next" never sends you back to one
  // you just finished — a stale snapshot would still list it as pending.
  useEffect(() => {
    if (!enabled || !batch) return;
    apiClient
      .getGoldBatchQueue(batch)
      .then((res) => setQueue(res.queue ?? []))
      .catch(() => setQueue([]));
  }, [enabled, batch, currentSectionId]);

  const position = useMemo(() => {
    if (queue.length === 0 || !currentSectionId) return null;
    const idx = queue.findIndex((q) => q.section_result_id === currentSectionId);
    return idx >= 0 ? { at: idx + 1, of: queue.length } : null;
  }, [queue, currentSectionId]);

  const nextEntry = useMemo(() => {
    if (queue.length === 0) return null;
    const start = currentSectionId
      ? queue.findIndex((q) => q.section_result_id === currentSectionId) + 1
      : 0;
    // Wrap around, so finishing mid-list still reaches the stragglers.
    const ordered = [...queue.slice(start), ...queue.slice(0, Math.max(0, start))];
    return (
      ordered.find(
        (q) => q.pending > 0 && q.section_result_id !== currentSectionId,
      ) ?? null
    );
  }, [queue, currentSectionId]);

  const goNext = () => {
    if (!nextEntry) return;
    const params = new URLSearchParams({
      file: nextEntry.file_id,
      section: nextEntry.section_result_id,
      view: "results",
    });
    router.push(`/jobs/${nextEntry.job_id}?${params.toString()}`);
  };

  const pickBatch = (next: string) => {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(BATCH_STORAGE_KEY, next);
    }
    onBatchChange(next);
  };

  const pct = section.total > 0 ? Math.round((section.done / section.total) * 100) : 0;

  return (
    <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50 px-4 py-1.5 text-xs">
      <Tooltip title="Judge each sampled field against the page — including the ones that are right">
        <span className="flex items-center gap-1.5 text-gray-600">
          <ClipboardCheck className="w-3.5 h-3.5" />
          Gold review
        </span>
      </Tooltip>
      <Switch size="small" checked={enabled} onChange={onEnabledChange} />

      {enabled && (
        <>
          <Select
            size="small"
            value={batch ?? undefined}
            onChange={pickBatch}
            placeholder="batch"
            style={{ minWidth: 110 }}
            options={batches.map((b) => ({
              value: b.batch,
              label: `${b.batch} · ${b.n_sections} sections`,
            }))}
            notFoundContent="No batches seeded yet"
          />

          {loading ? (
            <span className="text-gray-400">loading…</span>
          ) : section.total === 0 ? (
            <span className="text-gray-400">
              This section isn&apos;t in the sample — nothing to judge here.
            </span>
          ) : (
            <>
              <Progress
                percent={pct}
                size="small"
                showInfo={false}
                style={{ width: 90, marginBottom: 0 }}
              />
              <span className="text-gray-600 tabular-nums">
                {section.done}/{section.total} fields
              </span>
              {section.wrong > 0 && <Tag color="red">{section.wrong} wrong</Tag>}
              {section.missing > 0 && <Tag color="orange">{section.missing} missing</Tag>}
              {section.unreadable > 0 && <Tag>{section.unreadable} unreadable</Tag>}
              {section.drifted > 0 && (
                <Tooltip title="These fields changed after the batch was seeded — the value being judged is no longer what the record holds">
                  <Tag color="gold" className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {section.drifted} drifted
                  </Tag>
                </Tooltip>
              )}
            </>
          )}
        </>
      )}

      {error && <span className="text-red-500">{error}</span>}

      {enabled && position && (
        <span className="text-gray-400 tabular-nums">
          section {position.at} of {position.of}
        </span>
      )}

      {enabled && nextEntry && (
        <Tooltip
          title={
            section.pending > 0
              ? `${section.pending} field(s) still unjudged here — next: ${nextEntry.filename ?? "another file"}`
              : `Next: ${nextEntry.filename ?? "another file"}`
          }
        >
          <Button
            size="small"
            type={section.total > 0 && section.pending === 0 ? "primary" : "default"}
            icon={<SkipForward className="w-3 h-3" />}
            onClick={goNext}
          >
            Next section
          </Button>
        </Tooltip>
      )}

      <span className="ml-auto text-[10px] text-gray-400">
        blank + blank on page = correct
      </span>
    </div>
  );
};

export default GoldReviewBar;
