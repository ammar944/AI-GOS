// Media Plan Zod Schema for generateObject
// Mirrors types.ts with .describe() hints for AI quality

import { z } from 'zod';

// =============================================================================
// Executive Summary
// =============================================================================

export const executiveSummarySchema = z.object({
  overview: z.string()
    .describe('2-3 sentence high-level strategy overview. Mention the primary platform, campaign approach, and expected outcome.'),

  primaryObjective: z.string()
    .describe('The single most important objective (e.g., "Generate 40 SQLs/month at <$75 CPL via Meta + LinkedIn").'),

  recommendedMonthlyBudget: z.number()
    .describe('Recommended total monthly ad spend in USD. Must align with the client budget from onboarding data.'),

  timelineToResults: z.string()
    .describe('Realistic timeline to first meaningful results (e.g., "4-6 weeks for initial qualified leads, 90 days for steady pipeline").'),

  topPriorities: z.array(z.string())
    .min(2).max(5)
    .describe('Top 3 strategic priorities in order of importance. Be specific and actionable.'),
}).describe('High-level media plan executive summary');

// =============================================================================
// Platform Strategy
// =============================================================================

export const platformStrategySchema = z.object({
  platform: z.string()
    .describe('Advertising platform name (e.g., "Meta", "LinkedIn", "Google Ads", "YouTube", "TikTok").'),

  rationale: z.string()
    .describe('Why this platform is recommended for this specific client. Reference ICP data, competitor activity, and offer fit.'),

  budgetPercentage: z.number().min(0).max(100)
    .describe('Percentage of total budget allocated to this platform (0-100). All platforms must sum to 100.'),

  monthlySpend: z.number()
    .describe('Monthly dollar amount for this platform. Must equal totalBudget * budgetPercentage / 100.'),

  campaignTypes: z.array(z.string())
    .min(1).max(5)
    .describe('Campaign types to run (e.g., "Lead Gen", "Retargeting", "Brand Awareness", "Conversion").'),

  targetingApproach: z.string()
    .describe('How to target the ICP on this platform. Be specific about audiences, interests, job titles, etc.'),

  expectedCplRange: z.object({
    min: z.number().describe('Low end of expected CPL range in USD'),
    max: z.number().describe('High end of expected CPL range in USD'),
  }).describe('Expected cost-per-lead range based on industry benchmarks and platform.'),

  priority: z.enum(['primary', 'secondary', 'testing'])
    .describe('"primary" = main spend allocation. "secondary" = meaningful but smaller budget. "testing" = experimental.'),
}).describe('Per-platform advertising strategy with budget allocation');

// =============================================================================
// Budget Allocation
// =============================================================================

export const budgetAllocationSchema = z.object({
  totalMonthlyBudget: z.number()
    .describe('Total monthly ad spend in USD. Must match the client budget from onboarding.'),

  platformBreakdown: z.array(z.object({
    platform: z.string().describe('Platform name'),
    monthlyBudget: z.number().describe('Monthly spend for this platform in USD'),
    percentage: z.number().describe('Percentage of total budget (0-100)'),
  })).min(1).max(5)
    .describe('Budget breakdown by platform. Must sum to totalMonthlyBudget.'),

  dailyCeiling: z.number()
    .describe('Maximum daily spend across all platforms in USD.'),

  rampUpStrategy: z.string()
    .describe('How to ramp up spend over the first 30 days. Be specific about daily budget progression.'),
}).describe('Overall budget allocation and spending strategy');

// =============================================================================
// Campaign Phases
// =============================================================================

export const campaignPhaseSchema = z.object({
  name: z.string()
    .describe('Phase name (e.g., "Foundation & Testing", "Scale Winners", "Optimize & Expand").'),

  phase: z.number().min(1).max(6)
    .describe('Phase number (1-based sequential).'),

  durationWeeks: z.number().min(1).max(12)
    .describe('Duration of this phase in weeks.'),

  objective: z.string()
    .describe('Primary objective for this phase. Be specific about what success looks like.'),

  activities: z.array(z.string())
    .min(2).max(8)
    .describe('Key activities during this phase. Concrete actions the media buyer should take.'),

  successCriteria: z.array(z.string())
    .min(1).max(5)
    .describe('Measurable criteria for moving to the next phase.'),

  estimatedBudget: z.number()
    .describe('Total estimated budget for this entire phase in USD.'),
}).describe('Campaign phase with objectives, activities, and success criteria');

// =============================================================================
// KPI Targets
// =============================================================================

export const kpiTargetSchema = z.object({
  metric: z.string()
    .describe('KPI metric name (e.g., "Cost Per Lead", "SQL Rate", "ROAS", "Demo Booking Rate").'),

  target: z.string()
    .describe('Target value with units (e.g., "<$75", "15%", "3.5x", "80/month").'),

  timeframe: z.string()
    .describe('When this target should be achieved (e.g., "Month 2", "By end of Phase 2", "Ongoing").'),

  measurementMethod: z.string()
    .describe('How to measure this KPI. Be specific about tools and attribution (e.g., "HubSpot CRM pipeline tracking").'),
}).describe('KPI target with measurement methodology');

// =============================================================================
// Complete Media Plan Schema (excludes metadata — populated post-generation)
// =============================================================================

export const mediaPlanSchema = z.object({
  executiveSummary: executiveSummarySchema
    .describe('High-level strategy overview and priorities'),

  platformStrategy: z.array(platformStrategySchema)
    .min(1).max(5)
    .describe('Per-platform strategy. Include 2-4 platforms ordered by priority. Primary platform first.'),

  budgetAllocation: budgetAllocationSchema
    .describe('Budget allocation across platforms with ramp-up strategy'),

  campaignPhases: z.array(campaignPhaseSchema)
    .min(2).max(6)
    .describe('3-4 phased campaign rollout. Start with testing/foundation, then scale, then optimize.'),

  kpiTargets: z.array(kpiTargetSchema)
    .min(3).max(10)
    .describe('5-8 KPI targets covering cost efficiency, volume, quality, and ROI metrics.'),
}).describe('Complete media plan for paid advertising campaign');
