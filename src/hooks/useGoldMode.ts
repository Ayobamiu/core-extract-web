"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Which gold-set batch is being reviewed right now — `null` means review mode
 * is off. One value carries both facts, because "on but no batch" is not a
 * state worth having.
 *
 * This is shared by two components that sit far apart in the tree: the file
 * table (which tints the sampled files) and the section viewer (which tints
 * the sampled sections and hangs verdict controls on the tree). Threading a
 * prop through the four layers between them would touch three components that
 * have no interest in gold review, so it lives in localStorage with an event
 * to keep open views in step. It also survives a reload, which matters for a
 * mode you sit in for hours.
 */

const STORAGE_KEY = "goldReview.batch";
const CHANGE_EVENT = "gold-review-batch-change";

function readStored(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(STORAGE_KEY);
}

export function useGoldMode() {
  // Always null on the first render so the server and client markup agree;
  // the stored value arrives in the effect below.
  const [batch, setBatchState] = useState<string | null>(null);

  useEffect(() => {
    setBatchState(readStored());

    const sync = () => setBatchState(readStored());
    // CHANGE_EVENT covers this tab; `storage` covers a second tab.
    window.addEventListener(CHANGE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(CHANGE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const setBatch = useCallback((next: string | null) => {
    if (typeof window === "undefined") return;
    if (next) window.localStorage.setItem(STORAGE_KEY, next);
    else window.localStorage.removeItem(STORAGE_KEY);
    setBatchState(next);
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }, []);

  return { batch, setBatch, enabled: batch !== null };
}
