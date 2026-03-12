import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const offerStrengthSchema = z.object({
  painRelevance: z.number().min(1).max(10),
  urgency: z.number().min(1).max(10),
  differentiation: z.number().min(1).max(10),
  tangibility: z.number().min(1).max(10),
  proof: z.number().min(1).max(10),
  pricingLogic: z.number().min(1).max(10),
  overallScore: z.number().min(1).max(10),
});

export const offerRecommendationSchema = z.object({
  status: z.enum([
    'proceed',
    'needs-work',
    'adjust-messaging',
    'adjust-pricing',
    'icp-refinement-needed',
    'major-offer-rebuild',
    'do-not-launch',
  ]),
  summary: nonEmptyStringSchema,
  topStrengths: nonEmptyStringArraySchema,
  priorityFixes: nonEmptyStringArraySchema,
  recommendedActionPlan: nonEmptyStringArraySchema,
});

export const offerRedFlagSchema = z.object({
  issue: nonEmptyStringSchema,
  severity: z.enum(['high', 'medium', 'low']),
  priority: z.number().int().positive(),
  recommendedAction: nonEmptyStringSchema,
  launchBlocker: z.boolean(),
  evidence: nonEmptyStringSchema.optional(),
});

export const pricingAnalysisSchema = z.object({
  currentPricing: nonEmptyStringSchema,
  marketBenchmark: nonEmptyStringSchema,
  pricingPosition: z.enum(['premium', 'mid-market', 'budget', 'unclear']),
  coldTrafficViability: nonEmptyStringSchema,
});

export const offerAnalysisDataSchema = z.object({
  offerStrength: offerStrengthSchema,
  recommendation: offerRecommendationSchema,
  redFlags: z.array(offerRedFlagSchema).min(1),
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
});

export type OfferAnalysisData = z.infer<typeof offerAnalysisDataSchema>;
export type OfferStrength = z.infer<typeof offerStrengthSchema>;
export type OfferRecommendation = z.infer<typeof offerRecommendationSchema>;
export type OfferRedFlag = z.infer<typeof offerRedFlagSchema>;
export type PricingAnalysis = z.infer<typeof pricingAnalysisSchema>;
