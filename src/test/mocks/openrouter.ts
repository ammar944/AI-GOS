/**
 * Mock OpenRouter Client for Testing
 *
 * Provides a mock implementation of OpenRouterClient with:
 * - Configurable responses for all methods
 * - Call history tracking for assertions
 * - Error simulation (timeout, API error, rate limit)
 * - Mock response factories for common use cases
 */

import { vi } from "vitest";
import type {
  ChatCompletionOptions,
  ChatCompletionResponse,
  EmbeddingOptions,
  EmbeddingResponse,
  ChatMessage,
  PerplexitySearchResult,
} from "@/lib/openrouter/client";
import {
  TimeoutError,
  APIError,
} from "@/lib/openrouter/client";
import type { Citation } from "@/lib/strategic-blueprint/output-types";

// Re-export error classes for test convenience
export { TimeoutError, APIError };

// =============================================================================
// Types
// =============================================================================

export interface MockCallRecord<TArgs = unknown, TResult = unknown> {
  args: TArgs;
  result?: TResult;
  error?: Error;
  timestamp: number;
}

export type ChatCallRecord = MockCallRecord<ChatCompletionOptions, ChatCompletionResponse>;
export type EmbeddingCallRecord = MockCallRecord<EmbeddingOptions, EmbeddingResponse>;

export interface MockOpenRouterConfig {
  /** Default response for chat() calls */
  defaultChatResponse?: Partial<ChatCompletionResponse>;
  /** Default response for chatJSON() calls */
  defaultJSONResponse?: unknown;
  /** Default response for embeddings() calls */
  defaultEmbeddingResponse?: Partial<EmbeddingResponse>;
  /** Simulate error on all calls */
  simulateError?: {
    type: "timeout" | "api" | "rate_limit" | "validation";
    message?: string;
  };
}

// =============================================================================
// Mock Response Factories
// =============================================================================

/**
 * Create a mock chat completion response
 */
export function createMockChatResponse(
  content: string,
  overrides?: Partial<ChatCompletionResponse>
): ChatCompletionResponse {
  return {
    content,
    usage: {
      promptTokens: 100,
      completionTokens: 50,
      totalTokens: 150,
    },
    cost: 0.0001,
    ...overrides,
  };
}

/**
 * Create a mock JSON response (stringified for chat response)
 */
export function createMockJSONResponse<T>(
  data: T,
  overrides?: Partial<ChatCompletionResponse>
): ChatCompletionResponse {
  return createMockChatResponse(JSON.stringify(data, null, 2), overrides);
}

/**
 * Create mock embeddings response
 * @param texts - Array of texts that were embedded (determines number of embeddings)
 * @param dimension - Embedding dimension (default: 1536 for text-embedding-3-small)
 */
export function createMockEmbeddings(
  texts: string[],
  dimension: number = 1536
): EmbeddingResponse {
  const embeddings = texts.map(() =>
    Array.from({ length: dimension }, () => Math.random() * 2 - 1)
  );

  return {
    embeddings,
    usage: {
      promptTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
      totalTokens: texts.reduce((sum, t) => sum + Math.ceil(t.length / 4), 0),
    },
    cost: 0.00001 * texts.length,
  };
}

/**
 * Create mock citations for Perplexity responses
 */
export function createMockCitations(count: number = 3): Citation[] {
  return Array.from({ length: count }, (_, i) => ({
    url: `https://example.com/source-${i + 1}`,
    title: `Source ${i + 1}`,
    date: new Date().toISOString().split("T")[0],
    snippet: `This is a snippet from source ${i + 1} providing relevant information.`,
  }));
}

/**
 * Create mock search results for Perplexity responses
 */
export function createMockSearchResults(
  count: number = 3
): PerplexitySearchResult[] {
  return Array.from({ length: count }, (_, i) => ({
    title: `Search Result ${i + 1}`,
    url: `https://example.com/result-${i + 1}`,
    date: new Date().toISOString().split("T")[0],
    snippet: `Snippet from search result ${i + 1}.`,
  }));
}

/**
 * Create a mock Perplexity response with citations
 */
export function createMockPerplexityResponse(
  content: string,
  citationCount: number = 3
): ChatCompletionResponse {
  return {
    content,
    usage: {
      promptTokens: 200,
      completionTokens: 500,
      totalTokens: 700,
    },
    cost: 0.005,
    citations: Array.from(
      { length: citationCount },
      (_, i) => `https://example.com/source-${i + 1}`
    ),
    searchResults: createMockSearchResults(citationCount),
  };
}

// =============================================================================
// Mock OpenRouter Client Class
// =============================================================================

export class MockOpenRouterClient {
  private config: MockOpenRouterConfig;

  // Call history for assertions
  public chatCalls: ChatCallRecord[] = [];
  public chatJSONCalls: ChatCallRecord[] = [];
  public chatJSONValidatedCalls: ChatCallRecord[] = [];
  public chatStreamCalls: MockCallRecord<ChatCompletionOptions, string[]>[] = [];
  public embeddingsCalls: EmbeddingCallRecord[] = [];

  // Response queues (pop from front on each call)
  private chatResponseQueue: (ChatCompletionResponse | Error)[] = [];
  private jsonResponseQueue: (unknown | Error)[] = [];
  private embeddingsResponseQueue: (EmbeddingResponse | Error)[] = [];
  private streamChunksQueue: (string[] | Error)[] = [];

  constructor(config: MockOpenRouterConfig = {}) {
    this.config = config;
  }

  /**
   * Queue a response for the next chat() call
   */
  queueChatResponse(response: ChatCompletionResponse | Error): void {
    this.chatResponseQueue.push(response);
  }

  /**
   * Queue a response for the next chatJSON() call
   */
  queueJSONResponse(response: unknown | Error): void {
    this.jsonResponseQueue.push(response);
  }

  /**
   * Queue a response for the next embeddings() call
   */
  queueEmbeddingsResponse(response: EmbeddingResponse | Error): void {
    this.embeddingsResponseQueue.push(response);
  }

  /**
   * Queue chunks for the next chatStream() call
   */
  queueStreamChunks(chunks: string[] | Error): void {
    this.streamChunksQueue.push(chunks);
  }

  /**
   * Reset all call history and queued responses
   */
  reset(): void {
    this.chatCalls = [];
    this.chatJSONCalls = [];
    this.chatJSONValidatedCalls = [];
    this.chatStreamCalls = [];
    this.embeddingsCalls = [];
    this.chatResponseQueue = [];
    this.jsonResponseQueue = [];
    this.embeddingsResponseQueue = [];
    this.streamChunksQueue = [];
  }

  /**
   * Get the last call made to a specific method
   */
  getLastCall<T extends "chat" | "chatJSON" | "chatJSONValidated" | "chatStream" | "embeddings">(
    method: T
  ): MockCallRecord | undefined {
    const calls = {
      chat: this.chatCalls,
      chatJSON: this.chatJSONCalls,
      chatJSONValidated: this.chatJSONValidatedCalls,
      chatStream: this.chatStreamCalls,
      embeddings: this.embeddingsCalls,
    }[method];
    return calls[calls.length - 1];
  }

  /**
   * Simulate configured error if present
   */
  private maybeThrowError(): void {
    if (this.config.simulateError) {
      const { type, message } = this.config.simulateError;
      switch (type) {
        case "timeout":
          throw new TimeoutError(45000, message || "Request timed out");
        case "api":
          throw new APIError(500, message || "Internal server error");
        case "rate_limit":
          throw new APIError(429, message || "Rate limit exceeded");
        case "validation":
          throw new Error(message || "Validation failed");
      }
    }
  }

  /**
   * Mock implementation of chat()
   */
  async chat(options: ChatCompletionOptions): Promise<ChatCompletionResponse> {
    this.maybeThrowError();

    // Check queue first
    const queuedResponse = this.chatResponseQueue.shift();
    if (queuedResponse) {
      if (queuedResponse instanceof Error) {
        const record: ChatCallRecord = {
          args: options,
          error: queuedResponse,
          timestamp: Date.now(),
        };
        this.chatCalls.push(record);
        throw queuedResponse;
      }
      const record: ChatCallRecord = {
        args: options,
        result: queuedResponse,
        timestamp: Date.now(),
      };
      this.chatCalls.push(record);
      return queuedResponse;
    }

    // Use default response
    const response = createMockChatResponse(
      this.config.defaultChatResponse?.content || "Mock response",
      this.config.defaultChatResponse
    );

    const record: ChatCallRecord = {
      args: options,
      result: response,
      timestamp: Date.now(),
    };
    this.chatCalls.push(record);
    return response;
  }

  /**
   * Mock implementation of chatJSON()
   */
  async chatJSON<T>(
    options: ChatCompletionOptions,
    _retries: number = 2
  ): Promise<{ data: T; usage: ChatCompletionResponse["usage"]; cost: number }> {
    this.maybeThrowError();

    // Check queue first
    const queuedResponse = this.jsonResponseQueue.shift();
    if (queuedResponse) {
      if (queuedResponse instanceof Error) {
        const record: ChatCallRecord = {
          args: options,
          error: queuedResponse,
          timestamp: Date.now(),
        };
        this.chatJSONCalls.push(record);
        throw queuedResponse;
      }

      const response = {
        data: queuedResponse as T,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        cost: 0.0001,
      };
      const record: ChatCallRecord = {
        args: options,
        result: createMockJSONResponse(queuedResponse),
        timestamp: Date.now(),
      };
      this.chatJSONCalls.push(record);
      return response;
    }

    // Use default response
    const data = (this.config.defaultJSONResponse || {}) as T;
    const record: ChatCallRecord = {
      args: options,
      result: createMockJSONResponse(data),
      timestamp: Date.now(),
    };
    this.chatJSONCalls.push(record);

    return {
      data,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      cost: 0.0001,
    };
  }

  /**
   * Mock implementation of chatJSONValidated()
   */
  async chatJSONValidated<T>(
    options: ChatCompletionOptions,
    schema: { safeParse: (data: unknown) => { success: boolean; data?: T; error?: unknown } },
    _retries: number = 2
  ): Promise<{
    data: T;
    usage: ChatCompletionResponse["usage"];
    cost: number;
    validationErrors?: string[];
  }> {
    this.maybeThrowError();

    // Check queue first
    const queuedResponse = this.jsonResponseQueue.shift();
    if (queuedResponse) {
      if (queuedResponse instanceof Error) {
        const record: ChatCallRecord = {
          args: options,
          error: queuedResponse,
          timestamp: Date.now(),
        };
        this.chatJSONValidatedCalls.push(record);
        throw queuedResponse;
      }

      // Validate against schema
      const parseResult = schema.safeParse(queuedResponse);
      if (!parseResult.success) {
        const error = new Error("Validation failed");
        const record: ChatCallRecord = {
          args: options,
          error,
          timestamp: Date.now(),
        };
        this.chatJSONValidatedCalls.push(record);
        throw error;
      }

      const record: ChatCallRecord = {
        args: options,
        result: createMockJSONResponse(parseResult.data),
        timestamp: Date.now(),
      };
      this.chatJSONValidatedCalls.push(record);

      return {
        data: parseResult.data as T,
        usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
        cost: 0.0001,
      };
    }

    // Use default response and validate
    const defaultData = (this.config.defaultJSONResponse || {}) as T;
    const parseResult = schema.safeParse(defaultData);
    if (!parseResult.success) {
      throw new Error("Default mock response failed validation");
    }

    const record: ChatCallRecord = {
      args: options,
      result: createMockJSONResponse(parseResult.data),
      timestamp: Date.now(),
    };
    this.chatJSONValidatedCalls.push(record);

    return {
      data: parseResult.data as T,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      cost: 0.0001,
    };
  }

  /**
   * Mock implementation of chatStream()
   */
  async *chatStream(
    options: ChatCompletionOptions
  ): AsyncGenerator<string, void, unknown> {
    this.maybeThrowError();

    // Check queue first
    const queuedChunks = this.streamChunksQueue.shift();
    if (queuedChunks) {
      if (queuedChunks instanceof Error) {
        const record: MockCallRecord<ChatCompletionOptions, string[]> = {
          args: options,
          error: queuedChunks,
          timestamp: Date.now(),
        };
        this.chatStreamCalls.push(record);
        throw queuedChunks;
      }

      const record: MockCallRecord<ChatCompletionOptions, string[]> = {
        args: options,
        result: queuedChunks,
        timestamp: Date.now(),
      };
      this.chatStreamCalls.push(record);

      for (const chunk of queuedChunks) {
        yield chunk;
      }
      return;
    }

    // Default streaming response
    const defaultChunks = ["Hello", ", ", "world", "!"];
    const record: MockCallRecord<ChatCompletionOptions, string[]> = {
      args: options,
      result: defaultChunks,
      timestamp: Date.now(),
    };
    this.chatStreamCalls.push(record);

    for (const chunk of defaultChunks) {
      yield chunk;
    }
  }

  /**
   * Mock implementation of embeddings()
   */
  async embeddings(options: EmbeddingOptions): Promise<EmbeddingResponse> {
    this.maybeThrowError();

    // Check queue first
    const queuedResponse = this.embeddingsResponseQueue.shift();
    if (queuedResponse) {
      if (queuedResponse instanceof Error) {
        const record: EmbeddingCallRecord = {
          args: options,
          error: queuedResponse,
          timestamp: Date.now(),
        };
        this.embeddingsCalls.push(record);
        throw queuedResponse;
      }

      const record: EmbeddingCallRecord = {
        args: options,
        result: queuedResponse,
        timestamp: Date.now(),
      };
      this.embeddingsCalls.push(record);
      return queuedResponse;
    }

    // Generate default embeddings based on input
    const texts = Array.isArray(options.input) ? options.input : [options.input];
    const defaultEmbeddings = createMockEmbeddings(texts);
    const response: EmbeddingResponse = {
      embeddings: this.config.defaultEmbeddingResponse?.embeddings ?? defaultEmbeddings.embeddings,
      usage: this.config.defaultEmbeddingResponse?.usage ?? defaultEmbeddings.usage,
      cost: this.config.defaultEmbeddingResponse?.cost ?? defaultEmbeddings.cost,
    };

    const record: EmbeddingCallRecord = {
      args: options,
      result: response,
      timestamp: Date.now(),
    };
    this.embeddingsCalls.push(record);
    return response;
  }
}

// =============================================================================
// Factory Functions
// =============================================================================

/**
 * Create a mock OpenRouter client
 */
export function createMockOpenRouterClient(
  config?: MockOpenRouterConfig
): MockOpenRouterClient {
  return new MockOpenRouterClient(config);
}

/**
 * Create a vi.fn() mock for OpenRouterClient that can be used with vi.mock()
 */
export function createOpenRouterClientMock(config?: MockOpenRouterConfig) {
  const mockClient = new MockOpenRouterClient(config);
  return {
    OpenRouterClient: vi.fn(() => mockClient),
    createOpenRouterClient: vi.fn(() => mockClient),
    // Expose the mock instance for test assertions
    __mockInstance: mockClient,
  };
}
