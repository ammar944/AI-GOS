// Keyword-tool result helpers extracted from run-section.ts in Phase 5.
// Pure functions over AgentStep tool results; re-exported from run-section.ts
// so external consumers (keyword-volume-succeeded.test.ts) are untouched.

import type { AgentStep } from "./section-agent";

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractResultKeywordNames(output: unknown): readonly string[] {
  if (!isObjectRecord(output) || output.type !== "result") {
    return [];
  }

  const keywords = output.keywords;

  if (!Array.isArray(keywords)) {
    return [];
  }

  return keywords.flatMap((keyword) => {
    if (
      isObjectRecord(keyword) &&
      typeof keyword.keyword === "string" &&
      keyword.keyword.trim().length > 0
    ) {
      return [keyword.keyword];
    }

    return [];
  });
}

function keywordToolResultKeywords({
  modelSteps,
  toolName,
}: {
  modelSteps: readonly AgentStep[];
  toolName: "keyword_trends" | "keyword_volume";
}): readonly string[] {
  return modelSteps.flatMap((step) =>
    step.toolResults.flatMap((toolResult) => {
      if (toolResult.toolName !== toolName) {
        return [];
      }

      return extractResultKeywordNames(toolResult.output);
    }),
  );
}

export function keywordVolumeKeywords(modelSteps: readonly AgentStep[]): readonly string[] {
  return keywordToolResultKeywords({ modelSteps, toolName: "keyword_volume" });
}

export function keywordTrendKeywords(modelSteps: readonly AgentStep[]): readonly string[] {
  return keywordToolResultKeywords({ modelSteps, toolName: "keyword_trends" });
}

/**
 * True iff at least one keyword_volume result returned a named keyword. Kept
 * for focused tests and telemetry-style checks; provenance validation uses the
 * row-scoped keyword list above.
 */
export function keywordVolumeSucceeded(modelSteps: readonly AgentStep[]): boolean {
  return keywordVolumeKeywords(modelSteps).length > 0;
}

export function keywordTrendsSucceeded(modelSteps: readonly AgentStep[]): boolean {
  return keywordTrendKeywords(modelSteps).length > 0;
}
