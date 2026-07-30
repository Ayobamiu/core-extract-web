"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Tooltip } from "antd";
import { apiClient, type PreviewSlugCount } from "@/lib/api";
import { documentTypeLabel } from "@/app/preview/[id]/PreviewRail";

export type PreviewHoverSummary = {
  total: number;
  types: PreviewSlugCount[];
};

/** Module cache so hovering the same preview across rows doesn't refetch. */
const summaryCache = new Map<
  string,
  PreviewHoverSummary | Promise<PreviewHoverSummary>
>();

export function loadPreviewHoverSummary(
  previewId: string,
): Promise<PreviewHoverSummary> {
  const cached = summaryCache.get(previewId);
  if (cached) {
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const pending = apiClient
    .getPreviewDataPaginated(previewId, 1, 1)
    .then((res) => {
      const ok = res.status === "success" || (res as { success?: boolean }).success;
      if (!ok || !res.data) {
        throw new Error(res.message || "Failed to load preview summary");
      }
      const summary: PreviewHoverSummary = {
        total: res.data.pagination?.total ?? 0,
        types: Array.isArray(res.data.slugs) ? res.data.slugs : [],
      };
      summaryCache.set(previewId, summary);
      return summary;
    })
    .catch((err) => {
      summaryCache.delete(previewId);
      throw err;
    });

  summaryCache.set(previewId, pending);
  return pending;
}

function PreviewHoverCardBody({
  name,
  summary,
  loading,
  error,
}: {
  name: string;
  summary: PreviewHoverSummary | null;
  loading: boolean;
  error: string | null;
}) {
  const types = summary?.types ?? [];
  const total = summary?.total ?? 0;

  return (
    <div className="w-[260px] text-left">
      <div className="text-[13px] font-semibold text-gray-900 leading-snug truncate">
        {name}
      </div>
      <div className="mt-0.5 text-[11px] text-gray-500">Preview</div>

      <div className="my-2.5 border-t border-gray-200" />

      {loading && (
        <div className="space-y-1.5 animate-pulse">
          <div className="h-3 w-24 rounded bg-gray-200" />
          <div className="h-3 w-40 rounded bg-gray-100" />
          <div className="h-3 w-36 rounded bg-gray-100" />
        </div>
      )}

      {!loading && error && (
        <div className="text-[12px] text-red-600">{error}</div>
      )}

      {!loading && !error && summary && (
        <>
          <div className="text-[12px] text-gray-700">
            <span className="font-semibold tabular-nums text-gray-900">
              {total}
            </span>{" "}
            {total === 1 ? "record" : "records"}
            {types.length > 0 && (
              <span className="text-gray-400">
                {" "}
                · {types.length} {types.length === 1 ? "type" : "types"}
              </span>
            )}
          </div>

          {types.length > 0 ? (
            <ul className="mt-2 space-y-1 max-h-40 overflow-auto pr-0.5">
              {types.map((t) => (
                <li
                  key={t.slug ?? "__untyped__"}
                  className="flex items-center justify-between gap-3 text-[12px]"
                >
                  <span className="truncate text-gray-600">
                    {documentTypeLabel(t.slug)}
                  </span>
                  <span className="shrink-0 tabular-nums text-gray-900 font-medium">
                    {t.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1.5 text-[12px] text-gray-400">
              No typed records yet
            </div>
          )}
        </>
      )}
    </div>
  );
}

/**
 * GitHub-style hover card for a preview link — shows record count and
 * per-type breakdown without opening the preview page.
 */
export default function PreviewLinkHoverCard({
  previewId,
  name,
  href,
  className,
  style,
  children,
}: {
  previewId: string;
  name: string;
  href: string;
  className?: string;
  style?: React.CSSProperties;
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PreviewHoverSummary | null>(() => {
    const cached = summaryCache.get(previewId);
    return cached && !(cached instanceof Promise) ? cached : null;
  });

  const ensureLoaded = useCallback(async () => {
    const cached = summaryCache.get(previewId);
    if (cached && !(cached instanceof Promise)) {
      setSummary(cached);
      setError(null);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const next = await loadPreviewHoverSummary(previewId);
      setSummary(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [previewId]);

  useEffect(() => {
    if (open) void ensureLoaded();
  }, [open, ensureLoaded]);

  return (
    <Tooltip
      trigger={["hover"]}
      mouseEnterDelay={0.45}
      mouseLeaveDelay={0.15}
      placement="topLeft"
      destroyTooltipOnHide
      onOpenChange={setOpen}
      color="#ffffff"
      styles={{
        root: { maxWidth: 320 },
        body: {
          padding: "10px 12px",
          borderRadius: 8,
          border: "1px solid #d0d7de",
          boxShadow:
            "0 8px 24px rgba(140, 149, 159, 0.2), 0 1px 2px rgba(0,0,0,0.06)",
          color: "#24292f",
        },
      }}
      title={
        <PreviewHoverCardBody
          name={name}
          summary={summary}
          loading={loading && !summary}
          error={error}
        />
      }
    >
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
        style={style}
        onFocus={() => setOpen(true)}
      >
        {children ?? name}
      </a>
    </Tooltip>
  );
}
