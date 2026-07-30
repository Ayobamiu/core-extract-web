/**
 * Save & Re-extract / Reprocess run progress, derived from persisted state.
 *
 * Progress used to live only in `section-reextract-progress-event`, held in
 * component state — so it died on every remount (pane tab switch, pane
 * toggle, reload) with nothing to re-read it from. The backend now stamps a
 * `sreex_run` marker into detected_sections, which rides the initial file
 * load AND every file patch, so the card is a pure function of props.
 *
 * Mirror of computeSreexRunProgress in
 * ai/src/services/sectionReextractService.ts — keep the two in step.
 */

export const SREEX_RUN_KEY = "sreex_run";
export const TEXT_REEXTRACT_FLAG = "needs_text_reextract";

export type SreexRunOrigin = "save" | "reprocess" | "reextract";

export interface SreexRunMarker {
    section_indices: number[];
    total: number;
    started_at: string;
    origin: SreexRunOrigin;
    finished_at?: string | null;
    error?: string | null;
}

export interface SreexSectionRow {
    index: number;
    label: string;
    status: "extracting" | "done";
}

export interface SreexRunProgress {
    total: number;
    done: number;
    pendingIndices: number[];
    rows: SreexSectionRow[];
    /** Every section resolved, or the worker explicitly finished/failed. */
    finished: boolean;
    error: string | null;
    origin: SreexRunOrigin;
    startedAt: string;
}

/** Structural, not the exported DetectedSections type: this runs against
 *  both the routing panel's typed blob and the viewer's looser prop shape. */
interface SectionLike {
    document_type_slug?: string;
    record_id?: string | null;
    section_result_id?: string | null;
    superseded_by?: string | null;
    page_range?: [number, number];
    member_pages?: number[];
}

interface DetectedSectionsLike {
    sections?: SectionLike[];
}

function rowLabel(section: SectionLike, index: number): string {
    const parts: string[] = [];
    if (section.record_id) parts.push(String(section.record_id));
    if (section.document_type_slug) parts.push(section.document_type_slug);
    const pages = section.member_pages;
    if (Array.isArray(pages) && pages.length > 0) {
        parts.push(pages.length === 1 ? `p${pages[0]}` : `p${pages[0]}–${pages[pages.length - 1]}`);
    } else if (section.page_range?.[0] != null) {
        const [a, b] = section.page_range;
        parts.push(a === b ? `p${a}` : `p${a}–${b}`);
    }
    return parts.length > 0 ? parts.join(" · ") : `Section ${index + 1}`;
}

export function computeSreexRunProgress(
    detectedSections: DetectedSectionsLike | null | undefined,
): SreexRunProgress | null {
    const run = (detectedSections as Record<string, unknown> | null | undefined)?.[
        SREEX_RUN_KEY
    ] as SreexRunMarker | undefined;
    if (!run || !Array.isArray(run.section_indices)) return null;

    const sections = Array.isArray(detectedSections?.sections) ? detectedSections.sections : [];
    const rows: SreexSectionRow[] = [];
    const pendingIndices: number[] = [];
    let done = 0;

    for (const i of run.section_indices) {
        const section = sections[i];
        // Deleted mid-run — nothing left to wait for, and no row to show.
        if (!section) continue;
        // Two kinds of outstanding work, and a text-only reprocess has the
        // second WITHOUT the first: the section keeps its id while its pages
        // are re-OCR'd, so id-alone would report it done before it started.
        const awaitingAi = section.section_result_id == null && !section.superseded_by;
        const awaitingText =
            (section as Record<string, unknown>)[TEXT_REEXTRACT_FLAG] === true;
        const pending = awaitingAi || awaitingText;
        if (pending) pendingIndices.push(i);
        else done += 1;
        rows.push({ index: i, label: rowLabel(section, i), status: pending ? "extracting" : "done" });
    }

    return {
        total: typeof run.total === "number" ? run.total : run.section_indices.length,
        done,
        pendingIndices,
        rows,
        finished: Boolean(run.finished_at) || pendingIndices.length === 0,
        error: run.error ?? null,
        origin: run.origin ?? "save",
        startedAt: run.started_at,
    };
}
