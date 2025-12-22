// Pipeline Orchestrator
// Coordinates all 4 stages: Extract → Research → Logic → Synthesize

import type {
  NicheFormData,
  BriefingFormData,
  PipelineStage,
  PipelineProgress,
  PipelineResult,
  MediaPlanBlueprint,
  ExtractedData,
  ResearchData,
  LogicData,
} from "../types";

import { runExtractStage } from "./extract";
import { runResearchStage } from "./research";
import { runLogicStage } from "./logic";
import { runSynthesizeStage } from "./synthesize";

export type ProgressCallback = (progress: PipelineProgress) => void;

export interface PipelineOptions {
  onProgress?: ProgressCallback;
  abortSignal?: AbortSignal;
}

interface StageTimings {
  extract: number;
  research: number;
  logic: number;
  synthesize: number;
  complete: number;
}

export async function runMediaPlanPipeline(
  niche: NicheFormData,
  briefing: BriefingFormData,
  options: PipelineOptions = {}
): Promise<PipelineResult> {
  const { onProgress, abortSignal } = options;

  const startTime = Date.now();
  const stageTimings: StageTimings = {
    extract: 0,
    research: 0,
    logic: 0,
    synthesize: 0,
    complete: 0,
  };

  let totalCost = 0;
  const completedStages: PipelineStage[] = [];

  // Helper to update progress
  const updateProgress = (stage: PipelineStage, error?: string) => {
    if (onProgress) {
      onProgress({
        currentStage: stage,
        completedStages: [...completedStages],
        startTime,
        stageStartTime: Date.now(),
        error,
      });
    }
  };

  // Helper to check abort
  const checkAbort = () => {
    if (abortSignal?.aborted) {
      throw new Error("Pipeline aborted by user");
    }
  };

  let extractedData: ExtractedData;
  let researchData: ResearchData;
  let logicData: LogicData;
  let blueprint: MediaPlanBlueprint;

  try {
    // =========================================================================
    // Stage 1: EXTRACT (Gemini Flash)
    // =========================================================================
    checkAbort();
    updateProgress("extract");

    const extractResult = await runExtractStage(niche, briefing);
    extractedData = extractResult.data;
    totalCost += extractResult.cost;
    stageTimings.extract = extractResult.duration;
    completedStages.push("extract");

    // =========================================================================
    // Stage 2: RESEARCH (Perplexity)
    // =========================================================================
    checkAbort();
    updateProgress("research");

    const researchResult = await runResearchStage(extractedData);
    researchData = researchResult.data;
    totalCost += researchResult.cost;
    stageTimings.research = researchResult.duration;
    completedStages.push("research");

    // =========================================================================
    // Stage 3: APPLY LOGIC (GPT)
    // =========================================================================
    checkAbort();
    updateProgress("logic");

    const logicResult = await runLogicStage(extractedData, researchData);
    logicData = logicResult.data;
    totalCost += logicResult.cost;
    stageTimings.logic = logicResult.duration;
    completedStages.push("logic");

    // =========================================================================
    // Stage 4: SYNTHESIZE (Claude)
    // =========================================================================
    checkAbort();
    updateProgress("synthesize");

    const synthesizeResult = await runSynthesizeStage(
      extractedData,
      researchData,
      logicData
    );
    blueprint = synthesizeResult.data;
    totalCost += synthesizeResult.cost;
    stageTimings.synthesize = synthesizeResult.duration;
    completedStages.push("synthesize");

    // =========================================================================
    // Complete
    // =========================================================================
    const totalTime = Date.now() - startTime;
    stageTimings.complete = totalTime;

    // Update blueprint metadata with final values
    blueprint.metadata = {
      generatedAt: new Date().toISOString(),
      totalCost: Math.round(totalCost * 10000) / 10000, // Round to 4 decimal places
      processingTime: totalTime,
    };

    updateProgress("complete");

    return {
      success: true,
      blueprint,
      metadata: {
        totalTime,
        totalCost,
        stageTimings,
      },
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error occurred";

    // Determine which stage failed
    const failedStage: PipelineStage = completedStages.length === 0
      ? "extract"
      : completedStages.length === 1
        ? "research"
        : completedStages.length === 2
          ? "logic"
          : completedStages.length === 3
            ? "synthesize"
            : "complete";

    updateProgress(failedStage, errorMessage);

    return {
      success: false,
      error: errorMessage,
      metadata: {
        totalTime: Date.now() - startTime,
        totalCost,
        stageTimings,
      },
    };
  }
}

// Re-export types for convenience
export type { PipelineProgress, PipelineResult, PipelineStage } from "../types";
