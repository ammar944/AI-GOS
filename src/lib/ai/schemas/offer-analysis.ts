// Offer Analysis & Viability Schema
// Enhanced with .describe() hints for better AI output quality

import { z } from 'zod';

// =============================================================================
// Offer Clarity
// =============================================================================

export const offerClaritySchema = z.object({
  clearlyArticulated: z.boolean()
    .describe('Can someone understand the offer in under 10 seconds? Test: could you explain it to a stranger in one sentence?'),

  solvesRealPain: z.boolean()
    .describe('Does this offer solve a pain that people actively seek solutions for? Based on search demand and forum discussions.'),

  benefitsEasyToUnderstand: z.boolean()
    .describe('Are the benefits concrete and tangible? "Save 10 hours/week" is clear; "streamline operations" is vague.'),

  transformationMeasurable: z.boolean()
    .describe('Can the customer measure the before/after? There should be specific metrics or outcomes to track.'),

  valuePropositionObvious: z.boolean()
    .describe('Is the "why buy this" immediately obvious? Within 3 seconds of seeing the offer, prospects should know why they need it.'),
}).describe('5-point clarity check for offer communication effectiveness');

// =============================================================================
// Offer Strength Scores
// =============================================================================

export const offerStrengthSchema = z.object({
  painRelevance: z.number().min(1).max(10)
    .describe('1-10: How strongly does the offer address the primary ICP pain? 10 = direct, urgent solution. 1 = tangential connection.'),

  urgency: z.number().min(1).max(10)
    .describe('1-10: How urgent is the need? 10 = must solve now (bleeding). 1 = can defer indefinitely (nice-to-have).'),

  differentiation: z.number().min(1).max(10)
    .describe('1-10: How unique vs competitors? 10 = truly novel approach. 1 = commodity with no differentiation.'),

  tangibility: z.number().min(1).max(10)
    .describe('1-10: How concrete are the deliverables? 10 = specific, measurable outputs. 1 = vague promises.'),

  proof: z.number().min(1).max(10)
    .describe('1-10: Strength of social proof and results evidence? 10 = case studies with metrics. 1 = no proof available.'),

  pricingLogic: z.number().min(1).max(10)
    .describe('1-10: Does the price make sense for the value? 10 = obvious ROI, no-brainer. 1 = hard to justify.'),

  overallScore: z.number().min(1).max(10)
    .describe('Average of the 6 scores above, rounded to 1 decimal place. This is the headline offer strength metric.'),
}).describe('6 dimension offer scoring (1-10 each) plus overall average');

// =============================================================================
// Market-Offer Fit
// =============================================================================

export const marketOfferFitSchema = z.object({
  marketWantsNow: z.boolean()
    .describe('Is there active demand for this solution right now? Based on search trends, funding activity, and market timing.'),

  competitorsOfferSimilar: z.boolean()
    .describe('Are competitors offering similar solutions? True = validated market. Consider how this affects differentiation.'),

  priceMatchesExpectations: z.boolean()
    .describe('Is the price within the range this market expects to pay? Based on competitor pricing and typical budget allocations.'),

  proofStrongForColdTraffic: z.boolean()
    .describe('Is the proof compelling enough for cold traffic that has never heard of this brand? Testimonials and case studies matter here.'),

  transformationBelievable: z.boolean()
    .describe('Can prospects believe the promised transformation? Overpromising leads to low conversion and high refunds.'),
}).describe('Market-offer alignment assessment for ad effectiveness');

// =============================================================================
// Red Flags
// =============================================================================

export const redFlagsSchema = z.array(
  z.enum([
    'offer_too_vague',
    'overcrowded_market',
    'price_mismatch',
    'weak_or_no_proof',
    'no_funnel_built',
    'transformation_unclear',
  ])
)
  .describe('Only include flags that actually apply based on analysis. Empty array is valid if no red flags. Each flag indicates a specific issue that could hurt ad performance.');

// =============================================================================
// Recommendation
// =============================================================================

export const offerRecommendationSchema = z.object({
  status: z.enum(['proceed', 'adjust_messaging', 'adjust_pricing', 'icp_refinement_needed', 'major_offer_rebuild'])
    .describe('"proceed" = ready for ads. "adjust_messaging" = offer is good, positioning needs work. "adjust_pricing" = value-price mismatch. "icp_refinement_needed" = wrong audience. "major_offer_rebuild" = fundamental offer problems.'),

  reasoning: z.string()
    .describe('2-3 sentence explanation of the recommendation. Be direct about what needs to change and why.'),

  actionItems: z.array(z.string())
    .min(1).max(6)
    .describe('2-4 specific, actionable items to improve offer viability. Each should be something that can be done in the next 1-2 weeks.'),
}).describe('Final offer recommendation with status and action items');

// =============================================================================
// Complete Offer Analysis Schema
// =============================================================================

export const offerAnalysisSchema = z.object({
  offerClarity: offerClaritySchema,
  offerStrength: offerStrengthSchema,
  marketOfferFit: marketOfferFitSchema,
  redFlags: redFlagsSchema,
  recommendation: offerRecommendationSchema,
}).describe('Comprehensive offer analysis and viability assessment for paid media');

// =============================================================================
// Type Export
// =============================================================================

export type OfferAnalysisViability = z.infer<typeof offerAnalysisSchema>;
