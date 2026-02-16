// Media Plan Phase Schemas
// Per-phase schema groupings for the multi-phase pipeline.
// Thin wrappers re-exporting from schemas.ts grouped by pipeline phase.

import { z } from 'zod';
import {
  platformStrategySchema,
  icpTargetingSchema,
  kpiTargetSchema,
  campaignStructureSchema,
  creativeStrategySchema,
  campaignPhaseSchema,
  budgetAllocationSchema,
  executiveSummarySchema,
  riskMonitoringSchema,
} from './schemas';

// =============================================================================
// Phase 1: Web-Grounded Research (Sonar Pro)
// =============================================================================

/** Platform strategy — single platform object returned per research call */
export const phase1PlatformStrategySchema = z.object({
  platforms: z.array(platformStrategySchema)
    .min(1).max(5)
    .describe('Per-platform strategy with real CPL benchmarks and targeting data from current web sources.'),
});
export type Phase1PlatformStrategyOutput = z.infer<typeof phase1PlatformStrategySchema>;

/** ICP targeting — audience segments with real audience sizes */
export const phase1ICPTargetingSchema = icpTargetingSchema;
export type Phase1ICPTargetingOutput = z.infer<typeof phase1ICPTargetingSchema>;

/** KPI benchmarks with real industry data */
export const phase1KPITargetsSchema = z.object({
  kpiTargets: z.array(kpiTargetSchema)
    .min(3).max(12)
    .describe('KPI targets with current industry benchmarks sourced from web research.'),
});
export type Phase1KPITargetsOutput = z.infer<typeof phase1KPITargetsSchema>;

// =============================================================================
// Phase 2A: Synthesis (Claude Sonnet)
// =============================================================================

export const phase2CampaignStructureSchema = campaignStructureSchema;
export type Phase2CampaignStructureOutput = z.infer<typeof phase2CampaignStructureSchema>;

export const phase2CreativeStrategySchema = creativeStrategySchema;
export type Phase2CreativeStrategyOutput = z.infer<typeof phase2CreativeStrategySchema>;

export const phase2CampaignPhasesSchema = z.object({
  campaignPhases: z.array(campaignPhaseSchema)
    .min(2).max(6)
    .describe('Phased campaign rollout from testing to scaling to optimization.'),
});
export type Phase2CampaignPhasesOutput = z.infer<typeof phase2CampaignPhasesSchema>;

// =============================================================================
// Phase 2B: Budget + Monitoring (Claude Sonnet, then code validation)
// =============================================================================

/** Sonnet generates budget allocation + monitoring schedule in one call */
export const phase2BudgetMonitoringSchema = z.object({
  budgetAllocation: budgetAllocationSchema
    .describe('Budget allocation across platforms with funnel split and monthly roadmap.'),
  monitoringSchedule: z.object({
    daily: z.array(z.string()).min(2).max(6)
      .describe('Daily monitoring tasks for the media buyer.'),
    weekly: z.array(z.string()).min(2).max(6)
      .describe('Weekly review items.'),
    monthly: z.array(z.string()).min(2).max(6)
      .describe('Monthly strategic reviews.'),
  }).describe('Monitoring schedule referencing actual campaign structure.'),
});
export type Phase2BudgetMonitoringOutput = z.infer<typeof phase2BudgetMonitoringSchema>;

// =============================================================================
// Phase 3: Final Synthesis (Claude Sonnet)
// =============================================================================

export const phase3ExecutiveSummarySchema = executiveSummarySchema;
export type Phase3ExecutiveSummaryOutput = z.infer<typeof phase3ExecutiveSummarySchema>;

export const phase3RiskMonitoringSchema = riskMonitoringSchema;
export type Phase3RiskMonitoringOutput = z.infer<typeof phase3RiskMonitoringSchema>;
