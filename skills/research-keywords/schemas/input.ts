/**
 * research-keywords input schema.
 * Self-contained duplicate of only the locked GTM brief and prior-stage fields this skill needs.
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
    value: z.string(),
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
    icpPains: gtmBriefFieldSchema,
    currentAlternative: gtmBriefFieldSchema,
    awarenessLevel: gtmBriefFieldSchema,
    goals: gtmBriefFieldSchema,
    campaignObjective: gtmBriefFieldSchema,
    targetMarket: gtmBriefFieldSchema,
  })
  .strict();

const optionalBriefFieldsSchema = z
  .object({
    market: gtmBriefFieldSchema.optional(),
    industryVertical: gtmBriefFieldSchema.optional(),
    geography: gtmBriefFieldSchema.optional(),
    useCases: gtmBriefFieldSchema.optional(),
    corePromise: gtmBriefFieldSchema.optional(),
    cta: gtmBriefFieldSchema.optional(),
    topCompetitors: gtmBriefFieldSchema.optional(),
    knownCompetitors: gtmBriefFieldSchema.optional(),
    alternatives: gtmBriefFieldSchema.optional(),
    categoryFrames: gtmBriefFieldSchema.optional(),
    commonObjections: gtmBriefFieldSchema.optional(),
    keyPromises: gtmBriefFieldSchema.optional(),
    channels: gtmBriefFieldSchema.optional(),
    whatIsWorking: gtmBriefFieldSchema.optional(),
    whatIsNotWorking: gtmBriefFieldSchema.optional(),
  })
  .strict();

export const lockedGtmBriefFieldsSchema = requiredBriefFieldsSchema.merge(
  optionalBriefFieldsSchema,
);

export const lockedGtmBriefSchema = z
  .object({
    briefId: z.string().min(1),
    clientId: z.string().min(1).nullable(),
    fields: lockedGtmBriefFieldsSchema,
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
  .strict();

export const ingestIdentityOutputSchema = z
  .object({
    stage: z.literal("ingest-identity").optional(),
    canonical_company_name: z.string().min(1),
    canonical_domain: z.string().min(1),
    category: z.string().min(1),
    core_keywords: z.array(z.string().min(1)),
    negative_keywords: z.array(z.string().min(1)),
  })
  .strict();

export const sourcedClaimSchema = z
  .object({
    claim: z.string().min(1),
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const researchMarketOutputSchema = z
  .object({
    stage: z.literal("research-market-category").optional(),
    category: z.string().min(1).optional(),
    category_framing: z.string().min(1).optional(),
    demand_drivers: z.array(sourcedClaimSchema).optional(),
    buying_triggers: z.array(sourcedClaimSchema).optional(),
    adoption_barriers: z.array(sourcedClaimSchema).optional(),
  })
  .strict();

export const researchIcpSearchIntentSchema = z
  .object({
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
    source_url: z.string().url(),
    retrieved_at: z.string().datetime(),
  })
  .strict();

export const researchIcpPriorOutputSchema = z
  .object({
    stage: z.literal("research-buyer-icp").optional(),
    persona_anchors: z
      .array(
        z
          .object({
            persona_name: z.string().min(1),
            role_family: z.string().min(1),
            pains: z.array(sourcedClaimSchema).optional(),
            objections: z.array(sourcedClaimSchema).optional(),
          })
          .strict(),
      )
      .optional(),
    search_intent: z.array(researchIcpSearchIntentSchema).optional(),
    buying_committee_notes: z.array(sourcedClaimSchema).optional(),
    exclusions: z.array(sourcedClaimSchema).optional(),
  })
  .strict();

export const researchKeywordsInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-demand-intent"),
    gtm_brief: lockedGtmBriefSchema,
    ingest_identity: ingestIdentityOutputSchema,
    research_market: researchMarketOutputSchema.optional(),
    research_icp: researchIcpPriorOutputSchema.optional(),
  })
  .strict();

export type ResearchKeywordsInput = z.infer<typeof researchKeywordsInputSchema>;
