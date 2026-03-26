import { z } from 'zod';
import { flexibleEnum, nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const offerStrengthSchema = z.object({
  painRelevance: z.coerce.number().min(0).max(10),
  urgency: z.coerce.number().min(0).max(10),
  differentiation: z.coerce.number().min(0).max(10),
  tangibility: z.coerce.number().min(0).max(10),
  proof: z.coerce.number().min(0).max(10),
  pricingLogic: z.coerce.number().min(0).max(10),
  overallScore: z.coerce.number().min(0).max(10),
});

export const iceScoredFixSchema = z.object({
  issue: nonEmptyStringSchema,
  fix: nonEmptyStringSchema,
  impact: z.coerce.number().min(0).max(10),
  confidence: z.coerce.number().min(0).max(10),
  ease: z.coerce.number().min(0).max(10),
  iceScore: z.coerce.number().min(0),
});

export const offerRecommendationSchema = z.object({
  status: flexibleEnum(
    ['proceed', 'needs-work', 'adjust-messaging', 'adjust-pricing', 'icp-refinement-needed', 'major-offer-rebuild', 'do-not-launch'] as const,
    'needs-work',
  ),
  summary: nonEmptyStringSchema,
  topStrengths: nonEmptyStringArraySchema,
  priorityFixes: nonEmptyStringArraySchema,
  iceScoredFixes: z.array(iceScoredFixSchema).optional().default([]),
  recommendedActionPlan: nonEmptyStringArraySchema,
});

export const offerRedFlagSchema = z.object({
  issue: nonEmptyStringSchema,
  severity: flexibleEnum(['high', 'medium', 'low'] as const, 'medium'),
  priority: z.number().int().positive(),
  recommendedAction: nonEmptyStringSchema,
  launchBlocker: z.boolean(),
  evidence: nonEmptyStringSchema.optional(),
});

const PRICING_POSITION_VALUES = ['premium', 'mid-market', 'budget', 'unclear'] as const;
type PricingPosition = (typeof PRICING_POSITION_VALUES)[number];

const pricingPositionSchema = z
  .string()
  .transform((val): PricingPosition => {
    const lower = val.toLowerCase().trim();
    if (lower.includes('premium')) return 'premium';
    if (lower.includes('mid') && lower.includes('market')) return 'mid-market';
    if (lower.includes('budget') || lower.includes('low') || lower.includes('cheap')) return 'budget';
    if ((PRICING_POSITION_VALUES as readonly string[]).includes(lower))
      return lower as PricingPosition;
    return 'unclear';
  });

export const pricingAnalysisSchema = z.object({
  currentPricing: nonEmptyStringSchema,
  marketBenchmark: nonEmptyStringSchema,
  pricingPosition: pricingPositionSchema,
  coldTrafficViability: nonEmptyStringSchema,
});

export const offerAnalysisDataSchema = z.object({
  offerStrength: offerStrengthSchema,
  recommendation: offerRecommendationSchema,
  redFlags: z.array(offerRedFlagSchema).default([]),
  pricingAnalysis: pricingAnalysisSchema,
  marketFitAssessment: nonEmptyStringSchema,
  messagingRecommendations: nonEmptyStringArraySchema,
  offerClarity: z
    .object({
      clearlyArticulated: z.boolean(),
      solvesRealPain: z.boolean(),
      benefitsEasyToUnderstand: z.boolean(),
      transformationMeasurable: z.boolean(),
      valuePropositionObvious: z.boolean(),
    })
    .optional(),
  marketOfferFit: z
    .object({
      marketWantsNow: z.boolean(),
      competitorsOfferSimilar: z.boolean(),
      priceMatchesExpectations: z.boolean(),
      proofStrongForColdTraffic: z.boolean(),
      transformationBelievable: z.boolean(),
    })
    .optional(),
  strengths: nonEmptyStringArraySchema.optional(),
  weaknesses: nonEmptyStringArraySchema.optional(),
  generatedOfferStatements: z.array(z.object({
    type: flexibleEnum(['headline', 'guarantee', 'usp', 'value-prop', 'risk-reversal'] as const, 'headline'),
    statement: nonEmptyStringSchema,
    rationale: nonEmptyStringSchema,
    targetEmotion: nonEmptyStringSchema,
  })).optional().default([]),
});

export type OfferAnalysisData = z.infer<typeof offerAnalysisDataSchema>;
export type OfferStrength = z.infer<typeof offerStrengthSchema>;
export type OfferRecommendation = z.infer<typeof offerRecommendationSchema>;
export type OfferRedFlag = z.infer<typeof offerRedFlagSchema>;
export type PricingAnalysis = z.infer<typeof pricingAnalysisSchema>;
export type IceScoredFix = z.infer<typeof iceScoredFixSchema>;
