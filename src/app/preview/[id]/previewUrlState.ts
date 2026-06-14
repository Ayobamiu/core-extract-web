import { PreviewView } from "./PreviewRail";

export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;

export interface PreviewUrlState {
  page: number;
  pageSize: number;
  view: PreviewView;
}

function posInt(raw: string | null, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Read page / per_page / slug / view (+ file) from the URL. */
export function parsePreviewUrl(params: URLSearchParams): PreviewUrlState {
  const page = posInt(params.get("page"), DEFAULT_PAGE);
  const pageSize = posInt(params.get("per_page"), DEFAULT_PAGE_SIZE);
  const viewParam = params.get("view");
  const file = params.get("file");
  const slug = params.get("slug");

  let view: PreviewView;
  if (viewParam === "files") {
    view = file ? { kind: "file", fileId: file, filename: "" } : { kind: "files" };
  } else if (slug) {
    view = { kind: "records", slug };
  } else {
    view = { kind: "records" };
  }
  return { page, pageSize, view };
}

/** Merge page / per_page / slug / view into the current params, dropping defaults. */
export function buildPreviewParams(
  current: URLSearchParams,
  patch: { page?: number; pageSize?: number; view?: PreviewView },
): URLSearchParams {
  const next = new URLSearchParams(current.toString());

  if (patch.page !== undefined) {
    if (patch.page <= DEFAULT_PAGE) next.delete("page");
    else next.set("page", String(patch.page));
  }
  if (patch.pageSize !== undefined) {
    if (patch.pageSize === DEFAULT_PAGE_SIZE) next.delete("per_page");
    else next.set("per_page", String(patch.pageSize));
  }
  if (patch.view !== undefined) {
    const v = patch.view;
    next.delete("view");
    next.delete("file");
    next.delete("slug");
    if (v.kind === "files") {
      next.set("view", "files");
    } else if (v.kind === "file") {
      next.set("view", "files");
      next.set("file", v.fileId);
    } else if (v.kind === "records" && v.slug) {
      next.set("slug", v.slug);
    }
  }
  return next;
}
