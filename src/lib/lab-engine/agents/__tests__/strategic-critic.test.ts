import { beforeEach, describe, expect, it, vi } from "vitest";

import { crossSectionReasoningFixtureArtifact } from "@/lib/lab-engine/fixtures/cross-section-reasoning-artifact";
import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: aiMocks.generateText,
}));

import {
  applyCrossSectionStrategicCritic,
  parseCrossSectionStrategicCriticResponse,
} from "../strategic-critic";

const mockModel = {
  modelId: "strategy-model",
  provider: "anthropic.messages",
} as unknown as SectionLanguageModel;

function buildCriticResponse({
  body = crossSectionReasoningFixtureArtifact.body,
  items = [
    {
      action: "deepened",
      path: "body.crossSectionThreads[0].claim",
      rationale:
        "The final claim names the trade-off and second-order consequence.",
      text: body.crossSectionThreads[0]?.claim ?? "",
      verdict: "passes",
    },
    {
      action: "kept",
      path: "body.namedTension.side",
      rationale: "The final side chooses a position and its accepted cost.",
      text: body.namedTension.side,
      verdict: "passes",
    },
  ],
  summary = "The critic deepened the cross-section reasoning.",
}: {
  body?: typeof crossSectionReasoningFixtureArtifact.body;
  items?: Array<{
    action: "kept" | "deepened" | "cut";
    path: string;
    rationale: string;
    text: string;
    verdict: "passes" | "knew_that" | "too_vague" | "summary" | "unsupported";
  }>;
  summary?: string;
} = {}): string {
  return [
    "Strategic critic complete.",
    `<strategic_critic>${JSON.stringify({
      body,
      critique: {
        items,
        summary,
      },
    })}</strategic_critic>`,
  ].join("\n");
}

describe("cross-section strategic critic", (): void => {
  beforeEach((): void => {
    aiMocks.generateText.mockReset();
  });

  it("parses a critic response into an upgraded artifact", (): void => {
    const body = structuredClone(crossSectionReasoningFixtureArtifact.body);
    body.crossSectionThreads[0].claim =
      "Buyer urgency, competitor inertia, and customer anxiety collide around implementation delay, so the defensible wedge is a proof-backed time-to-first-campaign promise rather than a generic speed claim.";

    const artifact = parseCrossSectionStrategicCriticResponse({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      modelId: "claude-opus-4-5",
      text: buildCriticResponse({ body }),
    });

    expect(artifact.body.crossSectionThreads[0]?.claim).toContain(
      "proof-backed time-to-first-campaign",
    );
    expect(artifact.strategicCritique).toEqual(
      expect.objectContaining({
        checkedAt: "2026-06-04T13:00:00.000Z",
        modelId: "claude-opus-4-5",
        target: "cross_section_reasoning",
      }),
    );
  });

  it("rejects critic responses that introduce new source URLs", (): void => {
    const body = structuredClone(crossSectionReasoningFixtureArtifact.body);
    body.crossSectionThreads[0].sourceSections[0] = {
      ...body.crossSectionThreads[0].sourceSections[0],
      sourceUrl: "https://example.com/new-source",
    };

    expect(() =>
      parseCrossSectionStrategicCriticResponse({
        artifact: crossSectionReasoningFixtureArtifact,
        checkedAt: "2026-06-04T13:00:00.000Z",
        modelId: "claude-opus-4-5",
        text: buildCriticResponse({ body }),
      }),
    ).toThrow(/introduced unsupported source section ref/u);
  });

  it("rejects critic responses that reassign a source URL to another section", (): void => {
    const body = structuredClone(crossSectionReasoningFixtureArtifact.body);
    body.crossSectionThreads[0].sourceSections[0] = {
      sectionId: "positioningMarketCategory",
      sourceUrl:
        crossSectionReasoningFixtureArtifact.body.crossSectionThreads[0]
          .sourceSections[1]?.sourceUrl ?? "",
      sourceTitle: "Misassigned buyer source",
    };

    expect(() =>
      parseCrossSectionStrategicCriticResponse({
        artifact: crossSectionReasoningFixtureArtifact,
        checkedAt: "2026-06-04T13:00:00.000Z",
        modelId: "claude-opus-4-5",
        text: buildCriticResponse({ body }),
      }),
    ).toThrow(/positioningMarketCategory:https:\/\/example.com/u);
  });

  it("rejects top-level sources that were not existing body source refs", (): void => {
    const body = structuredClone(crossSectionReasoningFixtureArtifact.body);
    body.crossSectionThreads[0].sourceSections[0] = {
      sectionId: "positioningMarketCategory",
      sourceUrl: "https://example.com/cross-reasoning/top-level-only",
      sourceTitle: "Top-level only source",
    };

    expect(() =>
      parseCrossSectionStrategicCriticResponse({
        artifact: {
          ...crossSectionReasoningFixtureArtifact,
          sources: [
            ...crossSectionReasoningFixtureArtifact.sources,
            {
              id: "src_top_level_only",
              observedAt: "2026-06-04T12:00:00.000Z",
              title: "Top-Level Only Source",
              url: "https://example.com/cross-reasoning/top-level-only",
            },
          ],
        },
        checkedAt: "2026-06-04T13:00:00.000Z",
        modelId: "claude-opus-4-5",
        text: buildCriticResponse({ body }),
      }),
    ).toThrow(/top-level-only/u);
  });

  it("rejects kept or deepened metadata that does not match final body text", (): void => {
    expect(() =>
      parseCrossSectionStrategicCriticResponse({
        artifact: crossSectionReasoningFixtureArtifact,
        checkedAt: "2026-06-04T13:00:00.000Z",
        modelId: "claude-opus-4-5",
        text: buildCriticResponse({
          items: [
            {
              action: "deepened",
              path: "body.crossSectionThreads[0].claim",
              rationale: "This falsely claims a pass on text not in the body.",
              text: "A passing claim that is not present in the final body.",
              verdict: "passes",
            },
            {
              action: "kept",
              path: "body.namedTension.side",
              rationale: "The final side chooses a position and cost.",
              text: crossSectionReasoningFixtureArtifact.body.namedTension.side,
              verdict: "passes",
            },
          ],
        }),
      }),
    ).toThrow(/metadata does not map to final body/u);
  });

  it("persists critic metadata below the knew-that pass floor", (): void => {
    const artifact = parseCrossSectionStrategicCriticResponse({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      modelId: "claude-opus-4-5",
      text: buildCriticResponse({
        items: [
          {
            action: "kept",
            path: "body.crossSectionThreads[0].claim",
            rationale: "Only one item passes.",
            text: crossSectionReasoningFixtureArtifact.body.crossSectionThreads[0]
              .claim,
            verdict: "passes",
          },
          {
            action: "cut",
            path: "body.crossSectionThreads[1].claim",
            rationale: "This reads like a summary.",
            text: crossSectionReasoningFixtureArtifact.body.crossSectionThreads[1]
              .claim,
            verdict: "summary",
          },
          {
            action: "cut",
            path: "body.crossSectionThreads[2].claim",
            rationale: "This is too obvious.",
            text: crossSectionReasoningFixtureArtifact.body.crossSectionThreads[2]
              .claim,
            verdict: "knew_that",
          },
        ],
      }),
    });

    expect(artifact.body.belowFloor).toBe(true);
    expect(artifact.strategicCritique).toEqual(
      expect.objectContaining({
        belowFloor: true,
        items: expect.arrayContaining([
          expect.objectContaining({ verdict: "knew_that" }),
        ]),
      }),
    );
  });

  it("falls back to the original artifact with diagnostics when the critic model fails", async (): Promise<void> => {
    const providerError = Object.assign(
      new Error("Failed to process successful response"),
      {
        cause: new Error("No object generated"),
        name: "AI_NoObjectGeneratedError",
        responseBody: '{"finishReason":"stop"}',
        statusCode: 200,
      },
    );
    aiMocks.generateText.mockRejectedValue(providerError);

    const result = await applyCrossSectionStrategicCritic({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      model: mockModel,
      modelId: "claude-opus-4-5",
    });

    expect(result.outcome).toBe("fallback");
    expect(result.summary).toContain("Failed to process successful response");
    expect(result.errorDiagnostics).toEqual(
      expect.objectContaining({
        cause: "No object generated",
        message: "Failed to process successful response",
        name: "AI_NoObjectGeneratedError",
        responseBody: '{"finishReason":"stop"}',
        statusCode: 200,
      }),
    );
    expect(result.artifact).toBe(crossSectionReasoningFixtureArtifact);
    expect(result.artifact.strategicCritique).toBeUndefined();
  });

  it("falls back with diagnostics when the critic response is malformed", async (): Promise<void> => {
    aiMocks.generateText.mockResolvedValue({
      text: "Strategic critic complete, but no tagged JSON tail.",
    });

    const result = await applyCrossSectionStrategicCritic({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      model: mockModel,
      modelId: "claude-opus-4-5",
    });

    expect(result.outcome).toBe("fallback");
    expect(result.summary).toContain("missing <strategic_critic> tail");
    expect(result.errorDiagnostics).toEqual(
      expect.objectContaining({
        message: expect.stringContaining("missing <strategic_critic> tail"),
        name: "StrategicCriticError",
      }),
    );
    expect(result.artifact).toBe(crossSectionReasoningFixtureArtifact);
    expect(result.artifact.strategicCritique).toBeUndefined();
  });

  it("propagates caller aborts instead of falling back to a commit", async (): Promise<void> => {
    const controller = new AbortController();
    controller.abort(new Error("user aborted critic"));

    await expect(
      applyCrossSectionStrategicCritic({
        artifact: crossSectionReasoningFixtureArtifact,
        checkedAt: "2026-06-04T13:00:00.000Z",
        model: mockModel,
        modelId: "claude-opus-4-5",
        signal: controller.signal,
      }),
    ).rejects.toThrow("user aborted critic");
    expect(aiMocks.generateText).not.toHaveBeenCalled();
  });

  it("propagates caller aborts that happen while the critic is running", async (): Promise<void> => {
    const controller = new AbortController();
    aiMocks.generateText.mockImplementation(async () => {
      controller.abort(new Error("user aborted critic in flight"));
      return {
        text: buildCriticResponse(),
      };
    });

    await expect(
      applyCrossSectionStrategicCritic({
        artifact: crossSectionReasoningFixtureArtifact,
        checkedAt: "2026-06-04T13:00:00.000Z",
        model: mockModel,
        modelId: "claude-opus-4-5",
        signal: controller.signal,
      }),
    ).rejects.toThrow("user aborted critic in flight");
  });

  it("calls generateText with the strategy model and parses an upgraded body", async (): Promise<void> => {
    const body = structuredClone(crossSectionReasoningFixtureArtifact.body);
    body.contrarianInversion.claim =
      "The counterintuitive move is to advertise less of the platform first because a narrower promise creates proof faster and prevents the larger story from collapsing under trust objections.";
    aiMocks.generateText.mockResolvedValue({
      text: buildCriticResponse({ body }),
    });

    const result = await applyCrossSectionStrategicCritic({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      model: mockModel,
      modelId: "claude-opus-4-5",
    });

    expect(result.outcome).toBe("upgraded");
    expect(result.artifact.body.contrarianInversion.claim).toContain(
      "prevents the larger story",
    );
    expect(aiMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 12000,
        model: mockModel,
        prompt: expect.stringContaining("9/10 strategic rubric"),
        temperature: 0.1,
      }),
    );
  });

  it("sets DeepSeek strategy provider options only for the direct DeepSeek strategy transport", async (): Promise<void> => {
    aiMocks.generateText.mockResolvedValue({
      text: buildCriticResponse(),
    });

    await applyCrossSectionStrategicCritic({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      model: mockModel,
      modelId: "deepseek-v4-pro",
      modelTransport: "deepseek-direct",
    });

    expect(aiMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 12000,
        providerOptions: {
          deepseek: {
            thinking: { type: "disabled" },
          },
        },
      }),
    );
  });

  it("deepens once after a knew-that floor miss", async (): Promise<void> => {
    const firstBody = structuredClone(crossSectionReasoningFixtureArtifact.body);
    const retriedBody = structuredClone(crossSectionReasoningFixtureArtifact.body);
    retriedBody.crossSectionThreads[0].claim =
      "Buyer urgency, competitor inertia, and customer anxiety collide around implementation delay, so the defensible wedge is a proof-backed time-to-first-campaign promise rather than a generic speed claim.";
    aiMocks.generateText
      .mockResolvedValueOnce({
        text: buildCriticResponse({
          body: firstBody,
          items: [
            {
              action: "kept",
              path: "body.crossSectionThreads[0].claim",
              rationale: "This remained too obvious.",
              text: firstBody.crossSectionThreads[0]?.claim ?? "",
              verdict: "knew_that",
            },
            {
              action: "cut",
              path: "body.crossSectionThreads[1].claim",
              rationale: "This read like a summary.",
              text: firstBody.crossSectionThreads[1]?.claim ?? "",
              verdict: "summary",
            },
            {
              action: "cut",
              path: "body.crossSectionThreads[2].claim",
              rationale: "This was unsupported.",
              text: firstBody.crossSectionThreads[2]?.claim ?? "",
              verdict: "unsupported",
            },
          ],
        }),
      })
      .mockResolvedValueOnce({
        text: buildCriticResponse({ body: retriedBody }),
      });

    const result = await applyCrossSectionStrategicCritic({
      artifact: crossSectionReasoningFixtureArtifact,
      checkedAt: "2026-06-04T13:00:00.000Z",
      model: mockModel,
      modelId: "claude-opus-4-5",
    });

    expect(result.outcome).toBe("upgraded");
    expect(result.artifact.body.crossSectionThreads[0]?.claim).toContain(
      "proof-backed time-to-first-campaign",
    );
    expect(result.artifact.strategicCritique?.belowFloor).toBeUndefined();
    expect(aiMocks.generateText).toHaveBeenCalledTimes(2);
    expect(aiMocks.generateText.mock.calls[1]?.[0]?.prompt).toContain(
      "Deepen the AI-GOS cross-section reasoning artifact one more time.",
    );
  });
});
