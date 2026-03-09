import { z } from 'zod';
import {
  keywordOpportunitySchema,
  nonEmptyStringArraySchema,
  nonEmptyStringSchema,
  stringOrNumberSchema,
} from './base';

export const keywordEntrySchema = z.object({
  keyword: nonEmptyStringSchema,
  cpc: nonEmptyStringSchema.optional(),
  volume: stringOrNumberSchema.optional(),
  difficulty: stringOrNumberSchema.optional(),
  opportunity: z.number().optional(),
});

export const keywordIntelDataSchema = z.object({
  keywords: z.array(keywordEntrySchema).min(1),
  quickWins: z.array(keywordEntrySchema).min(1),
  highIntentKeywords: z.array(keywordEntrySchema).min(1),
  clientStrengths: z.array(keywordEntrySchema).min(1),
  contentTopicClusters: z
    .array(
      z.object({
        theme: nonEmptyStringSchema,
        keywords: z.array(nonEmptyStringSchema).min(1),
        searchVolumeTotal: stringOrNumberSchema.optional(),
        recommendedFormat: nonEmptyStringSchema.optional(),
      }),
    )
    .min(1),
  metadata: z.object({
    totalKeywordsAnalyzed: z.number().int().positive(),
    clientDomain: nonEmptyStringSchema.optional(),
    competitorDomainsAnalyzed: z.array(z.string()).optional(),
    collectedAt: nonEmptyStringSchema.optional(),
  }),

  // V1 restores
  clientDomain: z
    .object({
      domain: nonEmptyStringSchema,
      organicKeywords: z.number(),
      paidKeywords: z.number(),
      monthlyOrganicClicks: z.number(),
      monthlyPaidClicks: z.number(),
      organicClicksValue: z.number(),
      paidClicksValue: z.number(),
    })
    .optional(),

  competitorDomains: z
    .array(
      z.object({
        domain: nonEmptyStringSchema,
        organicKeywords: z.number(),
        paidKeywords: z.number(),
        monthlyOrganicClicks: z.number(),
      }),
    )
    .optional(),

  organicGaps: z.array(keywordOpportunitySchema).optional(),
  paidGaps: z.array(keywordOpportunitySchema).optional(),
  longTermPlays: z.array(keywordOpportunitySchema).optional(),

  strategicRecommendations: z
    .object({
      organicStrategy: nonEmptyStringArraySchema,
      paidSearchStrategy: nonEmptyStringArraySchema,
      competitivePositioning: nonEmptyStringArraySchema,
      quickWinActions: nonEmptyStringArraySchema,
    })
    .optional(),

  // V3 additions
  negativeKeywords: z
    .array(
      z.object({
        keyword: nonEmptyStringSchema,
        reason: nonEmptyStringSchema,
      }),
    )
    .optional(),

  seoAudit: z
    .object({
      technical: z.object({
        overallScore: z.number(),
        sitemapFound: z.boolean(),
        robotsTxtFound: z.boolean(),
      }),
      performance: z
        .object({
          mobile: z
            .object({
              performanceScore: z.number(),
              lcp: z.number(),
              cls: z.number(),
            })
            .optional(),
          desktop: z
            .object({
              performanceScore: z.number(),
              lcp: z.number(),
              cls: z.number(),
            })
            .optional(),
        })
        .optional(),
      overallScore: z.number(),
    })
    .optional(),
});

export type KeywordIntelData = z.infer<typeof keywordIntelDataSchema>;
