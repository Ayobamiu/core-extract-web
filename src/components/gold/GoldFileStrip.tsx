"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, Dropdown, Progress, Tooltip } from "antd";
import { ClipboardCheck, SkipForward } from "lucide-react";
import { apiClient } from "@/lib/api";
import type { GoldBatch, GoldQueueEntry } from "@/lib/api";

/**
 * Gold-set review, expressed in the file table itself rather than in a
 * separate worklist: sampled files are tinted, and this strip says how far
 * along the batch is and where to go next.
 *
 * The jump button is doing real work. Files are paginated server-side, so the
 * batch's 42 files are scattered across roughly ten pages of 181 — the tint
 * tells you a row you can already see is in the sample, but it can't tell you
 * where the next unjudged section is. Rather than page around hunting for a
 * gold row, you press the button.
 */

export interface GoldReviewToggleProps {
  batch: string | null;
  onBatchChange: (batch: string | null) => void;
}

/** Toolbar control: turns review mode on, and picks the batch. */
export const GoldReviewToggle: React.FC<GoldReviewToggleProps> = ({
  batch,
  onBatchChange,
}) => {
  const [batches, setBatches] = useState<GoldBatch[]>([]);

  useEffect(() => {
    apiClient
      .listGoldBatches()
      .then((res) =>
        setBatches(
          ((res.batches ?? []) as GoldBatch[]).filter((b) => b.batch !== "adhoc"),
        ),
      )
      .catch(() => setBatches([]));
  }, []);

  const items = [
    ...batches.map((b) => ({
      key: b.batch,
      label: `${b.batch} · ${b.n_sections} sections`,
    })),
    ...(batches.length === 0
      ? [{ key: "__none", label: "No batches seeded yet", disabled: true }]
      : []),
    ...(batch ? [{ type: "divider" as const }, { key: "__off", label: "Turn off" }] : []),
  ];

  return (
    <Dropdown
      menu={{
        items,
        onClick: ({ key }) => {
          if (key === "__none") return;
          onBatchChange(key === "__off" ? null : key);
        },
      }}
      trigger={["click"]}
    >
      <Tooltip title="Highlight the sections sampled for accuracy review">
        <Button
          size="small"
          type={batch ? "primary" : "default"}
          icon={<ClipboardCheck className="w-3.5 h-3.5" />}
        >
          {batch ? `Gold review · ${batch}` : "Gold review"}
        </Button>
      </Tooltip>
    </Dropdown>
  );
};

export interface GoldFileStripProps {
  batch: string;
  queue: GoldQueueEntry[];
  jobId: string;
  /** Skipped when picking the next section, so it never lands where you are. */
  activeSectionId?: string | null;
}

const GoldFileStrip: React.FC<GoldFileStripProps> = ({
  batch,
  queue,
  jobId,
  activeSectionId,
}) => {
  const router = useRouter();

  const totals = useMemo(() => {
    let pending = 0;
    let total = 0;
    let sectionsDone = 0;
    const files = new Set<string>();
    for (const entry of queue) {
      pending += entry.pending;
      total += entry.total;
      if (entry.pending === 0) sectionsDone += 1;
      files.add(entry.file_id);
    }
    return {
      pending,
      total,
      done: total - pending,
      sectionsDone,
      sections: queue.length,
      files: files.size,
    };
  }, [queue]);

  const next = useMemo(() => {
    if (queue.length === 0) return null;
    const start = activeSectionId
      ? queue.findIndex((q) => q.section_result_id === activeSectionId) + 1
      : 0;
    const ordered = [...queue.slice(start), ...queue.slice(0, Math.max(0, start))];
    return (
      ordered.find(
        (q) => q.pending > 0 && q.section_result_id !== activeSectionId,
      ) ?? null
    );
  }, [queue, activeSectionId]);

  if (queue.length === 0) return null;

  const pct = totals.total > 0 ? Math.round((totals.done / totals.total) * 100) : 0;

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-amber-200 bg-amber-50/60 px-4 py-1.5 text-xs">
      <span className="flex items-center gap-1.5 font-medium text-amber-900">
        <ClipboardCheck className="w-3.5 h-3.5" />
        Gold review · {batch}
      </span>

      <span className="text-amber-800">
        {totals.files} files highlighted below
      </span>

      <Progress
        percent={pct}
        size="small"
        showInfo={false}
        strokeColor="#d97706"
        style={{ width: 90, marginBottom: 0 }}
      />
      <span className="tabular-nums text-amber-800">
        {totals.sectionsDone}/{totals.sections} sections · {totals.done}/{totals.total}{" "}
        fields
      </span>

      {next ? (
        <Tooltip title={next.filename ?? "next sampled section"}>
          <Button
            size="small"
            type="primary"
            icon={<SkipForward className="w-3 h-3" />}
            onClick={() => {
              const params = new URLSearchParams({
                file: next.file_id,
                section: next.section_result_id,
                view: "results",
              });
              router.push(`/jobs/${next.job_id ?? jobId}?${params.toString()}`);
            }}
          >
            Next unjudged section
          </Button>
        </Tooltip>
      ) : (
        <span className="font-medium text-green-700">
          All {totals.sections} sections judged — score with goldSetScore.mjs --batch{" "}
          {batch}
        </span>
      )}
    </div>
  );
};

export default GoldFileStrip;
