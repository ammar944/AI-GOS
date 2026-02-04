// ICP Analysis & Validation Schema
// Enhanced with .describe() hints for better AI output quality

import { z } from 'zod';

// =============================================================================
// ICP Coherence Check
// =============================================================================

export const coherenceCheckSchema = z.object({
  clearlyDefined: z.boolean()
    .describe('Is the ICP specific enough to target? A vague ICP like "business owners" is false; "Series A B2B SaaS founders with $1M+ ARR" is true.'),

  reachableThroughPaidChannels: z.boolean()
    .describe('Can this ICP be targeted on Meta, LinkedIn, or Google? Consider job titles, interests, behaviors. Niche B2B roles may be false.'),

  adequateScale: z.boolean()
    .describe('Is there enough audience volume? Estimate: Meta needs 500K+, LinkedIn needs 50K+. Very narrow ICPs may be false.'),

  hasPainOfferSolves: z.boolean()
    .describe('Does the ICP actually experience the pain this offer addresses? Based on market research, not assumptions.'),

  hasBudgetAndAuthority: z.boolean()
    .describe('Can this ICP approve purchases at this price point? Consider typical budget authority for the job titles/company sizes.'),
}).describe('5-point coherence check validating ICP viability for paid media');

// =============================================================================
// Pain-Solution Fit
// =============================================================================

export const painSolutionFitSchema = z.object({
  primaryPain: z.string()
    .describe('The #1 pain point being solved. Be specific (e.g., "Cannot prove marketing ROI to the board" not "needs analytics").'),

  offerComponentSolvingIt: z.string()
    .describe('Which specific part of the offer addresses this pain (e.g., "Multi-touch attribution dashboard with board-ready reports").'),

  fitAssessment: z.enum(['strong', 'moderate', 'weak'])
    .describe('"strong" = direct solution, proven demand. "moderate" = solves it indirectly or partially. "weak" = tenuous connection.'),

  notes: z.string()
    .describe('Additional context on the fit. Flag any gaps between what the ICP needs and what the offer provides.'),
}).describe('Assessment of how well the offer solves the ICP primary pain');

// =============================================================================
// Market Reachability
// =============================================================================

export const marketReachabilitySchema = z.object({
  metaVolume: z.boolean()
    .describe('Adequate audience size on Meta (Facebook/Instagram)? B2B: use job titles + industries. B2C: interests + behaviors. Need 500K+ for testing.'),

  linkedInVolume: z.boolean()
    .describe('Adequate audience on LinkedIn? Check job titles, seniority, company size filters. Need 50K+ for effective campaigns.'),

  googleSearchDemand: z.boolean()
    .describe('Do people actively search for solutions to this problem? Check search volume for problem-aware and solution-aware keywords.'),

  contradictingSignals: z.array(z.string())
    .describe('Any conflicting data about this ICP (e.g., "High search volume but LinkedIn shows only 10K in-market"). Empty array if none.'),
}).describe('Platform-by-platform reachability assessment for paid media');

// =============================================================================
// Economic Feasibility
// =============================================================================

export const economicFeasibilitySchema = z.object({
  hasBudget: z.boolean()
    .describe('Does this ICP typically have budget for solutions at this price point? Based on company size, funding stage, industry norms.'),

  purchasesSimilar: z.boolean()
    .describe('Does this ICP already buy similar tools/services? Look for competitor usage, tech stack patterns, budget allocation history.'),

  tamAlignedWithCac: z.boolean()
    .describe('Is the total addressable market large enough to support the target CAC? Small TAM + high CAC = poor unit economics.'),

  notes: z.string()
    .describe('Economic viability notes. Include any concerns about price sensitivity, budget cycles, or economic conditions affecting this ICP.'),
}).describe('Economic feasibility assessment for sustainable customer acquisition');

// =============================================================================
// Risk Assessment
// =============================================================================

export const riskAssessmentSchema = z.object({
  reachability: z.enum(['low', 'medium', 'high', 'critical'])
    .describe('Risk that we cannot effectively reach this ICP through paid channels. "critical" = likely unreachable.'),

  budget: z.enum(['low', 'medium', 'high', 'critical'])
    .describe('Risk that ICP cannot afford the offer. "critical" = price is likely prohibitive.'),

  painStrength: z.enum(['low', 'medium', 'high', 'critical'])
    .describe('Risk that the pain is not urgent enough to drive action. "critical" = nice-to-have, not must-have.'),

  competitiveness: z.enum(['low', 'medium', 'high', 'critical'])
    .describe('Risk from competitive saturation. "critical" = red ocean with entrenched players and high CPMs.'),
}).describe('4-dimension risk assessment for ICP viability');

// =============================================================================
// Final Verdict
// =============================================================================

export const finalVerdictSchema = z.object({
  status: z.enum(['validated', 'workable', 'invalid'])
    .describe('"validated" = ready for ads with confidence. "workable" = proceed with caution, address concerns. "invalid" = do not run ads until ICP is refined.'),

  reasoning: z.string()
    .describe('2-3 sentence explanation of the verdict. Be honest about concerns even for "validated" ICPs.'),

  recommendations: z.array(z.string())
    .min(1).max(6)
    .describe('2-4 actionable recommendations to improve ICP viability or capitalize on strengths.'),
}).describe('Final ICP validation verdict with clear status and next steps');

// =============================================================================
// Customer Psychographics (for NLP Copywriting)
// =============================================================================

export const customerPsychographicsSchema = z.object({
  goalsAndDreams: z.array(z.string())
    .min(2).max(7)
    .describe('Top 3-5 aspirational goals and dreams this ICP has related to the problem space. What does success look like to them?'),
  
  fearsAndInsecurities: z.array(z.string())
    .min(2).max(7)
    .describe('Deep-seated fears and insecurities that keep them up at night. What are they secretly worried about?'),
  
  embarrassingSituations: z.array(z.string())
    .min(1).max(5)
    .describe('Specific embarrassing professional situations they actively try to avoid. What would make them look bad?'),
  
  perceivedEnemy: z.string()
    .describe('Who or what do they blame for their problems? The "villain" in their story (e.g., "Big agencies that charge $15k/month for cookie-cutter strategies").'),
  
  failedSolutions: z.array(z.string())
    .min(1).max(6)
    .describe('Alternative solutions they have tried that did not work, and briefly why each failed.'),
    
  dayInTheLife: z.string()
    .describe('A vivid, emotional 1st-person journal entry (2-3 paragraphs) describing a typical frustrating day for this ICP. Write as if you ARE the ICP, expressing their internal monologue, frustrations, and hopes.')
}).describe('Deep psychological profile of the ICP for copywriting angles');

// =============================================================================
// Complete ICP Analysis Schema
// =============================================================================

export const icpAnalysisSchema = z.object({
  coherenceCheck: coherenceCheckSchema,
  painSolutionFit: painSolutionFitSchema,
  marketReachability: marketReachabilitySchema,
  economicFeasibility: economicFeasibilitySchema,
  riskAssessment: riskAssessmentSchema,
  finalVerdict: finalVerdictSchema,
  customerPsychographics: customerPsychographicsSchema,
}).describe('Comprehensive ICP analysis and validation for paid media campaigns');

// =============================================================================
// Type Export
// =============================================================================

export type ICPAnalysisValidation = z.infer<typeof icpAnalysisSchema>;
export type CustomerPsychographics = z.infer<typeof customerPsychographicsSchema>;
