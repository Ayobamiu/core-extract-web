/**
 * Client-side routing edit functions (split, merge, slug change).
 *
 * These are pure functions that transform a DetectedSections blob without
 * any server calls. The user can split/merge freely in the UI; changes
 * are only persisted when they click "Save & Re-extract".
 *
 * Ported from ai/src/services/sectionRoutingEdits.js — same logic,
 * same output shape.
 */

import type { DetectedSections, DetectedSection, DetectedPage } from "./api";

// ─── Helpers ─────────────────────────────────────────────────────────

function cloneBlob(blob: DetectedSections): DetectedSections {
  return JSON.parse(JSON.stringify(blob));
}

function requireSection(blob: DetectedSections, index: number): DetectedSection {
  if (!Array.isArray(blob.sections)) {
    throw new Error("detected_sections.sections is missing");
  }
  if (!Number.isInteger(index) || index < 0 || index >= blob.sections.length) {
    throw new Error(
      `Section index ${index} is out of range (0..${blob.sections.length - 1})`
    );
  }
  return blob.sections[index];
}

function deriveFileStatus(
  sections: DetectedSection[]
): string {
  if (!Array.isArray(sections) || sections.length === 0) return "skipped";
  if (sections.some((s) => s.status === "pending_review")) return "pending_review";
  return "auto_approved";
}

const EXTRACTABLE_PURPOSE = "data";

function buildSectionFromPages(
  allPages: DetectedPage[],
  [start, end]: [number, number],
  proto: DetectedSection
): DetectedSection {
  const inRange = allPages.filter(
    (p) =>
      typeof p?.page_number === "number" &&
      p.page_number >= start &&
      p.page_number <= end
  );

  const extraction_pages: number[] = [];
  const skipped_pages: DetectedSection["skipped_pages"] = [];
  const page_roles: (string | null)[] = [];
  const page_purposes: string[] = [];
  const confidences: number[] = [];

  for (const p of inRange) {
    const purpose = p.page_purpose ?? "unknown";
    const isData = purpose === EXTRACTABLE_PURPOSE;
    const isDuplicate = p.duplicate_of != null;

    if (isData && !isDuplicate) {
      extraction_pages.push(p.page_number);
    } else if (isDuplicate) {
      skipped_pages.push({
        page_number: p.page_number,
        reason: "duplicate",
      });
    } else {
      skipped_pages.push({ page_number: p.page_number, reason: purpose });
    }

    page_roles.push(p.page_role ?? null);
    page_purposes.push(purpose);
    confidences.push(typeof p.confidence === "number" ? p.confidence : 0);
  }

  const confidence = confidences.length
    ? confidences.reduce((a, b) => a + b, 0) / confidences.length
    : 0;
  const minConfidence = confidences.length ? Math.min(...confidences) : 0;

  return {
    document_type_slug: proto.document_type_slug,
    page_range: [start, end],
    page_count: end - start + 1,
    extraction_pages,
    skipped_pages,
    page_roles,
    page_purposes,
    confidence: Number(confidence.toFixed(4)),
    min_page_confidence: Number(minConfidence.toFixed(4)),
    status: "approved",
    threshold_used: proto.threshold_used,
    section_result_id: null,
  };
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Split a section into two at `atPage`.
 * First half: [section.start, atPage - 1], second: [atPage, section.end].
 * Both halves get section_result_id: null (need extraction).
 */
export function splitSection(
  detectedSections: DetectedSections,
  index: number,
  atPage: number
): DetectedSections {
  if (!Number.isInteger(atPage) || atPage < 1) {
    throw new Error(`Invalid atPage '${atPage}' — must be a positive integer`);
  }

  const blob = cloneBlob(detectedSections);
  const section = requireSection(blob, index);
  const [start, end] = section.page_range;

  if (atPage <= start || atPage > end) {
    throw new Error(
      `atPage ${atPage} is outside section range (${start}–${end})`
    );
  }

  const allPages = blob.pages ?? [];
  const first = buildSectionFromPages(allPages, [start, atPage - 1], section);
  const second = buildSectionFromPages(allPages, [atPage, end], section);

  blob.sections.splice(index, 1, first, second);
  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Merge two adjacent sections into one.
 * The merged section inherits the first section's slug.
 * Gets section_result_id: null (needs extraction).
 */
export function mergeSections(
  detectedSections: DetectedSections,
  indexA: number
): DetectedSections {
  const indexB = indexA + 1;

  const blob = cloneBlob(detectedSections);
  const secA = requireSection(blob, indexA);
  const secB = requireSection(blob, indexB);

  if (secA.page_range[1] + 1 !== secB.page_range[0]) {
    throw new Error(
      `Sections are not page-adjacent: section ${indexA} ends at page ${secA.page_range[1]}, ` +
        `section ${indexB} starts at page ${secB.page_range[0]}`
    );
  }

  const allPages = blob.pages ?? [];
  const mergedRange: [number, number] = [secA.page_range[0], secB.page_range[1]];
  const merged = buildSectionFromPages(allPages, mergedRange, secA);

  blob.sections.splice(indexA, 2, merged);
  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Change a section's document type slug.
 * Sets section_result_id: null (different schema → needs extraction).
 */
export function changeSectionSlug(
  detectedSections: DetectedSections,
  index: number,
  slug: string
): DetectedSections {
  const blob = cloneBlob(detectedSections);
  const section = requireSection(blob, index);

  section.document_type_slug = slug;
  section.status = "approved";
  section.section_result_id = null;

  // Update per-page slugs within the section's range
  const [start, end] = section.page_range;
  for (const p of blob.pages ?? []) {
    if (
      typeof p.page_number === "number" &&
      p.page_number >= start &&
      p.page_number <= end
    ) {
      p.document_type_slug = slug;
    }
  }

  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Check if a DetectedSections blob has unsaved changes compared to another.
 * Compares section count, page ranges, slugs, and section_result_ids.
 */
export function hasUnsavedChanges(
  current: DetectedSections | null | undefined,
  saved: DetectedSections | null | undefined
): boolean {
  if (!current || !saved) return false;
  if (current.sections.length !== saved.sections.length) return true;
  for (let i = 0; i < current.sections.length; i++) {
    const c = current.sections[i];
    const s = saved.sections[i];
    if (c.document_type_slug !== s.document_type_slug) return true;
    if (c.page_range[0] !== s.page_range[0] || c.page_range[1] !== s.page_range[1]) return true;
    if (c.section_result_id !== s.section_result_id) return true;
  }
  return false;
}

/**
 * Get indices of sections that need extraction (section_result_id is null).
 */
export function getSectionsNeedingExtraction(
  detectedSections: DetectedSections | null | undefined
): number[] {
  if (!detectedSections?.sections) return [];
  return detectedSections.sections
    .map((s, i) => (s.section_result_id == null ? i : -1))
    .filter((i) => i >= 0);
}
