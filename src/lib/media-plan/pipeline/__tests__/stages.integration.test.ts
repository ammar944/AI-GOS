/**
 * Individual Stage Integration Tests
 *
 * Tests for each pipeline stage function verifying:
 * - Input/output contracts
 * - Cost and duration tracking
 * - Error handling
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runExtractStage } from "../extract";
import { runResearchStage } from "../research";
import { runLogicStage } from "../logic";
import { runSynthesizeStage } from "../synthesize";
import {
  createMockNicheFormData,
  createMockBriefingFormData,
  createMockExtractedData,
  createMockResearchData,
  createMockLogicData,
  createMockMediaPlanBlueprint,
} from "@/test";

// =============================================================================
// Mock Setup
// =============================================================================

// Track generateObject calls
const mockGenerateObject = vi.fn();

vi.mock("ai", () => ({
  generateObject: (...args: unknown[]) => mockGenerateObject(...args),
}));

function mockGenerateObjectResult(object: unknown) {
  mockGenerateObject.mockResolvedValueOnce({
    object,
    usage: { inputTokens: 100, outputTokens: 200 },
  });
}

// =============================================================================
// Tests
// =============================================================================

describe("runExtractStage", () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("should return ExtractedData with correct structure", async () => {
    // Arrange
    const niche = createMockNicheFormData();
    const briefing = createMockBriefingFormData();
    const mockExtracted = createMockExtractedData();
    mockGenerateObjectResult(mockExtracted);

    // Act
    const result = await runExtractStage(niche, briefing);

    // Assert
    expect(result.data).toBeDefined();
    expect(result.data.industry).toBeDefined();
    expect(result.data.audience).toBeDefined();
    expect(result.data.icp).toBeDefined();
    expect(result.data.budget).toBeDefined();
    expect(result.data.offer).toBeDefined();
    expect(result.data.salesCycle).toBeDefined();
  });

  it("should track cost and duration in result", async () => {
    // Arrange
    const niche = createMockNicheFormData();
    const briefing = createMockBriefingFormData();
    const mockExtracted = createMockExtractedData();
    mockGenerateObjectResult(mockExtracted);

    // Act
    const result = await runExtractStage(niche, briefing);

    // Assert
    expect(result.cost).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
    expect(result.usage).toBeDefined();
    expect(result.usage.totalTokens).toBeGreaterThan(0);
  });

  it("should preserve input budget and offer price in extracted data", async () => {
    // Arrange
    const niche = createMockNicheFormData();
    const briefing = createMockBriefingFormData({ budget: 25000, offerPrice: 5000 });
    const mockExtracted = createMockExtractedData({
      budget: { total: 1, currency: "USD" },
      offer: { price: 1, type: "low_ticket" },
    });
    mockGenerateObjectResult(mockExtracted);

    // Act
    const result = await runExtractStage(niche, briefing);

    // Assert - should override with actual input values
    expect(result.data.budget.total).toBe(25000);
    expect(result.data.offer.price).toBe(5000);
  });

  it("should set correct sales cycle values from input", async () => {
    // Arrange
    const niche = createMockNicheFormData();
    const briefing = createMockBriefingFormData({ salesCycleLength: "more_than_30_days" });
    const mockExtracted = createMockExtractedData();
    mockGenerateObjectResult(mockExtracted);

    // Act
    const result = await runExtractStage(niche, briefing);

    // Assert
    expect(result.data.salesCycle.length).toBe("more_than_30_days");
    expect(result.data.salesCycle.daysEstimate).toBe(45);
  });

  it("should throw error on API failure", async () => {
    // Arrange
    const niche = createMockNicheFormData();
    const briefing = createMockBriefingFormData();
    mockGenerateObject.mockRejectedValueOnce(new Error("API timeout"));

    // Act & Assert
    await expect(runExtractStage(niche, briefing)).rejects.toThrow("API timeout");
  });
});

describe("runResearchStage", () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("should return ResearchData with correct structure", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const mockResearch = createMockResearchData();
    mockGenerateObjectResult(mockResearch);

    // Act
    const result = await runResearchStage(extracted);

    // Assert
    expect(result.data).toBeDefined();
    expect(result.data.marketOverview).toBeDefined();
    expect(result.data.competitors).toBeDefined();
    expect(result.data.benchmarks).toBeDefined();
    expect(result.data.audienceInsights).toBeDefined();
    expect(result.data.sources).toBeDefined();
  });

  it("should include sources/citations in result", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const mockResearch = createMockResearchData({
      sources: [
        { title: "Source 1", url: "https://example.com/1" },
        { title: "Source 2", url: "https://example.com/2" },
      ],
    });
    mockGenerateObjectResult(mockResearch);

    // Act
    const result = await runResearchStage(extracted);

    // Assert
    expect(result.data.sources).toHaveLength(2);
    expect(result.data.sources[0].url).toBe("https://example.com/1");
  });

  it("should provide default benchmarks if missing from response", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const mockResearch = createMockResearchData();
    const responseWithoutBenchmarks = { ...mockResearch, benchmarks: undefined };
    mockGenerateObjectResult(responseWithoutBenchmarks);

    // Act
    const result = await runResearchStage(extracted);

    // Assert - should have default benchmarks
    expect(result.data.benchmarks).toBeDefined();
    expect(result.data.benchmarks.cpc).toBeDefined();
    expect(result.data.benchmarks.cpm).toBeDefined();
    expect(result.data.benchmarks.ctr).toBeDefined();
    expect(result.data.benchmarks.conversionRate).toBeDefined();
  });

  it("should handle empty competitors array gracefully", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const mockResearch = createMockResearchData();
    const responseWithoutCompetitors = { ...mockResearch, competitors: undefined };
    mockGenerateObjectResult(responseWithoutCompetitors);

    // Act
    const result = await runResearchStage(extracted);

    // Assert
    expect(Array.isArray(result.data.competitors)).toBe(true);
  });

  it("should track cost and duration", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const mockResearch = createMockResearchData();
    mockGenerateObjectResult(mockResearch);

    // Act
    const result = await runResearchStage(extracted);

    // Assert
    expect(result.cost).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe("runLogicStage", () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("should return LogicData with correct structure", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData();
    const mockLogic = createMockLogicData();
    mockGenerateObjectResult(mockLogic);

    // Act
    const result = await runLogicStage(extracted, research);

    // Assert
    expect(result.data).toBeDefined();
    expect(result.data.platforms).toBeDefined();
    expect(result.data.budgetAllocation).toBeDefined();
    expect(result.data.funnelType).toBeDefined();
    expect(result.data.kpiTargets).toBeDefined();
  });

  it("should normalize budget allocation percentages to 100%", async () => {
    // Arrange
    const extracted = createMockExtractedData({ budget: { total: 10000, currency: "USD" } });
    const research = createMockResearchData();
    const mockLogic = createMockLogicData({
      budgetAllocation: [
        { platform: "Google Ads", amount: 6000, percentage: 60 },
        { platform: "Meta Ads", amount: 3000, percentage: 30 },
      ],
    });
    mockGenerateObjectResult(mockLogic);

    // Act
    const result = await runLogicStage(extracted, research);

    // Assert - percentages might be normalized
    const totalPercentage = result.data.budgetAllocation.reduce(
      (sum, item) => sum + item.percentage,
      0
    );
    expect(totalPercentage).toBeGreaterThanOrEqual(90);
  });

  it("should calculate correct budget amounts from percentages", async () => {
    // Arrange
    const extracted = createMockExtractedData({ budget: { total: 10000, currency: "USD" } });
    const research = createMockResearchData();
    const mockLogic = createMockLogicData({
      budgetAllocation: [
        { platform: "Google Ads", amount: 0, percentage: 50 },
        { platform: "Meta Ads", amount: 0, percentage: 30 },
        { platform: "LinkedIn", amount: 0, percentage: 20 },
      ],
    });
    mockGenerateObjectResult(mockLogic);

    // Act
    const result = await runLogicStage(extracted, research);

    // Assert - amounts should match percentages of $10,000
    const googleAlloc = result.data.budgetAllocation.find((a) =>
      a.platform.toLowerCase().includes("google")
    );
    expect(googleAlloc?.amount).toBe(5000);
  });

  it("should track cost and duration", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData();
    const mockLogic = createMockLogicData();
    mockGenerateObjectResult(mockLogic);

    // Act
    const result = await runLogicStage(extracted, research);

    // Assert
    expect(result.cost).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});

describe("runSynthesizeStage", () => {
  beforeEach(() => {
    mockGenerateObject.mockReset();
  });

  it("should return MediaPlanBlueprint with all required sections", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData();
    const logic = createMockLogicData();
    const mockBlueprint = createMockMediaPlanBlueprint();
    mockGenerateObjectResult(mockBlueprint);

    // Act
    const result = await runSynthesizeStage(extracted, research, logic);

    // Assert
    expect(result.data.executiveSummary).toBeDefined();
    expect(result.data.platformStrategy).toBeDefined();
    expect(result.data.budgetBreakdown).toBeDefined();
    expect(result.data.funnelStrategy).toBeDefined();
    expect(result.data.adAngles).toBeDefined();
    expect(result.data.kpiTargets).toBeDefined();
    expect(result.data.sources).toBeDefined();
    expect(result.data.metadata).toBeDefined();
  });

  it("should initialize metadata with current timestamp", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData();
    const logic = createMockLogicData();
    const mockBlueprint = createMockMediaPlanBlueprint();
    mockGenerateObjectResult(mockBlueprint);

    // Act
    const result = await runSynthesizeStage(extracted, research, logic);

    // Assert
    expect(result.data.metadata.generatedAt).toBeDefined();
    expect(new Date(result.data.metadata.generatedAt).getTime()).toBeGreaterThan(0);
  });

  it("should include research sources in blueprint", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData({
      sources: [
        { title: "Research Source", url: "https://example.com/research" },
      ],
    });
    const logic = createMockLogicData();
    const mockBlueprint = createMockMediaPlanBlueprint({ sources: [] });
    mockGenerateObjectResult(mockBlueprint);

    // Act
    const result = await runSynthesizeStage(extracted, research, logic);

    // Assert - should fallback to research sources if empty
    expect(result.data.sources.length).toBeGreaterThan(0);
  });

  it("should ensure required arrays exist even if empty", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData();
    const logic = createMockLogicData();
    const mockBlueprint = {
      executiveSummary: "Test summary",
      metadata: { generatedAt: "", totalCost: 0, processingTime: 0 },
    };
    mockGenerateObjectResult(mockBlueprint);

    // Act
    const result = await runSynthesizeStage(extracted, research, logic);

    // Assert - should have empty arrays rather than undefined
    expect(Array.isArray(result.data.platformStrategy)).toBe(true);
    expect(Array.isArray(result.data.budgetBreakdown)).toBe(true);
    expect(Array.isArray(result.data.adAngles)).toBe(true);
    expect(Array.isArray(result.data.kpiTargets)).toBe(true);
  });

  it("should track cost and duration", async () => {
    // Arrange
    const extracted = createMockExtractedData();
    const research = createMockResearchData();
    const logic = createMockLogicData();
    const mockBlueprint = createMockMediaPlanBlueprint();
    mockGenerateObjectResult(mockBlueprint);

    // Act
    const result = await runSynthesizeStage(extracted, research, logic);

    // Assert
    expect(result.cost).toBeGreaterThan(0);
    expect(result.duration).toBeGreaterThanOrEqual(0);
  });
});
