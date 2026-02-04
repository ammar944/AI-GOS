// Cross-Analysis Synthesis Schema
// Enhanced with .describe() hints for better AI output quality

import { z } from 'zod';

// =============================================================================
// Key Insights
// =============================================================================

export const keyInsightSchema = z.object({
  insight: z.string()
    .describe('The specific finding or observation. Be concrete and actionable (e.g., "ICP has high urgency but competitors ignore speed-to-value messaging").'),

  source: z.enum([
    'industryMarketOverview',
    'icpAnalysisValidation',
    'offerAnalysisViability',
    'competitorAnalysis',
  ])
    .describe('Which analysis section this insight came from. Enables traceability.'),

  implication: z.string()
    .describe('What this means for the paid media strategy. Connect insight to action (e.g., "Lead with speed messaging in ad hooks, test 2-week implementation claims").'),

  priority: z.enum(['high', 'medium', 'low'])
    .describe('"high" = must address immediately, affects campaign success. "medium" = important for optimization. "low" = nice to have.'),
}).describe('Individual strategic insight with source and actionable implication');

// =============================================================================
// Recommended Platforms
// =============================================================================

export const recommendedPlatformSchema = z.object({
  platform: z.enum(['Meta', 'LinkedIn', 'Google', 'YouTube', 'TikTok'])
    .describe('Advertising platform recommendation'),

  reasoning: z.string()
    .describe('Why this platform fits the ICP and offer. Reference audience availability, intent level, and competitive density (e.g., "LinkedIn: High concentration of target job titles, competitors under-invested here").'),

  priority: z.enum(['primary', 'secondary', 'testing'])
    .describe('"primary" = main spend allocation. "secondary" = meaningful but smaller budget. "testing" = experimental, validate before scaling.'),
}).describe('Platform recommendation with prioritization');

// =============================================================================
// Positioning Strategy (NEW - Enhanced)
// =============================================================================

export const positioningStrategySchema = z.object({
  primary: z.string()
    .describe('The recommended primary positioning statement. 2-3 sentences that differentiate from competitors and resonate with ICP pain points.'),

  alternatives: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 alternative positioning angles to test. Each should be meaningfully different (e.g., speed vs. completeness vs. ease-of-use).'),

  differentiators: z.array(z.string())
    .min(1).max(6)
    .describe('2-4 key differentiators that competitors cannot easily claim. These are defensible advantages.'),

  avoidPositions: z.array(z.string())
    .min(1).max(5)
    .describe('1-3 positioning approaches to avoid. Either too crowded, not credible, or not aligned with offer strengths.'),
}).describe('Strategic positioning framework for market differentiation');

// =============================================================================
// Ad Hooks Schema (Copywriting Framework)
// =============================================================================

export const adHookSchema = z.object({
  hook: z.string()
    .describe('The attention-grabbing hook text. Should stop the scroll and create immediate curiosity or emotion.'),
  technique: z.enum(['controversial', 'revelation', 'myth-bust', 'status-quo-challenge', 'curiosity-gap', 'story'])
    .describe('The pattern interrupt technique used: controversial=challenges beliefs, revelation=shares surprising data, myth-bust=debunks common advice, status-quo-challenge=questions current approach, curiosity-gap=creates open loop, story=starts narrative'),
  targetAwareness: z.enum(['unaware', 'problem-aware', 'solution-aware', 'product-aware', 'most-aware'])
    .describe('Eugene Schwartz awareness level this hook targets. Unaware needs education, most-aware needs offer details.'),
  source: z.object({
    type: z.enum(['extracted', 'inspired', 'generated'])
      .describe('"extracted" = verbatim from competitor ad, "inspired" = based on real ad pattern, "generated" = created from research insights'),
    competitors: z.array(z.string()).optional()
      .describe('Competitor name(s) this hook was observed from or inspired by'),
    platform: z.enum(['linkedin', 'meta', 'google']).optional()
      .describe('Platform where original ad was found'),
  }).optional()
    .describe('Source attribution for traceability. Helps users understand which hooks are real vs synthesized.'),
}).describe('Ad hook with persuasion technique classification');

export const adHooksSchema = z.array(adHookSchema)
  .min(3).max(12)
  .describe('5-10 attention-grabbing ad hooks using various pattern interrupt techniques. Each should stop the scroll.');

// =============================================================================
// Angles Schema (Copywriting Framework)
// =============================================================================

export const angleSchema = z.object({
  name: z.string()
    .describe('Short name for this angle (e.g., "The Imposter Angle", "The Enemy Angle", "Speed Angle")'),
  description: z.string()
    .describe('What this angle focuses on and why it works for this ICP'),
  targetEmotion: z.string()
    .describe('The primary emotion this angle evokes (e.g., "Validation + Relief", "Righteous anger + Hope", "Fear of missing out")'),
  exampleHeadline: z.string()
    .describe('A specific, usable headline example for this angle')
}).describe('Advertising angle with emotional targeting');

export const anglesSchema = z.array(angleSchema)
  .min(2).max(8)
  .describe('4-6 distinct advertising angles: pain-focused, aspiration-focused, fear-focused, curiosity-focused, social proof, enemy-focused');

// =============================================================================
// Enhanced Proof & Objections (Copywriting Framework)
// =============================================================================

export const proofPointSchema = z.object({
  claim: z.string()
    .describe('The specific claim being made (e.g., "Reduces time-to-insight by 80%")'),
  evidence: z.string()
    .describe('The supporting evidence for this claim (statistic, study, case study, testimonial)'),
  source: z.string().optional()
    .describe('Source citation if available')
}).describe('Proof point with supporting evidence');

export const objectionHandlerSchema = z.object({
  objection: z.string()
    .describe('The common objection prospects raise (e.g., "We already have a marketing agency")'),
  response: z.string()
    .describe('Direct response to the objection'),
  reframe: z.string()
    .describe('How to reframe the objection into a selling point (e.g., "That\'s exactly why... agencies give you generic playbooks, we give you...")')
}).describe('Objection with response and persuasive reframe');

// =============================================================================
// Messaging Framework (NEW - Enhanced)
// =============================================================================

export const messagingFrameworkSchema = z.object({
  coreMessage: z.string()
    .describe('The single most important message to convey. If the audience remembers one thing, what should it be?'),

  supportingMessages: z.array(z.string())
    .min(2).max(7)
    .describe('3-5 supporting messages that reinforce the core message. Each should address a specific pain point or objection.'),

  proofPoints: z.array(z.string())
    .min(2).max(7)
    .describe('3-5 proof points to back up claims. Specific metrics, case studies, certifications, or social proof elements.'),

  tonalGuidelines: z.array(z.string())
    .min(1).max(6)
    .describe('2-4 tone and voice guidelines for ad copy. What should the brand sound like? (e.g., "Confident but not arrogant", "Data-driven with human touch").'),

  adHooks: adHooksSchema
    .describe('5-10 attention-grabbing ad hooks using pattern interrupt techniques'),

  angles: anglesSchema
    .describe('4-6 distinct advertising angles with emotional targeting'),

  proofPointsDetailed: z.array(proofPointSchema)
    .min(2).max(8)
    .describe('3-6 detailed proof points with claims, evidence, and sources'),

  objectionHandlers: z.array(objectionHandlerSchema)
    .min(2).max(10)
    .describe('4-8 common objections with responses and persuasive reframes'),
}).describe('Messaging framework for consistent, compelling communication');

// =============================================================================
// Complete Cross-Analysis Synthesis Schema
// =============================================================================

export const crossAnalysisSchema = z.object({
  keyInsights: z.array(keyInsightSchema)
    .min(3).max(10)
    .describe('5-7 key strategic insights with at least one from each analysis section. These are the "aha" moments that shape strategy.'),

  recommendedPositioning: z.string()
    .describe('2-3 sentence positioning statement synthesizing all research. This is the strategic north star for all marketing.'),

  positioningStrategy: positioningStrategySchema
    .describe('Detailed positioning strategy with alternatives and differentiators'),

  messagingFramework: messagingFrameworkSchema
    .describe('Comprehensive messaging framework for ad copy and content'),

  primaryMessagingAngles: z.array(z.string())
    .min(2).max(7)
    .describe('3-5 specific, testable messaging angles for ads. Each should be a complete hook concept (e.g., "Speed: From signup to insights in 48 hours", "Proof: Join 500+ marketing teams who...").'),

  recommendedPlatforms: z.array(recommendedPlatformSchema)
    .min(1).max(5)
    .describe('2-3 platform recommendations. Exactly one should be "primary".'),

  criticalSuccessFactors: z.array(z.string())
    .min(2).max(7)
    .describe('4-5 must-have elements for campaign success. Things that, if missing, will cause failure (e.g., "Strong proof for cold traffic", "Clear speed-to-value messaging").'),

  potentialBlockers: z.array(z.string())
    .min(1).max(5)
    .describe('2-3 realistic blockers that could prevent success. Based on risks identified in earlier sections.'),

  nextSteps: z.array(z.string())
    .min(2).max(7)
    .describe('4-5 actionable next steps in priority order. Each should be specific and achievable in the next 2 weeks.'),
}).describe('Strategic synthesis of all research into actionable paid media strategy');

// =============================================================================
// Type Exports
// =============================================================================

export type AdHook = z.infer<typeof adHookSchema>;
export type AdHooks = z.infer<typeof adHooksSchema>;
export type Angle = z.infer<typeof angleSchema>;
export type Angles = z.infer<typeof anglesSchema>;
export type ProofPoint = z.infer<typeof proofPointSchema>;
export type ObjectionHandler = z.infer<typeof objectionHandlerSchema>;
export type KeyInsight = z.infer<typeof keyInsightSchema>;
export type RecommendedPlatform = z.infer<typeof recommendedPlatformSchema>;
export type PositioningStrategy = z.infer<typeof positioningStrategySchema>;
export type MessagingFramework = z.infer<typeof messagingFrameworkSchema>;
export type CrossAnalysisSynthesis = z.infer<typeof crossAnalysisSchema>;
