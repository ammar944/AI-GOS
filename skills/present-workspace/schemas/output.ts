import { z } from "zod";
import { cardStatusSchema, sectionKeySchema } from "./input.ts";

export const sourcedClaimSchema = z
  .object({
    value: z.string().min(1),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

const nonEmptyRecordSchema = z.record(z.string(), z.unknown()).refine(
  (content) => Object.keys(content).length > 0,
  "content must contain renderable data",
);

export const workspaceCardSchema = z
  .object({
    id: z.string().min(1),
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1).optional(),
    section_key: sectionKeySchema,
    card_kind: z.string().min(1),
    card_type: z.string().min(1),
    label: z.string().min(1),
    description: z.string().min(1).optional(),
    content: nonEmptyRecordSchema,
    status: cardStatusSchema,
    evidence: z.array(sourcedClaimSchema).min(1),
  })
  .strict();

export const cardWriteResultSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1).optional(),
    section_key: sectionKeySchema,
    card_id: z.string().min(1),
    card_kind: z.string().min(1),
    prior_content_snapshot: z.record(z.string(), z.unknown()).nullable(),
    new_content_snapshot: nonEmptyRecordSchema,
    outcome: z.enum(["dry_run", "mock_written"]),
    idempotency_key: z.string().min(1),
  })
  .strict();

export const researchResultEnvelopeSchema = z
  .object({
    status: z.enum(["complete", "partial", "error"]),
    section: sectionKeySchema,
    data: z.record(z.string(), z.unknown()),
    durationMs: z.number().int().nonnegative(),
    __cardEdits: z.record(z.string(), z.record(z.string(), z.unknown())).optional(),
  })
  .strict();

export const supabaseWriteSchema = z
  .object({
    table: z.literal("journey_sessions"),
    user_id: z.string().min(1),
    run_id: z.string().min(1),
    section_key: sectionKeySchema,
    result_status: z.enum(["complete", "partial", "error"]),
    transport: z.enum(["dry-run", "mock-write"]),
    wrote_research_results: z.boolean(),
    wrote_research_document: z.boolean(),
    write_happened: z.boolean(),
    outcome: z.enum(["dry_run", "mock_written"]),
    updated_at: z.string().datetime(),
    idempotency_key: z.string().min(1),
    card_results: z.array(cardWriteResultSchema).min(1),
    warnings: z.array(z.string().min(1)),
  })
  .strict();

export const presentWorkspaceOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1).optional(),
    stage: z.literal("present-workspace"),
    section_key: sectionKeySchema,
    cards: z.array(workspaceCardSchema).min(1),
    research_result_envelope: researchResultEnvelopeSchema,
    write: supabaseWriteSchema,
    warnings: z.array(z.string().min(1)),
    generated_at: z.string().datetime(),
  })
  .strict();

export type SourcedClaim = z.infer<typeof sourcedClaimSchema>;
export type WorkspaceCard = z.infer<typeof workspaceCardSchema>;
export type CardWriteResult = z.infer<typeof cardWriteResultSchema>;
export type ResearchResultEnvelope = z.infer<typeof researchResultEnvelopeSchema>;
export type SupabaseWrite = z.infer<typeof supabaseWriteSchema>;
export type PresentWorkspaceOutput = z.infer<typeof presentWorkspaceOutputSchema>;
