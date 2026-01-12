/**
 * Intent Router Integration Tests
 *
 * Tests for classifyIntent() verifying:
 * - Classification of user messages into intent types
 * - Correct extraction of sections, fields, and changes
 * - Validation of section names
 * - Cost and usage tracking
 * - Graceful handling of malformed responses
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChatIntent } from "../types";

// =============================================================================
// Mock Setup
// =============================================================================

const mockOpenRouterClient = {
  chat: vi.fn(),
};

vi.mock("@/lib/openrouter/client", () => ({
  createOpenRouterClient: vi.fn(() => mockOpenRouterClient),
  MODELS: {
    CLAUDE_SONNET: "anthropic/claude-3.5-sonnet",
  },
}));

// Import after mocks
import { classifyIntent } from "../intent-router";

// =============================================================================
// Test Helpers
// =============================================================================

function createMockChatResponse(content: string) {
  return {
    content,
    usage: {
      promptTokens: 150,
      completionTokens: 50,
      totalTokens: 200,
    },
    cost: 0.0003,
  };
}

function createMockIntentResponse(intent: Record<string, unknown>) {
  return createMockChatResponse(JSON.stringify(intent));
}

// =============================================================================
// Tests
// =============================================================================

describe("classifyIntent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("intent classification", () => {
    it("should classify 'What are the main competitors?' as question intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "question",
          topic: "main competitors",
          sections: ["competitorAnalysis"],
        })
      );

      // Act
      const result = await classifyIntent("What are the main competitors?");

      // Assert
      expect(result.intent.type).toBe("question");
      if (result.intent.type === "question") {
        expect(result.intent.topic).toBe("main competitors");
        expect(result.intent.sections).toContain("competitorAnalysis");
      }
    });

    it("should classify 'Change the budget to $5000' as edit intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "edit",
          section: "crossAnalysisSynthesis",
          field: "budget",
          desiredChange: "Change budget to $5000",
        })
      );

      // Act
      const result = await classifyIntent("Change the budget to $5000");

      // Assert
      expect(result.intent.type).toBe("edit");
      if (result.intent.type === "edit") {
        expect(result.intent.desiredChange).toBe("Change budget to $5000");
      }
    });

    it("should classify 'Why did you recommend Facebook ads?' as explain intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "explain",
          section: "crossAnalysisSynthesis",
          field: "platformRecommendations",
          whatToExplain: "Facebook ads recommendation",
        })
      );

      // Act
      const result = await classifyIntent("Why did you recommend Facebook ads?");

      // Assert
      expect(result.intent.type).toBe("explain");
      if (result.intent.type === "explain") {
        expect(result.intent.whatToExplain).toBe("Facebook ads recommendation");
      }
    });

    it("should classify 'Regenerate the competitor analysis' as regenerate intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "regenerate",
          section: "competitorAnalysis",
          instructions: "",
        })
      );

      // Act
      const result = await classifyIntent("Regenerate the competitor analysis");

      // Assert
      expect(result.intent.type).toBe("regenerate");
      if (result.intent.type === "regenerate") {
        expect(result.intent.section).toBe("competitorAnalysis");
      }
    });

    it("should classify 'Hello' as general intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "general",
          topic: "greeting",
        })
      );

      // Act
      const result = await classifyIntent("Hello");

      // Assert
      expect(result.intent.type).toBe("general");
      if (result.intent.type === "general") {
        expect(result.intent.topic).toBe("greeting");
      }
    });

    it("should return correct sections array for question intents", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "question",
          topic: "market overview and competitors",
          sections: ["industryMarketOverview", "competitorAnalysis"],
        })
      );

      // Act
      const result = await classifyIntent("Tell me about the market and competitors");

      // Assert
      expect(result.intent.type).toBe("question");
      if (result.intent.type === "question") {
        expect(result.intent.sections).toEqual(["industryMarketOverview", "competitorAnalysis"]);
      }
    });

    it("should return correct section for edit intents", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "edit",
          section: "offerAnalysisViability",
          field: "offerStrength.overallScore",
          desiredChange: "Update score to 8",
        })
      );

      // Act
      const result = await classifyIntent("Update the offer strength score to 8");

      // Assert
      expect(result.intent.type).toBe("edit");
      if (result.intent.type === "edit") {
        expect(result.intent.section).toBe("offerAnalysisViability");
      }
    });

    it("should include desiredChange for edit intents", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "edit",
          section: "icpAnalysisValidation",
          field: "targetingRecommendations",
          desiredChange: "Add 'Target decision makers' to recommendations",
        })
      );

      // Act
      const result = await classifyIntent("Add 'Target decision makers' to targeting recommendations");

      // Assert
      expect(result.intent.type).toBe("edit");
      if (result.intent.type === "edit") {
        expect(result.intent.desiredChange).toBe("Add 'Target decision makers' to recommendations");
      }
    });

    it("should include whatToExplain for explain intents", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "explain",
          section: "icpAnalysisValidation",
          field: "icpViability.score",
          whatToExplain: "low ICP viability score",
        })
      );

      // Act
      const result = await classifyIntent("Why is the ICP viability score so low?");

      // Assert
      expect(result.intent.type).toBe("explain");
      if (result.intent.type === "explain") {
        expect(result.intent.whatToExplain).toBe("low ICP viability score");
      }
    });
  });

  describe("validation", () => {
    it("should validate section names against allowed list", async () => {
      // Arrange - return a valid section
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "edit",
          section: "competitorAnalysis",
          field: "competitors",
          desiredChange: "Add new competitor",
        })
      );

      // Act
      const result = await classifyIntent("Add new competitor");

      // Assert
      expect(result.intent.type).toBe("edit");
      if (result.intent.type === "edit") {
        expect(result.intent.section).toBe("competitorAnalysis");
      }
    });

    it("should default to crossAnalysisSynthesis for invalid sections in edit intent", async () => {
      // Arrange - return an invalid section
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "edit",
          section: "invalidSection",
          field: "someField",
          desiredChange: "Some change",
        })
      );

      // Act
      const result = await classifyIntent("Edit something");

      // Assert
      expect(result.intent.type).toBe("edit");
      if (result.intent.type === "edit") {
        expect(result.intent.section).toBe("crossAnalysisSynthesis");
      }
    });

    it("should default to crossAnalysisSynthesis for invalid sections in explain intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "explain",
          section: "nonExistentSection",
          field: "field",
          whatToExplain: "something",
        })
      );

      // Act
      const result = await classifyIntent("Explain something");

      // Assert
      expect(result.intent.type).toBe("explain");
      if (result.intent.type === "explain") {
        expect(result.intent.section).toBe("crossAnalysisSynthesis");
      }
    });

    it("should default to crossAnalysisSynthesis for invalid sections in regenerate intent", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "regenerate",
          section: "badSection",
          instructions: "redo it",
        })
      );

      // Act
      const result = await classifyIntent("Regenerate something");

      // Assert
      expect(result.intent.type).toBe("regenerate");
      if (result.intent.type === "regenerate") {
        expect(result.intent.section).toBe("crossAnalysisSynthesis");
      }
    });

    it("should handle malformed JSON response gracefully", async () => {
      // Arrange - return invalid JSON
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockChatResponse("This is not valid JSON at all")
      );

      // Act
      const result = await classifyIntent("Random message");

      // Assert - should default to general intent
      expect(result.intent.type).toBe("general");
    });

    it("should filter invalid sections from question intent sections array", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({
          type: "question",
          topic: "test",
          sections: ["industryMarketOverview", "invalidSection", "competitorAnalysis"],
        })
      );

      // Act
      const result = await classifyIntent("Question about multiple sections");

      // Assert
      expect(result.intent.type).toBe("question");
      if (result.intent.type === "question") {
        expect(result.intent.sections).toEqual(["industryMarketOverview", "competitorAnalysis"]);
        expect(result.intent.sections).not.toContain("invalidSection");
      }
    });
  });

  describe("cost tracking", () => {
    it("should return usage stats from classification", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue({
        content: JSON.stringify({ type: "general", topic: "test" }),
        usage: {
          promptTokens: 200,
          completionTokens: 75,
          totalTokens: 275,
        },
        cost: 0.0004,
      });

      // Act
      const result = await classifyIntent("Test message");

      // Assert
      expect(result.usage).toBeDefined();
      expect(result.usage.promptTokens).toBe(200);
      expect(result.usage.completionTokens).toBe(75);
      expect(result.usage.totalTokens).toBe(275);
    });

    it("should return cost estimate", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue({
        content: JSON.stringify({ type: "general", topic: "test" }),
        usage: {
          promptTokens: 100,
          completionTokens: 50,
          totalTokens: 150,
        },
        cost: 0.00025,
      });

      // Act
      const result = await classifyIntent("Another test");

      // Assert
      expect(result.cost).toBe(0.00025);
    });
  });

  describe("API call parameters", () => {
    it("should use Claude Sonnet model for classification", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({ type: "general", topic: "test" })
      );

      // Act
      await classifyIntent("Test message");

      // Assert
      expect(mockOpenRouterClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          model: "anthropic/claude-3.5-sonnet",
        })
      );
    });

    it("should use temperature 0 for deterministic classification", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({ type: "general", topic: "test" })
      );

      // Act
      await classifyIntent("Test message");

      // Assert
      expect(mockOpenRouterClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0,
        })
      );
    });

    it("should enable JSON mode", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({ type: "general", topic: "test" })
      );

      // Act
      await classifyIntent("Test message");

      // Assert
      expect(mockOpenRouterClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          jsonMode: true,
        })
      );
    });

    it("should pass user message as user role content", async () => {
      // Arrange
      mockOpenRouterClient.chat.mockResolvedValue(
        createMockIntentResponse({ type: "general", topic: "test" })
      );

      // Act
      await classifyIntent("What are the competitors?");

      // Assert
      expect(mockOpenRouterClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: "What are the competitors?",
            }),
          ]),
        })
      );
    });
  });
});
