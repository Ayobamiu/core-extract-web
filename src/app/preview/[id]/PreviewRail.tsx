"use client";

import React, { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Layers } from "lucide-react";

export type PreviewView =
  | { kind: "records"; slug?: string } // slug undefined = all; "untyped" = no-type bucket
  | { kind: "files" }
  | { kind: "file"; fileId: string; filename: string };

const TYPE_NAMES: Record<string, string> = {
  mgs_well_log: "Well Logs",
  borehole_log: "Boring Logs",
  aquifer_test: "Aquifer Tests",
  analytical_results: "Analytical Results",
  well_coordinate_table: "Well Coordinates",
  field_sampling_forms: "Field Sampling",
};

const COLLAPSED_KEY = "previewRailCollapsed";

export function documentTypeLabel(slug: string | null | undefined): string {
  if (!slug) return "Untyped";
  return (
    TYPE_NAMES[slug] ??
    slug.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function RailItem({
  active,
  count,
  onClick,
  children,
}: {
  active: boolean;
  count?: number;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md text-sm text-left transition-colors ${
        active
          ? "bg-blue-50 text-blue-700 font-medium"
          : "text-gray-600 hover:bg-gray-100"
      }`}
    >
      <span className="truncate">{children}</span>
      {count != null && (
        <span className="text-xs tabular-nums text-gray-400">{count}</span>
      )}
    </button>
  );
}

/**
 * Collapsible left rail for the preview page — replaces document-type tabs.
 * Shows "All records" + "Files" + one entry per document type (with counts), so
 * navigation always reveals the full landscape and scales past a few types.
 * Collapse state persists in localStorage (mirrors the jobs rail).
 */
export function PreviewRail({
  slugs,
  totalRecords,
  totalFiles,
  view,
  onSelect,
}: {
  slugs: Array<{ slug: string | null; count: number }>;
  totalRecords?: number;
  totalFiles?: number;
  view: PreviewView;
  onSelect: (v: PreviewView) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(COLLAPSED_KEY) === "true") setCollapsed(true);
    } catch {
      /* ignore */
    }
  }, []);

  const toggle = () =>
    setCollapsed((c) => {
      const next = !c;
      try {
        localStorage.setItem(COLLAPSED_KEY, String(next));
      } catch {
        /* ignore */
      }
      return next;
    });

  const recordsAllActive = view.kind === "records" && !view.slug;
  const filesActive = view.kind === "files" || view.kind === "file";

  return (
    <aside
      className={`shrink-0 flex flex-col border-r border-gray-200 bg-white overflow-hidden transition-[width] duration-200 ease-out ${
        collapsed ? "w-12" : "w-56"
      }`}
      aria-label="Preview views"
    >
      {collapsed ? (
        <div className="flex flex-col items-center py-3 gap-2">
          <button
            type="button"
            onClick={toggle}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
            title="Expand views"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <Layers className="h-4 w-4 text-gray-400" aria-hidden />
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 pl-1">
              Views
            </span>
            <button
              type="button"
              onClick={toggle}
              className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
              title="Collapse views"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          <div className="p-3 flex flex-col gap-1 overflow-y-auto">
            <RailItem
              active={recordsAllActive}
              count={totalRecords}
              onClick={() => onSelect({ kind: "records" })}
            >
              All records
            </RailItem>
            <RailItem
              active={filesActive}
              count={totalFiles}
              onClick={() => onSelect({ kind: "files" })}
            >
              Files
            </RailItem>

            {slugs.length > 0 && (
              <div className="mt-3 mb-1 px-3 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                Data types
              </div>
            )}
            {slugs.map((s) => {
              const key = s.slug ?? "untyped";
              return (
                <RailItem
                  key={key}
                  active={view.kind === "records" && view.slug === key}
                  count={s.count}
                  onClick={() => onSelect({ kind: "records", slug: key })}
                >
                  {documentTypeLabel(s.slug)}
                </RailItem>
              );
            })}
          </div>
        </>
      )}
    </aside>
  );
}
