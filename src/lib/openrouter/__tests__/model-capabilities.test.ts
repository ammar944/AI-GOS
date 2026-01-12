/**
 * Unit tests for OpenRouter model capability helpers
 *
 * Tests cover:
 * - MODELS constant validation
 * - supportsReasoning(model) for all models
 * - hasWebSearch(model) for all models
 * - supportsJSONMode(model) for all models
 * - extractCitations(response) for different response formats
 */

import { describe, it, expect } from "vitest";
import {
  MODELS,
  supportsReasoning,
  hasWebSearch,
  supportsJSONMode,
  extractCitations,
  type ChatCompletionResponse,
  type PerplexitySearchResult,
} from "../client";

// =============================================================================
// MODELS Constant Tests
// =============================================================================

describe("MODELS constant", () => {
  it("defines all required model identifiers", () => {
    expect(MODELS).toHaveProperty("GEMINI_FLASH");
    expect(MODELS).toHaveProperty("PERPLEXITY_SONAR");
    expect(MODELS).toHaveProperty("GPT_4O");
    expect(MODELS).toHaveProperty("CLAUDE_SONNET");
    expect(MODELS).toHaveProperty("PERPLEXITY_DEEP_RESEARCH");
    expect(MODELS).toHaveProperty("O3_MINI");
    expect(MODELS).toHaveProperty("GEMINI_25_FLASH");
    expect(MODELS).toHaveProperty("CLAUDE_OPUS");
    expect(MODELS).toHaveProperty("EMBEDDING");
  });

  it("all model identifiers are strings", () => {
    Object.values(MODELS).forEach((modelId) => {
      expect(typeof modelId).toBe("string");
    });
  });

  it("values match OpenRouter model ID format (provider/model)", () => {
    Object.values(MODELS).forEach((modelId) => {
      // Format: provider/model-name-version (allows letters, numbers, hyphens, dots)
      expect(modelId).toMatch(/^[a-z]+\/[a-z0-9.-]+$/);
    });
  });

  it("has unique values for all model identifiers", () => {
    const values = Object.values(MODELS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it("defines correct model IDs for each model", () => {
    expect(MODELS.GEMINI_FLASH).toBe("google/gemini-2.0-flash-001");
    expect(MODELS.PERPLEXITY_SONAR).toBe("perplexity/sonar-pro");
    expect(MODELS.GPT_4O).toBe("openai/gpt-4o");
    expect(MODELS.CLAUDE_SONNET).toBe("anthropic/claude-sonnet-4");
    expect(MODELS.PERPLEXITY_DEEP_RESEARCH).toBe("perplexity/sonar-deep-research");
    expect(MODELS.O3_MINI).toBe("openai/o3-mini");
    expect(MODELS.GEMINI_25_FLASH).toBe("google/gemini-2.5-flash");
    expect(MODELS.CLAUDE_OPUS).toBe("anthropic/claude-opus-4");
    expect(MODELS.EMBEDDING).toBe("openai/text-embedding-3-small");
  });
});

// =============================================================================
// supportsReasoning Tests
// =============================================================================

describe("supportsReasoning", () => {
  describe("returns true for reasoning models", () => {
    it.each([
      [MODELS.O3_MINI, "O3_MINI"],
      [MODELS.GEMINI_25_FLASH, "GEMINI_25_FLASH"],
      [MODELS.CLAUDE_OPUS, "CLAUDE_OPUS"],
      [MODELS.PERPLEXITY_DEEP_RESEARCH, "PERPLEXITY_DEEP_RESEARCH"],
    ])("returns true for %s (%s)", (model) => {
      expect(supportsReasoning(model)).toBe(true);
    });
  });

  describe("returns false for non-reasoning models", () => {
    it.each([
      [MODELS.GEMINI_FLASH, "GEMINI_FLASH"],
      [MODELS.GPT_4O, "GPT_4O"],
      [MODELS.CLAUDE_SONNET, "CLAUDE_SONNET"],
      [MODELS.PERPLEXITY_SONAR, "PERPLEXITY_SONAR"],
      [MODELS.EMBEDDING, "EMBEDDING"],
    ])("returns false for %s (%s)", (model) => {
      expect(supportsReasoning(model)).toBe(false);
    });
  });

  it("returns false for unknown model", () => {
    expect(supportsReasoning("unknown/model")).toBe(false);
    expect(supportsReasoning("")).toBe(false);
    expect(supportsReasoning("openai/gpt-3.5-turbo")).toBe(false);
  });
});

// =============================================================================
// hasWebSearch Tests
// =============================================================================

describe("hasWebSearch", () => {
  describe("returns true for web search models (Perplexity)", () => {
    it.each([
      [MODELS.PERPLEXITY_SONAR, "PERPLEXITY_SONAR"],
      [MODELS.PERPLEXITY_DEEP_RESEARCH, "PERPLEXITY_DEEP_RESEARCH"],
    ])("returns true for %s (%s)", (model) => {
      expect(hasWebSearch(model)).toBe(true);
    });
  });

  describe("returns false for non-search models", () => {
    it.each([
      [MODELS.GEMINI_FLASH, "GEMINI_FLASH"],
      [MODELS.GPT_4O, "GPT_4O"],
      [MODELS.CLAUDE_SONNET, "CLAUDE_SONNET"],
      [MODELS.CLAUDE_OPUS, "CLAUDE_OPUS"],
      [MODELS.O3_MINI, "O3_MINI"],
      [MODELS.GEMINI_25_FLASH, "GEMINI_25_FLASH"],
      [MODELS.EMBEDDING, "EMBEDDING"],
    ])("returns false for %s (%s)", (model) => {
      expect(hasWebSearch(model)).toBe(false);
    });
  });

  it("returns false for unknown model", () => {
    expect(hasWebSearch("unknown/model")).toBe(false);
    expect(hasWebSearch("")).toBe(false);
  });
});

// =============================================================================
// supportsJSONMode Tests
// =============================================================================

describe("supportsJSONMode", () => {
  describe("returns true for JSON-mode supporting models", () => {
    it.each([
      [MODELS.GEMINI_FLASH, "GEMINI_FLASH"],
      [MODELS.GPT_4O, "GPT_4O"],
      [MODELS.CLAUDE_SONNET, "CLAUDE_SONNET"],
      [MODELS.CLAUDE_OPUS, "CLAUDE_OPUS"],
      [MODELS.O3_MINI, "O3_MINI"],
      [MODELS.GEMINI_25_FLASH, "GEMINI_25_FLASH"],
    ])("returns true for %s (%s)", (model) => {
      expect(supportsJSONMode(model)).toBe(true);
    });
  });

  describe("returns false for Perplexity models (no response_format support)", () => {
    it.each([
      [MODELS.PERPLEXITY_SONAR, "PERPLEXITY_SONAR"],
      [MODELS.PERPLEXITY_DEEP_RESEARCH, "PERPLEXITY_DEEP_RESEARCH"],
    ])("returns false for %s (%s)", (model) => {
      expect(supportsJSONMode(model)).toBe(false);
    });
  });

  it("returns false for embedding model", () => {
    expect(supportsJSONMode(MODELS.EMBEDDING)).toBe(false);
  });

  it("returns false for unknown model", () => {
    expect(supportsJSONMode("unknown/model")).toBe(false);
    expect(supportsJSONMode("")).toBe(false);
  });
});

// =============================================================================
// extractCitations Tests
// =============================================================================

describe("extractCitations", () => {
  // Helper to create a base response
  function createBaseResponse(overrides?: Partial<ChatCompletionResponse>): ChatCompletionResponse {
    return {
      content: "Test response content",
      usage: {
        promptTokens: 100,
        completionTokens: 200,
        totalTokens: 300,
      },
      cost: 0.01,
      ...overrides,
    };
  }

  describe("searchResults format (preferred)", () => {
    it("extracts citations from searchResults array", () => {
      const searchResults: PerplexitySearchResult[] = [
        {
          title: "Source 1",
          url: "https://example.com/1",
          date: "2024-01-15",
          snippet: "First source snippet",
        },
        {
          title: "Source 2",
          url: "https://example.com/2",
          snippet: "Second source snippet",
        },
      ];

      const response = createBaseResponse({ searchResults });
      const citations = extractCitations(response);

      expect(citations).toHaveLength(2);
      expect(citations[0]).toEqual({
        url: "https://example.com/1",
        title: "Source 1",
        date: "2024-01-15",
        snippet: "First source snippet",
      });
      expect(citations[1]).toEqual({
        url: "https://example.com/2",
        title: "Source 2",
        date: undefined,
        snippet: "Second source snippet",
      });
    });

    it("maps all searchResult fields correctly", () => {
      const searchResults: PerplexitySearchResult[] = [
        {
          title: "Complete Source",
          url: "https://example.com/complete",
          date: "2024-06-01",
          snippet: "A complete snippet with all fields",
        },
      ];

      const response = createBaseResponse({ searchResults });
      const citations = extractCitations(response);

      expect(citations[0].url).toBe("https://example.com/complete");
      expect(citations[0].title).toBe("Complete Source");
      expect(citations[0].date).toBe("2024-06-01");
      expect(citations[0].snippet).toBe("A complete snippet with all fields");
    });

    it("handles searchResults with minimal fields", () => {
      const searchResults: PerplexitySearchResult[] = [
        {
          title: "Minimal",
          url: "https://example.com/minimal",
        },
      ];

      const response = createBaseResponse({ searchResults });
      const citations = extractCitations(response);

      expect(citations[0]).toEqual({
        url: "https://example.com/minimal",
        title: "Minimal",
        date: undefined,
        snippet: undefined,
      });
    });
  });

  describe("legacy citations format (fallback)", () => {
    it("extracts citations from legacy citations array", () => {
      const citations = [
        "https://example.com/legacy1",
        "https://example.com/legacy2",
        "https://example.com/legacy3",
      ];

      const response = createBaseResponse({ citations });
      const result = extractCitations(response);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ url: "https://example.com/legacy1" });
      expect(result[1]).toEqual({ url: "https://example.com/legacy2" });
      expect(result[2]).toEqual({ url: "https://example.com/legacy3" });
    });

    it("legacy citations only have url field", () => {
      const citations = ["https://example.com/url-only"];

      const response = createBaseResponse({ citations });
      const result = extractCitations(response);

      expect(result[0].url).toBe("https://example.com/url-only");
      expect(result[0].title).toBeUndefined();
      expect(result[0].date).toBeUndefined();
      expect(result[0].snippet).toBeUndefined();
    });
  });

  describe("format preference", () => {
    it("prefers searchResults over legacy citations when both present", () => {
      const searchResults: PerplexitySearchResult[] = [
        {
          title: "From SearchResults",
          url: "https://example.com/search",
        },
      ];
      const citations = [
        "https://example.com/legacy",
      ];

      const response = createBaseResponse({ searchResults, citations });
      const result = extractCitations(response);

      // Should use searchResults, not citations
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/search");
      expect(result[0].title).toBe("From SearchResults");
    });
  });

  describe("empty/missing citations", () => {
    it("returns empty array when no citations exist", () => {
      const response = createBaseResponse();
      const result = extractCitations(response);

      expect(result).toEqual([]);
    });

    it("returns empty array when searchResults is empty array", () => {
      const response = createBaseResponse({ searchResults: [] });
      const result = extractCitations(response);

      expect(result).toEqual([]);
    });

    it("returns empty array when citations is empty array", () => {
      const response = createBaseResponse({ citations: [] });
      const result = extractCitations(response);

      expect(result).toEqual([]);
    });

    it("falls back to legacy citations when searchResults is empty but citations exist", () => {
      const response = createBaseResponse({
        searchResults: [],
        citations: ["https://example.com/fallback"],
      });
      const result = extractCitations(response);

      // Empty searchResults should fall back to citations
      expect(result).toHaveLength(1);
      expect(result[0].url).toBe("https://example.com/fallback");
    });
  });

  describe("edge cases", () => {
    it("handles single citation", () => {
      const citations = ["https://example.com/single"];

      const response = createBaseResponse({ citations });
      const result = extractCitations(response);

      expect(result).toHaveLength(1);
    });

    it("handles many citations", () => {
      const citations = Array.from({ length: 50 }, (_, i) => `https://example.com/${i}`);

      const response = createBaseResponse({ citations });
      const result = extractCitations(response);

      expect(result).toHaveLength(50);
    });

    it("preserves citation order", () => {
      const citations = [
        "https://example.com/first",
        "https://example.com/second",
        "https://example.com/third",
      ];

      const response = createBaseResponse({ citations });
      const result = extractCitations(response);

      expect(result[0].url).toBe("https://example.com/first");
      expect(result[1].url).toBe("https://example.com/second");
      expect(result[2].url).toBe("https://example.com/third");
    });
  });
});

// =============================================================================
// Model Capability Matrix Tests
// =============================================================================

describe("Model Capability Matrix", () => {
  // Comprehensive test covering all models and all capabilities
  const allModels = [
    { id: MODELS.GEMINI_FLASH, name: "GEMINI_FLASH" },
    { id: MODELS.PERPLEXITY_SONAR, name: "PERPLEXITY_SONAR" },
    { id: MODELS.GPT_4O, name: "GPT_4O" },
    { id: MODELS.CLAUDE_SONNET, name: "CLAUDE_SONNET" },
    { id: MODELS.PERPLEXITY_DEEP_RESEARCH, name: "PERPLEXITY_DEEP_RESEARCH" },
    { id: MODELS.O3_MINI, name: "O3_MINI" },
    { id: MODELS.GEMINI_25_FLASH, name: "GEMINI_25_FLASH" },
    { id: MODELS.CLAUDE_OPUS, name: "CLAUDE_OPUS" },
    { id: MODELS.EMBEDDING, name: "EMBEDDING" },
  ];

  it.each(allModels)(
    "$name returns consistent results across all capability checks",
    ({ id }) => {
      // These should not throw - just verify they return booleans
      expect(typeof supportsReasoning(id)).toBe("boolean");
      expect(typeof hasWebSearch(id)).toBe("boolean");
      expect(typeof supportsJSONMode(id)).toBe("boolean");
    }
  );

  describe("capability combinations", () => {
    it("O3_MINI: reasoning + JSON, no web search", () => {
      expect(supportsReasoning(MODELS.O3_MINI)).toBe(true);
      expect(hasWebSearch(MODELS.O3_MINI)).toBe(false);
      expect(supportsJSONMode(MODELS.O3_MINI)).toBe(true);
    });

    it("PERPLEXITY_SONAR: web search, no reasoning, no JSON", () => {
      expect(supportsReasoning(MODELS.PERPLEXITY_SONAR)).toBe(false);
      expect(hasWebSearch(MODELS.PERPLEXITY_SONAR)).toBe(true);
      expect(supportsJSONMode(MODELS.PERPLEXITY_SONAR)).toBe(false);
    });

    it("PERPLEXITY_DEEP_RESEARCH: reasoning + web search, no JSON", () => {
      expect(supportsReasoning(MODELS.PERPLEXITY_DEEP_RESEARCH)).toBe(true);
      expect(hasWebSearch(MODELS.PERPLEXITY_DEEP_RESEARCH)).toBe(true);
      expect(supportsJSONMode(MODELS.PERPLEXITY_DEEP_RESEARCH)).toBe(false);
    });

    it("CLAUDE_SONNET: JSON only, no reasoning, no web search", () => {
      expect(supportsReasoning(MODELS.CLAUDE_SONNET)).toBe(false);
      expect(hasWebSearch(MODELS.CLAUDE_SONNET)).toBe(false);
      expect(supportsJSONMode(MODELS.CLAUDE_SONNET)).toBe(true);
    });

    it("CLAUDE_OPUS: reasoning + JSON, no web search", () => {
      expect(supportsReasoning(MODELS.CLAUDE_OPUS)).toBe(true);
      expect(hasWebSearch(MODELS.CLAUDE_OPUS)).toBe(false);
      expect(supportsJSONMode(MODELS.CLAUDE_OPUS)).toBe(true);
    });

    it("GEMINI_FLASH: JSON only, no reasoning, no web search", () => {
      expect(supportsReasoning(MODELS.GEMINI_FLASH)).toBe(false);
      expect(hasWebSearch(MODELS.GEMINI_FLASH)).toBe(false);
      expect(supportsJSONMode(MODELS.GEMINI_FLASH)).toBe(true);
    });

    it("GEMINI_25_FLASH: reasoning + JSON, no web search", () => {
      expect(supportsReasoning(MODELS.GEMINI_25_FLASH)).toBe(true);
      expect(hasWebSearch(MODELS.GEMINI_25_FLASH)).toBe(false);
      expect(supportsJSONMode(MODELS.GEMINI_25_FLASH)).toBe(true);
    });

    it("GPT_4O: JSON only, no reasoning, no web search", () => {
      expect(supportsReasoning(MODELS.GPT_4O)).toBe(false);
      expect(hasWebSearch(MODELS.GPT_4O)).toBe(false);
      expect(supportsJSONMode(MODELS.GPT_4O)).toBe(true);
    });

    it("EMBEDDING: no capabilities", () => {
      expect(supportsReasoning(MODELS.EMBEDDING)).toBe(false);
      expect(hasWebSearch(MODELS.EMBEDDING)).toBe(false);
      expect(supportsJSONMode(MODELS.EMBEDDING)).toBe(false);
    });
  });
});
