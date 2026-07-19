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

/**
 * The section's member pages, sorted ascending. Falls back to expanding
 * `page_range` for legacy sections that predate explicit membership
 * (those were always contiguous, so the expansion is exact).
 *
 * This is THE membership lookup: non-contiguous sections' [min, max] spans
 * may interleave, so `page_range` containment checks are wrong.
 */
export function getMemberPages(
  section: Pick<DetectedSection, "member_pages" | "page_range"> | null | undefined
): number[] {
  if (Array.isArray(section?.member_pages) && section.member_pages.length > 0) {
    return [...section.member_pages].sort((a, b) => a - b);
  }
  const range = section?.page_range;
  if (!Array.isArray(range) || range.length !== 2) return [];
  const [start, end] = range;
  if (!Number.isInteger(start) || !Number.isInteger(end) || end < start) return [];
  const pages: number[] = [];
  for (let p = start; p <= end; p++) pages.push(p);
  return pages;
}

/**
 * Human-readable member pages, collapsing contiguous runs:
 * [2,3,7] → "2–3, 7"; [4] → "4".
 */
export function formatMemberPages(
  section: Pick<DetectedSection, "member_pages" | "page_range">
): string {
  const pages = getMemberPages(section);
  if (pages.length === 0) return "—";
  const runs: string[] = [];
  let runStart = pages[0];
  let prev = pages[0];
  for (const p of pages.slice(1)) {
    if (p === prev + 1) {
      prev = p;
      continue;
    }
    runs.push(runStart === prev ? `${runStart}` : `${runStart}–${prev}`);
    runStart = p;
    prev = p;
  }
  runs.push(runStart === prev ? `${runStart}` : `${runStart}–${prev}`);
  return runs.join(", ");
}

/** Effective purpose: a human override (set by attach) wins over the classifier. */
function effectivePurpose(page: DetectedPage): string {
  return page.page_purpose_override ?? page.page_purpose ?? "unknown";
}

function buildSectionFromPages(
  allPages: DetectedPage[],
  memberPages: number[],
  proto: DetectedSection
): DetectedSection {
  if (!Array.isArray(memberPages) || memberPages.length === 0) {
    throw new Error("Cannot build a section from an empty page list");
  }
  const member_pages = [...new Set(memberPages)].sort((a, b) => a - b);
  const memberSet = new Set(member_pages);
  const inSection = allPages
    .filter((p) => typeof p?.page_number === "number" && memberSet.has(p.page_number))
    .sort((a, b) => a.page_number - b.page_number);

  const extraction_pages: number[] = [];
  const skipped_pages: DetectedSection["skipped_pages"] = [];
  const page_roles: (string | null)[] = [];
  const page_purposes: string[] = [];
  const confidences: number[] = [];

  for (const p of inSection) {
    const purpose = effectivePurpose(p);
    const isData = purpose === EXTRACTABLE_PURPOSE;
    const isDuplicate = p.duplicate_of != null;

    if (isData && !isDuplicate) {
      extraction_pages.push(p.page_number);
    } else if (isDuplicate) {
      skipped_pages.push({
        page_number: p.page_number,
        reason: "duplicate",
        duplicate_of: p.duplicate_of,
        page_purpose: purpose,
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
    member_pages,
    // Derived [min, max] display span — may interleave with other sections'.
    page_range: [member_pages[0], member_pages[member_pages.length - 1]],
    // Member count, NOT span width.
    page_count: member_pages.length,
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
 * Split a section into two at `atPage`: member pages below `atPage` vs
 * member pages at/above it. For a contiguous section that's the classic
 * [start, atPage-1] / [atPage, end] split; for a non-contiguous one it
 * splits by position in the member list (splitting [2,3,7] at 7 peels the
 * appendix page back off). Both halves get section_result_id: null.
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
  const members = getMemberPages(section);

  const firstPages = members.filter((p) => p < atPage);
  const secondPages = members.filter((p) => p >= atPage);
  if (firstPages.length === 0 || secondPages.length === 0) {
    throw new Error(
      `atPage ${atPage} does not split section pages [${members.join(", ")}] ` +
        `into two non-empty halves`
    );
  }

  const allPages = blob.pages ?? [];
  const first = buildSectionFromPages(allPages, firstPages, section);
  const second = buildSectionFromPages(allPages, secondPages, section);

  blob.sections.splice(index, 1, first, second);
  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

/**
 * Merge two sections into one. `indexA` is the anchor: the merged section
 * inherits its slug and threshold. Defaults to merging with the next
 * section, but ANY other section may be passed — adjacency is NOT
 * required. Member pages are unioned, so pages in the gap between two
 * non-adjacent sections are untouched (this is the gesture for wiring an
 * appendix-figure section to its log). Gets section_result_id: null.
 */
export function mergeSections(
  detectedSections: DetectedSections,
  indexA: number,
  indexB: number = indexA + 1
): DetectedSections {
  if (indexA === indexB) {
    throw new Error("Cannot merge a section with itself");
  }

  const blob = cloneBlob(detectedSections);
  const secA = requireSection(blob, indexA);
  const secB = requireSection(blob, indexB);

  if (secA.superseded_by || secB.superseded_by) {
    throw new Error("Cannot merge a superseded section");
  }

  const pagesA = getMemberPages(secA);
  const pagesB = getMemberPages(secB);
  const overlap = pagesA.filter((p) => pagesB.includes(p));
  if (overlap.length > 0) {
    throw new Error(
      `Sections ${indexA} and ${indexB} both claim page(s) ${overlap.join(", ")}`
    );
  }

  const allPages = blob.pages ?? [];
  const merged = buildSectionFromPages(allPages, [...pagesA, ...pagesB], secA);

  // Remove the higher index first so the lower stays valid; insert at the
  // lower index — the merged section starts at the earlier section's first
  // page, so ordering by start page is preserved.
  const hi = Math.max(indexA, indexB);
  const lo = Math.min(indexA, indexB);
  blob.sections.splice(hi, 1);
  blob.sections.splice(lo, 1, merged);
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

  // Update per-page slugs by MEMBERSHIP, not range: a non-contiguous
  // section's span may cover pages that belong to another section.
  const members = new Set(getMemberPages(section));
  for (const p of blob.pages ?? []) {
    if (typeof p.page_number === "number" && members.has(p.page_number)) {
      p.document_type_slug = slug;
    }
  }

  blob.status = deriveFileStatus(blob.sections);
  return blob;
}

const DEFAULT_THRESHOLD = 0.75;

/**
 * Attach a page the classifier left "outside any section" to an existing
 * section. The page does NOT need to be adjacent to the section — attaching
 * an appendix figure on p 7 to a log on pp 2–3 yields a non-contiguous
 * section with member_pages [2,3,7]; pages in between are untouched.
 *
 * This is a reviewer override of the classifier's skip decision, so the
 * page gets `page_purpose_override: 'data'` and lands in extraction_pages
 * regardless of what the classifier thought it was (otherwise attaching a
 * "figure" page would be a silent no-op). The classifier's original
 * page_purpose is preserved. The section is rebuilt and marked for
 * re-extraction.
 *
 * Mirrors `applyAttachPages` in ai/src/services/sectionRoutingEdits.js.
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

  if (section.superseded_by) {
    throw new Error("Cannot attach pages to a superseded section");
  }

  // A page belongs to at most one section — check MEMBERSHIP across all
  // sections (spans may interleave, so range containment is wrong here).
  for (let i = 0; i < blob.sections.length; i++) {
    if (getMemberPages(blob.sections[i]).includes(pageNumber)) {
      throw new Error(
        i === index
          ? `Page ${pageNumber} is already in this section`
          : `Page ${pageNumber} already belongs to another section — merge instead`
      );
    }
  }

  const allPages = blob.pages ?? [];
  const page = allPages.find((p) => p.page_number === pageNumber);
  if (!page) {
    throw new Error(`Page ${pageNumber} not found in this file's classified pages`);
  }

  // Reviewer override: make the page extractable and align its per-page slug.
  page.page_purpose_override = EXTRACTABLE_PURPOSE;
  page.document_type_slug = section.document_type_slug;

  const rebuilt = buildSectionFromPages(
    allPages,
    [...getMemberPages(section), pageNumber],
    section
  );
  blob.sections.splice(index, 1, rebuilt);
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
    blob.sections.some((s) => getMemberPages(s).includes(pageNumber))
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
    member_pages: [pageNumber],
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
  // Membership-based: don't clobber interleaved pages of other sections.
  const members = new Set(getMemberPages(section));
  for (const p of blob.pages ?? []) {
    if (typeof p.page_number === "number" && members.has(p.page_number)) {
      p.document_type_slug = "none";
      // A deleted section's attach overrides are void too.
      delete p.page_purpose_override;
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
    // Compare full membership, not just the span — an attach can change
    // members without moving the [min, max] endpoints.
    const cm = getMemberPages(c);
    const sm = getMemberPages(s);
    if (cm.length !== sm.length || cm.some((p, j) => p !== sm[j])) return true;
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
