/**
 * synthesize-positioning output schema.
 * Synthesis is allowed, but every claim must preserve upstream provenance.
 */
import { z } from "zod";

export const sourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const sourcedClaimSchema = sourceSchema
  .extend({
    claim: z.string().min(1),
  })
  .strict();

export const derivedFromSchema = z.enum([
  "ingest-identity",
  "research-icp",
  "research-offer",
  "research-cross",
  "research-voc",
  "research-market",
  "gtm-brief",
]);

export const derivedClaimSchema = z
  .object({
    value: z.string().min(1),
    derived_from: z.array(derivedFromSchema).min(1),
    evidence: z.array(sourcedClaimSchema).min(1),
  })
  .strict();

export const rankedValuePropSchema = derivedClaimSchema
  .extend({
    rank: z.number().int().min(1).max(7),
    icp_fit_reason: derivedClaimSchema,
    objection_addressed: derivedClaimSchema.optional(),
  })
  .strict();

export const narrativeArcSchema = z
  .object({
    old_way: derivedClaimSchema,
    cost_of_old_way: derivedClaimSchema,
    new_way: derivedClaimSchema,
    proof_bridge: z.array(derivedClaimSchema).min(1),
    closing_frame: derivedClaimSchema,
  })
  .strict();

export const synthesizePositioningOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("synthesize-strategy"),
    company_name: z.string().min(1),
    category: z.string().min(1),
    positioning_statement: derivedClaimSchema,
    one_line_promise: derivedClaimSchema,
    ranked_value_props: z.array(rankedValuePropSchema).min(3).max(7),
    narrative_arc: narrativeArcSchema,
    status_quo_contrast: z.array(derivedClaimSchema).min(2).max(5),
    message_angles: z.array(derivedClaimSchema).min(3).max(8),
    claims_not_allowed: z.array(derivedClaimSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type DerivedClaim = z.infer<typeof derivedClaimSchema>;
export type SynthesizePositioningOutput = z.infer<
  typeof synthesizePositioningOutputSchema
>;
