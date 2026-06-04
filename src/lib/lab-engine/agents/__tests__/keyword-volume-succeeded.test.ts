import { describe, expect, it } from "vitest";

import {
  keywordTrendKeywords,
  keywordTrendsSucceeded,
  keywordVolumeKeywords,
  keywordVolumeSucceeded,
} from "../run-section";
import type { AgentStep } from "../section-agent";

function buildStep(toolResults: AgentStep["toolResults"]): AgentStep {
  return {
    stepNumber: 1,
    finishReason: "stop",
    text: "",
    toolCalls: [],
    toolResults,
  };
}

describe("keywordVolumeSucceeded", (): void => {
  it("returns true when a keyword_volume result output is present", (): void => {
    const steps: AgentStep[] = [
      buildStep([
        {
          toolName: "keyword_volume",
          output: {
            type: "result",
            source: "SpyFu",
            keywords: [
              { keyword: "founder sales", searchVolume: 320, cpc: 4.1, difficulty: 22 },
            ],
          },
        },
      ]),
    ];

    expect(keywordVolumeSucceeded(steps)).toBe(true);
    expect(keywordVolumeKeywords(steps)).toEqual(["founder sales"]);
  });

  it("returns false when keyword_volume result has no returned keywords", (): void => {
    const steps: AgentStep[] = [
      buildStep([
        {
          toolName: "keyword_volume",
          output: {
            type: "result",
            source: "SpyFu",
            keywords: [],
          },
        },
      ]),
    ];

    expect(keywordVolumeSucceeded(steps)).toBe(false);
    expect(keywordVolumeKeywords(steps)).toEqual([]);
  });

  it("returns false when keyword_volume returned a gap (rate-limited)", (): void => {
    const steps: AgentStep[] = [
      buildStep([
        {
          toolName: "keyword_volume",
          output: {
            type: "gap",
            reason: "rate_limited",
            message: "SpyFu keyword volume failed: 429",
          },
        },
      ]),
    ];

    expect(keywordVolumeSucceeded(steps)).toBe(false);
  });

  it("returns false when keyword_volume was never called", (): void => {
    const steps: AgentStep[] = [
      buildStep([{ toolName: "web_search", output: { type: "result" } }]),
    ];

    expect(keywordVolumeSucceeded(steps)).toBe(false);
  });
});

describe("keywordTrendsSucceeded", (): void => {
  it("returns true when a keyword_trends result output is present", (): void => {
    const steps: AgentStep[] = [
      buildStep([
        {
          toolName: "keyword_trends",
          output: {
            type: "result",
            source: "SearchAPI Google Trends",
            keywords: [
              {
                keyword: "founder sales",
                averageInterest: 42,
                peakInterest: 80,
                trendDirection: "rising",
              },
            ],
          },
        },
      ]),
    ];

    expect(keywordTrendsSucceeded(steps)).toBe(true);
    expect(keywordTrendKeywords(steps)).toEqual(["founder sales"]);
  });

  it("returns false when keyword_trends returned a gap", (): void => {
    const steps: AgentStep[] = [
      buildStep([
        {
          toolName: "keyword_trends",
          output: {
            type: "gap",
            reason: "api_error",
            message: "SearchAPI Google Trends failed: 429",
          },
        },
      ]),
    ];

    expect(keywordTrendsSucceeded(steps)).toBe(false);
  });

  it("returns false when keyword_trends result has no returned keywords", (): void => {
    const steps: AgentStep[] = [
      buildStep([
        {
          toolName: "keyword_trends",
          output: {
            type: "result",
            source: "SearchAPI Google Trends",
            keywords: [],
          },
        },
      ]),
    ];

    expect(keywordTrendsSucceeded(steps)).toBe(false);
    expect(keywordTrendKeywords(steps)).toEqual([]);
  });
});
