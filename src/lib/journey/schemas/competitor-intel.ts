import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const threatFactorsSchema = z.object({
  marketShareRecognition: z.number().min(1).max(10),
  adSpendIntensity: z.number().min(1).max(10),
  productOverlap: z.number().min(1).max(10),
  priceCompetitiveness: z.number().min(1).max(10),
  growthTrajectory: z.number().min(1).max(10),
});

export const threatAssessmentSchema = z.object({
  threatFactors: threatFactorsSchema,
  topAdHooks: nonEmptyStringArraySchema.optional(),
  likelyResponse: nonEmptyStringSchema.optional(),
  counterPositioning: nonEmptyStringSchema.optional(),
});

export const competitorAdActivitySchema = z.object({
  activeAdCount: z.number().int().nonnegative(),
  platforms: nonEmptyStringArraySchema,
  themes: nonEmptyStringArraySchema,
  evidence: nonEmptyStringSchema,
  sourceConfidence: z.enum(['high', 'medium', 'low']),
});

export const competitorRecordSchema = z.object({
  name: nonEmptyStringSchema,
  website: nonEmptyStringSchema,
  positioning: nonEmptyStringSchema,
  price: nonEmptyStringSchema.optional(),
  pricingConfidence: z.enum(['high', 'medium', 'low', 'unknown']).optional(),
  strengths: nonEmptyStringArraySchema,
  weaknesses: nonEmptyStringArraySchema,
  opportunities: nonEmptyStringArraySchema,
  ourAdvantage: nonEmptyStringSchema,
  adActivity: competitorAdActivitySchema,
  adPlatforms: nonEmptyStringArraySchema.optional(),
  offer: nonEmptyStringSchema.optional(),
  funnels: nonEmptyStringSchema.optional(),
  threatAssessment: threatAssessmentSchema.optional(),
});

export const whiteSpaceGapSchema = z.object({
  gap: nonEmptyStringSchema,
  type: z.enum(['messaging', 'feature', 'audience', 'channel']),
  evidence: nonEmptyStringSchema,
  exploitability: z.number().min(1).max(10),
  impact: z.number().min(1).max(10),
  recommendedAction: nonEmptyStringSchema,
});

export const competitorIntelDataSchema = z.object({
  competitors: z.array(competitorRecordSchema).min(1),
  marketPatterns: nonEmptyStringArraySchema.optional(),
  marketStrengths: nonEmptyStringArraySchema.optional(),
  marketWeaknesses: nonEmptyStringArraySchema.optional(),
  whiteSpaceGaps: z.array(whiteSpaceGapSchema).min(1),
  overallLandscape: nonEmptyStringSchema.optional(),
});

export type CompetitorIntelData = z.infer<typeof competitorIntelDataSchema>;
export type CompetitorRecord = z.infer<typeof competitorRecordSchema>;
export type CompetitorAdActivity = z.infer<typeof competitorAdActivitySchema>;
export type ThreatAssessment = z.infer<typeof threatAssessmentSchema>;
export type ThreatFactors = z.infer<typeof threatFactorsSchema>;
export type WhiteSpaceGap = z.infer<typeof whiteSpaceGapSchema>;
