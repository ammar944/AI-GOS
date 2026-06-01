import { describe, expect, it } from "vitest";

import { keywordVolumeSucceeded } from "../run-section";
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
