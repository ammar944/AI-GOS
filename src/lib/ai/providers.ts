// AI Provider Configuration
// Vercel AI SDK providers for SaasLaunch research generation

import { createPerplexity } from '@ai-sdk/perplexity';
import { createAnthropic } from '@ai-sdk/anthropic';

// =============================================================================
// Provider Instances
// =============================================================================

export const perplexity = createPerplexity({
  apiKey: process.env.PERPLEXITY_API_KEY,
});

export const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// =============================================================================
// Model Constants
// =============================================================================

export const MODELS = {
  // Research models (Perplexity)
  SONAR_PRO: 'sonar-pro',
  SONAR_REASONING: 'sonar-reasoning-pro',

  // Anthropic models
  CLAUDE_SONNET: 'claude-sonnet-4-20250514',
  CLAUDE_HAIKU: 'claude-haiku-4-5-20251001',

  // Groq models
  LLAMA_3_3_70B: 'llama-3.3-70b-versatile',
  KIMI_K2: 'moonshotai/kimi-k2-instruct-0905',
  GPT_OSS_20B: 'openai/gpt-oss-20b',
} as const;

// =============================================================================
// Section → Model Mapping
// =============================================================================

export const SECTION_MODELS = {
  // Phase 1: Parallel research
  industryMarket: MODELS.SONAR_PRO,        // Research aggregation
  competitorAnalysis: MODELS.SONAR_PRO,    // Research + Firecrawl/AdLibrary

  // Phase 2: Sequential analysis
  // NOTE: Using SONAR_PRO instead of SONAR_REASONING because reasoning models
  // output <think> tags and prose instead of following JSON output instructions.
  // SONAR_PRO reliably produces structured JSON with generateObject().
  icpValidation: MODELS.SONAR_PRO,         // ICP validation & psychographics
  offerAnalysis: MODELS.SONAR_PRO,         // Scoring & recommendations

  // Phase 3: Synthesis (Kimi K2 on Groq — fast inference)
  crossAnalysis: MODELS.KIMI_K2,           // Strategic prose
} as const;

// =============================================================================
// Media Plan Section → Model Mapping
// =============================================================================

export const MEDIA_PLAN_SECTION_MODELS = {
  // Phase 1: Web-grounded research (Sonar Pro)
  platformStrategy: MODELS.SONAR_PRO,
  icpTargeting: MODELS.SONAR_PRO,
  kpiTargets: MODELS.SONAR_PRO,

  // Phase 2A: Synthesis (Claude Sonnet)
  campaignStructure: MODELS.CLAUDE_SONNET,
  creativeStrategy: MODELS.CLAUDE_SONNET,
  campaignPhases: MODELS.CLAUDE_SONNET,

  // Phase 2B: Budget + Monitoring (Claude Sonnet → code validation)
  budgetAllocation: MODELS.CLAUDE_SONNET,

  // Phase 2C: Performance Model (pure code — no model)
  performanceModel: 'deterministic' as const,

  // Phase 3: Final synthesis (Claude Sonnet)
  executiveSummary: MODELS.CLAUDE_SONNET,
  riskMonitoring: MODELS.CLAUDE_SONNET,
} as const;

// =============================================================================
// Generation Settings
// =============================================================================

export const GENERATION_SETTINGS = {
  // Sonar Pro - research tasks
  research: {
    temperature: 0.3,
    maxTokens: 8192,
  },

  // Sonar Reasoning Pro - analytical tasks
  reasoning: {
    temperature: 0.4,
    maxTokens: 6144,
  },

  // Claude Sonnet - synthesis
  synthesis: {
    temperature: 0.5,
    maxTokens: 8192,
  },

  // Claude Haiku - fast extraction tasks
  extraction: {
    temperature: 0.1,
    maxTokens: 2048,
  },
} as const;

// =============================================================================
// Cost Tracking (per 1M tokens)
// =============================================================================

export const MODEL_COSTS = {
  [MODELS.SONAR_PRO]: {
    input: 3.0,
    output: 15.0,
    requestFee: 0.01, // Medium context
  },
  [MODELS.SONAR_REASONING]: {
    input: 2.0,
    output: 8.0,
    requestFee: 0.01,
  },
  [MODELS.CLAUDE_SONNET]: {
    input: 3.0,
    output: 15.0,
    requestFee: 0,
  },
  [MODELS.CLAUDE_HAIKU]: {
    input: 0.8,
    output: 4.0,
    requestFee: 0,
  },
  [MODELS.LLAMA_3_3_70B]: {
    input: 0.59,
    output: 0.79,
    requestFee: 0,
  },
  [MODELS.KIMI_K2]: {
    input: 1.0,
    output: 3.0,
    requestFee: 0,
  },
  [MODELS.GPT_OSS_20B]: {
    input: 0.075,
    output: 0.30,
    requestFee: 0,
  },
} as const;

export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  const costs = MODEL_COSTS[model as keyof typeof MODEL_COSTS] ?? { input: 3, output: 15, requestFee: 0.01 };
  const inputCost = (inputTokens / 1_000_000) * costs.input;
  const outputCost = (outputTokens / 1_000_000) * costs.output;
  return inputCost + outputCost + costs.requestFee;
}
