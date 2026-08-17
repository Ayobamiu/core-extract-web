"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiClient } from "@/lib/api";
import type { GoldLabel, GoldVerdict } from "@/lib/api";
import { seededLeavesUnder } from "@/lib/goldSetPaths";

/**
 * Gold-set review state for one file.
 *
 * The seeded batch is deliberately the spine of this. A reviewer could in
 * principle just hover fields and judge whatever catches the eye, but then the
 * denominator becomes "whatever somebody remembered to check" — which is the
 * same missing-denominator problem that makes production data unusable for
 * accuracy in the first place. So the batch decides what is in scope; the tree
 * only decides how it is judged.
 *
 * Labels are keyed by `${section_result_id}::${field_path}` because a file
 * holds many sections and paths repeat across them.
 */

export type GoldLabelsByKey = Map<string, GoldLabel>;

export const goldKey = (sectionResultId: string, fieldPath: string) =>
  `${sectionResultId}::${fieldPath}`;

export interface SectionGoldProgress {
  total: number;
  done: number;
  pending: number;
  wrong: number;
  missing: number;
  unreadable: number;
  drifted: number;
}

interface UseGoldReviewArgs {
  fileId: string | null | undefined;
  batch: string | null;
  /** Off entirely until the reviewer turns review mode on — no batch, no fetch. */
  enabled: boolean;
}

export function useGoldReview({ fileId, batch, enabled }: UseGoldReviewArgs) {
  const [labels, setLabels] = useState<GoldLabel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState<Set<string>>(new Set());

  const load = useCallback(async () => {
    if (!enabled || !fileId || !batch) {
      setLabels([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await apiClient.getGoldLabels(fileId, batch);
      setLabels(res.labels ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gold labels");
      setLabels([]);
    } finally {
      setLoading(false);
    }
  }, [enabled, fileId, batch]);

  useEffect(() => {
    void load();
  }, [load]);

  const byKey: GoldLabelsByKey = useMemo(() => {
    const map = new Map<string, GoldLabel>();
    for (const label of labels) {
      map.set(goldKey(label.section_result_id, label.field_path), label);
    }
    return map;
  }, [labels]);

  /** The seeded paths for one section — what the tree paints chips on. */
  const seededPathsFor = useCallback(
    (sectionResultId: string | null | undefined): Set<string> => {
      const out = new Set<string>();
      if (!sectionResultId) return out;
      for (const label of labels) {
        if (label.section_result_id === sectionResultId) out.add(label.field_path);
      }
      return out;
    },
    [labels],
  );

  const progressFor = useCallback(
    (sectionResultId: string | null | undefined): SectionGoldProgress => {
      const empty: SectionGoldProgress = {
        total: 0, done: 0, pending: 0, wrong: 0, missing: 0, unreadable: 0, drifted: 0,
      };
      if (!sectionResultId) return empty;
      return labels.reduce((acc, label) => {
        if (label.section_result_id !== sectionResultId) return acc;
        acc.total += 1;
        if (label.verdict) acc.done += 1;
        else acc.pending += 1;
        if (label.verdict === "wrong") acc.wrong += 1;
        if (label.verdict === "missing") acc.missing += 1;
        if (label.verdict === "unreadable") acc.unreadable += 1;
        if (label.drifted) acc.drifted += 1;
        return acc;
      }, { ...empty });
    },
    [labels],
  );

  /**
   * Judge one field, or every seeded leaf beneath a container.
   *
   * The expansion is the point: "this whole well_construction block is right"
   * writes a row per leaf, so it is exactly as scoreable as five separate
   * clicks. A verdict stored against the container itself would collapse five
   * observations into one and no per-field accuracy could be recovered.
   */
  const review = useCallback(
    async (
      sectionResultId: string,
      fieldPath: string,
      verdict: GoldVerdict | null,
      opts: { trueValue?: string | null; notes?: string | null } = {},
    ): Promise<number> => {
      if (!fileId) return 0;

      const seeded = seededPathsFor(sectionResultId);
      const targets = seeded.has(fieldPath)
        ? [fieldPath]
        : seededLeavesUnder(fieldPath, seeded);

      const ids = targets
        .map((p) => byKey.get(goldKey(sectionResultId, p))?.id)
        .filter((id): id is string => !!id);
      if (ids.length === 0) return 0;

      const idSet = new Set(ids);
      setSaving((prev) => new Set([...prev, ...ids]));

      // Optimistic: at ~2,000 checks a round-trip per click is the difference
      // between a session that flows and one that stutters.
      const previous = labels;
      setLabels((prev) =>
        prev.map((l) =>
          idSet.has(l.id)
            ? {
                ...l,
                verdict,
                true_value: verdict === "wrong" ? (opts.trueValue ?? null) : null,
                notes: opts.notes ?? l.notes,
              }
            : l,
        ),
      );

      try {
        await apiClient.setGoldVerdicts(fileId, ids, verdict, opts);
      } catch (err) {
        setLabels(previous);
        setError(err instanceof Error ? err.message : "Failed to save verdict");
      } finally {
        setSaving((prev) => {
          const next = new Set(prev);
          for (const id of ids) next.delete(id);
          return next;
        });
      }
      return ids.length;
    },
    [byKey, fileId, labels, seededPathsFor],
  );

  /**
   * The next unjudged field in a section, in seeded order — what the keyboard
   * fast path jumps to. Returns null when the section is finished.
   */
  const nextPendingPath = useCallback(
    (sectionResultId: string | null | undefined, after?: string | null): string | null => {
      if (!sectionResultId) return null;
      const inSection = labels
        .filter((l) => l.section_result_id === sectionResultId)
        .sort((a, b) => a.field_path.localeCompare(b.field_path));
      const pending = inSection.filter((l) => !l.verdict);
      if (pending.length === 0) return null;
      if (!after) return pending[0].field_path;
      const next = pending.find((l) => l.field_path.localeCompare(after) > 0);
      return (next ?? pending[0]).field_path;
    },
    [labels],
  );

  return {
    labels,
    byKey,
    loading,
    error,
    saving,
    reload: load,
    review,
    seededPathsFor,
    progressFor,
    nextPendingPath,
  };
}
