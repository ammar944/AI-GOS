import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const keywordDifficultySchema = z.enum(['low', 'medium', 'high']);
export const keywordConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const keywordOpportunitySchema = z.object({
  keyword: nonEmptyStringSchema,
  searchVolume: z.number().nonnegative(),
  estimatedCpc: nonEmptyStringSchema,
  difficulty: keywordDifficultySchema,
  priorityScore: z.number().int().min(0).max(100),
  confidence: keywordConfidenceSchema,
});

export const campaignAdGroupSchema = z.object({
  name: nonEmptyStringSchema,
  recommendedMatchTypes: nonEmptyStringArraySchema,
  keywords: z.array(keywordOpportunitySchema).min(1),
  negativeKeywords: z.array(nonEmptyStringSchema),
});

export const keywordCampaignGroupSchema = z.object({
  campaign: nonEmptyStringSchema,
  intent: nonEmptyStringSchema,
  recommendedMonthlyBudget: z.number().nonnegative(),
  adGroups: z.array(campaignAdGroupSchema).min(1),
});

export const recommendedStartingKeywordSchema = z.object({
  keyword: nonEmptyStringSchema,
  campaign: nonEmptyStringSchema,
  adGroup: nonEmptyStringSchema,
  recommendedMonthlyBudget: z.number().nonnegative(),
  reason: nonEmptyStringSchema,
  priorityScore: z.number().int().min(0).max(100),
});

export const competitorGapSchema = z.object({
  keyword: nonEmptyStringSchema,
  competitorName: nonEmptyStringSchema,
  searchVolume: z.number().nonnegative(),
  estimatedCpc: nonEmptyStringSchema,
  priorityScore: z.number().int().min(0).max(100),
});

export const negativeKeywordSchema = z.object({
  keyword: nonEmptyStringSchema,
  reason: nonEmptyStringSchema,
});

export const keywordIntelDataSchema = z.object({
  totalKeywordsFound: z.number().int().nonnegative(),
  competitorGapCount: z.number().int().nonnegative(),
  campaignGroups: z.array(keywordCampaignGroupSchema).min(1),
  topOpportunities: z.array(keywordOpportunitySchema).min(1),
  recommendedStartingSet: z.array(recommendedStartingKeywordSchema).min(1),
  competitorGaps: z.array(competitorGapSchema),
  negativeKeywords: z.array(negativeKeywordSchema),
  confidenceNotes: z.array(nonEmptyStringSchema),
  quickWins: nonEmptyStringArraySchema,
});

export type KeywordIntelData = z.infer<typeof keywordIntelDataSchema>;
export type KeywordOpportunity = z.infer<typeof keywordOpportunitySchema>;
export type KeywordCampaignGroup = z.infer<typeof keywordCampaignGroupSchema>;
export type RecommendedStartingKeyword = z.infer<
  typeof recommendedStartingKeywordSchema
>;
export type CompetitorGap = z.infer<typeof competitorGapSchema>;
export type NegativeKeyword = z.infer<typeof negativeKeywordSchema>;
