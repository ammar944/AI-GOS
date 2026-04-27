/**
 * research-voc input schema.
 * Self-contained duplicate of only the locked GTM brief and upstream fields this skill needs.
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

const requiredFields = z.object({
  companyName: gtmBriefFieldSchema,
  companyUrl: gtmBriefFieldSchema,
  category: gtmBriefFieldSchema,
  productDescription: gtmBriefFieldSchema,
  targetCustomer: gtmBriefFieldSchema,
  primaryIcpDescription: gtmBriefFieldSchema,
  icpPains: gtmBriefFieldSchema,
  currentAlternative: gtmBriefFieldSchema,
  buyingTriggers: gtmBriefFieldSchema,
  icpObjections: gtmBriefFieldSchema,
  topCompetitors: gtmBriefFieldSchema,
  knownCompetitors: gtmBriefFieldSchema,
  alternatives: gtmBriefFieldSchema,
});

const optionalFields = z.object({
  market: gtmBriefFieldSchema.optional(),
  industryVertical: gtmBriefFieldSchema.optional(),
  geography: gtmBriefFieldSchema.optional(),
  useCases: gtmBriefFieldSchema.optional(),
  corePromise: gtmBriefFieldSchema.optional(),
  categoryFrames: gtmBriefFieldSchema.optional(),
  lossReasons: gtmBriefFieldSchema.optional(),
  competitorStrengths: gtmBriefFieldSchema.optional(),
  commonObjections: gtmBriefFieldSchema.optional(),
  keyPromises: gtmBriefFieldSchema.optional(),
});

export const lockedGtmBriefFieldsSchema = requiredFields.merge(optionalFields).strict();

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
    category: z.string().min(1),
    category_definition: sourcedClaimSchema.optional(),
    pains: z.array(sourcedClaimSchema).optional(),
    demand_drivers: z.array(sourcedClaimSchema).optional(),
    adoption_barriers: z.array(sourcedClaimSchema).optional(),
  })
  .strict();

export const competitorRefSchema = z
  .object({
    name: z.string().min(1),
    type: z.enum(["subject", "direct", "indirect", "status_quo", "diy"]).optional(),
    source_url: z.string().url().optional(),
    retrieved_at: z.string().datetime().optional(),
  })
  .strict();

export const researchCompetitorOutputSchema = z
  .object({
    stage: z.literal("research-competitor").optional(),
    competitor_set: z.array(competitorRefSchema),
  })
  .strict();

export const researchVocInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("research-voc"),
    gtm_brief: lockedGtmBriefSchema,
    ingest_identity: ingestIdentityOutputSchema,
    research_market: researchMarketOutputSchema.optional(),
    research_competitor: researchCompetitorOutputSchema.optional(),
  })
  .strict();

export type ResearchVocInput = z.infer<typeof researchVocInputSchema>;
export type GtmBriefField = z.infer<typeof gtmBriefFieldSchema>;
