// Industry & Market Overview Schema
// Enhanced with .describe() hints for better AI output quality

import { z } from 'zod';

// =============================================================================
// Category Snapshot
// =============================================================================

export const categorySnapshotSchema = z.object({
  category: z.string()
    .describe('Specific market category name (e.g., "B2B Marketing Attribution SaaS", "Enterprise HR Tech"). Be precise, not generic.'),

  marketMaturity: z.enum(['early', 'growing', 'saturated'])
    .describe('Market stage: "early" = emerging (<$1B TAM, few players), "growing" = rapid expansion (VC funding, new entrants), "saturated" = commoditized (price competition, consolidation)'),

  awarenessLevel: z.enum(['low', 'medium', 'high'])
    .describe('Target audience awareness: "low" = need education, "medium" = know solutions exist, "high" = actively comparing vendors'),

  buyingBehavior: z.enum(['impulsive', 'committee_driven', 'roi_based', 'mixed'])
    .describe('How purchases happen: "impulsive" = quick decisions, "committee_driven" = multiple stakeholders, "roi_based" = data-driven evaluation, "mixed" = varies by deal size'),

  averageSalesCycle: z.string()
    .describe('Typical time from first touch to closed deal. Be specific (e.g., "2-4 weeks for SMB, 3-6 months for Enterprise").'),

  seasonality: z.string()
    .describe('Buying patterns throughout the year. Include specific timing (e.g., "Q4 budget flush in Oct-Nov", "Back-to-school surge in Aug", "Year-round with slight Q1 dip").'),
}).describe('High-level market positioning snapshot based on current market research');

// =============================================================================
// Market Dynamics
// =============================================================================

export const marketDynamicsSchema = z.object({
  demandDrivers: z.array(z.string())
    .min(2).max(8)
    .describe('4-6 factors currently driving demand in this market. Include recent trends (2024+), regulatory changes, technology shifts, and macro factors. Be specific with data when available.'),

  buyingTriggers: z.array(z.string())
    .min(2).max(8)
    .describe('4-6 specific events that trigger purchase decisions. Examples: "New CMO hire", "Failed marketing campaign", "Board pressure for metrics". These should be actionable for ad targeting.'),

  barriersToPurchase: z.array(z.string())
    .min(2).max(7)
    .describe('3-5 obstacles preventing purchases. Include budget concerns, implementation fears, stakeholder objections, and competing priorities. These inform objection handling in ads.'),

  macroRisks: z.object({
    regulatoryConcerns: z.string()
      .describe('Current or upcoming regulatory risks affecting this market (e.g., "GDPR enforcement tightening", "FTC ad disclosure rules"). Say "None identified" if truly none.'),
    marketDownturnRisks: z.string()
      .describe('How economic conditions affect this market (e.g., "First budget cut in recession", "Counter-cyclical demand in downturns").'),
    industryConsolidation: z.string()
      .describe('M&A trends, platform acquisitions, or vendor consolidation affecting the competitive landscape.'),
  }).describe('Macro-level risks that could impact marketing effectiveness'),
}).describe('Current market dynamics based on recent (2024+) research and trends');

// =============================================================================
// Pain Points
// =============================================================================

export const painPointsSchema = z.object({
  primary: z.array(z.string())
    .min(3).max(10)
    .describe('5-7 most critical, urgent pain points that drive immediate buying action. Source from G2 reviews, Capterra feedback, Reddit threads, and industry forums. These are ad headline material - make them visceral and specific.'),

  secondary: z.array(z.string())
    .min(3).max(10)
    .describe('5-8 additional pain points that matter but are not primary purchase drivers. Often operational or nice-to-have issues. Good for retargeting and nurture content.'),
}).describe('Customer pain points ranked by urgency and purchase impact, sourced from review sites and forums');

// =============================================================================
// Psychological Drivers
// =============================================================================

export const psychologicalDriversSchema = z.object({
  drivers: z.array(z.object({
    driver: z.string()
      .describe('Name of the emotional driver (e.g., "Fear of falling behind competitors", "Desire for recognition", "Job security anxiety")'),
    description: z.string()
      .describe('How this manifests in buying behavior. Include specific scenarios and how to leverage in ad messaging.'),
  }))
    .min(2).max(8)
    .describe('4-6 emotional and psychological drivers that influence purchasing. Map each to specific ad angle opportunities.'),
}).describe('Psychological and emotional drivers behind purchase decisions - key for ad creative strategy');

// =============================================================================
// Audience Objections
// =============================================================================

export const audienceObjectionsSchema = z.object({
  objections: z.array(z.object({
    objection: z.string()
      .describe('The specific objection as a prospect would phrase it (e.g., "We already have Google Analytics", "Our data is too messy")'),
    howToAddress: z.string()
      .describe('Effective response strategy for ads and sales. Be specific about proof points, comparisons, or reframes that work.'),
  }))
    .min(2).max(8)
    .describe('4-6 common objections prospects raise, sourced from sales calls, reviews, and forum discussions'),
}).describe('Common objections and how to address them in marketing - critical for ad copy and landing pages');

// =============================================================================
// Messaging Opportunities
// =============================================================================

export const messagingOpportunitiesSchema = z.object({
  summaryRecommendations: z.array(z.string())
    .min(2).max(5)
    .describe('Top 3 strategic recommendations synthesized from all analysis. These are the priority actions for the marketing strategy.'),
}).describe('Strategic recommendations for paid media');

// =============================================================================
// Complete Industry & Market Overview Schema
// =============================================================================

export const industryMarketSchema = z.object({
  categorySnapshot: categorySnapshotSchema,
  marketDynamics: marketDynamicsSchema,
  painPoints: painPointsSchema,
  psychologicalDrivers: psychologicalDriversSchema,
  audienceObjections: audienceObjectionsSchema,
  messagingOpportunities: messagingOpportunitiesSchema,
}).describe('Comprehensive industry and market research for paid media strategy');

// =============================================================================
// Type Export
// =============================================================================

export type IndustryMarketOverview = z.infer<typeof industryMarketSchema>;
