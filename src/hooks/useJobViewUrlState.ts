"use client";

import { useCallback, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition } from "react";
import {
  applyJobViewUrlPatch,
  parseJobViewUrlState,
  type JobViewUrlPatch,
  type JobViewUrlState,
} from "@/lib/jobViewUrlState";

export function useJobViewUrlState(jobId: string) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const state = useMemo(
    () => parseJobViewUrlState(searchParams),
    [searchParams],
  );

  const patchUrl = useCallback(
    (patch: JobViewUrlPatch) => {
      startTransition(() => {
        const next = applyJobViewUrlPatch(searchParams, patch);
        const qs = next.toString();
        router.replace(`/jobs/${jobId}${qs ? `?${qs}` : ""}`, { scroll: false });
      });
    },
    [jobId, router, searchParams],
  );

  const setFile = useCallback(
    (file: string | null) => patchUrl({ file }),
    [patchUrl],
  );

  const setPagination = useCallback(
    (page: number, size: number) => patchUrl({ page, size }),
    [patchUrl],
  );

  const setPane = useCallback(
    (pane: JobViewUrlState["pane"]) => patchUrl({ pane }),
    [patchUrl],
  );

  const setSection = useCallback(
    (section: string | null) => patchUrl({ section }),
    [patchUrl],
  );

  const setView = useCallback(
    (view: JobViewUrlState["view"]) => patchUrl({ view }),
    [patchUrl],
  );

  return {
    ...state,
    patchUrl,
    setFile,
    setPagination,
    setPane,
    setSection,
    setView,
  };
}
