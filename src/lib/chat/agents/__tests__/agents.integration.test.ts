/**
 * Chat Agents Integration Tests
 *
 * Tests for Q&A Agent, Edit Agent, and Explain Agent verifying:
 * - Response generation using context and blueprints
 * - Structured output with proper fields
 * - Usage and cost tracking
 * - Graceful error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { BlueprintChunk, EditIntent, ExplainIntent, BlueprintSection } from "../../types";

// =============================================================================
// Mock Setup
// =============================================================================

const mockOpenRouterClient = {
  chat: vi.fn(),
  chatJSON: vi.fn(),
};

vi.mock("@/lib/openrouter/client", () => ({
  createOpenRouterClient: vi.fn(() => mockOpenRouterClient),
  MODELS: {
    CLAUDE_SONNET: "anthropic/claude-3.5-sonnet",
  },
}));

// Mock retrieval service for QA Agent
vi.mock("../../retrieval", () => ({
  buildContextFromChunks: vi.fn((chunks: BlueprintChunk[]) => {
    if (chunks.length === 0) {
      return "No relevant context found in the blueprint.";
    }
    return chunks
      .map((chunk, i) => `[${i + 1}] ${chunk.content}`)
      .join("\n\n");
  }),
}));

// Import after mocks
import { answerQuestion } from "../qa-agent";
import { handleEdit } from "../edit-agent";
import { handleExplain } from "../explain-agent";

// =============================================================================
// Test Data Factories
// =============================================================================

function createMockBlueprintChunk(overrides?: Partial<BlueprintChunk>): BlueprintChunk {
  return {
    id: overrides?.id ?? crypto.randomUUID(),
    blueprintId: overrides?.blueprintId ?? "test-blueprint-id",
    section: overrides?.section ?? "industryMarketOverview",
    fieldPath: overrides?.fieldPath ?? "categorySnapshot.category",
    content: overrides?.content ?? "Test chunk content about the market",
    contentType: overrides?.contentType ?? "string",
    metadata: overrides?.metadata ?? {
      sectionTitle: "Industry Market Overview",
      fieldDescription: "Market category description",
      isEditable: true,
      originalValue: "Test category",
    },
    embedding: overrides?.embedding ?? [],
    similarity: overrides?.similarity ?? 0.85,
    createdAt: overrides?.createdAt ?? new Date(),
    updatedAt: overrides?.updatedAt ?? new Date(),
  };
}

function createMockChatResponse(content: string) {
  return {
    content,
    usage: {
      promptTokens: 300,
      completionTokens: 200,
      totalTokens: 500,
    },
    cost: 0.001,
  };
}

function createMockEditIntent(overrides?: Partial<EditIntent>): EditIntent {
  return {
    type: "edit",
    section: overrides?.section ?? "crossAnalysisSynthesis",
    field: overrides?.field ?? "executiveSummary",
    desiredChange: overrides?.desiredChange ?? "Update the summary to be more concise",
  };
}

function createMockExplainIntent(overrides?: Partial<ExplainIntent>): ExplainIntent {
  return {
    type: "explain",
    section: overrides?.section ?? "crossAnalysisSynthesis",
    field: overrides?.field ?? "strategicRecommendations",
    whatToExplain: overrides?.whatToExplain ?? "Why Facebook ads are recommended",
  };
}

function createMockSectionData(section: BlueprintSection): Record<string, unknown> {
  switch (section) {
    case "crossAnalysisSynthesis":
      return {
        executiveSummary: "This is the current executive summary for the blueprint.",
        strategicRecommendations: {
          immediate: ["Start with Facebook ads", "Build email list"],
          shortTerm: ["Expand to Instagram"],
          longTerm: ["Consider YouTube"],
        },
        nextSteps: ["Launch campaign", "Monitor metrics"],
      };
    case "industryMarketOverview":
      return {
        categorySnapshot: {
          category: "Digital Marketing",
          market: "SMB",
        },
        painPoints: {
          primary: ["Limited budget", "Time constraints"],
          secondary: ["Technical knowledge gap"],
        },
      };
    case "competitorAnalysis":
      return {
        competitors: [
          { name: "Competitor A", strengths: ["Strong brand"], weaknesses: ["High price"] },
        ],
        competitiveGaps: ["Untapped market segment"],
      };
    default:
      return {};
  }
}

function createMockBlueprint(): Record<string, unknown> {
  return {
    industryMarketOverview: createMockSectionData("industryMarketOverview"),
    crossAnalysisSynthesis: createMockSectionData("crossAnalysisSynthesis"),
    competitorAnalysis: createMockSectionData("competitorAnalysis"),
  };
}

// =============================================================================
// Tests: Q&A Agent
// =============================================================================

describe("QAAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("answerQuestion", () => {
    it("should generate answer using retrieved context", async () => {
      // Arrange
      const chunks = [
        createMockBlueprintChunk({ content: "The target market is small business owners." }),
        createMockBlueprintChunk({ content: "Primary pain point is limited budget." }),
      ];

      mockOpenRouterClient.chat.mockResolvedValue(
        createMockChatResponse(
          "Based on the blueprint, the target market is small business owners with limited budgets."
        )
      );

      // Act
      const result = await answerQuestion({
        query: "Who is the target market?",
        chunks,
      });

      // Assert
      expect(result.answer).toContain("small business owners");
      expect(mockOpenRouterClient.chat).toHaveBeenCalled();
    });

    it("should include source references in response", async () => {
      // Arrange
      const chunks = [
        createMockBlueprintChunk({
          id: "chunk-1",
          content: "Revenue streams include subscription and one-time purchases.",
        }),
      ];

      mockOpenRouterClient.chat.mockResolvedValue(
        createMockChatResponse("The revenue model includes both subscription and one-time purchases.")
      );

      // Act
      const result = await answerQuestion({
        query: "What is the revenue model?",
        chunks,
      });

      // Assert
      expect(result.sources).toHaveLength(1);
      expect(result.sources[0].id).toBe("chunk-1");
    });

    it("should handle empty context gracefully", async () => {
      // Arrange
      const chunks: BlueprintChunk[] = [];

      mockOpenRouterClient.chat.mockResolvedValue(
        createMockChatResponse("I don't have that information in the blueprint.")
      );

      // Act
      const result = await answerQuestion({
        query: "What is the marketing budget?",
        chunks,
      });

      // Assert
      expect(result.answer).toBeDefined();
      expect(result.confidence).toBe("low");
    });

    it("should respect chat history for context", async () => {
      // Arrange
      const chunks = [createMockBlueprintChunk({ content: "Target demographic: 25-45 years old." })];
      const chatHistory = [
        { role: "user" as const, content: "Tell me about the target audience." },
        { role: "assistant" as const, content: "The target audience is young professionals." },
      ];

      mockOpenRouterClient.chat.mockResolvedValue(
        createMockChatResponse("Following up on the target audience, the age range is 25-45 years old.")
      );

      // Act
      const result = await answerQuestion({
        query: "What is their age range?",
        chunks,
        chatHistory,
      });

      // Assert - verify chat history was included in the call
      expect(mockOpenRouterClient.chat).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "user", content: "Tell me about the target audience." }),
          ]),
        })
      );
      expect(result.answer).toBeDefined();
    });

    it("should return confidence based on chunk similarity", async () => {
      // Arrange - high similarity chunks
      const chunks = [
        createMockBlueprintChunk({ similarity: 0.95 }),
        createMockBlueprintChunk({ similarity: 0.90 }),
      ];

      mockOpenRouterClient.chat.mockResolvedValue(createMockChatResponse("High confidence answer."));

      // Act
      const result = await answerQuestion({
        query: "High relevance question",
        chunks,
      });

      // Assert
      expect(result.confidence).toBe("high");
    });

    it("should return usage and cost metrics", async () => {
      // Arrange
      const chunks = [createMockBlueprintChunk()];

      mockOpenRouterClient.chat.mockResolvedValue({
        content: "Test answer",
        usage: {
          promptTokens: 400,
          completionTokens: 150,
          totalTokens: 550,
        },
        cost: 0.0015,
      });

      // Act
      const result = await answerQuestion({
        query: "Test question",
        chunks,
      });

      // Assert
      expect(result.usage.totalTokens).toBe(550);
      expect(result.cost).toBe(0.0015);
    });
  });
});

// =============================================================================
// Tests: Edit Agent
// =============================================================================

describe("EditAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleEdit", () => {
    it("should identify correct field path for edit", async () => {
      // Arrange
      const intent = createMockEditIntent({
        section: "crossAnalysisSynthesis",
        field: "executiveSummary",
        desiredChange: "Make the summary shorter",
      });
      const fullSection = createMockSectionData("crossAnalysisSynthesis");

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          fieldPath: "executiveSummary",
          oldValue: "This is the current executive summary for the blueprint.",
          newValue: "Concise executive summary.",
          explanation: "Shortened the summary as requested.",
        },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        cost: 0.002,
      });

      // Act
      const result = await handleEdit({
        fullSection,
        intent,
      });

      // Assert
      expect(result.result.fieldPath).toBe("executiveSummary");
      expect(result.result.section).toBe("crossAnalysisSynthesis");
    });

    it("should return structured edit proposal", async () => {
      // Arrange
      const intent = createMockEditIntent({
        desiredChange: "Add LinkedIn to immediate recommendations",
      });
      const fullSection = createMockSectionData("crossAnalysisSynthesis");

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          fieldPath: "strategicRecommendations.immediate",
          oldValue: ["Start with Facebook ads", "Build email list"],
          newValue: ["Start with Facebook ads", "Build email list", "Add LinkedIn presence"],
          explanation: "Added LinkedIn to immediate recommendations as requested.",
        },
        usage: { promptTokens: 600, completionTokens: 250, totalTokens: 850 },
        cost: 0.0025,
      });

      // Act
      const result = await handleEdit({
        fullSection,
        intent,
      });

      // Assert
      expect(result.result.oldValue).toBeDefined();
      expect(result.result.newValue).toBeDefined();
      expect(result.result.explanation).toContain("LinkedIn");
      expect(result.result.diffPreview).toBeDefined();
      expect(result.result.requiresConfirmation).toBe(true);
    });

    it("should validate edit against section data", async () => {
      // Arrange
      const intent = createMockEditIntent({
        field: "nextSteps",
        desiredChange: "Replace all next steps",
      });
      const fullSection = createMockSectionData("crossAnalysisSynthesis");

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          fieldPath: "nextSteps",
          oldValue: ["Launch campaign", "Monitor metrics"],
          newValue: ["New step 1", "New step 2"],
          explanation: "Replaced all next steps as requested.",
        },
        usage: { promptTokens: 400, completionTokens: 150, totalTokens: 550 },
        cost: 0.0015,
      });

      // Act
      const result = await handleEdit({
        fullSection,
        intent,
      });

      // Assert - oldValue should match actual data
      expect(result.result.oldValue).toEqual(["Launch campaign", "Monitor metrics"]);
    });

    it("should handle ambiguous edit requests", async () => {
      // Arrange - vague request
      const intent = createMockEditIntent({
        field: "",
        desiredChange: "Make it better",
      });
      const fullSection = createMockSectionData("crossAnalysisSynthesis");

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          fieldPath: "executiveSummary",
          oldValue: "This is the current executive summary for the blueprint.",
          newValue: "Improved executive summary with clearer insights.",
          explanation: "Interpreted 'make it better' as improving the executive summary.",
        },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        cost: 0.002,
      });

      // Act
      const result = await handleEdit({
        fullSection,
        intent,
      });

      // Assert - should still return a valid proposal
      expect(result.result.fieldPath).toBeDefined();
      expect(result.result.explanation).toBeDefined();
    });

    it("should return usage and cost metrics", async () => {
      // Arrange
      const intent = createMockEditIntent();
      const fullSection = createMockSectionData("crossAnalysisSynthesis");

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          fieldPath: "executiveSummary",
          oldValue: "Old",
          newValue: "New",
          explanation: "Changed",
        },
        usage: { promptTokens: 700, completionTokens: 300, totalTokens: 1000 },
        cost: 0.003,
      });

      // Act
      const result = await handleEdit({
        fullSection,
        intent,
      });

      // Assert
      expect(result.usage.totalTokens).toBe(1000);
      expect(result.cost).toBe(0.003);
    });

    it("should work with provided chat history", async () => {
      // Arrange
      const intent = createMockEditIntent();
      const fullSection = createMockSectionData("crossAnalysisSynthesis");
      const chatHistory = [
        { role: "user" as const, content: "I want to update the summary" },
        { role: "assistant" as const, content: "What changes would you like?" },
      ];

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          fieldPath: "executiveSummary",
          oldValue: "Old",
          newValue: "New",
          explanation: "Updated based on conversation.",
        },
        usage: { promptTokens: 800, completionTokens: 250, totalTokens: 1050 },
        cost: 0.0028,
      });

      // Act
      const result = await handleEdit({
        fullSection,
        intent,
        chatHistory,
      });

      // Assert
      expect(result.result).toBeDefined();
      expect(mockOpenRouterClient.chatJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({ role: "user", content: "I want to update the summary" }),
          ]),
        })
      );
    });
  });
});

// =============================================================================
// Tests: Explain Agent
// =============================================================================

describe("ExplainAgent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("handleExplain", () => {
    it("should generate explanation for specified field", async () => {
      // Arrange
      const intent = createMockExplainIntent({
        section: "crossAnalysisSynthesis",
        field: "strategicRecommendations.immediate",
        whatToExplain: "Why Facebook ads are first priority",
      });
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation:
            "Facebook ads are recommended as first priority because the target audience (small business owners) is highly active on Facebook, and the platform offers cost-effective targeting options.",
          relatedFactors: [
            {
              section: "industryMarketOverview",
              factor: "Target demographic active on Facebook",
              relevance: "Supports platform selection",
            },
          ],
          confidence: "high",
        },
        usage: { promptTokens: 800, completionTokens: 400, totalTokens: 1200 },
        cost: 0.004,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.explanation).toContain("Facebook ads");
      expect(result.explanation).toContain("target audience");
    });

    it("should include reasoning and related factors", async () => {
      // Arrange
      const intent = createMockExplainIntent({
        whatToExplain: "Why is the ICP viability score 7/10",
      });
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation:
            "The ICP viability score of 7/10 reflects a strong but not perfect fit. The target audience shows clear pain points that align with the offer, but there are some accessibility challenges.",
          relatedFactors: [
            {
              section: "industryMarketOverview",
              factor: "Limited budget as primary pain point",
              relevance: "Affects purchasing capacity",
            },
            {
              section: "competitorAnalysis",
              factor: "Competitors target same segment",
              relevance: "Indicates market validation",
            },
          ],
          confidence: "high",
        },
        usage: { promptTokens: 900, completionTokens: 450, totalTokens: 1350 },
        cost: 0.0045,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.relatedFactors).toHaveLength(2);
      expect(result.relatedFactors[0].section).toBe("industryMarketOverview");
      expect(result.relatedFactors[1].section).toBe("competitorAnalysis");
    });

    it("should reference blueprint data in explanation", async () => {
      // Arrange
      const intent = createMockExplainIntent({
        whatToExplain: "Why focus on SMB market",
      });
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation:
            "The SMB market focus is based on the category snapshot showing 'SMB' as the target market, combined with pain points like 'Limited budget' and 'Time constraints' that are characteristic of small business owners.",
          relatedFactors: [
            {
              section: "industryMarketOverview",
              factor: "Category snapshot: SMB market",
              relevance: "Direct market definition",
            },
          ],
          confidence: "high",
        },
        usage: { promptTokens: 1000, completionTokens: 350, totalTokens: 1350 },
        cost: 0.004,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.explanation).toContain("SMB");
      expect(result.explanation).toContain("pain points");
    });

    it("should handle missing field gracefully", async () => {
      // Arrange
      const intent = createMockExplainIntent({
        field: "nonExistentField",
        whatToExplain: "Why this field has this value",
      });
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation:
            "I cannot find specific data for that field in the blueprint. However, based on the overall strategy...",
          relatedFactors: [],
          confidence: "low",
        },
        usage: { promptTokens: 600, completionTokens: 200, totalTokens: 800 },
        cost: 0.002,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.explanation).toBeDefined();
      expect(result.confidence).toBe("low");
    });

    it("should return confidence level in response", async () => {
      // Arrange
      const intent = createMockExplainIntent();
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation: "Clear explanation with strong supporting data.",
          relatedFactors: [
            { section: "industryMarketOverview", factor: "Factor 1", relevance: "Strong connection" },
            { section: "competitorAnalysis", factor: "Factor 2", relevance: "Supporting evidence" },
          ],
          confidence: "high",
        },
        usage: { promptTokens: 700, completionTokens: 300, totalTokens: 1000 },
        cost: 0.003,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.confidence).toBe("high");
    });

    it("should return usage and cost metrics", async () => {
      // Arrange
      const intent = createMockExplainIntent();
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation: "Test explanation",
          relatedFactors: [],
          confidence: "medium",
        },
        usage: { promptTokens: 1100, completionTokens: 500, totalTokens: 1600 },
        cost: 0.005,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.usage.totalTokens).toBe(1600);
      expect(result.cost).toBe(0.005);
    });

    it("should work with provided chat history", async () => {
      // Arrange
      const intent = createMockExplainIntent();
      const fullBlueprint = createMockBlueprint();
      const chatHistory = [
        { role: "user" as const, content: "Tell me about the recommendations" },
        { role: "assistant" as const, content: "Here are the strategic recommendations..." },
      ];

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation: "Building on our previous discussion about recommendations...",
          relatedFactors: [],
          confidence: "medium",
        },
        usage: { promptTokens: 1200, completionTokens: 400, totalTokens: 1600 },
        cost: 0.0048,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
        chatHistory,
      });

      // Assert
      expect(result.explanation).toBeDefined();
      expect(mockOpenRouterClient.chatJSON).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              role: "user",
              content: "Tell me about the recommendations",
            }),
          ]),
        })
      );
    });

    it("should handle empty relatedFactors gracefully", async () => {
      // Arrange
      const intent = createMockExplainIntent();
      const fullBlueprint = createMockBlueprint();

      mockOpenRouterClient.chatJSON.mockResolvedValue({
        data: {
          explanation: "Explanation without specific cross-references.",
          relatedFactors: null, // Could be null instead of empty array
          confidence: "low",
        },
        usage: { promptTokens: 500, completionTokens: 200, totalTokens: 700 },
        cost: 0.002,
      });

      // Act
      const result = await handleExplain({
        fullBlueprint,
        intent,
      });

      // Assert
      expect(result.relatedFactors).toEqual([]);
    });
  });
});
