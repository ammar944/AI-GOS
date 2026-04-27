/**
 * research-icp output schema.
 * Facts only. No scores, estimates, recommendations, or fabricated metrics.
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

export const personaAnchorSchema = z
  .object({
    persona_name: z.string().min(1),
    role_family: z.string().min(1),
    seniority: z.string().min(1).optional(),
    company_context: z.array(sourcedClaimSchema),
    pains: z.array(sourcedClaimSchema),
    triggers: z.array(sourcedClaimSchema),
    objections: z.array(sourcedClaimSchema),
    current_alternatives: z.array(sourcedClaimSchema),
  })
  .strict();

export const awarenessStageSchema = z
  .object({
    stage: z.enum([
      "unaware",
      "problem_aware",
      "solution_aware",
      "product_aware",
      "most_aware",
    ]),
    evidence: z.array(sourcedClaimSchema),
    message_implication: z.string().min(1),
  })
  .strict();

export const jobTitleSchema = sourceSchema
  .extend({
    title: z.string().min(1),
    department: z.string().min(1).optional(),
    seniority: z.string().min(1).optional(),
    buying_role: z.enum([
      "economic_buyer",
      "champion",
      "user",
      "technical_evaluator",
      "procurement",
      "influencer",
    ]),
  })
  .strict();

export const searchIntentSchema = sourceSchema
  .extend({
    query_pattern: z.string().min(1),
    intent: z.enum([
      "problem",
      "solution",
      "category",
      "competitor",
      "implementation",
      "pricing",
    ]),
    likely_persona: z.string().min(1),
  })
  .strict();

export const researchIcpOutputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-buyer-icp"),
    company_name: z.string().min(1),
    category: z.string().min(1),
    persona_anchors: z.array(personaAnchorSchema).min(1),
    awareness_stages: z.array(awarenessStageSchema).min(1),
    job_titles: z.array(jobTitleSchema).min(1),
    search_intent: z.array(searchIntentSchema).min(1),
    buying_committee_notes: z.array(sourcedClaimSchema),
    exclusions: z.array(sourcedClaimSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type ResearchIcpOutput = z.infer<typeof researchIcpOutputSchema>;
