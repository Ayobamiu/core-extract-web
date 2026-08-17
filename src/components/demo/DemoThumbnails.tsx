"use client";

import React, { useEffect, useState } from "react";
import { fetchDemoThumbnail } from "@/lib/demoApi";

export default function DemoThumbnails({
  sessionId,
  token,
  pages,
}: {
  sessionId: string;
  token: string;
  pages: number[];
}) {
  const [srcs, setSrcs] = useState<Record<number, string>>({});
  const pageKey = pages.join(",");

  useEffect(() => {
    if (!sessionId || !token || pages.length === 0) return;
    let cancelled = false;
    const created: string[] = [];

    async function load(page: number) {
      for (let attempt = 0; attempt < 8 && !cancelled; attempt++) {
        try {
          const url = await fetchDemoThumbnail(sessionId, token, page);
          if (cancelled) {
            URL.revokeObjectURL(url);
            return;
          }
          created.push(url);
          setSrcs((prev) => ({ ...prev, [page]: url }));
          return;
        } catch {
          await new Promise((r) => setTimeout(r, 700 * (attempt + 1)));
        }
      }
    }

    for (const page of pages) void load(page);

    return () => {
      cancelled = true;
      for (const url of created) URL.revokeObjectURL(url);
    };
    // pageKey is the stable dependency for the page list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, token, pageKey]);

  return (
    <div className="mt-6 flex gap-3 overflow-x-auto pb-2">
      {pages.map((n) => (
        <figure key={n} className="w-28 shrink-0">
          {srcs[n] ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={srcs[n]}
              alt={`Page ${n}`}
              className="h-36 w-28 rounded-md border border-neutral-200 object-cover bg-neutral-50"
            />
          ) : (
            <div className="h-36 w-28 animate-pulse rounded-md border border-neutral-200 bg-neutral-100" />
          )}
          <figcaption className="mt-1 text-center text-[11px] text-neutral-500">
            {n}
          </figcaption>
        </figure>
      ))}
    </div>
  );
}
