export type ViewerPane = "results" | "routing" | "processing";

export type ViewerResultTab = "results" | "markdown" | "compare" | "comments";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

export interface JobViewUrlState {
  file: string | null;
  page: number;
  size: number;
  /** Null when absent from the URL — use smart defaults in the viewer. */
  pane: ViewerPane | null;
  section: string | null;
  /** Null when absent from the URL — use smart defaults in the viewer. */
  view: ViewerResultTab | null;
}

const VALID_PANES = new Set<ViewerPane>(["results", "routing", "processing"]);
const VALID_VIEWS = new Set<ViewerResultTab>([
  "results",
  "markdown",
  "compare",
  "comments",
]);

function parsePositiveInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export function parseJobViewUrlState(
  params: URLSearchParams,
): JobViewUrlState {
  const paneRaw = params.get("pane");
  const viewRaw = params.get("view");

  return {
    file: params.get("file"),
    page: parsePositiveInt(params.get("page"), DEFAULT_PAGE),
    size: parsePositiveInt(params.get("size"), DEFAULT_PAGE_SIZE),
    pane:
      paneRaw && VALID_PANES.has(paneRaw as ViewerPane)
        ? (paneRaw as ViewerPane)
        : null,
    section: params.get("section"),
    view:
      viewRaw && VALID_VIEWS.has(viewRaw as ViewerResultTab)
        ? (viewRaw as ViewerResultTab)
        : null,
  };
}

export type JobViewUrlPatch = Partial<JobViewUrlState>;

export function applyJobViewUrlPatch(
  current: URLSearchParams,
  patch: JobViewUrlPatch,
): URLSearchParams {
  const next = new URLSearchParams(current.toString());

  const setOrDelete = (key: string, value: string | null | undefined) => {
    if (value === undefined) return;
    if (value === null || value === "") {
      next.delete(key);
    } else {
      next.set(key, value);
    }
  };

  if (patch.file !== undefined) setOrDelete("file", patch.file);
  if (patch.page !== undefined) {
    if (patch.page <= DEFAULT_PAGE) next.delete("page");
    else next.set("page", String(patch.page));
  }
  if (patch.size !== undefined) {
    if (patch.size === DEFAULT_PAGE_SIZE) next.delete("size");
    else next.set("size", String(patch.size));
  }
  if (patch.pane !== undefined) {
    if (patch.pane === null || patch.pane === "results") next.delete("pane");
    else next.set("pane", patch.pane);
  }
  if (patch.section !== undefined) setOrDelete("section", patch.section);
  if (patch.view !== undefined) {
    if (patch.view === null || patch.view === "results") next.delete("view");
    else next.set("view", patch.view);
  }

  return next;
}
