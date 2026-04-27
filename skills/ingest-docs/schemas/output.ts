/**
 * ingest-docs output schema.
 * Facts only. Every extracted value carries source URL and retrieval time.
 */
import { z } from "zod";
import { documentKindHintSchema, gtmStageTagSchema } from "./input.ts";

const PLACEHOLDER_PATTERNS: RegExp[] = [
  /^\s*unknown\s*$/i,
  /^\s*tbd\s*$/i,
  /^\s*n\/a\s*$/i,
  /^\s*na\s*$/i,
  /^\s*not found\s*$/i,
  /\bscaffold\b/i,
];

function rejectPlaceholder(label: string): (value: string) => boolean {
  return (value: string) => {
    const trimmed = value.trim();
    return trimmed.length > 0 && !PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
  };
}

function sourcedString(label: string): z.ZodEffects<z.ZodString, string, string> {
  return z.string().min(1).refine(rejectPlaceholder(label), `${label} cannot be a placeholder value`);
}

export const sourcedClaimSchema = z
  .object({
    value: sourcedString("value"),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

const documentSourceBaseSchema = z
  .object({
    document_id: sourcedString("document_id"),
    file_name: sourcedString("file_name"),
    mime_type: sourcedString("mime_type"),
  })
  .strict();

const documentSourceMetaSchema = z
  .object({
    doc_kind: documentKindHintSchema,
    gtm_stage_tags: z.array(gtmStageTagSchema),
    word_count: z.number().int().nonnegative(),
    page_count: z.number().int().positive().optional(),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const documentSourceSchema = documentSourceBaseSchema.merge(documentSourceMetaSchema).strict();

const extractedFieldBaseSchema = z
  .object({
    field_key: sourcedString("field_key"),
    label: sourcedString("label"),
    value: sourcedString("value"),
  })
  .strict();

const extractedFieldEvidenceSchema = z
  .object({
    confidence: z.enum(["low", "medium", "high"]),
    evidence: z.array(sourcedClaimSchema).min(1),
    source_document_ids: z.array(sourcedString("source_document_id")).min(1),
  })
  .strict();

export const extractedFieldSchema = extractedFieldBaseSchema
  .merge(extractedFieldEvidenceSchema)
  .strict();

export const conflictSchema = z
  .object({
    field_key: sourcedString("field_key"),
    values: z.array(sourcedClaimSchema).min(2),
    resolution_note: sourcedString("resolution_note"),
  })
  .strict();

export const briefFragmentFieldSchema = z
  .object({
    value: sourcedString("value"),
    confidence: z.enum(["low", "medium", "high"]),
    evidence: z.array(sourcedClaimSchema).min(1),
    source_document_ids: z.array(sourcedString("source_document_id")).min(1),
  })
  .strict();

export const ingestDocsOutputSchema = z
  .object({
    run_id: sourcedString("run_id"),
    stage: z.literal("enrich-brief"),
    documents: z.array(documentSourceSchema).min(1),
    brief_fragment: z.record(briefFragmentFieldSchema),
    field_catalog: z.array(extractedFieldSchema),
    conflicts: z.array(conflictSchema),
    unresolved_fields: z.array(sourcedString("unresolved_field")),
    generated_at: z.string().datetime(),
  })
  .strict();

export type SourcedClaim = z.infer<typeof sourcedClaimSchema>;
export type DocumentSource = z.infer<typeof documentSourceSchema>;
export type ExtractedField = z.infer<typeof extractedFieldSchema>;
export type IngestDocsOutput = z.infer<typeof ingestDocsOutputSchema>;
