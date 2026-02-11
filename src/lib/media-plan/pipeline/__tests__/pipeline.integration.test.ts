/**
 * Pipeline Orchestrator Integration Tests
 *
 * Tests for runMediaPlanPipeline() verifying:
 * - Complete pipeline execution with mocked stage results
 * - Progress tracking through all stages
 * - Abort signal handling
 * - Error propagation from each stage
 * - Cost and timing aggregation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runMediaPlanPipeline, type ProgressCallback } from "../index";
import type { PipelineProgress, PipelineStage } from "@/lib/media-plan/types";
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

// Mock all stage modules
vi.mock("../extract", () => ({
  runExtractStage: vi.fn(),
}));

vi.mock("../research", () => ({
  runResearchStage: vi.fn(),
}));

vi.mock("../logic", () => ({
  runLogicStage: vi.fn(),
}));

vi.mock("../synthesize", () => ({
  runSynthesizeStage: vi.fn(),
}));

// Import mocked functions for configuration
import { runExtractStage } from "../extract";
import { runResearchStage } from "../research";
import { runLogicStage } from "../logic";
import { runSynthesizeStage } from "../synthesize";

const mockExtractStage = vi.mocked(runExtractStage);
const mockResearchStage = vi.mocked(runResearchStage);
const mockLogicStage = vi.mocked(runLogicStage);
const mockSynthesizeStage = vi.mocked(runSynthesizeStage);

// =============================================================================
// Test Data
// =============================================================================

function createSuccessfulStageResults() {
  return {
    extract: {
      data: createMockExtractedData(),
      usage: { inputTokens: 100, outputTokens: 200, totalTokens: 300 },
      cost: 0.001,
      duration: 1000,
    },
    research: {
      data: createMockResearchData(),
      usage: { inputTokens: 200, outputTokens: 400, totalTokens: 600 },
      cost: 0.005,
      duration: 2000,
    },
    logic: {
      data: createMockLogicData(),
      usage: { inputTokens: 150, outputTokens: 300, totalTokens: 450 },
      cost: 0.003,
      duration: 1500,
    },
    synthesize: {
      data: createMockMediaPlanBlueprint(),
      usage: { inputTokens: 300, outputTokens: 800, totalTokens: 1100 },
      cost: 0.015,
      duration: 3000,
    },
  };
}

// =============================================================================
// Tests
// =============================================================================

describe("runMediaPlanPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("successful execution", () => {
    it("should complete all 4 stages and return success with blueprint", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(true);
      expect(result.blueprint).toBeDefined();
      expect(result.error).toBeUndefined();
    });

    it("should call stages in correct order with proper data flow", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert - verify call order
      expect(mockExtractStage).toHaveBeenCalledWith(niche, briefing);
      expect(mockResearchStage).toHaveBeenCalledWith(stageResults.extract.data);
      expect(mockLogicStage).toHaveBeenCalledWith(
        stageResults.extract.data,
        stageResults.research.data
      );
      expect(mockSynthesizeStage).toHaveBeenCalledWith(
        stageResults.extract.data,
        stageResults.research.data,
        stageResults.logic.data
      );
    });

    it("should aggregate costs from all stages", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      const expectedCost =
        stageResults.extract.cost +
        stageResults.research.cost +
        stageResults.logic.cost +
        stageResults.synthesize.cost;
      expect(result.metadata.totalCost).toBe(expectedCost);
    });

    it("should track stage timings in metadata", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.metadata.stageTimings.extract).toBe(stageResults.extract.duration);
      expect(result.metadata.stageTimings.research).toBe(stageResults.research.duration);
      expect(result.metadata.stageTimings.logic).toBe(stageResults.logic.duration);
      expect(result.metadata.stageTimings.synthesize).toBe(stageResults.synthesize.duration);
    });

    it("should update blueprint metadata with final cost and processing time", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.blueprint?.metadata.totalCost).toBeGreaterThan(0);
      expect(result.blueprint?.metadata.processingTime).toBeGreaterThanOrEqual(0);
      expect(result.blueprint?.metadata.generatedAt).toBeDefined();
    });
  });

  describe("progress tracking", () => {
    it("should call progress callback for each stage transition", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();
      const progressCallback = vi.fn<ProgressCallback>();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        onProgress: progressCallback,
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert - should be called for extract, research, logic, synthesize, complete
      expect(progressCallback).toHaveBeenCalledTimes(5);
    });

    it("should report correct stage sequence in progress callbacks", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();
      const progressUpdates: PipelineProgress[] = [];

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert
      expect(progressUpdates[0].currentStage).toBe("extract");
      expect(progressUpdates[1].currentStage).toBe("research");
      expect(progressUpdates[2].currentStage).toBe("logic");
      expect(progressUpdates[3].currentStage).toBe("synthesize");
      expect(progressUpdates[4].currentStage).toBe("complete");
    });

    it("should track completed stages array correctly", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();
      const progressUpdates: PipelineProgress[] = [];

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        onProgress: (progress) =>
          progressUpdates.push({ ...progress, completedStages: [...progress.completedStages] }),
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert - completedStages grows with each progress update
      expect(progressUpdates[0].completedStages).toEqual([]);
      expect(progressUpdates[1].completedStages).toEqual(["extract"]);
      expect(progressUpdates[2].completedStages).toEqual(["extract", "research"]);
      expect(progressUpdates[3].completedStages).toEqual(["extract", "research", "logic"]);
      expect(progressUpdates[4].completedStages).toEqual([
        "extract",
        "research",
        "logic",
        "synthesize",
      ]);
    });

    it("should include startTime and stageStartTime in progress", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();
      let firstProgress: PipelineProgress | null = null;

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockResolvedValue(stageResults.synthesize);

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        onProgress: (progress) => {
          if (!firstProgress) firstProgress = { ...progress };
        },
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert
      expect(firstProgress).not.toBeNull();
      expect(firstProgress!.startTime).toBeGreaterThan(0);
      expect(firstProgress!.stageStartTime).toBeGreaterThanOrEqual(firstProgress!.startTime);
    });
  });

  describe("abort handling", () => {
    it("should abort pipeline when signal is triggered before any stage", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const abortController = new AbortController();

      // Abort immediately
      abortController.abort();

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        abortSignal: abortController.signal,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("aborted");
      expect(mockExtractStage).not.toHaveBeenCalled();
    });

    it("should abort pipeline after extract stage completes", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const abortController = new AbortController();
      const stageResults = createSuccessfulStageResults();

      // Abort after extract completes
      mockExtractStage.mockImplementation(async () => {
        abortController.abort();
        return stageResults.extract;
      });

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        abortSignal: abortController.signal,
      });
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toContain("aborted");
      expect(mockExtractStage).toHaveBeenCalled();
      expect(mockResearchStage).not.toHaveBeenCalled();
    });

    it("should report correct failed stage when aborted mid-pipeline", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const abortController = new AbortController();
      const stageResults = createSuccessfulStageResults();
      const progressUpdates: PipelineProgress[] = [];

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockImplementation(async () => {
        abortController.abort();
        return stageResults.research;
      });

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        abortSignal: abortController.signal,
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert - last progress should have error
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.error).toContain("aborted");
    });
  });

  describe("error handling", () => {
    it("should return error when extract stage fails", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();

      mockExtractStage.mockRejectedValue(new Error("Gemini API error"));

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Gemini API error");
      expect(result.blueprint).toBeUndefined();
    });

    it("should return error when research stage fails", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockRejectedValue(new Error("Perplexity rate limit"));

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Perplexity rate limit");
    });

    it("should return error when logic stage fails", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockRejectedValue(new Error("GPT timeout"));

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("GPT timeout");
    });

    it("should return error when synthesize stage fails", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockResolvedValue(stageResults.logic);
      mockSynthesizeStage.mockRejectedValue(new Error("Claude validation error"));

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Claude validation error");
    });

    it("should report correct failed stage in progress callback", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();
      const progressUpdates: PipelineProgress[] = [];

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockRejectedValue(new Error("Logic error"));

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing, {
        onProgress: (progress) => progressUpdates.push({ ...progress }),
      });
      await vi.runAllTimersAsync();
      await resultPromise;

      // Assert - last progress should indicate logic stage failed
      const lastProgress = progressUpdates[progressUpdates.length - 1];
      expect(lastProgress.currentStage).toBe("logic");
      expect(lastProgress.error).toBe("Logic error");
    });

    it("should handle non-Error throws gracefully", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();

      mockExtractStage.mockRejectedValue("String error");

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert
      expect(result.success).toBe(false);
      expect(result.error).toBe("Unknown error occurred");
    });

    it("should include partial cost in metadata even on failure", async () => {
      // Arrange
      const niche = createMockNicheFormData();
      const briefing = createMockBriefingFormData();
      const stageResults = createSuccessfulStageResults();

      mockExtractStage.mockResolvedValue(stageResults.extract);
      mockResearchStage.mockResolvedValue(stageResults.research);
      mockLogicStage.mockRejectedValue(new Error("Logic error"));

      // Act
      const resultPromise = runMediaPlanPipeline(niche, briefing);
      await vi.runAllTimersAsync();
      const result = await resultPromise;

      // Assert - should have costs from extract and research
      const expectedCost = stageResults.extract.cost + stageResults.research.cost;
      expect(result.metadata.totalCost).toBe(expectedCost);
    });
  });
});
