/**
 * research-cross input schema.
 * Self-contained duplicate of only the locked GTM brief and prior-output fields this skill needs.
 */
import { z } from "zod";

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
    goals: gtmBriefFieldSchema,
    campaignObjective: gtmBriefFieldSchema,
    expectedOutput: gtmBriefFieldSchema,
    targetMarket: gtmBriefFieldSchema,
  })
  .strict();

const optionalBriefFieldsSchema = z
  .object({
    primaryIcpDescription: gtmBriefFieldSchema.optional(),
    jobTitles: gtmBriefFieldSchema.optional(),
    icpRoles: gtmBriefFieldSchema.optional(),
    companySize: gtmBriefFieldSchema.optional(),
    buyingCommittee: gtmBriefFieldSchema.optional(),
    buyingTriggers: gtmBriefFieldSchema.optional(),
    icpPains: gtmBriefFieldSchema.optional(),
    currentAlternative: gtmBriefFieldSchema.optional(),
    awarenessLevel: gtmBriefFieldSchema.optional(),
    icpObjections: gtmBriefFieldSchema.optional(),
    market: gtmBriefFieldSchema.optional(),
    industryVertical: gtmBriefFieldSchema.optional(),
    geography: gtmBriefFieldSchema.optional(),
    useCases: gtmBriefFieldSchema.optional(),
    corePromise: gtmBriefFieldSchema.optional(),
    firstValueMoment: gtmBriefFieldSchema.optional(),
    activationEvent: gtmBriefFieldSchema.optional(),
    salesMotion: gtmBriefFieldSchema.optional(),
    gtmMotion: gtmBriefFieldSchema.optional(),
    topCompetitors: gtmBriefFieldSchema.optional(),
    knownCompetitors: gtmBriefFieldSchema.optional(),
    alternatives: gtmBriefFieldSchema.optional(),
    commonObjections: gtmBriefFieldSchema.optional(),
    keyPromises: gtmBriefFieldSchema.optional(),
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

export const sourceSchema = z
  .object({
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const sourcedClaimSchema = sourceSchema
  .extend({
    claim: z.string().min(1),
    evidence_id: z.string().min(1).optional(),
  })
  .strict();

const requiredSkillNameSchema = z.enum([
  "ingest-identity",
  "research-market",
  "research-icp",
  "research-offer",
  "research-competitor",
  "research-voc",
  "research-keywords",
]);

const priorSkillOutputBaseSchema = z
  .object({
    skill: requiredSkillNameSchema,
    stage: z.string().min(1),
    output_path: z.string().min(1),
    generated_at: z.string().datetime(),
    key_claims: z.array(sourcedClaimSchema).min(1),
    research_gaps: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const ingestIdentityOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("ingest-identity"),
    stage: z.literal("ingest-identity"),
    canonical_company_name: z.string().min(1),
    canonical_domain: z.string().min(1),
    category: z.string().min(1),
    core_keywords: z.array(z.string().min(1)),
    negative_keywords: z.array(z.string().min(1)),
  })
  .strict();

export const researchMarketOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("research-market"),
    stage: z.literal("research-market-category"),
    category: z.string().min(1),
  })
  .strict();

export const researchIcpOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("research-icp"),
    stage: z.literal("research-buyer-icp"),
    persona_anchors: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const researchOfferOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("research-offer"),
    stage: z.literal("research-offer-funnel"),
    offer_claims: z.array(sourcedClaimSchema).min(1),
  })
  .strict();

export const researchCompetitorOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("research-competitor"),
    stage: z.literal("research-competitors"),
    competitor_set: z.array(z.string().min(1)).min(1),
  })
  .strict();

export const researchVocOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("research-voc"),
    stage: z.literal("research-voc"),
    objection_evidence: z.array(sourcedClaimSchema),
  })
  .strict();

export const researchKeywordsOutputSchema = priorSkillOutputBaseSchema
  .extend({
    skill: z.literal("research-keywords"),
    stage: z.literal("research-demand-intent"),
    demand_intents: z.array(sourcedClaimSchema).min(1),
  })
  .strict();

export const researchCrossInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("synthesize-strategy"),
    gtm_brief: lockedGtmBriefSchema,
    ingest_identity: ingestIdentityOutputSchema,
    research_market: researchMarketOutputSchema,
    research_icp: researchIcpOutputSchema,
    research_offer: researchOfferOutputSchema,
    research_competitor: researchCompetitorOutputSchema,
    research_voc: researchVocOutputSchema,
    research_keywords: researchKeywordsOutputSchema,
  })
  .strict();

export type ResearchCrossInput = z.infer<typeof researchCrossInputSchema>;
