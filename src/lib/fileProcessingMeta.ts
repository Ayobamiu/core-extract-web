import type { JobFile, SectionResult } from "@/lib/api";

export type FileProcessingSummary = {
  extractionMethod: string | null;
  processingMethod: string | null;
  model: string | null;
  resultEnvelope: "v1" | "v2" | null;
  documentTypeSlugs: string[];
  schemasUsed: Array<{ slug: string; version: number; schemaId?: string }>;
  perSection: {
    sectionCount: number;
    successCount: number;
    failedCount: number;
    skippedCount: number;
    totalAiTimeSeconds: number | null;
  } | null;
  classifier: {
    model?: string;
    provider?: string;
    version?: number;
    sectionCount?: number;
    fellBack?: boolean;
    fellBackReason?: string;
  } | null;
  routingStatus: string | null;
  sectionCount: number;
};

function aiMetaFromFile(file: JobFile): Record<string, unknown> | null {
  const top = file.processing_metadata as Record<string, unknown> | undefined;
  if (top?.model) return top;

  const sections = file.extraction_metadata?.section_results;
  if (!Array.isArray(sections)) return null;
  const first = sections.find(
    (s) => s?.status === "success" && s.ai_metadata,
  ) as SectionResult | undefined;
  return (first?.ai_metadata as Record<string, unknown>) ?? null;
}

/** Normalize processing / routing fields for display chips and panels. */
export function buildFileProcessingSummary(
  file: JobFile | null | undefined,
): FileProcessingSummary {
  if (!file) {
    return {
      extractionMethod: null,
      processingMethod: null,
      model: null,
      resultEnvelope: null,
      documentTypeSlugs: [],
      schemasUsed: [],
      perSection: null,
      classifier: null,
      routingStatus: null,
      sectionCount: 0,
    };
  }

  const extMeta = file.extraction_metadata as Record<string, unknown> | undefined;
  const procMeta = aiMetaFromFile(file);
  const visual = extMeta?.visual_page_classifier as
    | Record<string, unknown>
    | undefined;
  const classifierRan = visual?.ran === true;
  const classifierInner = visual?.classifier as
    | Record<string, unknown>
    | undefined;

  const sections = file.detected_sections?.sections ?? [];
  const slugs = [
    ...new Set(
      sections
        .map((s) => s.document_type_slug)
        .filter((s): s is string => Boolean(s)),
    ),
  ];

  const schemasUsed: FileProcessingSummary["schemasUsed"] = [];
  const rawSchemas = file.extraction_metadata?.schemas_used;
  if (rawSchemas && typeof rawSchemas === "object") {
    for (const [slug, info] of Object.entries(rawSchemas)) {
      if (info && typeof info === "object") {
        schemasUsed.push({
          slug,
          version: Number((info as { version?: number }).version) || 0,
          schemaId: (info as { schemaId?: string }).schemaId,
        });
      }
    }
  }

  const ps = file.extraction_metadata?.per_section_extraction;

  return {
    extractionMethod:
      (extMeta?.extraction_method as string) ??
      (file.extraction_metadata?.extraction_method as string) ??
      null,
    processingMethod: (procMeta?.processing_method as string) ?? null,
    model: (procMeta?.model as string) ?? null,
    resultEnvelope:
      file.extraction_metadata?.result_envelope === "v2"
        ? "v2"
        : file.extraction_metadata?.result_envelope === "v1"
          ? "v1"
          : null,
    documentTypeSlugs: slugs,
    schemasUsed,
    perSection: ps
      ? {
          sectionCount: ps.section_count ?? 0,
          successCount: ps.success_count ?? 0,
          failedCount: ps.failed_count ?? 0,
          skippedCount: ps.skipped_count ?? 0,
          totalAiTimeSeconds: ps.total_ai_time_seconds ?? null,
        }
      : null,
    classifier: classifierRan
      ? {
          model: classifierInner?.model as string | undefined,
          provider: (classifierInner?.name as string) ?? "openai-vision",
          version: classifierInner?.version as number | undefined,
          sectionCount: visual?.section_count as number | undefined,
          fellBack: visual?.fell_back as boolean | undefined,
          fellBackReason: visual?.fell_back_reason as string | undefined,
        }
      : null,
    routingStatus: file.detected_sections?.status ?? null,
    sectionCount: sections.length,
  };
}
