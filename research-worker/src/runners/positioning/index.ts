// Positioning section runners — Pre-Pitch Positioning Audit.
//
// Reuses the journey-section-synthesis.ts helper (Anthropic Platform Skills
// runtime) so the prompt skill is delivered server-side by Anthropic and we
// don't duplicate the toolRunner machinery. Each runner is a thin spec → call.
//
// The frontend prompt skills at src/lib/ai/prompts/positioning-skills/ are
// the canonical reference for what each section answers; the same intent is
// reflected in the spec.mission and spec.outputEmphasis fields here so the
// worker has self-contained context (worker can't import from src/lib).
//
// Section ids match POSITIONING_SECTION_IDS in the frontend skills barrel —
// keep them in sync.

import {
  runJourneySection,
  type JourneySectionSpec,
} from '../journey-section-synthesis';
import {
  runJourneySectionViaSubagent,
  type PositioningRunnerOptions,
} from '../positioning-subagent-runner';
import type { RunnerProgressReporter } from '../../runner';
import type { ResearchResult } from '../../supabase';

/**
 * Phase 3b cutover gate. When ENABLE_POSITIONING_SUBAGENTS is set, each
 * positioning runner dispatches through the AI SDK ToolLoopAgent subagent
 * (with domain-scoped tools) instead of the Platform Skills toolRunner.
 * Defaults to `true` — Phase 3b ships the subagent path as the default.
 * Set explicitly to "false" to roll back to Platform Skills without a deploy.
 */
const USE_SUBAGENTS = process.env.ENABLE_POSITIONING_SUBAGENTS !== 'false';

function runPositioningSection(
  spec: JourneySectionSpec,
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> {
  if (USE_SUBAGENTS) {
    return runJourneySectionViaSubagent(
      spec,
      context,
      onProgress,
      chatRefinement,
      abortSignal,
      options,
    );
  }
  return runJourneySection(spec, context, onProgress, chatRefinement);
}

export const POSITIONING_SECTION_SPECS = {
  positioningMarketCategory: {
    section: 'positioningMarketCategory',
    title: 'Market & Category Intelligence Specialist',
    skill: 'ai-gos-market-category-intelligence',
    mission:
      'Define the market category, the adjacent categories buyers confuse it with, market size and trajectory signals, structural forces moving the market, category maturity with evidence, and 1-3 strategic white-space openings a paid-media-led entrant can exploit in the next six months.',
    outputEmphasis: [
      'category definition',
      'market size + trajectory',
      'structural forces',
      'category maturity',
      'strategic openings',
    ],
  },
  positioningBuyerICP: {
    section: 'positioningBuyerICP',
    title: 'Buyer & ICP Validation Specialist',
    skill: 'ai-gos-buyer-icp-validation',
    mission:
      'Pin down the validated ICP firmographics + role-graph, the jobs-to-be-done, top 3-5 pains in real buyer language with triggers, top objections + risk-reversal assets, and qualification filters a media buyer can use in targeting. Disqualify wrong-fit buyers explicitly.',
    outputEmphasis: [
      'validated ICP',
      'jobs-to-be-done',
      'pains + triggers',
      'objections + risk reversal',
      'qualification filters',
    ],
  },
  positioningCompetitorLandscape: {
    section: 'positioningCompetitorLandscape',
    title: 'Competitor Landscape & Positioning Specialist',
    skill: 'ai-gos-competitive-positioning',
    mission:
      'Map 3-7 direct competitors with positioning, pricing, proof, and documented weaknesses; 1-3 adjacent solutions; a 2-axis positioning map with empty quadrants identified; 1-3 differentiation moves a media buyer can write ad copy from; and the proof-asset gaps that need closing.',
    outputEmphasis: [
      'direct competitor set',
      'adjacent solutions',
      'positioning map',
      'differentiation moves',
      'proof gaps',
    ],
  },
  positioningVoiceOfCustomer: {
    section: 'positioningVoiceOfCustomer',
    title: 'Voice of Customer & Objection Evidence Specialist',
    skill: 'ai-gos-voice-of-customer-objections',
    mission:
      'Surface verbatim buyer language patterns for pain, solution, and switching motions; the top 5-8 objections with verbatim quotes and the proof that defuses each; and the trust signals buyers weight most. Quote-first artifact — paraphrase is a tax.',
    outputEmphasis: [
      'pain language',
      'solution language',
      'switching language',
      'objection bank',
      'trust signals',
    ],
  },
  positioningDemandIntent: {
    section: 'positioningDemandIntent',
    title: 'Demand & Intent Signals Specialist',
    skill: 'ai-gos-demand-intent-signals',
    mission:
      'Map 4-7 intent clusters across the funnel, the problem-aware queries buyers use BEFORE knowing the category, the comparison "X vs Y" patterns with real competitor pairings, 3-5 paid-search ad-copy angles, and 3-5 content gaps with documented demand and weak competitor coverage.',
    outputEmphasis: [
      'intent clusters',
      'problem-aware queries',
      'comparison queries',
      'paid-search angles',
      'content gaps',
    ],
  },
  positioningOfferDiagnostic: {
    section: 'positioningOfferDiagnostic',
    title: 'Offer & Performance Diagnostic Specialist',
    skill: 'ai-gos-offer-performance-diagnostic',
    mission:
      'Diagnose whether the OFFER is the bottleneck for paid-media performance: score the value equation (dream outcome / likelihood / time delay / effort) with evidence, audit the cold-ad-click → paid conversion path for friction, identify proof gaps, and propose 2-4 specific offer moves with the value-equation axis each improves and a test window in days.',
    outputEmphasis: [
      'offer summary',
      'value equation diagnostic',
      'conversion-path audit',
      'proof gaps',
      'offer moves',
    ],
  },
} as const satisfies Record<string, JourneySectionSpec>;

export type PositioningSectionId = keyof typeof POSITIONING_SECTION_SPECS;

export const POSITIONING_SECTION_IDS = Object.keys(
  POSITIONING_SECTION_SPECS,
) as PositioningSectionId[];

export function isPositioningSectionId(
  value: unknown,
): value is PositioningSectionId {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(POSITIONING_SECTION_SPECS, value)
  );
}

export const runPositioningMarketCategory = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> =>
  runPositioningSection(
    POSITIONING_SECTION_SPECS.positioningMarketCategory,
    context,
    onProgress,
    chatRefinement,
    abortSignal,
    options,
  );

export const runPositioningBuyerICP = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> =>
  runPositioningSection(
    POSITIONING_SECTION_SPECS.positioningBuyerICP,
    context,
    onProgress,
    chatRefinement,
    abortSignal,
    options,
  );

export const runPositioningCompetitorLandscape = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> =>
  runPositioningSection(
    POSITIONING_SECTION_SPECS.positioningCompetitorLandscape,
    context,
    onProgress,
    chatRefinement,
    abortSignal,
    options,
  );

export const runPositioningVoiceOfCustomer = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> =>
  runPositioningSection(
    POSITIONING_SECTION_SPECS.positioningVoiceOfCustomer,
    context,
    onProgress,
    chatRefinement,
    abortSignal,
    options,
  );

export const runPositioningDemandIntent = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> =>
  runPositioningSection(
    POSITIONING_SECTION_SPECS.positioningDemandIntent,
    context,
    onProgress,
    chatRefinement,
    abortSignal,
    options,
  );

export const runPositioningOfferDiagnostic = (
  context: string,
  onProgress?: RunnerProgressReporter,
  chatRefinement?: string,
  abortSignal?: AbortSignal,
  options?: PositioningRunnerOptions,
): Promise<ResearchResult> =>
  runPositioningSection(
    POSITIONING_SECTION_SPECS.positioningOfferDiagnostic,
    context,
    onProgress,
    chatRefinement,
    abortSignal,
    options,
  );

export const POSITIONING_RUNNERS: Record<
  PositioningSectionId,
  (
    context: string,
    onProgress?: RunnerProgressReporter,
    chatRefinement?: string,
    abortSignal?: AbortSignal,
    options?: PositioningRunnerOptions,
  ) => Promise<ResearchResult>
> = {
  positioningMarketCategory: runPositioningMarketCategory,
  positioningBuyerICP: runPositioningBuyerICP,
  positioningCompetitorLandscape: runPositioningCompetitorLandscape,
  positioningVoiceOfCustomer: runPositioningVoiceOfCustomer,
  positioningDemandIntent: runPositioningDemandIntent,
  positioningOfferDiagnostic: runPositioningOfferDiagnostic,
};
