/**
 * synthesize-positioning input schema.
 * Self-contained duplicate of only the locked GTM brief and upstream outputs this skill needs.
 */
import { z } from "zod";
import { sourcedClaimSchema } from "./output.ts";

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

const requiredBriefFieldsSchema = z.object({
  companyName: gtmBriefFieldSchema,
  companyUrl: gtmBriefFieldSchema,
  category: gtmBriefFieldSchema,
  productDescription: gtmBriefFieldSchema,
  targetCustomer: gtmBriefFieldSchema,
  primaryIcpDescription: gtmBriefFieldSchema,
  icpPains: gtmBriefFieldSchema,
  buyingTriggers: gtmBriefFieldSchema,
  currentAlternative: gtmBriefFieldSchema,
  icpObjections: gtmBriefFieldSchema,
  corePromise: gtmBriefFieldSchema,
  uniqueEdge: gtmBriefFieldSchema,
  differentiation: gtmBriefFieldSchema,
  commonObjections: gtmBriefFieldSchema,
  keyPromises: gtmBriefFieldSchema,
});

const optionalBriefFieldsSchema = z.object({
  market: gtmBriefFieldSchema.optional(),
  industryVertical: gtmBriefFieldSchema.optional(),
  geography: gtmBriefFieldSchema.optional(),
  tone: gtmBriefFieldSchema.optional(),
  forbiddenClaims: gtmBriefFieldSchema.optional(),
  testimonials: gtmBriefFieldSchema.optional(),
  caseStudies: gtmBriefFieldSchema.optional(),
  metrics: gtmBriefFieldSchema.optional(),
  claims: gtmBriefFieldSchema.optional(),
  topCompetitors: gtmBriefFieldSchema.optional(),
  alternatives: gtmBriefFieldSchema.optional(),
});

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

export const upstreamEvidenceSchema = z
  .object({
    summary: z.string().min(1).optional(),
    evidence: z.array(sourcedClaimSchema).min(1),
  })
  .strict();

export const priorResearchOutputSchema = z
  .object({
    stage: z.string().min(1),
    company_name: z.string().min(1).optional(),
    category: z.string().min(1).optional(),
    evidence: z.array(sourcedClaimSchema).min(1),
    insights: z.array(upstreamEvidenceSchema).optional(),
  })
  .passthrough();

export const synthesizePositioningInputSchema = z
  .object({
    run_id: z.string().min(1),
    brief_snapshot_id: z.string().min(1),
    stage: z.literal("synthesize-strategy"),
    gtm_brief: lockedGtmBriefSchema,
    ingest_identity: ingestIdentityOutputSchema,
    research_icp: priorResearchOutputSchema,
    research_offer: priorResearchOutputSchema,
    research_cross: priorResearchOutputSchema,
    research_voc: priorResearchOutputSchema.optional(),
    research_market: priorResearchOutputSchema.optional(),
  })
  .strict();

export type SynthesizePositioningInput = z.infer<
  typeof synthesizePositioningInputSchema
>;
