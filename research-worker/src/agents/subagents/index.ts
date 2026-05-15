/**
 * Phase 3b subagent registry. Each subagent is a ToolLoopAgent with a
 * domain-scoped tool map from POSITIONING_TOOL_MAPS (Phase 3a) and a
 * zone-specific instruction set.
 *
 * Phase 3b worker dispatcher (journey-section-synthesis.ts → runJourneySection)
 * selects the right subagent by spec.section and calls subagent.generate().
 *
 * Models: opus-4-6 across the board for quality. Token budget per design
 * Premise: ~$7-15/run (vs $1.50-2 on Platform Skills) — Anthropic's
 * published 15× multiplier for parallel-subagent systems.
 */

import { anthropic } from '@ai-sdk/anthropic';
import { ToolLoopAgent } from 'ai';

import {
  POSITIONING_TOOL_MAPS,
} from '../../agent-tools';

import {
  BUYER_ICP_INSTRUCTIONS,
  COMPETITOR_LANDSCAPE_INSTRUCTIONS,
  DEMAND_INTENT_INSTRUCTIONS,
  MARKET_CATEGORY_INSTRUCTIONS,
  OFFER_DIAGNOSTIC_INSTRUCTIONS,
  VOICE_OF_CUSTOMER_INSTRUCTIONS,
} from './_skill-loader';

const SUBAGENT_MODEL = anthropic('claude-opus-4-6');

/**
 * Market Category gathers evidence only. ADR-0002 moves the typed Artifact
 * emission to positioning-subagent-runner.ts via
 * streamObject(MarketCategoryArtifactSchema) after this tool loop completes.
 */
export const marketCategoryAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: MARKET_CATEGORY_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningMarketCategory,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningMarketCategory',
  },
});

/**
 * BuyerICP gathers evidence only. ADR-0002 moves the typed Artifact emission
 * to positioning-subagent-runner.ts via streamObject(BuyerICPArtifactSchema)
 * after this tool loop completes.
 */
export const buyerIcpAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: BUYER_ICP_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningBuyerICP,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningBuyerICP',
  },
});

export const competitorAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: COMPETITOR_LANDSCAPE_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningCompetitorLandscape,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningCompetitorLandscape',
  },
});

export const vocAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: VOICE_OF_CUSTOMER_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningVoiceOfCustomer,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningVoiceOfCustomer',
  },
});

export const demandAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: DEMAND_INTENT_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningDemandIntent,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningDemandIntent',
  },
});

export const offerAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: OFFER_DIAGNOSTIC_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningOfferDiagnostic,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningOfferDiagnostic',
  },
});

/**
 * Section-id → subagent lookup. The 6 positioning section ids come from
 * `src/lib/ai/prompts/positioning-skills/index.ts` (POSITIONING_SECTION_IDS).
 * deepResearchProgram is intentionally NOT registered here — corpus stays
 * on Platform Skills per design Open Question 7.
 */
export const POSITIONING_SUBAGENTS = {
  positioningMarketCategory: marketCategoryAgent,
  positioningBuyerICP: buyerIcpAgent,
  positioningCompetitorLandscape: competitorAgent,
  positioningVoiceOfCustomer: vocAgent,
  positioningDemandIntent: demandAgent,
  positioningOfferDiagnostic: offerAgent,
} as const;

export type PositioningSubagentId = keyof typeof POSITIONING_SUBAGENTS;

export function isPositioningSubagentId(
  value: string,
): value is PositioningSubagentId {
  return value in POSITIONING_SUBAGENTS;
}
