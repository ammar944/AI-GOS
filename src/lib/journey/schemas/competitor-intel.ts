import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

// ---------- Threat Assessment (per-competitor) ----------

export const threatFactorsSchema = z.object({
  marketShareRecognition: z.number().min(1).max(10),
  adSpendIntensity: z.number().min(1).max(10),
  productOverlap: z.number().min(1).max(10),
  priceCompetitiveness: z.number().min(1).max(10),
  growthTrajectory: z.number().min(1).max(10),
});

export const threatAssessmentSchema = z.object({
  threatFactors: threatFactorsSchema,
  topAdHooks: z.array(z.string()).optional(),
  likelyResponse: nonEmptyStringSchema.optional(),
  counterPositioning: nonEmptyStringSchema.optional(),
});

// ---------- Pricing tier ----------

export const pricingTierSchema = z.object({
  tier: nonEmptyStringSchema,
  price: nonEmptyStringSchema,
  features: z.array(z.string()).optional(),
});

// ---------- Website performance ----------

export const websitePerformanceSchema = z.object({
  performanceScore: z.number(),
  lcp: z.number(),
  cls: z.number(),
});

// ---------- Competitor record ----------

export const competitorRecordSchema = z.object({
  name: nonEmptyStringSchema,
  positioning: nonEmptyStringSchema.optional(),
  price: nonEmptyStringSchema.optional(),
  adCount: z.number().int().nonnegative().optional(),
  strengths: nonEmptyStringArraySchema,
  weaknesses: nonEmptyStringArraySchema,
  opportunities: nonEmptyStringArraySchema,
  // V1 restores
  offer: nonEmptyStringSchema.optional(),
  funnels: nonEmptyStringSchema.optional(),
  adPlatforms: z.array(z.string()).optional(),
  threatAssessment: threatAssessmentSchema.optional(),
  pricingTiers: z.array(pricingTierSchema).optional(),
  // V3 additions
  estimatedMonthlyAdSpend: z.number().optional(),
  websitePerformance: websitePerformanceSchema.optional(),
});

// ---------- Structured V3 sub-schemas (top-level) ----------

export const creativeFormatsSchema = z.object({
  ugc: z.boolean(),
  carousels: z.boolean(),
  statics: z.boolean(),
  testimonial: z.boolean(),
  productDemo: z.boolean(),
});

export const creativeLibraryDetailedSchema = z.object({
  creativeFormats: creativeFormatsSchema,
});

export const funnelBreakdownDetailedSchema = z.object({
  landingPagePatterns: z.array(z.string()),
  headlineStructure: z.array(z.string()),
  ctaHierarchy: z.array(z.string()),
  socialProofPatterns: z.array(z.string()),
  leadCaptureMethods: z.array(z.string()),
  formFriction: z.enum(['low', 'medium', 'high']),
});

export const whiteSpaceGapDetailedSchema = z.object({
  gap: nonEmptyStringSchema,
  type: z.enum(['messaging', 'feature', 'audience', 'channel']),
  evidence: nonEmptyStringSchema,
  exploitability: z.number().min(1).max(10),
  impact: z.number().min(1).max(10),
  recommendedAction: nonEmptyStringSchema,
});

export const adCreativeThemeSchema = z.object({
  theme: nonEmptyStringSchema,
  count: z.number(),
  platforms: z.array(z.string()),
  exampleHook: nonEmptyStringSchema,
});

// ---------- Top-level Competitor Intel schema ----------

export const competitorIntelDataSchema = z.object({
  competitors: z.array(competitorRecordSchema).min(1),
  marketStrengths: nonEmptyStringArraySchema,
  marketWeaknesses: nonEmptyStringArraySchema,
  // Original flat version (backwards compat)
  whiteSpaceGaps: nonEmptyStringArraySchema,
  creativeLibrary: z
    .array(z.object({ summary: nonEmptyStringSchema }))
    .optional(),
  funnelBreakdown: z
    .array(
      z.object({
        stage: nonEmptyStringSchema,
        summary: nonEmptyStringSchema,
      }),
    )
    .optional(),
  keywordOverlap: z.number().min(0).max(100).optional(),
  // V3 structured versions
  creativeLibraryDetailed: creativeLibraryDetailedSchema.optional(),
  funnelBreakdownDetailed: funnelBreakdownDetailedSchema.optional(),
  whiteSpaceGapsDetailed: z.array(whiteSpaceGapDetailedSchema).optional(),
  adCreativeThemes: z.array(adCreativeThemeSchema).optional(),
});

export type CompetitorIntelData = z.infer<typeof competitorIntelDataSchema>;
export type CompetitorRecord = z.infer<typeof competitorRecordSchema>;
export type ThreatAssessment = z.infer<typeof threatAssessmentSchema>;
export type ThreatFactors = z.infer<typeof threatFactorsSchema>;
export type PricingTier = z.infer<typeof pricingTierSchema>;
export type WebsitePerformance = z.infer<typeof websitePerformanceSchema>;
export type CreativeLibraryDetailed = z.infer<
  typeof creativeLibraryDetailedSchema
>;
export type FunnelBreakdownDetailed = z.infer<
  typeof funnelBreakdownDetailedSchema
>;
export type WhiteSpaceGapDetailed = z.infer<typeof whiteSpaceGapDetailedSchema>;
export type AdCreativeTheme = z.infer<typeof adCreativeThemeSchema>;
