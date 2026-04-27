/**
 * research-icp input schema.
 * Self-contained duplicate of only the locked GTM brief fields this skill needs.
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
    icpRoles: gtmBriefFieldSchema,
    companySize: gtmBriefFieldSchema,
    buyingCommittee: gtmBriefFieldSchema,
    buyingTriggers: gtmBriefFieldSchema,
    icpPains: gtmBriefFieldSchema,
    currentAlternative: gtmBriefFieldSchema,
    awarenessLevel: gtmBriefFieldSchema,
    icpObjections: gtmBriefFieldSchema,
  })
  .strict();

const optionalBriefFieldsSchema = z
  .object({
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

export const researchMarketOutputSchema = z
  .object({
    stage: z.literal("research-market-category").optional(),
    category: z.string().min(1),
    category_framing: z.string().min(1).optional(),
    market_context: z.array(z.string().min(1)).optional(),
  })
  .strict();

export const researchIcpInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-buyer-icp"),
    gtm_brief: lockedGtmBriefSchema,
    ingest_identity: ingestIdentityOutputSchema.optional(),
    research_market: researchMarketOutputSchema.optional(),
  })
  .strict();

export type ResearchIcpInput = z.infer<typeof researchIcpInputSchema>;
