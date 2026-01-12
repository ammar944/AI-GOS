// OpenRouter API Client
// Uses OpenAI-compatible API format

import { z } from "zod";
import type { Citation } from "@/lib/strategic-blueprint/output-types";

// =============================================================================
// Custom Error Classes
// =============================================================================

/**
 * Error thrown when a request times out.
 * Distinguishable from other abort reasons.
 */
export class TimeoutError extends Error {
  name = "TimeoutError" as const;
  timeout: number;

  constructor(timeout: number, message?: string) {
    super(message || `Request timed out after ${timeout}ms`);
    this.timeout = timeout;
  }
}

/**
 * Error thrown when API returns an error response.
 * Includes status code for retry classification.
 */
export class APIError extends Error {
  name = "APIError" as const;
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Sleep for a specified duration
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Calculate exponential backoff delay with jitter
 * @param attempt - Current attempt number (0-indexed)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @param maxDelay - Maximum delay in ms (default: 10000)
 * @returns Delay in milliseconds
 */
function calculateBackoff(
  attempt: number,
  baseDelay: number = 1000,
  maxDelay: number = 10000
): number {
  // Exponential: baseDelay * 2^attempt
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  // Add random jitter (0-500ms) to prevent thundering herd
  const jitter = Math.random() * 500;
  // Cap at maxDelay
  return Math.min(exponentialDelay + jitter, maxDelay);
}

/**
 * Determine if an error is retryable
 */
function isRetryableError(error: unknown): boolean {
  // TimeoutError is always retryable
  if (error instanceof TimeoutError) {
    return true;
  }

  // APIError - check status code
  if (error instanceof APIError) {
    // 429 Too Many Requests - retryable
    if (error.status === 429) return true;
    // 5xx Server Errors - retryable
    if (error.status >= 500 && error.status < 600) return true;
    // 4xx Client Errors (except 429) - not retryable
    if (error.status >= 400 && error.status < 500) return false;
  }

  // Validation errors (from JSON parsing) - retryable (AI might fix)
  if (error instanceof Error && error.message.includes("parse")) {
    return true;
  }

  // Default: not retryable
  return false;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Effort level for OpenAI o-series reasoning models */
export type ReasoningEffort = "low" | "medium" | "high";

/** Reasoning/thinking parameters for supported models */
export interface ReasoningOptions {
  /** Effort level for OpenAI o-series models */
  effort?: ReasoningEffort;
  /** Max tokens for Anthropic/Gemini reasoning (min 1024) */
  maxTokens?: number;
  /** Include reasoning in response (default: false) */
  include?: boolean;
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean; // Enable strict JSON output
  timeout?: number; // Request timeout in ms (default: 45000)
  /** Reasoning/thinking parameters for supported models */
  reasoning?: ReasoningOptions;
}

// Default timeout for API requests (45 seconds)
const DEFAULT_TIMEOUT_MS = 45000;

/** Search result from Perplexity API (structured citation) */
export interface PerplexitySearchResult {
  title: string;
  url: string;
  date?: string;
  snippet?: string;
}

export interface ChatCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
  /** Citation URLs from Perplexity (legacy format) */
  citations?: string[];
  /** Structured search results from Perplexity (new format) */
  searchResults?: PerplexitySearchResult[];
}

// =============================================================================
// Embedding Types (for v1.4 RAG)
// =============================================================================

export interface EmbeddingOptions {
  /** Model to use for embeddings */
  model: string;
  /** Text(s) to embed - single string or array for batch */
  input: string | string[];
  /** Request timeout in ms (default: 45000) */
  timeout?: number;
}

export interface EmbeddingResponse {
  /** Generated embeddings (one per input text) */
  embeddings: number[][];
  /** Token usage */
  usage: {
    promptTokens: number;
    totalTokens: number;
  };
  /** Estimated cost */
  cost: number;
}

/**
 * Model identifiers for OpenRouter
 *
 * Research/Search models:
 * - PERPLEXITY_SONAR: Real-time web search, citations
 * - PERPLEXITY_DEEP_RESEARCH: Multi-step research with reasoning
 *
 * Reasoning models:
 * - O3_MINI: Cost-efficient STEM reasoning
 * - GEMINI_25_FLASH: Fast reasoning with 1M context
 * - CLAUDE_OPUS: Deep reasoning for complex tasks
 *
 * General purpose:
 * - GEMINI_FLASH: Fast extraction and simple tasks
 * - GPT_4O: Balanced capability
 * - CLAUDE_SONNET: Synthesis and writing
 */
export const MODELS = {
  // Existing models
  GEMINI_FLASH: "google/gemini-2.0-flash-001",
  PERPLEXITY_SONAR: "perplexity/sonar-pro",
  GPT_4O: "openai/gpt-4o",
  CLAUDE_SONNET: "anthropic/claude-sonnet-4",
  // New models for v1.3 multi-agent research
  PERPLEXITY_DEEP_RESEARCH: "perplexity/sonar-deep-research",
  O3_MINI: "openai/o3-mini",
  GEMINI_25_FLASH: "google/gemini-2.5-flash",
  CLAUDE_OPUS: "anthropic/claude-opus-4",
  // Embedding model for v1.4 RAG
  EMBEDDING: "openai/text-embedding-3-small",
} as const;

/** Models that support reasoning/thinking parameters */
const REASONING_MODELS: Set<string> = new Set([
  MODELS.O3_MINI,
  MODELS.GEMINI_25_FLASH,
  MODELS.CLAUDE_OPUS,
  MODELS.PERPLEXITY_DEEP_RESEARCH,
]);

/** Check if a model supports reasoning/thinking parameters */
export function supportsReasoning(model: string): boolean {
  return REASONING_MODELS.has(model);
}

/** Models that include web search/citations */
const WEB_SEARCH_MODELS: Set<string> = new Set([
  MODELS.PERPLEXITY_SONAR,
  MODELS.PERPLEXITY_DEEP_RESEARCH,
]);

/** Check if a model includes web search and citations */
export function hasWebSearch(model: string): boolean {
  return WEB_SEARCH_MODELS.has(model);
}

/** Models that support JSON mode (response_format) */
const JSON_MODE_MODELS: Set<string> = new Set([
  MODELS.GEMINI_FLASH,
  MODELS.GPT_4O,
  MODELS.CLAUDE_SONNET,
  MODELS.CLAUDE_OPUS,
  MODELS.O3_MINI,
  MODELS.GEMINI_25_FLASH,
  // Note: Perplexity models do NOT support response_format
]);

/** Check if a model supports JSON mode (response_format) */
export function supportsJSONMode(model: string): boolean {
  return JSON_MODE_MODELS.has(model);
}

/**
 * Extract normalized citations from an OpenRouter response.
 * Prefers structured search_results over legacy citations array.
 * Returns empty array for non-research models.
 */
export function extractCitations(response: ChatCompletionResponse): Citation[] {
  // Prefer structured searchResults (new format as of May 2025)
  if (response.searchResults?.length) {
    return response.searchResults.map(sr => ({
      url: sr.url,
      title: sr.title,
      date: sr.date,
      snippet: sr.snippet,
    }));
  }

  // Fallback to legacy citations array (URLs only)
  if (response.citations?.length) {
    return response.citations.map(url => ({ url }));
  }

  return [];
}

// Approximate costs per 1M tokens (input/output) - for estimation
// Note: Perplexity models have additional $5/K search cost not tracked here
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  // Existing models
  [MODELS.GEMINI_FLASH]: { input: 0.075, output: 0.30 },
  [MODELS.PERPLEXITY_SONAR]: { input: 3.0, output: 15.0 },
  [MODELS.GPT_4O]: { input: 2.5, output: 10.0 },
  [MODELS.CLAUDE_SONNET]: { input: 3.0, output: 15.0 },
  // New models for v1.3 multi-agent research
  [MODELS.PERPLEXITY_DEEP_RESEARCH]: { input: 2.0, output: 8.0 },
  [MODELS.O3_MINI]: { input: 1.10, output: 4.40 },
  [MODELS.GEMINI_25_FLASH]: { input: 0.30, output: 2.50 },
  [MODELS.CLAUDE_OPUS]: { input: 15.0, output: 75.0 },
  // Embedding model for v1.4 RAG (per 1M tokens)
  [MODELS.EMBEDDING]: { input: 0.02, output: 0 },
};

function estimateCost(
  model: string,
  promptTokens: number,
  completionTokens: number
): number {
  const costs = MODEL_COSTS[model] || { input: 1.0, output: 1.0 };
  const inputCost = (promptTokens / 1_000_000) * costs.input;
  const outputCost = (completionTokens / 1_000_000) * costs.output;
  return inputCost + outputCost;
}

export class OpenRouterClient {
  private apiKey: string;
  private baseUrl = "https://openrouter.ai/api/v1";

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error("OpenRouter API key is required");
    }
    this.apiKey = apiKey;
  }

  /**
   * Stream a chat completion response, yielding content chunks as they arrive.
   * Uses SSE format from OpenRouter (OpenAI-compatible streaming).
   *
   * @param options - Chat completion options (same as chat())
   * @yields String chunks of the response content (delta.content)
   *
   * Note: Usage/cost tracking not available during streaming.
   * JSON mode (response_format) is incompatible with streaming.
   */
  async *chatStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    const {
      model,
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      timeout = DEFAULT_TIMEOUT_MS,
    } = options;

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
      stream: true, // Enable streaming
    };

    // Add reasoning parameters if provided (but NOT response_format for streaming)
    if (options.reasoning) {
      const reasoningConfig: Record<string, unknown> = {};

      if (options.reasoning.effort) {
        reasoningConfig.effort = options.reasoning.effort;
      }
      if (options.reasoning.maxTokens) {
        reasoningConfig.max_tokens = Math.max(1024, options.reasoning.maxTokens);
      }
      if (options.reasoning.include) {
        reasoningConfig.include = true;
      }

      if (Object.keys(reasoningConfig).length > 0) {
        requestBody.reasoning = reasoningConfig;
      }
    }

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "AI-GOS Media Plan Generator",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(timeout);
      }
      throw error;
    }

    if (!response.ok) {
      clearTimeout(timeoutId);
      const errorText = await response.text();
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      console.error(`OpenRouter API error [${response.status}]:`, errorMessage);
      throw new APIError(
        response.status,
        `OpenRouter API error: ${response.status} - ${errorMessage}`
      );
    }

    // Process SSE stream
    const reader = response.body?.getReader();
    if (!reader) {
      clearTimeout(timeoutId);
      throw new Error("No response body for streaming");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          break;
        }

        // Decode chunk and add to buffer
        buffer += decoder.decode(value, { stream: true });

        // Process complete lines from buffer
        const lines = buffer.split("\n");
        buffer = lines.pop() || ""; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmedLine = line.trim();

          // Ignore empty lines and SSE comments (lines starting with :)
          if (!trimmedLine || trimmedLine.startsWith(":")) {
            continue;
          }

          // Check for data: prefix
          if (!trimmedLine.startsWith("data:")) {
            continue;
          }

          // Extract the data content
          const dataContent = trimmedLine.slice(5).trim();

          // Check for stream termination
          if (dataContent === "[DONE]") {
            return;
          }

          // Parse the JSON chunk
          try {
            const chunk = JSON.parse(dataContent);
            const content = chunk.choices?.[0]?.delta?.content;

            if (content) {
              yield content;
            }
          } catch (parseError) {
            // Log but don't fail on parse errors - may be malformed chunk
            console.warn("Failed to parse SSE chunk:", dataContent, parseError);
          }
        }
      }
    } finally {
      clearTimeout(timeoutId);
      reader.releaseLock();
    }
  }

  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    const {
      model,
      messages,
      temperature = 0.7,
      maxTokens = 4096,
      jsonMode = false,
      timeout = DEFAULT_TIMEOUT_MS
    } = options;

    const requestBody: Record<string, unknown> = {
      model,
      messages,
      temperature,
      max_tokens: maxTokens,
    };

    // Enable JSON mode only for supported models (NOT Perplexity)
    if (jsonMode && supportsJSONMode(model)) {
      requestBody.response_format = { type: "json_object" };
    }

    // Add reasoning parameters if provided
    if (options.reasoning) {
      const reasoningConfig: Record<string, unknown> = {};

      if (options.reasoning.effort) {
        // OpenAI o-series format
        reasoningConfig.effort = options.reasoning.effort;
      }
      if (options.reasoning.maxTokens) {
        // Anthropic/Gemini format (enforce minimum 1024)
        reasoningConfig.max_tokens = Math.max(1024, options.reasoning.maxTokens);
      }
      if (options.reasoning.include) {
        reasoningConfig.include = true;
      }

      if (Object.keys(reasoningConfig).length > 0) {
        requestBody.reasoning = reasoningConfig;
      }
    }

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "AI-GOS Media Plan Generator",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      // Check if this was a timeout abort
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      console.error(`OpenRouter API error [${response.status}]:`, errorMessage);
      throw new APIError(
        response.status,
        `OpenRouter API error: ${response.status} - ${errorMessage}`
      );
    }

    const data = await response.json();

    const promptTokens = data.usage?.prompt_tokens || 0;
    const completionTokens = data.usage?.completion_tokens || 0;

    // Extract Perplexity citation fields if present
    const citations = data.citations as string[] | undefined;
    const searchResults = data.search_results as PerplexitySearchResult[] | undefined;

    return {
      content: data.choices[0]?.message?.content || "",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cost: estimateCost(model, promptTokens, completionTokens),
      // Include citation fields (only present for Perplexity models)
      ...(citations && { citations }),
      ...(searchResults && { searchResults }),
    };
  }

  /**
   * Generate embeddings for text(s) using OpenRouter's embeddings API.
   * Uses OpenAI-compatible format.
   *
   * @param options - Embedding options (model, input text(s), timeout)
   * @returns Embeddings array with usage stats
   */
  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    const { model, input, timeout = DEFAULT_TIMEOUT_MS } = options;

    const requestBody = {
      model,
      input: Array.isArray(input) ? input : [input],
    };

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      controller.abort();
    }, timeout);

    let response: Response;
    try {
      response = await fetch(`${this.baseUrl}/embeddings`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "AI-GOS Media Plan Generator",
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (error) {
      clearTimeout(timeoutId);
      // Check if this was a timeout abort
      if (error instanceof Error && error.name === "AbortError") {
        throw new TimeoutError(timeout);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = response.statusText;
      try {
        const errorData = JSON.parse(errorText);
        errorMessage = errorData.error?.message || errorData.message || errorText;
      } catch {
        errorMessage = errorText || response.statusText;
      }
      console.error(`OpenRouter Embeddings API error [${response.status}]:`, errorMessage);
      throw new APIError(
        response.status,
        `OpenRouter Embeddings API error: ${response.status} - ${errorMessage}`
      );
    }

    const data = await response.json();

    // Response format: { data: [{ index, embedding }], usage: { prompt_tokens, total_tokens } }
    const embeddings = (data.data as { index: number; embedding: number[] }[])
      .sort((a, b) => a.index - b.index)
      .map((item) => item.embedding);

    const promptTokens = data.usage?.prompt_tokens || 0;
    const totalTokens = data.usage?.total_tokens || promptTokens;

    return {
      embeddings,
      usage: {
        promptTokens,
        totalTokens,
      },
      cost: estimateCost(model, promptTokens, 0),
    };
  }

  /**
   * Make a chat completion request and validate the JSON response against a Zod schema.
   * Provides type-safe responses with clear validation error messages.
   *
   * @param options - Chat completion options
   * @param schema - Zod schema to validate the response against
   * @param retries - Number of retries on validation failure (default: 2)
   * @returns Validated and typed data with usage stats
   */
  async chatJSONValidated<T>(
    options: ChatCompletionOptions,
    schema: z.ZodType<T>,
    retries: number = 2
  ): Promise<{
    data: T;
    usage: ChatCompletionResponse["usage"];
    cost: number;
    validationErrors?: string[];
  }> {
    let lastValidationErrors: string[] = [];
    let lastError: Error | null = null;
    let totalCost = 0;
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let attempt = 0; attempt <= retries; attempt++) {
      // Apply exponential backoff before retry (not on first attempt)
      if (attempt > 0) {
        const backoffDelay = calculateBackoff(attempt - 1);
        console.log(`[Retry] Attempt ${attempt + 1}/${retries + 1}, waiting ${Math.round(backoffDelay)}ms`);
        await sleep(backoffDelay);
      }

      try {
        // Build messages with JSON instruction (and validation errors on retry)
        let messagesWithContext = this.buildJSONMessages(options.messages, attempt);

        // On retry after validation failure, include the validation errors to help AI fix
        if (attempt > 0 && lastValidationErrors.length > 0) {
          const errorContext = `\n\nPREVIOUS RESPONSE VALIDATION FAILED. Please fix these errors:\n${lastValidationErrors.join("\n")}\n\nGenerate a corrected JSON response:`;
          messagesWithContext = messagesWithContext.map((msg, index) => {
            if (index === messagesWithContext.length - 1) {
              return { ...msg, content: msg.content + errorContext };
            }
            return msg;
          });
        }

        const response = await this.chat({
          ...options,
          messages: messagesWithContext,
          jsonMode: true,
          temperature: attempt > 0 ? 0.3 : (options.temperature ?? 0.5),
        });

        totalCost += response.cost;
        totalUsage = {
          promptTokens: totalUsage.promptTokens + response.usage.promptTokens,
          completionTokens: totalUsage.completionTokens + response.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + response.usage.totalTokens,
        };

        const extractedJSON = this.extractJSON(response.content);

        if (!extractedJSON) {
          console.error(`Attempt ${attempt + 1}: Failed to extract JSON from response`);
          lastValidationErrors = ["Failed to extract valid JSON from response"];
          continue;
        }

        let parsedData: unknown;
        try {
          parsedData = JSON.parse(extractedJSON);
        } catch (e) {
          console.error(`Attempt ${attempt + 1}: JSON parse error:`, e);
          lastValidationErrors = [`JSON parse error: ${e instanceof Error ? e.message : "Unknown error"}`];
          continue;
        }

        // Validate against Zod schema
        const validationResult = schema.safeParse(parsedData);

        if (!validationResult.success) {
          // Format Zod errors into clear messages
          lastValidationErrors = this.formatZodErrors(validationResult.error);
          console.error(`Attempt ${attempt + 1}: Validation failed:`, lastValidationErrors);
          continue;
        }

        // Success!
        return {
          data: validationResult.data,
          usage: totalUsage,
          cost: totalCost,
        };
      } catch (e) {
        console.error(`Attempt ${attempt + 1}: Error:`, e);
        lastError = e instanceof Error ? e : new Error("Unknown error");

        // Check if error is retryable
        if (!isRetryableError(e)) {
          console.error(`[Retry] Non-retryable error, stopping retries`);
          throw e;
        }

        // For 429 errors, use longer backoff
        if (e instanceof APIError && e.status === 429) {
          const longerBackoff = calculateBackoff(attempt, 5000, 30000);
          console.log(`[Retry] Rate limited (429), waiting ${Math.round(longerBackoff)}ms`);
          await sleep(longerBackoff);
        }

        lastValidationErrors = [`Error: ${e instanceof Error ? e.message : "Unknown error"}`];
      }
    }

    // All retries exhausted
    throw lastError || new Error(
      `Validation failed after ${retries + 1} attempts. Errors:\n${lastValidationErrors.join("\n")}`
    );
  }

  /**
   * Format Zod validation errors into human-readable messages
   */
  private formatZodErrors(error: z.ZodError): string[] {
    return error.issues.map((issue) => {
      const path = issue.path.join(".");
      const pathPrefix = path ? `Field '${path}'` : "Root";

      // Zod v4 uses different issue codes and structure
      switch (issue.code) {
        case "invalid_type":
          // Zod v4 uses 'input' not 'received'
          return `${pathPrefix}: expected ${issue.expected}, got ${typeof issue.input}`;
        case "invalid_value":
          // Zod v4 merged invalid_enum_value into invalid_value
          if ("values" in issue) {
            return `${pathPrefix}: invalid value, expected one of: ${(issue.values as string[]).join(", ")}`;
          }
          return `${pathPrefix}: invalid value`;
        case "too_small":
          return `${pathPrefix}: too small (minimum: ${issue.minimum})`;
        case "too_big":
          return `${pathPrefix}: too large (maximum: ${issue.maximum})`;
        case "invalid_format":
          // Zod v4 uses invalid_format instead of invalid_string
          return `${pathPrefix}: invalid format`;
        default:
          return `${pathPrefix}: ${issue.message}`;
      }
    });
  }

  async chatJSON<T>(
    options: ChatCompletionOptions,
    retries: number = 2
  ): Promise<{ data: T; usage: ChatCompletionResponse["usage"]; cost: number }> {
    let lastError: Error | null = null;
    let totalCost = 0;
    let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    for (let attempt = 0; attempt <= retries; attempt++) {
      // Apply exponential backoff before retry (not on first attempt)
      if (attempt > 0) {
        const backoffDelay = calculateBackoff(attempt - 1);
        console.log(`[Retry] Attempt ${attempt + 1}/${retries + 1}, waiting ${Math.round(backoffDelay)}ms`);
        await sleep(backoffDelay);
      }

      try {
        // Build messages with strong JSON instruction
        const messagesWithJSON = this.buildJSONMessages(options.messages, attempt);

        const response = await this.chat({
          ...options,
          messages: messagesWithJSON,
          jsonMode: true, // Enable native JSON mode
          temperature: attempt > 0 ? 0.3 : (options.temperature ?? 0.5), // Lower temp on retries
        });

        totalCost += response.cost;
        totalUsage = {
          promptTokens: totalUsage.promptTokens + response.usage.promptTokens,
          completionTokens: totalUsage.completionTokens + response.usage.completionTokens,
          totalTokens: totalUsage.totalTokens + response.usage.totalTokens,
        };

        const extractedJSON = this.extractJSON(response.content);

        if (!extractedJSON) {
          console.error(`Attempt ${attempt + 1}: Failed to extract JSON from response:`, response.content.slice(0, 500));
          lastError = new Error(`Failed to extract JSON from response`);
          continue;
        }

        try {
          const data = JSON.parse(extractedJSON) as T;
          return {
            data,
            usage: totalUsage,
            cost: totalCost,
          };
        } catch (e) {
          console.error(`Attempt ${attempt + 1}: JSON parse error:`, e, "Content:", extractedJSON.slice(0, 500));
          lastError = new Error(`Failed to parse JSON: ${e instanceof Error ? e.message : "Unknown error"}`);
          continue;
        }
      } catch (e) {
        console.error(`Attempt ${attempt + 1}: Error:`, e);
        lastError = e instanceof Error ? e : new Error("Unknown error");

        // Check if error is retryable
        if (!isRetryableError(e)) {
          console.error(`[Retry] Non-retryable error, stopping retries`);
          throw e;
        }

        // For 429 errors, use longer backoff
        if (e instanceof APIError && e.status === 429) {
          const longerBackoff = calculateBackoff(attempt, 5000, 30000);
          console.log(`[Retry] Rate limited (429), waiting ${Math.round(longerBackoff)}ms`);
          await sleep(longerBackoff);
        }
      }
    }

    throw lastError || new Error("Failed to get valid JSON response after retries");
  }

  private buildJSONMessages(messages: ChatMessage[], attempt: number): ChatMessage[] {
    const jsonInstruction = attempt === 0
      ? `

CRITICAL OUTPUT REQUIREMENT:
You MUST respond with ONLY a valid JSON object.
- Start your response with { and end with }
- Do NOT include any text before or after the JSON
- Do NOT use markdown code blocks
- Do NOT include explanations or commentary
- Ensure all strings are properly escaped
- Ensure all required fields are present`
      : `

CRITICAL: Your previous response was not valid JSON. This time you MUST:
1. Output ONLY a raw JSON object starting with { and ending with }
2. NO text before the opening brace
3. NO text after the closing brace
4. NO markdown, NO code blocks, NO explanations
5. Just the pure JSON object`;

    return messages.map((msg, index) => {
      if (index === 0 && msg.role === "system") {
        return {
          ...msg,
          content: msg.content + jsonInstruction,
        };
      }
      return msg;
    });
  }

  protected extractJSON(content: string): string | null {
    if (!content || typeof content !== "string") {
      return null;
    }

    const trimmed = content.trim();

    // Strategy 1: Try parsing the whole content directly (best case)
    if (this.isValidJSON(trimmed)) {
      console.log("[JSON Extraction] Strategy 1: Direct parse succeeded");
      return trimmed;
    }

    // Strategy 2: Content starts with { - find the matching closing brace
    if (trimmed.startsWith("{")) {
      const json = this.extractBalancedJSON(trimmed, "{", "}");
      if (json && this.isValidJSON(json)) {
        console.log("[JSON Extraction] Strategy 2: Balanced object extraction succeeded");
        return json;
      }
    }

    // Strategy 3: Content starts with [ - find the matching closing bracket
    if (trimmed.startsWith("[")) {
      const json = this.extractBalancedJSON(trimmed, "[", "]");
      if (json && this.isValidJSON(json)) {
        console.log("[JSON Extraction] Strategy 3: Balanced array extraction succeeded");
        return json;
      }
    }

    // Strategy 4: Extract from markdown code blocks
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeBlockMatch) {
      const blockContent = codeBlockMatch[1].trim();
      if (this.isValidJSON(blockContent)) {
        console.log("[JSON Extraction] Strategy 4: Markdown code block succeeded");
        return blockContent;
      }
      // Try balanced extraction on code block content
      if (blockContent.startsWith("{")) {
        const json = this.extractBalancedJSON(blockContent, "{", "}");
        if (json && this.isValidJSON(json)) {
          console.log("[JSON Extraction] Strategy 4b: Balanced extraction from code block succeeded");
          return json;
        }
      }
    }

    // Strategy 5: Find first { and try balanced extraction from there
    const firstBrace = trimmed.indexOf("{");
    if (firstBrace !== -1) {
      const fromBrace = trimmed.substring(firstBrace);
      const json = this.extractBalancedJSON(fromBrace, "{", "}");
      if (json && this.isValidJSON(json)) {
        console.log("[JSON Extraction] Strategy 5: Find-first-brace balanced extraction succeeded");
        return json;
      }
    }

    // Strategy 6: Find first [ and try balanced extraction
    const firstBracket = trimmed.indexOf("[");
    if (firstBracket !== -1) {
      const fromBracket = trimmed.substring(firstBracket);
      const json = this.extractBalancedJSON(fromBracket, "[", "]");
      if (json && this.isValidJSON(json)) {
        console.log("[JSON Extraction] Strategy 6: Find-first-bracket balanced extraction succeeded");
        return json;
      }
    }

    // Strategy 7: Try repair on best candidate from balanced extraction attempts
    // This handles truncated JSON where balanced extraction fails
    if (firstBrace !== -1) {
      const fromBrace = trimmed.substring(firstBrace);
      const repaired = this.repairJSON(fromBrace);
      if (this.isValidJSON(repaired)) {
        console.log("[JSON Extraction] Strategy 7: Repair on unbalanced object succeeded");
        return repaired;
      }
    }

    if (firstBracket !== -1 && (firstBrace === -1 || firstBracket < firstBrace)) {
      const fromBracket = trimmed.substring(firstBracket);
      const repaired = this.repairJSON(fromBracket);
      if (this.isValidJSON(repaired)) {
        console.log("[JSON Extraction] Strategy 7b: Repair on unbalanced array succeeded");
        return repaired;
      }
    }

    // Strategy 8: Greedy extraction - find first open and last close, then repair
    // This is the last resort for severely malformed responses
    const firstOpen = Math.min(
      firstBrace === -1 ? Infinity : firstBrace,
      firstBracket === -1 ? Infinity : firstBracket
    );

    if (firstOpen !== Infinity) {
      const lastClose = Math.max(trimmed.lastIndexOf("}"), trimmed.lastIndexOf("]"));
      if (lastClose > firstOpen) {
        const candidate = trimmed.slice(firstOpen, lastClose + 1);
        const repaired = this.repairJSON(candidate);
        if (this.isValidJSON(repaired)) {
          console.log("[JSON Extraction] Strategy 8: Greedy extraction with repair succeeded");
          return repaired;
        }
      }
    }

    console.log("[JSON Extraction] All strategies failed");
    return null;
  }

  /**
   * Extract a balanced JSON structure by counting open/close brackets
   * This is more reliable than greedy regex for nested structures
   */
  protected extractBalancedJSON(content: string, openChar: string, closeChar: string): string | null {
    if (!content.startsWith(openChar)) {
      return null;
    }

    let depth = 0;
    let inString = false;
    let escaped = false;

    for (let i = 0; i < content.length; i++) {
      const char = content[i];

      if (escaped) {
        escaped = false;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (inString) {
        continue;
      }

      if (char === openChar) {
        depth++;
      } else if (char === closeChar) {
        depth--;
        if (depth === 0) {
          return content.substring(0, i + 1);
        }
      }
    }

    return null; // Unbalanced
  }

  protected isValidJSON(str: string): boolean {
    if (!str || typeof str !== "string") {
      return false;
    }
    try {
      const parsed = JSON.parse(str);
      // Must be an object or array, not a primitive
      return typeof parsed === "object" && parsed !== null;
    } catch {
      return false;
    }
  }

  /**
   * Attempt to repair common JSON malformations from AI responses.
   * This is a last-resort strategy when balanced extraction fails.
   */
  protected repairJSON(json: string): string {
    let repaired = json;

    // 1. Remove trailing commas before closing braces/brackets
    // Handles: {"a": 1,} or [1, 2,]
    repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

    // 2. Handle unescaped newlines in strings (common AI issue)
    // Replace actual newlines in strings with \n escape sequence
    // This is tricky - we need to be inside a string context
    // For safety, just remove control characters that break JSON
    repaired = repaired.replace(/[\x00-\x1F\x7F]/g, (char) => {
      if (char === "\n") return "\\n";
      if (char === "\r") return "\\r";
      if (char === "\t") return "\\t";
      return ""; // Remove other control chars
    });

    // 3. Count braces/brackets to detect and fix truncation
    let openBraces = 0;
    let openBrackets = 0;
    let inString = false;
    let escaped = false;

    for (const char of repaired) {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === '"') {
        inString = !inString;
        continue;
      }
      if (inString) continue;

      if (char === "{") openBraces++;
      else if (char === "}") openBraces--;
      else if (char === "[") openBrackets++;
      else if (char === "]") openBrackets--;
    }

    // 4. If we're in a string, try to close it
    // This handles: {"a": "hello... (truncated mid-string)
    if (inString) {
      // Find last quote and truncate there, or add closing quote
      const lastQuote = repaired.lastIndexOf('"');
      if (lastQuote > 0) {
        // Check if there's meaningful content after the last quote
        const afterQuote = repaired.substring(lastQuote + 1).trim();
        if (afterQuote && !afterQuote.match(/^[}\],]/)) {
          // Truncated in middle of string value, close it
          repaired = repaired + '"';
        }
      }
    }

    // 5. Add missing closing braces/brackets
    // Add brackets first, then braces (inner structures close first)
    for (let i = 0; i < openBrackets; i++) {
      repaired += "]";
    }
    for (let i = 0; i < openBraces; i++) {
      repaired += "}";
    }

    // 6. Handle truncated values - if ends with colon or comma, remove trailing incomplete part
    // Handles: {"a": 1, "b":  (truncated before value)
    repaired = repaired.replace(/,\s*"[^"]*":\s*$/, "");
    repaired = repaired.replace(/,\s*$/, "");

    // Re-apply trailing comma removal after all fixes
    repaired = repaired.replace(/,(\s*[}\]])/g, "$1");

    return repaired;
  }
}

// Factory function to create client (matches Supabase pattern)
export function createOpenRouterClient(): OpenRouterClient {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY environment variable is not set");
  }
  return new OpenRouterClient(apiKey);
}
