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

export const competitorAdCreativeSchema = z.object({
  platform: z.enum(['linkedin', 'meta', 'google']),
  id: nonEmptyStringSchema,
  advertiser: nonEmptyStringSchema,
  headline: nonEmptyStringSchema.optional(),
  body: nonEmptyStringSchema.optional(),
  imageUrl: nonEmptyStringSchema.optional(),
  videoUrl: nonEmptyStringSchema.optional(),
  format: z.enum(['video', 'image', 'carousel', 'text', 'message', 'unknown']),
  isActive: z.boolean(),
  firstSeen: nonEmptyStringSchema.optional(),
  lastSeen: nonEmptyStringSchema.optional(),
  platforms: nonEmptyStringArraySchema.optional(),
  detailsUrl: nonEmptyStringSchema.optional(),
});

export const competitorLibraryLinksSchema = z.object({
  metaLibraryUrl: nonEmptyStringSchema.optional(),
  linkedInLibraryUrl: nonEmptyStringSchema.optional(),
  googleAdvertiserUrl: nonEmptyStringSchema.optional(),
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
  adCreatives: z.array(competitorAdCreativeSchema).default([]),
  libraryLinks: competitorLibraryLinksSchema.optional(),
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
export type CompetitorAdCreative = z.infer<typeof competitorAdCreativeSchema>;
export type CompetitorLibraryLinks = z.infer<typeof competitorLibraryLinksSchema>;
