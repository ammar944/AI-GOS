/**
 * ingest-fathom output schema.
 * Sales-call facts only. Transcript claims require source metadata and speaker attribution.
 */
import { z } from "zod";

export const sourcedClaimSchema = z
  .object({
    value: z.string().min(1),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const transcriptQuoteSchema = sourcedClaimSchema
  .extend({
    speaker: z.string().min(1),
    timestamp: z.string().min(1).optional(),
  })
  .strict();

export const actionItemSchema = z
  .object({
    action: sourcedClaimSchema,
    owner: sourcedClaimSchema.optional(),
    due_date: sourcedClaimSchema.optional(),
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const decisionSchema = z
  .object({
    decision: sourcedClaimSchema,
    participants: z.array(sourcedClaimSchema),
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const speakerSchema = z
  .object({
    name: sourcedClaimSchema,
    role: sourcedClaimSchema.optional(),
  })
  .strict();

export const painPointSchema = z
  .object({
    pain: sourcedClaimSchema,
    severity: z.enum(["critical", "moderate", "minor"]),
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const budgetSignalSchema = z
  .object({
    signal: sourcedClaimSchema,
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const competitorMentionSchema = z
  .object({
    name: sourcedClaimSchema,
    sentiment: z.enum(["positive", "negative", "neutral"]),
    context: sourcedClaimSchema.optional(),
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const buyingTriggerSchema = z
  .object({
    trigger: sourcedClaimSchema,
    urgency: z.enum(["immediate", "near_term", "exploratory"]),
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const objectionSchema = z
  .object({
    objection: sourcedClaimSchema,
    resolution: sourcedClaimSchema.optional(),
    evidence: transcriptQuoteSchema,
  })
  .strict();

export const icpSignalsSchema = z
  .object({
    company_size: sourcedClaimSchema.optional(),
    role: sourcedClaimSchema.optional(),
    industry: sourcedClaimSchema.optional(),
    decision_process: sourcedClaimSchema.optional(),
    decision_timeline: sourcedClaimSchema.optional(),
  })
  .strict();

export const currentMarketingSchema = z
  .object({
    channels: z.array(sourcedClaimSchema),
    monthly_spend: sourcedClaimSchema.optional(),
    what_works: sourcedClaimSchema.optional(),
    what_fails: sourcedClaimSchema.optional(),
    evidence: z.array(transcriptQuoteSchema),
  })
  .strict();

export const goalsAndOutcomesSchema = z
  .object({
    primary_goal: sourcedClaimSchema.optional(),
    success_metrics: z.array(sourcedClaimSchema),
    desired_transformation: sourcedClaimSchema.optional(),
    evidence: z.array(transcriptQuoteSchema),
  })
  .strict();

export const ingestFathomOutputSchema = z
  .object({
    run_id: z.string().min(1),
    stage: z.literal("enrich-brief"),
    ingest_kind: z.literal("fathom"),
    recording_id: z.string().min(1),
    recording_url: z.string().url(),
    title: sourcedClaimSchema.optional(),
    call_type: z.enum([
      "discovery",
      "demo",
      "follow_up",
      "closing",
      "strategy",
      "kickoff",
      "review",
      "other",
    ]),
    speakers: z.array(speakerSchema),
    business_health_summary: sourcedClaimSchema.optional(),
    pain_points: z.array(painPointSchema),
    budget_signals: z.array(budgetSignalSchema),
    competitor_mentions: z.array(competitorMentionSchema),
    buying_triggers: z.array(buyingTriggerSchema),
    objections: z.array(objectionSchema),
    icp_signals: icpSignalsSchema,
    current_marketing: currentMarketingSchema,
    goals_and_outcomes: goalsAndOutcomesSchema,
    action_items: z.array(actionItemSchema),
    decisions: z.array(decisionSchema),
    notable_quotes: z.array(transcriptQuoteSchema),
    generated_at: z.string().datetime(),
  })
  .strict();

export type IngestFathomOutput = z.infer<typeof ingestFathomOutputSchema>;
