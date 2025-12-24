// OpenRouter API Client
// Uses OpenAI-compatible API format

import { z } from "zod";

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

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean; // Enable strict JSON output
  timeout?: number; // Request timeout in ms (default: 45000)
}

// Default timeout for API requests (45 seconds)
const DEFAULT_TIMEOUT_MS = 45000;

export interface ChatCompletionResponse {
  content: string;
  usage: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  cost: number;
}

// Model identifiers for OpenRouter
export const MODELS = {
  GEMINI_FLASH: "google/gemini-2.0-flash-001",
  PERPLEXITY_SONAR: "perplexity/sonar-pro",
  GPT_4O: "openai/gpt-4o",
  CLAUDE_SONNET: "anthropic/claude-sonnet-4",
} as const;

// Approximate costs per 1M tokens (input/output) - for estimation
const MODEL_COSTS: Record<string, { input: number; output: number }> = {
  [MODELS.GEMINI_FLASH]: { input: 0.075, output: 0.30 },
  [MODELS.PERPLEXITY_SONAR]: { input: 1.0, output: 1.0 },
  [MODELS.GPT_4O]: { input: 2.5, output: 10.0 },
  [MODELS.CLAUDE_SONNET]: { input: 3.0, output: 15.0 },
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

    // Enable JSON mode for supported models (Claude, GPT-4, Gemini)
    if (jsonMode) {
      requestBody.response_format = { type: "json_object" };
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

    return {
      content: data.choices[0]?.message?.content || "",
      usage: {
        promptTokens,
        completionTokens,
        totalTokens: promptTokens + completionTokens,
      },
      cost: estimateCost(model, promptTokens, completionTokens),
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

  private extractJSON(content: string): string | null {
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
  private extractBalancedJSON(content: string, openChar: string, closeChar: string): string | null {
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

  private isValidJSON(str: string): boolean {
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
  private repairJSON(json: string): string {
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
