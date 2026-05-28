/**
 * Phase 3b subagent registry. Each subagent is a ToolLoopAgent with a
 * domain-scoped tool map from POSITIONING_TOOL_MAPS (Phase 3a) and a
 * zone-specific instruction set.
 *
 * Phase 3b worker dispatcher (journey-section-synthesis.ts → runJourneySection)
 * selects the right subagent by spec.section and calls subagent.generate().
 *
 * Deep mode uses the strong model for quality. Draft mode bypasses these
 * agents entirely and streams typed Artifacts directly from the Section
 * Context Pack.
 */

import { anthropic } from '@ai-sdk/anthropic';
import {
  ToolLoopAgent,
  type LanguageModel,
  type PrepareStepFunction,
  type Tool,
  type ToolExecutionOptions,
  type ToolSet,
} from 'ai';

import {
  POSITIONING_TOOL_MAPS,
} from '../../agent-tools';
import { MODELS } from '../../models';

import {
  BUYER_ICP_INSTRUCTIONS,
  COMPETITOR_LANDSCAPE_INSTRUCTIONS,
  DEMAND_INTENT_INSTRUCTIONS,
  MARKET_CATEGORY_INSTRUCTIONS,
  OFFER_DIAGNOSTIC_INSTRUCTIONS,
  VOICE_OF_CUSTOMER_INSTRUCTIONS,
} from './_skill-loader';

const STRONG_SUBAGENT_MODEL = anthropic(MODELS.STRONG);

export interface SectionToolBudget {
  maxExternalLookups: number;
  allowedTools: string[];
}

export interface ToolBudgetExhaustedResult {
  ok: false;
  status: 'tool_budget_exhausted';
  maxExternalLookups: number;
  unresolvedEvidenceGapId?: string;
  message: string;
}

export interface BudgetedToolRuntime {
  tools: ToolSet;
  prepareStep: PrepareStepFunction<ToolSet>;
  recordProviderToolCalls: (toolNames: string[]) => ToolBudgetExhaustedResult[];
  getExhaustedResults: () => ToolBudgetExhaustedResult[];
}

export interface CreatePositioningSubagentInput {
  section: PositioningSubagentId;
  model: LanguageModel;
  toolBudget?: SectionToolBudget;
  unresolvedEvidenceGapId?: string;
}

const PACK_TOOL_TO_RUNTIME_TOOL: Record<string, string> = {
  webSearch: 'web_search',
  web_search: 'web_search',
  firecrawl: 'firecrawl',
  pagespeed: 'pagespeed',
  reviews: 'reviews',
  spyfu: 'spyfu',
  adlibrary: 'adlibrary',
  metaAds: 'meta_ads',
  meta_ads: 'meta_ads',
  googleAds: 'google_ads',
  google_ads: 'google_ads',
  keywordAdProbe: 'keyword_ad_probe',
  keyword_ad_probe: 'keyword_ad_probe',
  ga4: 'ga4',
};

const INSTRUCTIONS_BY_SECTION: Record<PositioningSubagentId, string> = {
  positioningMarketCategory: MARKET_CATEGORY_INSTRUCTIONS,
  positioningBuyerICP: BUYER_ICP_INSTRUCTIONS,
  positioningCompetitorLandscape: COMPETITOR_LANDSCAPE_INSTRUCTIONS,
  positioningVoiceOfCustomer: VOICE_OF_CUSTOMER_INSTRUCTIONS,
  positioningDemandIntent: DEMAND_INTENT_INSTRUCTIONS,
  positioningOfferDiagnostic: OFFER_DIAGNOSTIC_INSTRUCTIONS,
};

function normalizeAllowedToolName(toolName: string): string {
  return PACK_TOOL_TO_RUNTIME_TOOL[toolName] ?? toolName;
}

function createBudgetExhaustedResult(input: {
  maxExternalLookups: number;
  unresolvedEvidenceGapId?: string;
}): ToolBudgetExhaustedResult {
  return {
    ok: false,
    status: 'tool_budget_exhausted',
    maxExternalLookups: input.maxExternalLookups,
    ...(input.unresolvedEvidenceGapId
      ? { unresolvedEvidenceGapId: input.unresolvedEvidenceGapId }
      : {}),
    message: 'Tool budget exhausted for this section.',
  };
}

function asExecutableTool(
  value: unknown,
): (Tool & {
  execute: (input: unknown, options: ToolExecutionOptions) => unknown;
}) | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  return typeof record.execute === 'function'
    ? (value as Tool & {
        execute: (input: unknown, options: ToolExecutionOptions) => unknown;
      })
    : null;
}

export function createBudgetedToolRuntime(input: {
  section: PositioningSubagentId;
  toolBudget?: SectionToolBudget;
  unresolvedEvidenceGapId?: string;
}): BudgetedToolRuntime {
  const baseTools = POSITIONING_TOOL_MAPS[input.section];
  const budget = input.toolBudget;
  const allowedRuntimeTools =
    budget && budget.allowedTools.length > 0
      ? new Set(budget.allowedTools.map(normalizeAllowedToolName))
      : null;
  const maxExternalLookups =
    budget && Number.isFinite(budget.maxExternalLookups)
      ? Math.max(0, budget.maxExternalLookups)
      : null;

  let consumedExternalLookups = 0;
  const exhaustedResults: ToolBudgetExhaustedResult[] = [];
  const executableToolNames = new Set<string>();

  const consumeLookup = (): ToolBudgetExhaustedResult | null => {
    if (maxExternalLookups === null) return null;
    if (consumedExternalLookups >= maxExternalLookups) {
      const exhausted = createBudgetExhaustedResult({
        maxExternalLookups,
        unresolvedEvidenceGapId: input.unresolvedEvidenceGapId,
      });
      exhaustedResults.push(exhausted);
      return exhausted;
    }
    consumedExternalLookups += 1;
    return null;
  };

  const filteredTools: Record<string, unknown> = {};
  for (const [toolName, toolValue] of Object.entries(baseTools)) {
    if (allowedRuntimeTools && !allowedRuntimeTools.has(toolName)) {
      continue;
    }
    const executable = asExecutableTool(toolValue);
    if (!executable) {
      filteredTools[toolName] = toolValue;
      continue;
    }
    executableToolNames.add(toolName);
    filteredTools[toolName] = {
      ...executable,
      execute: async (
        toolInput: unknown,
        options: ToolExecutionOptions,
      ): Promise<unknown> => {
        const exhausted = consumeLookup();
        if (exhausted) return exhausted;
        return await executable.execute(toolInput, options);
      },
    } satisfies Tool;
  }

  const tools = filteredTools as ToolSet;
  const activeToolNames = (): Array<keyof ToolSet> => {
    if (maxExternalLookups !== null && consumedExternalLookups >= maxExternalLookups) {
      return [];
    }
    return Object.keys(tools) as Array<keyof ToolSet>;
  };

  return {
    tools,
    prepareStep: () => ({ activeTools: activeToolNames() }),
    recordProviderToolCalls: (toolNames: string[]) => {
      const results: ToolBudgetExhaustedResult[] = [];
      for (const toolName of toolNames) {
        if (executableToolNames.has(toolName)) continue;
        const exhausted = consumeLookup();
        if (exhausted) results.push(exhausted);
      }
      return results;
    },
    getExhaustedResults: () => [...exhaustedResults],
  };
}

export function createPositioningSubagent(
  input: CreatePositioningSubagentInput,
): { agent: ToolLoopAgent<never, ToolSet>; toolRuntime: BudgetedToolRuntime } {
  const toolRuntime = createBudgetedToolRuntime({
    section: input.section,
    toolBudget: input.toolBudget,
    unresolvedEvidenceGapId: input.unresolvedEvidenceGapId,
  });

  return {
    agent: new ToolLoopAgent({
      model: input.model,
      instructions: INSTRUCTIONS_BY_SECTION[input.section],
      tools: toolRuntime.tools,
      prepareStep: toolRuntime.prepareStep,
      experimental_telemetry: {
        isEnabled: true,
        functionId: input.section,
      },
    }),
    toolRuntime,
  };
}

/**
 * Retired positioning subagent prototype kept only for historical schema/tool
 * experiments. Production section runs use the Next.js lab engine.
 */
export const marketCategoryAgent = new ToolLoopAgent({
  model: STRONG_SUBAGENT_MODEL,
  instructions: MARKET_CATEGORY_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningMarketCategory,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningMarketCategory',
  },
});

/**
 * Retired positioning subagent prototype kept only for historical schema/tool
 * experiments. Production section runs use the Next.js lab engine.
 */
export const buyerIcpAgent = new ToolLoopAgent({
  model: STRONG_SUBAGENT_MODEL,
  instructions: BUYER_ICP_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningBuyerICP,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningBuyerICP',
  },
});

export const competitorAgent = new ToolLoopAgent({
  model: STRONG_SUBAGENT_MODEL,
  instructions: COMPETITOR_LANDSCAPE_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningCompetitorLandscape,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningCompetitorLandscape',
  },
});

export const vocAgent = new ToolLoopAgent({
  model: STRONG_SUBAGENT_MODEL,
  instructions: VOICE_OF_CUSTOMER_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningVoiceOfCustomer,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningVoiceOfCustomer',
  },
});

export const demandAgent = new ToolLoopAgent({
  model: STRONG_SUBAGENT_MODEL,
  instructions: DEMAND_INTENT_INSTRUCTIONS,
  tools: POSITIONING_TOOL_MAPS.positioningDemandIntent,
  experimental_telemetry: {
    isEnabled: true,
    functionId: 'positioningDemandIntent',
  },
});

export const offerAgent = new ToolLoopAgent({
  model: STRONG_SUBAGENT_MODEL,
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
