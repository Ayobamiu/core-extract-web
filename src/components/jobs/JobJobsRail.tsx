"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Button, Drawer, Input, Spin } from "antd";
import {
  Briefcase,
  Search,
  ChevronLeft,
  ChevronRight,
  PanelLeftOpen,
  CheckCircle,
  XCircle,
  Loader,
  Clock,
} from "lucide-react";
import { apiClient, Job } from "@/lib/api";
import { useOrganization } from "@/contexts/OrganizationContext";

const RAIL_COLLAPSED_KEY = "jobDetailJobsRailCollapsed";

interface JobJobsRailProps {
  currentJobId: string;
  jobName: string;
}

function statusIcon(status: string) {
  switch (status) {
    case "completed":
      return (
        <CheckCircle
          className="h-3.5 w-3.5 text-green-500 flex-shrink-0"
          aria-hidden
        />
      );
    case "processing":
      return (
        <Loader
          className="h-3.5 w-3.5 text-amber-500 flex-shrink-0 animate-spin"
          aria-hidden
        />
      );
    case "failed":
      return (
        <XCircle className="h-3.5 w-3.5 text-red-500 flex-shrink-0" aria-hidden />
      );
    default:
      return (
        <Clock className="h-3.5 w-3.5 text-gray-400 flex-shrink-0" aria-hidden />
      );
  }
}

export default function JobJobsRail({ currentJobId, jobName }: JobJobsRailProps) {
  const { currentOrganization } = useOrganization();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const activeRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    const raw = localStorage.getItem(RAIL_COLLAPSED_KEY);
    if (raw === "true") setCollapsed(true);
  }, []);

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      const next = !c;
      localStorage.setItem(RAIL_COLLAPSED_KEY, String(next));
      return next;
    });
  };

  useEffect(() => {
    if (!currentOrganization) {
      setJobs([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      setLoading(true);
      setFetchError(null);
      try {
        const res = await apiClient.getJobs(200, 0);
        if (!cancelled) {
          setJobs(res.jobs || []);
        }
      } catch (e) {
        if (!cancelled) {
          setFetchError(e instanceof Error ? e.message : "Failed to load jobs");
          setJobs([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [currentOrganization]);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [currentJobId, jobs.length, mobileOpen, collapsed]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return jobs;
    return jobs.filter(
      (j) =>
        j.name.toLowerCase().includes(q) ||
        j.id.toLowerCase().includes(q),
    );
  }, [jobs, search]);

  const listSection = (
    <div className="flex flex-col min-h-0 flex-1">
      <div className="p-3 border-b border-gray-100 flex-shrink-0 space-y-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Jobs
          </span>
          <Link
            href="/jobs"
            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
            onClick={() => setMobileOpen(false)}
          >
            All jobs
          </Link>
        </div>
        <Input
          allowClear
          size="small"
          placeholder="Search…"
          prefix={<Search className="h-3.5 w-3.5 text-gray-400" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0">
        {loading ? (
          <div className="flex justify-center py-12">
            <Spin />
          </div>
        ) : fetchError ? (
          <p className="text-xs text-red-600 px-3 py-4">{fetchError}</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-gray-500 px-3 py-4">
            {jobs.length === 0 ? "No jobs yet." : "No matches."}
          </p>
        ) : (
          <nav className="py-2" aria-label="Jobs in organization">
            <ul className="space-y-0.5 px-2">
              {filtered.map((j) => {
                const active = j.id === currentJobId;
                return (
                  <li key={j.id}>
                    <Link
                      ref={active ? activeRef : undefined}
                      href={`/jobs/${j.id}`}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors ${
                        active
                          ? "bg-blue-50 text-blue-900 ring-1 ring-blue-100"
                          : "text-gray-700 hover:bg-gray-50"
                      }`}
                    >
                      {statusIcon(j.status)}
                      <span className="min-w-0 flex-1">
                        <span className="font-medium line-clamp-2 leading-snug">
                          {j.name || "Untitled job"}
                        </span>
                        <span className="block text-[11px] text-gray-400 tabular-nums truncate">
                          {j.file_count} file
                          {String(j.file_count) === "1" ? "" : "s"}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile: compact trigger + drawer */}
      <div className="flex lg:hidden items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white flex-shrink-0">
        <Button
          type="default"
          size="middle"
          icon={<PanelLeftOpen className="h-4 w-4" />}
          onClick={() => setMobileOpen(true)}
          className="flex items-center"
        >
          Jobs
        </Button>
        <span className="text-sm font-medium text-gray-900 truncate min-w-0">
          {jobName}
        </span>
      </div>

      <Drawer
        title={
          <span className="flex items-center gap-2">
            <Briefcase className="h-4 w-4" />
            Switch job
          </span>
        }
        placement="left"
        width={320}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        styles={{ body: { padding: 0, display: "flex", flexDirection: "column" } }}
      >
        {listSection}
      </Drawer>

      {/* Desktop: sticky rail */}
      <aside
        className={`hidden lg:flex flex-shrink-0 flex-col border-r border-gray-200 bg-white sticky top-0 self-start max-h-[calc(100vh-4rem)] transition-[width] duration-200 ease-out ${
          collapsed ? "w-12" : "w-[17rem]"
        }`}
        aria-label="Jobs sidebar"
      >
        {collapsed ? (
          <div className="flex flex-col items-center py-3 gap-2 border-b border-gray-100">
            <button
              type="button"
              onClick={toggleCollapsed}
              className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              title="Expand jobs list"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
            <Briefcase className="h-4 w-4 text-gray-400" aria-hidden />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100 flex-shrink-0">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide pl-1">
                Jobs
              </span>
              <button
                type="button"
                onClick={toggleCollapsed}
                className="p-1.5 rounded-md hover:bg-gray-100 text-gray-500"
                title="Collapse jobs list"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
            {listSection}
          </>
        )}
      </aside>
    </>
  );
}
