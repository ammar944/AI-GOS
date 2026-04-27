/**
 * synthesize-media-plan output schema.
 * Recommendations only when each recommendation carries derivation and evidence.
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
  "synthesize-positioning",
  "research-icp",
  "research-offer",
  "research-keywords",
  "research-competitor",
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

export const platformSchema = z.enum([
  "meta",
  "google",
  "linkedin",
  "youtube",
  "tiktok",
  "reddit",
  "other",
]);

export const campaignSchema = z
  .object({
    platform: platformSchema,
    name: z.string().min(1),
    objective: derivedClaimSchema,
    audience: derivedClaimSchema,
    budget_share_pct: z.number().min(0).max(100),
    single_campaign_rationale: derivedClaimSchema.optional(),
  })
  .strict();

export const rolloutPhaseSchema = z
  .object({
    phase: z.number().int().min(1).max(4),
    name: z.string().min(1),
    duration: z.string().min(1),
    objectives: z.array(derivedClaimSchema).min(1),
    campaigns: z.array(campaignSchema).max(2),
    decision_gate: derivedClaimSchema,
    google_phase_out_reason: derivedClaimSchema.optional(),
  })
  .strict();

export const benchmarkSchema = z
  .object({
    metric: z.string().min(1),
    range: sourcedClaimSchema,
    interpretation: derivedClaimSchema,
    levers_to_move_it: z.array(derivedClaimSchema).length(2),
  })
  .strict();

export const synthesizeMediaPlanOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("generate-media-plan"),
    company_name: z.string().min(1),
    strategic_frame: z
      .object({
        business_model: derivedClaimSchema,
        awareness_level: derivedClaimSchema,
        sales_cycle_ceiling: derivedClaimSchema,
        in_market_tier_mix: derivedClaimSchema,
      })
      .strict(),
    channel_mix: z.array(derivedClaimSchema).min(1).max(3),
    audience_campaign_matrix: z.array(campaignSchema).min(1),
    creative_angle_system: z.array(derivedClaimSchema).min(3).max(8),
    sales_process_guidance: z.array(derivedClaimSchema).min(1),
    industry_benchmarks: z.array(benchmarkSchema).max(2),
    rollout_phases: z.array(rolloutPhaseSchema).min(2).max(4),
    strategy_snapshot: z.array(derivedClaimSchema).min(3).max(6),
    validation_warnings: z.array(z.string()),
    generated_at: z.string().datetime(),
  })
  .strict();

export type Source = z.infer<typeof sourceSchema>;
export type SourcedClaim = z.infer<typeof sourcedClaimSchema>;
export type DerivedFrom = z.infer<typeof derivedFromSchema>;
export type DerivedClaim = z.infer<typeof derivedClaimSchema>;
export type Platform = z.infer<typeof platformSchema>;
export type Campaign = z.infer<typeof campaignSchema>;
export type RolloutPhase = z.infer<typeof rolloutPhaseSchema>;
export type Benchmark = z.infer<typeof benchmarkSchema>;
export type SynthesizeMediaPlanOutput = z.infer<
  typeof synthesizeMediaPlanOutputSchema
>;
