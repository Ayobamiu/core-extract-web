"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Drawer, Button as AntButton, Spin, Tag, notification } from "antd";
import { apiClient, RunServiceResult } from "@/lib/api";
import { documentTypeLabel } from "./PreviewRail";

// Plain-English copy for the registered services.
const SERVICE_META: Record<string, { title: string; desc: string }> = {
  geocode_locations: {
    title: "Geocode locations",
    desc: "Derive a coordinate + precision tier for each record — from document coordinates, a street address (Google), or the PLSS section (Michigan Wellogic). Writes to the spatial layer; the extracted record is never changed.",
  },
  mgs_enrich: {
    title: "Enrich with MGS",
    desc: "Merge Michigan MGS permit data into records that carry a permit number.",
  },
};

const tierColor: Record<string, string> = {
  exact: "green",
  good: "cyan",
  plss_centroid: "gold",
  approx: "orange",
  unresolved: "default",
};

function ServiceResultView({ result }: { result: RunServiceResult }) {
  const svc = Object.values(result.summary)[0] || { applied: 0, skipped: 0, error: 0 };
  return (
    <div className="mt-2 rounded-md bg-gray-50 p-2 text-sm">
      <div className="text-gray-700">
        {result.apply ? "Applied" : "Dry-run"} · {result.recordsMatched} records
        {result.apply ? ` · ${result.filesUpdated} files updated` : ""}
      </div>
      <div className="mt-1 flex flex-wrap gap-1">
        <Tag color="green">applied {svc.applied}</Tag>
        <Tag>skipped {svc.skipped}</Tag>
        {svc.error > 0 && <Tag color="red">error {svc.error}</Tag>}
      </div>
      {result.precisionTiers && (
        <div className="mt-1 flex flex-wrap gap-1">
          {Object.entries(result.precisionTiers).map(([tier, n]) => (
            <Tag key={tier} color={tierColor[tier] || "default"}>
              {tier} {n}
            </Tag>
          ))}
        </div>
      )}
    </div>
  );
}

export function ServicesDrawer({
  previewId,
  slug,
  open,
  onClose,
  onApplied,
}: {
  previewId: string;
  slug: string | null;
  open: boolean;
  onClose: () => void;
  onApplied?: () => void;
}) {
  const [services, setServices] = useState<{ name: string; version: string }[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, RunServiceResult>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await apiClient.getProcessingServices();
      if (r.success) setServices(r.data?.services || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      load();
      setResults({});
    }
  }, [open, load]);

  const run = async (name: string, apply: boolean) => {
    if (!slug) return;
    setBusy(`${name}:${apply}`);
    try {
      const r = await apiClient.runPreviewService(previewId, { name, slug, apply });
      if (r.success && r.data) {
        setResults((p) => ({ ...p, [name]: r.data! }));
        if (apply) {
          notification.success({
            message: `${SERVICE_META[name]?.title || name} applied`,
            description: `${r.data.recordsMatched} records processed.`,
          });
          onApplied?.();
        }
      } else {
        notification.error({ message: "Service failed", description: r.message });
      }
    } catch (e: any) {
      notification.error({ message: "Service failed", description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Drawer
      title="Processing services"
      placement="right"
      width={460}
      open={open}
      onClose={onClose}
    >
      {!slug && (
        <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Select a document type in the left rail — services run over all records
          of one type.
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-8">
          <Spin />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {services.map((s) => {
            const meta = SERVICE_META[s.name] || { title: s.name, desc: "" };
            return (
              <div key={s.name} className="rounded-lg border border-gray-200 p-3">
                <div className="font-medium text-gray-900">{meta.title}</div>
                <div className="mt-1 text-sm text-gray-500">{meta.desc}</div>
                <div className="mt-3 flex gap-2">
                  <AntButton
                    size="small"
                    disabled={!slug || busy !== null}
                    loading={busy === `${s.name}:false`}
                    onClick={() => run(s.name, false)}
                  >
                    Preview (dry-run)
                  </AntButton>
                  <AntButton
                    size="small"
                    type="primary"
                    disabled={!slug || busy !== null}
                    loading={busy === `${s.name}:true`}
                    onClick={() => run(s.name, true)}
                  >
                    Apply{slug ? ` to ${documentTypeLabel(slug)}` : ""}
                  </AntButton>
                </div>
                {results[s.name] && <ServiceResultView result={results[s.name]} />}
              </div>
            );
          })}
          {services.length === 0 && (
            <div className="text-sm text-gray-500">No services registered.</div>
          )}
        </div>
      )}
    </Drawer>
  );
}
