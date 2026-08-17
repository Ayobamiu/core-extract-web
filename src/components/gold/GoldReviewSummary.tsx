"use client";

import React, { useMemo, useState } from "react";
import { Empty, Segmented, Table, Tag, Tooltip } from "antd";
import type { ColumnsType } from "antd/es/table";
import { AlertTriangle } from "lucide-react";
import type { GoldLabel, GoldVerdict } from "@/lib/api";
import { aggregateFieldPath } from "@/lib/goldSetPaths";

/**
 * Everything recorded for this file — the audit view behind the tree.
 *
 * Deliberately NOT a scoreboard. It counts verdicts and shows the rows behind
 * them; it never divides one by another. Per-field accuracy is only meaningful
 * with its n and its interval (roughly ±8pp per field at n=60), it is a
 * property of the whole batch rather than of one file, and a percentage shown
 * here would be a percentage of whatever slice happens to be on screen. The
 * number comes from `goldSetScore.mjs --batch`.
 */

const VERDICT_COLOR: Record<GoldVerdict, string> = {
  correct: "green",
  wrong: "red",
  missing: "orange",
  unreadable: "default",
};

export interface GoldReviewSummaryProps {
  labels: GoldLabel[];
  /** Section on screen, so its rows can be shown first. */
  currentSectionId?: string | null;
  onJumpToSection?: (sectionResultId: string) => void;
}

type Filter = "all" | "judged" | "pending" | "problems";

const GoldReviewSummary: React.FC<GoldReviewSummaryProps> = ({
  labels,
  currentSectionId,
  onJumpToSection,
}) => {
  const [filter, setFilter] = useState<Filter>("all");
  const [scope, setScope] = useState<"section" | "file">("file");

  const counts = useMemo(() => {
    const base = { total: 0, judged: 0, correct: 0, wrong: 0, missing: 0, unreadable: 0 };
    for (const l of labels) {
      base.total += 1;
      if (!l.verdict) continue;
      base.judged += 1;
      base[l.verdict] += 1;
    }
    return base;
  }, [labels]);

  const rows = useMemo(() => {
    let out = labels;
    if (scope === "section" && currentSectionId) {
      out = out.filter((l) => l.section_result_id === currentSectionId);
    }
    if (filter === "judged") out = out.filter((l) => !!l.verdict);
    if (filter === "pending") out = out.filter((l) => !l.verdict);
    if (filter === "problems") {
      out = out.filter((l) => l.verdict === "wrong" || l.verdict === "missing");
    }
    return [...out].sort((a, b) => {
      if (a.section_result_id !== b.section_result_id) {
        if (a.section_result_id === currentSectionId) return -1;
        if (b.section_result_id === currentSectionId) return 1;
        return a.section_result_id.localeCompare(b.section_result_id);
      }
      return a.field_path.localeCompare(b.field_path);
    });
  }, [labels, filter, scope, currentSectionId]);

  const columns: ColumnsType<GoldLabel> = [
    {
      title: "Field",
      dataIndex: "field_path",
      key: "field_path",
      render: (path: string, row) => (
        <div className="flex items-center gap-1">
          <span className="font-mono text-[11px] break-all">{path}</span>
          {row.drifted && (
            <Tooltip title="The record changed after this batch was seeded">
              <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
            </Tooltip>
          )}
        </div>
      ),
    },
    {
      title: "Extracted",
      dataIndex: "extracted_value",
      key: "extracted_value",
      render: (value: string | null) =>
        value === null ? (
          <span className="italic text-gray-400 text-[11px]">blank</span>
        ) : (
          <span className="font-mono text-[11px] break-all">{value}</span>
        ),
    },
    {
      title: "Verdict",
      dataIndex: "verdict",
      key: "verdict",
      width: 110,
      render: (verdict: GoldVerdict | null) =>
        verdict ? (
          <Tag color={VERDICT_COLOR[verdict]}>{verdict}</Tag>
        ) : (
          <span className="text-[11px] text-gray-400">pending</span>
        ),
    },
    {
      title: "On the page",
      dataIndex: "true_value",
      key: "true_value",
      render: (value: string | null) =>
        value ? <span className="font-mono text-[11px] break-all">{value}</span> : null,
    },
    {
      title: "By",
      dataIndex: "reviewed_by_email",
      key: "reviewed_by_email",
      width: 150,
      render: (email: string | null) =>
        email ? <span className="text-[11px] text-gray-500">{email}</span> : null,
    },
  ];

  if (labels.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Empty
          description={
            <span className="text-sm text-gray-500">
              No gold rows for this file. Either it isn&apos;t in the sample, or no batch
              is selected.
            </span>
          }
        />
      </div>
    );
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex flex-wrap items-center gap-3 px-4 py-2 border-b border-gray-100 bg-gray-50 text-xs">
        <span className="text-gray-600 tabular-nums">
          {counts.judged}/{counts.total} judged
        </span>
        <Tag color="green">{counts.correct} correct</Tag>
        <Tag color="red">{counts.wrong} wrong</Tag>
        <Tag color="orange">{counts.missing} missing</Tag>
        {counts.unreadable > 0 && <Tag>{counts.unreadable} unreadable</Tag>}

        <Segmented
          size="small"
          value={scope}
          onChange={(v) => setScope(v as "section" | "file")}
          options={[
            { label: "This file", value: "file" },
            { label: "This section", value: "section" },
          ]}
        />
        <Segmented
          size="small"
          value={filter}
          onChange={(v) => setFilter(v as Filter)}
          options={[
            { label: "All", value: "all" },
            { label: "Judged", value: "judged" },
            { label: "Pending", value: "pending" },
            { label: "Problems", value: "problems" },
          ]}
        />

        <span className="ml-auto text-[10px] text-gray-400">
          Accuracy comes from goldSetScore.mjs, with its intervals — counts here are
          just the rows.
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-auto">
        <Table<GoldLabel>
          rowKey="id"
          size="small"
          columns={columns}
          dataSource={rows}
          pagination={{ pageSize: 50, size: "small", showSizeChanger: false }}
          onRow={(row) => ({
            onClick: () => {
              if (row.section_result_id !== currentSectionId) {
                onJumpToSection?.(row.section_result_id);
              }
            },
            className:
              row.section_result_id === currentSectionId ? "" : "cursor-pointer",
          })}
        />
      </div>
    </div>
  );
};

export default GoldReviewSummary;

/** Row paths aggregate the way the scorer aggregates them. */
export const displayFieldGroup = aggregateFieldPath;
