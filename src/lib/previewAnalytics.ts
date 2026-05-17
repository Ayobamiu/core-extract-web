import { apiClient } from "@/lib/api";

const SESSION_STORAGE_KEY = "preview_analytics_client_session";

export type PreviewAnalyticsEventType =
  | "preview_visit"
  | "well_view"
  | "wellbore_open"
  | "wellbore_fullscreen"
  | "wellbore_print";

export interface PreviewAnalyticsEventPayload {
  type: PreviewAnalyticsEventType;
  jobFileId?: string;
  wellLabel?: string;
  metadata?: Record<string, unknown>;
}

export function getPreviewClientSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = sessionStorage.getItem(SESSION_STORAGE_KEY);
    if (!id) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `ps-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      sessionStorage.setItem(SESSION_STORAGE_KEY, id);
    }
    return id;
  } catch {
    return `ps-${Date.now()}`;
  }
}

/** Fire-and-forget preview analytics (public preview pages). */
export function trackPreviewAnalytics(
  previewId: string,
  events: PreviewAnalyticsEventPayload[],
): void {
  if (!previewId || events.length === 0) return;

  const clientSessionId = getPreviewClientSessionId();
  if (!clientSessionId) return;

  void apiClient
    .recordPreviewAnalyticsEvents(previewId, { clientSessionId, events })
    .catch(() => {
      /* non-blocking */
    });
}

export function trackPreviewAnalyticsBeacon(
  previewId: string,
  events: PreviewAnalyticsEventPayload[],
): void {
  if (typeof navigator === "undefined" || !navigator.sendBeacon) {
    trackPreviewAnalytics(previewId, events);
    return;
  }

  const base =
    process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";
  const clientSessionId = getPreviewClientSessionId();
  const body = JSON.stringify({ clientSessionId, events });

  try {
    navigator.sendBeacon(
      `${base}/previews/${previewId}/analytics/events`,
      new Blob([body], { type: "application/json" }),
    );
  } catch {
    trackPreviewAnalytics(previewId, events);
  }
}
