/**
 * research-offer input contract.
 * Self-contained copy of the offer-relevant GTM brief primitives.
 */
import { z } from "zod";

const evidenceSourceSchema = z
  .object({
    type: z
      .enum(["user_input", "url", "document", "research", "system", "manual"])
      .optional(),
    label: z.string().min(1).optional(),
    url: z.string().url().optional(),
    retrieved_at: z.string().datetime().optional(),
  })
  .strict();

const gtmBriefFieldSchema = z
  .object({
    value: z.string(),
    status: z.enum(["missing", "suggested", "needs_review", "confirmed"]),
    confidence: z.enum(["missing", "low", "medium", "high"]),
    sources: z.array(evidenceSourceSchema),
    updatedBy: z.enum(["ai", "user", "system"]),
    updatedAt: z.string().datetime(),
  })
  .strict();

const requiredOfferFieldsSchema = z
  .object({
    companyName: gtmBriefFieldSchema,
    companyUrl: gtmBriefFieldSchema,
    category: gtmBriefFieldSchema,
    productDescription: gtmBriefFieldSchema,
    targetCustomer: gtmBriefFieldSchema,
    corePromise: gtmBriefFieldSchema,
    firstValueMoment: gtmBriefFieldSchema,
    activationEvent: gtmBriefFieldSchema,
    cta: gtmBriefFieldSchema,
    packaging: gtmBriefFieldSchema,
    pricingModel: gtmBriefFieldSchema,
    pricingTiers: gtmBriefFieldSchema,
    targetPlan: gtmBriefFieldSchema,
  })
  .strict();

const optionalOfferFieldsSchema = z
  .object({
    useCases: gtmBriefFieldSchema.optional(),
    coreDeliverables: gtmBriefFieldSchema.optional(),
    retentionDrivers: gtmBriefFieldSchema.optional(),
    conversionPath: gtmBriefFieldSchema.optional(),
    landingPages: gtmBriefFieldSchema.optional(),
    salesMotion: gtmBriefFieldSchema.optional(),
    gtmMotion: gtmBriefFieldSchema.optional(),
    avgAcv: gtmBriefFieldSchema.optional(),
    acv: gtmBriefFieldSchema.optional(),
    salesCycleLength: gtmBriefFieldSchema.optional(),
    salesCycle: gtmBriefFieldSchema.optional(),
    testimonials: gtmBriefFieldSchema.optional(),
    caseStudies: gtmBriefFieldSchema.optional(),
    logos: gtmBriefFieldSchema.optional(),
    metrics: gtmBriefFieldSchema.optional(),
    claims: gtmBriefFieldSchema.optional(),
    commonObjections: gtmBriefFieldSchema.optional(),
    keyPromises: gtmBriefFieldSchema.optional(),
    whatIsWorking: gtmBriefFieldSchema.optional(),
    whatIsNotWorking: gtmBriefFieldSchema.optional(),
  })
  .strict();

const lockedGtmBriefSchema = z
  .object({
    briefId: z.string().min(1),
    clientId: z.string().min(1).nullable(),
    fields: requiredOfferFieldsSchema.and(optionalOfferFieldsSchema),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
    lockedAt: z.string().datetime(),
  })
  .strict();

const sourcedKeywordSchema = z
  .object({
    value: z.string().min(1),
    source_url: z.string().url().optional(),
    retrieved_at: z.string().datetime().optional(),
  })
  .strict();

const ingestIdentitySchema = z
  .object({
    stage: z.literal("ingest-identity"),
    company_name: z.string().min(1),
    canonical_domain: z.string().min(1),
    category: z.string().min(1),
    core_keywords: z.array(sourcedKeywordSchema),
    negative_keywords: z.array(z.string().min(1)),
    generated_at: z.string().datetime(),
  })
  .strict();

const researchMarketSchema = z
  .object({
    stage: z.literal("research-market-category"),
    category: z.string().min(1),
    category_summary: z.string().min(1).optional(),
    demand_context: z.array(sourcedKeywordSchema).optional(),
    generated_at: z.string().datetime(),
  })
  .strict();

export const researchOfferInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    locked_gtm_brief: lockedGtmBriefSchema,
    ingest_identity: ingestIdentitySchema,
    research_market: researchMarketSchema.optional(),
  })
  .strict();

export type ResearchOfferInput = z.infer<typeof researchOfferInputSchema>;
