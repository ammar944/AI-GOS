// Research Agent Types
// Types for research operations with citation tracking

import type { ChatMessage, ReasoningOptions } from "@/lib/openrouter/client";
import type { Citation } from "@/lib/strategic-blueprint/output-types";

/** Research request options */
export interface ResearchOptions {
  /** The model to use for research */
  model: string;
  /** Chat messages (system + user prompts) */
  messages: ChatMessage[];
  /** Temperature for response generation */
  temperature?: number;
  /** Maximum tokens for response */
  maxTokens?: number;
  /** Enable JSON mode for structured output */
  jsonMode?: boolean;
  /** Request timeout in ms */
  timeout?: number;
  /** Reasoning options for supported models */
  reasoning?: ReasoningOptions;
}

/** Research response with citations */
export interface ResearchResponse<T = string> {
  /** The research content (string or parsed JSON) */
  content: T;
  /** Citations extracted from the response */
  citations: Citation[];
  /** Token usage */
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  /** Cost breakdown */
  cost: {
    /** Base API cost (input + output tokens) */
    apiCost: number;
    /** Estimated citation token cost (Perplexity only) */
    citationCost: number;
    /** Total cost */
    totalCost: number;
  };
  /** Model used */
  model: string;
}

/** Research cost tracking for a session/pipeline */
export interface ResearchCostSummary {
  /** Total API costs across all calls */
  totalApiCost: number;
  /** Total estimated citation costs */
  totalCitationCost: number;
  /** Total combined cost */
  totalCost: number;
  /** Number of research calls made */
  callCount: number;
  /** Total citations collected */
  citationCount: number;
  /** Breakdown by model */
  byModel: Record<string, { calls: number; cost: number; citations: number }>;
}
