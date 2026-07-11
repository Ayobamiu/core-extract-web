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

const DEFAULT_THRESHOLD = 0.75;

/**
 * Add a single page (typically one the classifier left "outside any section")
 * into an existing section, as an extraction page. This is a reviewer override
 * of the classifier's skip decision, so the page is forced into
 * `extraction_pages` regardless of its page_purpose. The section's range is
 * widened to cover the page and it's marked for re-extraction.
 *
 * Intended for pages adjacent to the section boundary; the caller (UI) only
 * offers this when `page === section.end + 1` or `page === section.start - 1`,
 * which keeps the [start,end] range contiguous and avoids swallowing other
 * unassigned pages into the section's display range.
 */
export function addPageToSection(
  detectedSections: DetectedSections,
  index: number,
  pageNumber: number
): DetectedSections {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`Invalid pageNumber '${pageNumber}' — must be a positive integer`);
  }

  const blob = cloneBlob(detectedSections);
  const section = requireSection(blob, index);

  if (section.extraction_pages.includes(pageNumber)) {
    throw new Error(`Page ${pageNumber} is already in this section`);
  }

  // Force into extraction (override the classifier's skip), keep sorted.
  section.extraction_pages = [...section.extraction_pages, pageNumber].sort(
    (a, b) => a - b
  );
  // If it was previously recorded as a skipped page here, drop that record.
  section.skipped_pages = section.skipped_pages.filter(
    (s) => s.page_number !== pageNumber
  );

  const start = Math.min(section.page_range[0], pageNumber);
  const end = Math.max(section.page_range[1], pageNumber);
  section.page_range = [start, end];
  section.page_count = end - start + 1;
  section.status = "approved";
  section.section_result_id = null;

  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Create a brand-new single-page section from a page the classifier left
 * outside any section, with the reviewer-chosen slug. Inserted at the correct
 * document-order position (by page number) so the section ordering — and the
 * V2 envelope's positional pairing — stays consistent. Marked for extraction.
 */
export function createSectionFromPage(
  detectedSections: DetectedSections,
  pageNumber: number,
  slug: string
): DetectedSections {
  if (!Number.isInteger(pageNumber) || pageNumber < 1) {
    throw new Error(`Invalid pageNumber '${pageNumber}' — must be a positive integer`);
  }
  if (!slug) {
    throw new Error("A document type slug is required");
  }

  const blob = cloneBlob(detectedSections);

  if (
    Array.isArray(blob.sections) &&
    blob.sections.some(
      (s) =>
        pageNumber >= s.page_range[0] && pageNumber <= s.page_range[1]
    )
  ) {
    throw new Error(`Page ${pageNumber} already belongs to a section`);
  }

  const page = (blob.pages ?? []).find((p) => p.page_number === pageNumber);
  const conf = typeof page?.confidence === "number" ? page.confidence : 0;
  // Inherit threshold from an existing section of the same slug, if any.
  const sameSlug = (blob.sections ?? []).find(
    (s) => s.document_type_slug === slug
  );

  const newSection: DetectedSection = {
    document_type_slug: slug,
    page_range: [pageNumber, pageNumber],
    page_count: 1,
    extraction_pages: [pageNumber],
    skipped_pages: [],
    page_roles: [page?.page_role ?? null],
    page_purposes: [page?.page_purpose ?? "unknown"],
    confidence: Number(conf.toFixed(4)),
    min_page_confidence: Number(conf.toFixed(4)),
    status: "approved",
    threshold_used: sameSlug?.threshold_used ?? DEFAULT_THRESHOLD,
    section_result_id: null,
  };

  if (!Array.isArray(blob.sections)) blob.sections = [];
  const insertAt = blob.sections.findIndex(
    (s) => s.page_range[0] > pageNumber
  );
  if (insertAt === -1) blob.sections.push(newSection);
  else blob.sections.splice(insertAt, 0, newSection);

  // Reflect the reviewer's decision on the page itself, so it no longer reads
  // as "none"/unassigned in the per-page view.
  if (page) page.document_type_slug = slug;

  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Delete a section outright (wrongly assigned / shouldn't exist).
 * Its pages become unassigned — they reappear under "pages outside any
 * section", from where a new section can be created if the delete was a
 * mistake. On Save, the server drops the section's record from the result
 * envelope and removes its verification/QA rows.
 */
export function deleteSection(
  detectedSections: DetectedSections,
  index: number
): DetectedSections {
  const blob = cloneBlob(detectedSections);
  const section = requireSection(blob, index);

  // Reflect the removal on the pages so the per-page view reads "none".
  const [start, end] = section.page_range;
  for (const p of blob.pages ?? []) {
    if (
      typeof p.page_number === "number" &&
      p.page_number >= start &&
      p.page_number <= end
    ) {
      p.document_type_slug = "none";
    }
  }

  blob.sections.splice(index, 1);
  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Re-assign a contiguous page range inside a section to a different document
 * type: carves the range out (splitting at both boundaries as needed) and
 * re-routes the carved-out part to `slug`. One-shot version of
 * split → split → change slug. All affected sections are marked for
 * re-extraction (the remnants' previous results covered the moved pages).
 */
export function reassignPages(
  detectedSections: DetectedSections,
  index: number,
  fromPage: number,
  toPage: number,
  slug: string
): DetectedSections {
  if (!slug) {
    throw new Error("A document type slug is required");
  }
  if (
    !Number.isInteger(fromPage) ||
    !Number.isInteger(toPage) ||
    fromPage > toPage
  ) {
    throw new Error(`Invalid page range ${fromPage}–${toPage}`);
  }

  const section = requireSection(cloneBlob(detectedSections), index);
  const [start, end] = section.page_range;
  if (fromPage < start || toPage > end) {
    throw new Error(
      `Page range ${fromPage}–${toPage} is outside the section (${start}–${end})`
    );
  }

  // Whole section → plain slug change.
  if (fromPage === start && toPage === end) {
    return changeSectionSlug(detectedSections, index, slug);
  }

  let blob = detectedSections;
  let middleIndex = index;
  // Carve off the tail first so `index` stays valid for the second split.
  if (toPage < end) {
    blob = splitSection(blob, index, toPage + 1); // [start..toPage] + [toPage+1..end]
  }
  if (fromPage > start) {
    blob = splitSection(blob, middleIndex, fromPage); // [start..fromPage-1] + [fromPage..toPage]
    middleIndex = index + 1;
  }
  return changeSectionSlug(blob, middleIndex, slug);
}

/**
 * Mark a section as a duplicate superseded by another section (the canonical,
 * e.g. the updated version of the same well). The superseded section keeps
 * its entry (provenance, undo) but on Save its record leaves the result
 * envelope and its verification/QA rows are removed; it is excluded from
 * extraction, review counts and QA from then on.
 */
export function markSectionSuperseded(
  detectedSections: DetectedSections,
  index: number,
  canonicalIndex: number
): DetectedSections {
  if (index === canonicalIndex) {
    throw new Error("A section cannot supersede itself");
  }
  const blob = cloneBlob(detectedSections);
  const section = requireSection(blob, index);
  const canonical = requireSection(blob, canonicalIndex);

  if (!canonical.section_result_id) {
    throw new Error(
      "The canonical section has no extraction result yet — extract it first"
    );
  }
  if (canonical.superseded_by) {
    throw new Error("The canonical section is itself superseded");
  }

  section.superseded_by = canonical.section_result_id;
  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Undo a supersede. If the mark was already saved, the section's record is
 * gone from the envelope, so the section is flagged for re-extraction
 * (`forceReextract: true` — the caller knows whether the server state had
 * the mark). An unsaved in-draft mark keeps its record and just clears.
 */
export function unsupersedeSection(
  detectedSections: DetectedSections,
  index: number,
  { forceReextract = false }: { forceReextract?: boolean } = {}
): DetectedSections {
  const blob = cloneBlob(detectedSections);
  const section = requireSection(blob, index);

  section.superseded_by = null;
  if (forceReextract) {
    section.section_result_id = null;
    section.status = "approved";
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
    if ((c.superseded_by ?? null) !== (s.superseded_by ?? null)) return true;
  }
  return false;
}

/**
 * Get indices of sections that need extraction (section_result_id is null).
 * Superseded sections never extract — their canonical twin carries the data.
 */
export function getSectionsNeedingExtraction(
  detectedSections: DetectedSections | null | undefined
): number[] {
  if (!detectedSections?.sections) return [];
  return detectedSections.sections
    .map((s, i) => (s.section_result_id == null && !s.superseded_by ? i : -1))
    .filter((i) => i >= 0);
}
