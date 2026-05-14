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
import { Output, stepCountIs, ToolLoopAgent } from 'ai';

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
import { PositioningEnvelopeSchema } from './envelope-schema';
import { BuyerICPSectionSchema } from './schemas/buyer-icp';

const SUBAGENT_MODEL = anthropic('claude-opus-4-6');
// 13 = 12 prompt-instructed tool calls + 1 final structured-output step.
// AI SDK v6 `Output.object()` consumes an additional step for the schema
// emission; sizing the cap at 12 truncates the loop one step before the
// schema can land. See AI SDK docs structured-output troubleshooting +
// codex review feedback 2026-05-13.
const SUBAGENT_STEP_CAP = stepCountIs(13);

// Schema-enforced final answer for all 6 positioning subagents. Replaces
// the manual `extractJson(rawText)` parse-and-pray pipeline that produced
// the ~50% JSON-failure rate on positioningOfferDiagnostic.
//
// Each subagent's tool loop runs as before; only the FINAL response is
// constrained to PositioningEnvelopeSchema. Result is read from
// `result.output` (typed) in positioning-subagent-runner.ts.
const SUBAGENT_OUTPUT = Output.object({
  schema: PositioningEnvelopeSchema,
  name: 'positioningEnvelope',
  description:
    'Final structured envelope for the positioning section. Populate every field; cite sourceUrl wherever possible.',
});

// PILOT — BuyerICP per-section schema. Adds rich fields (personas[],
// icpAccountCounts{}, awarenessDistribution[], triggers[], clusters{}) that
// scripts/validate.py enforces inside the agent's code_execution loop.
// Other 5 subagents still use SUBAGENT_OUTPUT until this pattern is proven
// in production, then they migrate one at a time.
const BUYER_ICP_OUTPUT = Output.object({
  schema: BuyerICPSectionSchema,
  name: 'buyerIcpSection',
  description:
    'Final structured BuyerICP section with envelope core + rich fields (personas, icpAccountCounts, awarenessDistribution, triggers, clusters). The agent MUST validate this against scripts/validate.py via code_execution before emitting.',
});

export const marketAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: MARKET_CATEGORY_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningMarketCategory,
  stopWhen: SUBAGENT_STEP_CAP,
  output: SUBAGENT_OUTPUT,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningMarketCategory',
  },
});

export const buyerIcpAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: BUYER_ICP_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningBuyerICP,
  stopWhen: SUBAGENT_STEP_CAP,
  output: BUYER_ICP_OUTPUT,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningBuyerICP',
  },
});

export const competitorAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: COMPETITOR_LANDSCAPE_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningCompetitorLandscape,
  stopWhen: SUBAGENT_STEP_CAP,
  output: SUBAGENT_OUTPUT,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningCompetitorLandscape',
  },
});

export const vocAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: VOICE_OF_CUSTOMER_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningVoiceOfCustomer,
  stopWhen: SUBAGENT_STEP_CAP,
  output: SUBAGENT_OUTPUT,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningVoiceOfCustomer',
  },
});

export const demandAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: DEMAND_INTENT_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningDemandIntent,
  stopWhen: SUBAGENT_STEP_CAP,
  output: SUBAGENT_OUTPUT,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningDemandIntent',
  },
});

export const offerAgent = new ToolLoopAgent({
  model: SUBAGENT_MODEL,
  instructions: OFFER_DIAGNOSTIC_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningOfferDiagnostic,
  stopWhen: SUBAGENT_STEP_CAP,
  output: SUBAGENT_OUTPUT,
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
  positioningMarketCategory: marketAgent,
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
