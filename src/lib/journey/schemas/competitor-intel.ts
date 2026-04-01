import { z } from 'zod';
import { flexibleEnum, nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const threatFactorsSchema = z.object({
  marketShareRecognition: z.coerce.number().min(0).max(10),
  adSpendIntensity: z.coerce.number().min(0).max(10),
  productOverlap: z.coerce.number().min(0).max(10),
  priceCompetitiveness: z.coerce.number().min(0).max(10),
  growthTrajectory: z.coerce.number().min(0).max(10),
});

export const threatAssessmentSchema = z.object({
  threatFactors: threatFactorsSchema,
  topAdHooks: nonEmptyStringArraySchema.optional(),
  likelyResponse: nonEmptyStringSchema.optional(),
  counterPositioning: nonEmptyStringSchema.optional(),
});

export const competitorAdActivitySchema = z.object({
  activeAdCount: z.number().int().nonnegative(),
  platforms: z.array(z.string()).default([]),
  themes: z.array(z.string()).default([]),
  evidence: nonEmptyStringSchema,
  sourceConfidence: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
});

export const competitorAdCreativeSchema = z.object({
  platform: flexibleEnum(['linkedin', 'meta', 'google'] as const, 'google'),
  id: nonEmptyStringSchema,
  advertiser: nonEmptyStringSchema,
  headline: nonEmptyStringSchema.optional(),
  body: nonEmptyStringSchema.optional(),
  imageUrl: nonEmptyStringSchema.optional(),
  videoUrl: nonEmptyStringSchema.optional(),
  format: flexibleEnum(['video', 'image', 'carousel', 'text', 'message', 'unknown'] as const, 'unknown'),
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

export const reviewSourceSchema = z.object({
  rating: z.number().min(0).max(5).nullable().optional(),
  reviewCount: z.number().nonnegative().nullable().optional(),
  categories: z.array(z.string()).optional(),
  url: z.string().nullable().optional(),
  recentThemes: z.array(z.string()).optional(),
});

export const negativeReviewSchema = z.object({
  text: z.string(),
  rating: z.number().min(1).max(3),
  date: z.string().optional(),
  source: z.enum(['g2', 'capterra', 'trustpilot']),
});

export const competitorReviewsSchema = z.object({
  trustpilot: reviewSourceSchema.optional(),
  g2: reviewSourceSchema.optional(),
  capterra: reviewSourceSchema.optional(),
  negativeReviews: z.array(negativeReviewSchema).max(5).optional(),
});

export const competitorRecordSchema = z.object({
  name: nonEmptyStringSchema,
  website: nonEmptyStringSchema,
  positioning: nonEmptyStringSchema,
  price: z.string().nullable().optional(),
  pricingConfidence: flexibleEnum(['high', 'medium', 'low', 'unknown'] as const, 'unknown').optional(),
  pricingSourceUrl: z.string().nullable().optional(),
  strengths: z.array(z.string()).default([]),
  weaknesses: z.array(z.string()).default([]),
  opportunities: z.array(z.string()).default([]),
  ourAdvantage: nonEmptyStringSchema,
  adActivity: competitorAdActivitySchema,
  adPlatforms: nonEmptyStringArraySchema.optional(),
  offer: nonEmptyStringSchema.optional(),
  funnels: nonEmptyStringSchema.optional(),
  threatAssessment: threatAssessmentSchema.optional(),
  adCreatives: z.array(competitorAdCreativeSchema).default([]),
  libraryLinks: competitorLibraryLinksSchema.optional(),
  reviews: competitorReviewsSchema.optional(),
});

export const whiteSpaceGapSchema = z.object({
  gap: nonEmptyStringSchema,
  type: flexibleEnum(['messaging', 'feature', 'audience', 'channel'] as const, 'messaging'),
  evidence: nonEmptyStringSchema,
  exploitability: z.coerce.number().min(0).max(10),
  impact: z.coerce.number().min(0).max(10),
  recommendedAction: nonEmptyStringSchema,
});

export const competitorIntelDataSchema = z.object({
  competitors: z.array(competitorRecordSchema).min(1),
  marketPatterns: nonEmptyStringArraySchema.optional(),
  marketStrengths: nonEmptyStringArraySchema.optional(),
  marketWeaknesses: nonEmptyStringArraySchema.optional(),
  whiteSpaceGaps: z.array(whiteSpaceGapSchema).default([]),
  overallLandscape: nonEmptyStringSchema.optional(),

  // ── Intelligence: Positioning Moves ─────────────────────────────────
  positioningMoves: z.array(z.object({
    move: nonEmptyStringSchema,
    targetCompetitor: nonEmptyStringSchema,
    risk: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    reward: flexibleEnum(['low', 'medium', 'high'] as const, 'medium'),
    playbook: nonEmptyStringSchema,
  })).default([]),
});

export type CompetitorIntelData = z.infer<typeof competitorIntelDataSchema>;
export type CompetitorRecord = z.infer<typeof competitorRecordSchema>;
export type CompetitorAdActivity = z.infer<typeof competitorAdActivitySchema>;
export type ThreatAssessment = z.infer<typeof threatAssessmentSchema>;
export type ThreatFactors = z.infer<typeof threatFactorsSchema>;
export type WhiteSpaceGap = z.infer<typeof whiteSpaceGapSchema>;
export type CompetitorAdCreative = z.infer<typeof competitorAdCreativeSchema>;
export type CompetitorLibraryLinks = z.infer<typeof competitorLibraryLinksSchema>;
export type CompetitorReviews = z.infer<typeof competitorReviewsSchema>;
export type NegativeReview = z.infer<typeof negativeReviewSchema>;
