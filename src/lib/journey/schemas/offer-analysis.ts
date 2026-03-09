import { z } from 'zod';
import { nonEmptyStringArraySchema, nonEmptyStringSchema } from './base';

export const offerAnalysisDataSchema = z.object({
  offerClarity: z.object({
    clearlyArticulated: z.boolean(),
    solvesRealPain: z.boolean(),
    benefitsEasyToUnderstand: z.boolean(),
    transformationMeasurable: z.boolean(),
    valuePropositionObvious: z.boolean(),
  }),
  offerStrength: z.object({
    painRelevance: z.number().min(1).max(10),
    urgency: z.number().min(1).max(10),
    differentiation: z.number().min(1).max(10),
    tangibility: z.number().min(1).max(10),
    proof: z.number().min(1).max(10),
    pricingLogic: z.number().min(1).max(10),
    overallScore: z.number().min(1).max(10),
  }),
  marketOfferFit: z.object({
    marketWantsNow: z.boolean(),
    competitorsOfferSimilar: z.boolean(),
    priceMatchesExpectations: z.boolean(),
    proofStrongForColdTraffic: z.boolean(),
    transformationBelievable: z.boolean(),
  }),
  redFlags: z
    .array(
      z.enum([
        'offer_too_vague',
        'overcrowded_market',
        'price_mismatch',
        'weak_or_no_proof',
        'no_funnel_built',
        'transformation_unclear',
      ]),
    )
    .min(1),
  recommendation: z.object({
    status: z.enum([
      'proceed',
      'adjust_messaging',
      'adjust_pricing',
      'icp_refinement_needed',
      'major_offer_rebuild',
    ]),
    reasoning: nonEmptyStringSchema,
    actionItems: nonEmptyStringArraySchema,
  }),
  strengths: nonEmptyStringArraySchema.optional(),
  weaknesses: nonEmptyStringArraySchema.optional(),
  pricingComparison: z
    .array(
      z.object({
        competitor: nonEmptyStringSchema,
        price: nonEmptyStringSchema,
      }),
    )
    .optional(),
  // V3 additions
  competitivePricing: z
    .array(
      z.object({
        competitor: nonEmptyStringSchema,
        lowestTier: nonEmptyStringSchema,
        highestTier: nonEmptyStringSchema,
        comparison: z.enum(['cheaper', 'similar', 'premium']),
      }),
    )
    .optional(),
  conversionPotential: z
    .object({
      landingPageScore: z.number().min(1).max(10),
      urgencyFactors: nonEmptyStringArraySchema,
      frictionPoints: nonEmptyStringArraySchema,
    })
    .optional(),
});

export type OfferAnalysisData = z.infer<typeof offerAnalysisDataSchema>;
