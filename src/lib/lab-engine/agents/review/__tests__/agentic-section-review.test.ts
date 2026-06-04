import { beforeEach, describe, expect, it, vi } from "vitest";

import { marketCategoryFixtureArtifact } from "@/lib/lab-engine/fixtures/market-category-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import type { SectionLanguageModel } from "@/lib/lab-engine/ai/models";

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock("ai", () => ({
  generateText: aiMocks.generateText,
}));

import {
  buildOriginalArtifactMarkdown,
  parseSectionReviewResponse,
  reviewAndUpgradeSection,
} from "../agentic-section-review";

const mockModel = {
  modelId: "review-model",
  provider: "anthropic.messages",
} as unknown as SectionLanguageModel;

describe("parseSectionReviewResponse", (): void => {
  it("parses upgraded markdown plus the tiny metadata tail", (): void => {
    const result = parseSectionReviewResponse({
      fallbackMarkdown: "fallback",
      text: [
        "## Upgraded section",
        "",
        "This is the reviewed client narrative.",
        '<review_metadata>{"tier":"needs_review","tierRationale":"Thin VoC evidence.","removedItems":["Invented G2 quote"],"clientQuestions":["Can you share real churn-call notes?"]}</review_metadata>',
      ].join("\n"),
    });

    expect(result).toEqual({
      upgradedMarkdown:
        "## Upgraded section\n\nThis is the reviewed client narrative.",
      tier: "needs_review",
      tierRationale: "Thin VoC evidence.",
      removedItems: ["Invented G2 quote"],
      clientQuestions: ["Can you share real churn-call notes?"],
    });
  });

  it("rejects responses without the metadata tail", (): void => {
    expect(() =>
      parseSectionReviewResponse({
        fallbackMarkdown: "fallback",
        text: "## Upgraded section without metadata",
      }),
    ).toThrow(/missing <review_metadata>/u);
  });
});

describe("reviewAndUpgradeSection", (): void => {
  beforeEach((): void => {
    aiMocks.generateText.mockReset();
  });

  it("returns a parsed review result from generateText", async (): Promise<void> => {
    aiMocks.generateText.mockResolvedValue({
      text: [
        "## Reviewed market category",
        "",
        "The section is grounded enough to use.",
        '<review_metadata>{"tier":"verified","tierRationale":"Claims are supported by supplied sources.","removedItems":[],"clientQuestions":[]}</review_metadata>',
      ].join("\n"),
    });

    const result = await reviewAndUpgradeSection({
      artifact: marketCategoryFixtureArtifact,
      model: mockModel,
      researchInput: saaslaunchResearchInput,
      sectionId: "positioningMarketCategory",
    });

    expect(result.tier).toBe("verified");
    expect(result.upgradedMarkdown).toContain("Reviewed market category");
    expect(aiMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        maxOutputTokens: 8000,
        model: mockModel,
        temperature: 0.1,
      }),
    );
  });

  it("falls back to the original artifact markdown when the model call fails", async (): Promise<void> => {
    aiMocks.generateText.mockRejectedValue(new Error("No object generated"));

    const result = await reviewAndUpgradeSection({
      artifact: marketCategoryFixtureArtifact,
      model: mockModel,
      researchInput: saaslaunchResearchInput,
      sectionId: "positioningMarketCategory",
    });

    expect(result.tier).toBe("needs_review");
    expect(result.tierRationale).toContain("No object generated");
    expect(result.upgradedMarkdown).toBe(
      buildOriginalArtifactMarkdown(
        marketCategoryFixtureArtifact,
        "positioningMarketCategory",
      ),
    );
  });
});
