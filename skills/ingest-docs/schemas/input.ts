/**
 * ingest-docs input schema.
 * Self-contained contract for uploaded document payloads feeding enrich-brief.
 */
import { z } from "zod";

const PLACEHOLDER_VALUES = new Set(["unknown", "tbd", "n/a", "na", "not found", "scaffold"]);

export const acceptedMimeTypes = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
] as const;

export const documentKindHintSchema = z.enum([
  "pitch_deck",
  "icp_doc",
  "case_study",
  "brand_book",
  "pricing_sheet",
  "competitor_analysis",
  "market_research",
  "meeting_transcript",
  "other",
]);

export const gtmStageTagSchema = z.enum([
  "ingest-identity",
  "research-market-category",
  "research-buyer-icp",
  "research-competitor",
  "research-offer",
  "research-keywords",
  "synthesize-positioning",
  "synthesize-media-plan",
]);

export const MAX_FILES_PER_RUN = 10;
export const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const MAX_TOTAL_TOKENS = 50_000;
export const MIN_WORD_COUNT = 10;

function isPlaceholder(value: string): boolean {
  return PLACEHOLDER_VALUES.has(value.trim().toLowerCase());
}

function nonPlaceholderString(label: string): z.ZodEffects<z.ZodString, string, string> {
  return z
    .string()
    .min(1)
    .refine((value) => !isPlaceholder(value), `${label} cannot be a placeholder value`);
}

export function normalizeMimeType(mimeType: string): string {
  if (mimeType === "text/x-markdown") {
    return "text/markdown";
  }
  return mimeType;
}

export const priorSourcedValueSchema = z
  .object({
    value: nonPlaceholderString("value"),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const priorFieldSchema = z
  .object({
    field_key: nonPlaceholderString("field_key"),
    label: nonPlaceholderString("label"),
    value: nonPlaceholderString("value"),
    confidence: z.enum(["low", "medium", "high"]).optional(),
    evidence: z.array(priorSourcedValueSchema).min(1),
    source_document_ids: z.array(nonPlaceholderString("source_document_id")).optional(),
  })
  .strict();

export const ingestUrlOutputSchema = z
  .object({
    stage: z.literal("enrich-brief").optional(),
    field_catalog: z.array(priorFieldSchema).optional(),
  })
  .strict();

export const ingestDocumentInputSchema = z
  .object({
    document_id: nonPlaceholderString("document_id").optional(),
    file_name: nonPlaceholderString("file_name"),
    mime_type: z.enum(acceptedMimeTypes),
    file_base64: z.string().min(1).optional(),
    storage_path: nonPlaceholderString("storage_path").optional(),
    source_url: z.string().url().optional(),
    retrieved_at: z.string().datetime().optional(),
    file_size_bytes: z.number().int().positive().max(MAX_FILE_SIZE_BYTES).optional(),
    document_type_hint: documentKindHintSchema.optional(),
  })
  .strict()
  .superRefine((document, context) => {
    if (!document.file_base64 && !document.storage_path) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "one of file_base64 or storage_path is required",
        path: ["file_base64"],
      });
    }
    if (document.file_base64 && document.storage_path) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "provide only one of file_base64 or storage_path",
        path: ["storage_path"],
      });
    }
    if (!document.source_url && !document.storage_path?.startsWith("http")) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "source_url is required unless storage_path is an HTTP source URL",
        path: ["source_url"],
      });
    }
  });

export const ingestDocsInputSchema = z
  .object({
    run_id: nonPlaceholderString("run_id"),
    stage: z.literal("enrich-brief").optional(),
    brief_id: nonPlaceholderString("brief_id").optional(),
    client_id: nonPlaceholderString("client_id").optional(),
    business_profile_id: nonPlaceholderString("business_profile_id").optional(),
    documents: z.array(ingestDocumentInputSchema).min(1).max(MAX_FILES_PER_RUN),
    ingest_url: ingestUrlOutputSchema.optional(),
  })
  .strict();

export type IngestDocsInput = z.infer<typeof ingestDocsInputSchema>;
export type IngestDocumentInput = z.infer<typeof ingestDocumentInputSchema>;
export type DocumentKindHint = z.infer<typeof documentKindHintSchema>;
export type GtmStageTag = z.infer<typeof gtmStageTagSchema>;
