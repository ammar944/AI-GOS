// Research Agent
// Wraps OpenRouter client with citation extraction and research-specific features

import { z } from "zod";
import {
  OpenRouterClient,
  createOpenRouterClient,
  extractCitations,
  hasWebSearch,
  type ChatMessage,
} from "@/lib/openrouter/client";
import type { Citation } from "@/lib/strategic-blueprint/output-types";
import type {
  ResearchOptions,
  ResearchResponse,
  ResearchCostSummary,
} from "./types";

// Estimated cost per 1M citation tokens (Perplexity Deep Research)
const CITATION_TOKEN_COST_PER_MILLION = 2.0;
// Estimated average citation tokens per web search call
const ESTIMATED_CITATION_TOKENS_PER_CALL = 5000;

/**
 * Research agent that wraps OpenRouter client with citation extraction
 * and research-specific cost tracking.
 */
export class ResearchAgent {
  private client: OpenRouterClient;
  private costSummary: ResearchCostSummary;

  constructor(client?: OpenRouterClient) {
    this.client = client ?? createOpenRouterClient();
    this.costSummary = this.initCostSummary();
  }

  private initCostSummary(): ResearchCostSummary {
    return {
      totalApiCost: 0,
      totalCitationCost: 0,
      totalCost: 0,
      callCount: 0,
      citationCount: 0,
      byModel: {},
    };
  }

  /**
   * Perform a research query and extract citations.
   * Use this for free-form research where you want the raw content.
   */
  async research(options: ResearchOptions): Promise<ResearchResponse<string>> {
    const response = await this.client.chat({
      model: options.model,
      messages: options.messages,
      temperature: options.temperature ?? 0.3,
      maxTokens: options.maxTokens ?? 4096,
      jsonMode: options.jsonMode,
      timeout: options.timeout,
      reasoning: options.reasoning,
    });

    const citations = extractCitations(response);
    const cost = this.calculateCost(options.model, response.cost, citations.length);

    this.updateCostSummary(options.model, cost, citations.length);

    return {
      content: response.content,
      citations,
      usage: response.usage,
      cost,
      model: options.model,
    };
  }

  /**
   * Perform research and parse the JSON response with Zod validation.
   * Includes retries for validation failures.
   */
  async researchJSON<T>(
    options: ResearchOptions,
    schema: z.ZodType<T>,
    retries: number = 2
  ): Promise<ResearchResponse<T>> {
    const response = await this.client.chatJSONValidated(
      {
        model: options.model,
        messages: options.messages,
        temperature: options.temperature ?? 0.3,
        maxTokens: options.maxTokens ?? 4096,
        jsonMode: true,
        timeout: options.timeout,
        reasoning: options.reasoning,
      },
      schema,
      retries
    );

    // Note: chatJSONValidated doesn't return citations directly
    // We need to make a separate call or use chat() for citation-critical research
    // For now, return empty citations for JSON-validated calls
    // Future: extend chatJSONValidated to preserve citations
    const citations: Citation[] = [];
    const cost = this.calculateCost(options.model, response.cost, citations.length);

    this.updateCostSummary(options.model, cost, citations.length);

    return {
      content: response.data,
      citations,
      usage: response.usage,
      cost,
      model: options.model,
    };
  }

  /**
   * Get the accumulated cost summary for this agent instance.
   */
  getCostSummary(): ResearchCostSummary {
    return { ...this.costSummary };
  }

  /**
   * Reset the cost tracking for a new research session.
   */
  resetCostTracking(): void {
    this.costSummary = this.initCostSummary();
  }

  private calculateCost(
    model: string,
    apiCost: number,
    citationCount: number
  ): ResearchResponse["cost"] {
    // Only estimate citation costs for web search models
    const citationCost = hasWebSearch(model)
      ? (ESTIMATED_CITATION_TOKENS_PER_CALL * citationCount / 1_000_000) * CITATION_TOKEN_COST_PER_MILLION
      : 0;

    return {
      apiCost,
      citationCost,
      totalCost: apiCost + citationCost,
    };
  }

  private updateCostSummary(
    model: string,
    cost: ResearchResponse["cost"],
    citationCount: number
  ): void {
    this.costSummary.totalApiCost += cost.apiCost;
    this.costSummary.totalCitationCost += cost.citationCost;
    this.costSummary.totalCost += cost.totalCost;
    this.costSummary.callCount += 1;
    this.costSummary.citationCount += citationCount;

    if (!this.costSummary.byModel[model]) {
      this.costSummary.byModel[model] = { calls: 0, cost: 0, citations: 0 };
    }
    this.costSummary.byModel[model].calls += 1;
    this.costSummary.byModel[model].cost += cost.totalCost;
    this.costSummary.byModel[model].citations += citationCount;
  }
}

/**
 * Factory function to create a research agent.
 */
export function createResearchAgent(): ResearchAgent {
  return new ResearchAgent();
}
