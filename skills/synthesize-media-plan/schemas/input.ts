/**
 * synthesize-media-plan input schema.
 * Self-contained duplicate of only the locked GTM brief fields this skill needs.
 */
import { z } from "zod";
import { derivedClaimSchema, sourcedClaimSchema } from "./output.ts";

export const evidenceSourceSchema = z
  .object({
    type: z.string().min(1).optional(),
    label: z.string().min(1).optional(),
    url: z.string().url().optional(),
    quote: z.string().min(1).optional(),
    retrievedAt: z.string().datetime().optional(),
  })
  .strict();

export const gtmBriefFieldSchema = z
  .object({
    value: z.string().min(1),
    status: z.enum(["missing", "suggested", "needs_review", "confirmed"]),
    confidence: z.enum(["missing", "low", "medium", "high"]),
    sources: z.array(evidenceSourceSchema),
    updatedBy: z.enum(["ai", "user", "system"]),
    updatedAt: z.string().datetime(),
  })
  .strict();

const requiredBriefFieldsSchema = z
  .object({
    companyName: gtmBriefFieldSchema,
    companyUrl: gtmBriefFieldSchema,
    category: gtmBriefFieldSchema,
    productDescription: gtmBriefFieldSchema,
    targetCustomer: gtmBriefFieldSchema,
    primaryIcpDescription: gtmBriefFieldSchema,
    jobTitles: gtmBriefFieldSchema,
    awarenessLevel: gtmBriefFieldSchema,
    icpPains: gtmBriefFieldSchema,
    buyingTriggers: gtmBriefFieldSchema,
    corePromise: gtmBriefFieldSchema,
    firstValueMoment: gtmBriefFieldSchema,
    activationEvent: gtmBriefFieldSchema,
    salesMotion: gtmBriefFieldSchema,
    gtmMotion: gtmBriefFieldSchema,
    conversionPath: gtmBriefFieldSchema,
    salesHandoff: gtmBriefFieldSchema,
    monthlyAdBudget: gtmBriefFieldSchema,
    avgAcv: gtmBriefFieldSchema,
    pricingModel: gtmBriefFieldSchema,
    salesCycleLength: gtmBriefFieldSchema,
  })
  .strict();

const optionalBriefFieldsSchema = z
  .object({
    channels: gtmBriefFieldSchema.optional(),
    channelBudgetSplit: gtmBriefFieldSchema.optional(),
    whatIsWorking: gtmBriefFieldSchema.optional(),
    whatIsNotWorking: gtmBriefFieldSchema.optional(),
    currentCac: gtmBriefFieldSchema.optional(),
    monthlyRevenue: gtmBriefFieldSchema.optional(),
    marginAssumptions: gtmBriefFieldSchema.optional(),
    compliance: gtmBriefFieldSchema.optional(),
    brandGeography: gtmBriefFieldSchema.optional(),
  })
  .strict();

export const lockedGtmBriefFieldsSchema = requiredBriefFieldsSchema
  .merge(optionalBriefFieldsSchema)
  .strict();

export const lockedGtmBriefSchema = z
  .object({
    briefId: z.string().min(1),
    clientId: z.string().min(1).nullable(),
    fields: lockedGtmBriefFieldsSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const positioningOutputSchema = z
  .object({
    stage: z.literal("synthesize-strategy").optional(),
    positioning_statement: derivedClaimSchema,
    narrative_frame: derivedClaimSchema,
    proof_points: z.array(derivedClaimSchema).min(1),
  })
  .strict();

export const icpOutputSchema = z
  .object({
    stage: z.literal("research-buyer-icp").optional(),
    persona_anchors: z.array(derivedClaimSchema).min(1),
    attention_channels: z.array(derivedClaimSchema).min(1),
    awareness_evidence: z.array(derivedClaimSchema).min(1),
    objections: z.array(sourcedClaimSchema),
  })
  .strict();

export const offerOutputSchema = z
  .object({
    stage: z.literal("research-offer-funnel").optional(),
    conversion_path: derivedClaimSchema,
    value_moments: z.array(derivedClaimSchema).min(1),
    sales_process_notes: z.array(derivedClaimSchema).min(1),
  })
  .strict();

export const keywordOutputSchema = z
  .object({
    stage: z.literal("research-demand-intent").optional(),
    demand_intent: z.array(derivedClaimSchema).min(1),
    keyword_groups: z.array(derivedClaimSchema).min(1),
    negative_keywords: z.array(sourcedClaimSchema),
  })
  .strict();

export const optionalPriorOutputSchema = z
  .object({
    stage: z.string().min(1).optional(),
    evidence: z.array(sourcedClaimSchema).optional(),
    findings: z.array(derivedClaimSchema).optional(),
  })
  .strict();

export const synthesizeMediaPlanInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("generate-media-plan"),
    gtm_brief: lockedGtmBriefSchema,
    synthesize_positioning: positioningOutputSchema,
    research_icp: icpOutputSchema,
    research_offer: offerOutputSchema,
    research_keywords: keywordOutputSchema,
    research_competitor: optionalPriorOutputSchema.optional(),
    research_voc: optionalPriorOutputSchema.optional(),
    research_market: optionalPriorOutputSchema.optional(),
  })
  .strict();

export type EvidenceSource = z.infer<typeof evidenceSourceSchema>;
export type GtmBriefField = z.infer<typeof gtmBriefFieldSchema>;
export type LockedGtmBrief = z.infer<typeof lockedGtmBriefSchema>;
export type SynthesizeMediaPlanInput = z.infer<
  typeof synthesizeMediaPlanInputSchema
>;
