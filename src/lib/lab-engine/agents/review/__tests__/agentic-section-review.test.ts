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
const mockDeepSeekModel = {
  modelId: "deepseek-v4-flash",
  provider: "deepseek.chat",
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
    vi.useRealTimers();
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

  it("treats user-supplied economics provenance as grounded client brief context", async (): Promise<void> => {
    aiMocks.generateText.mockResolvedValue({
      text: [
        "## Reviewed market category",
        "",
        "The client-supplied ACV remains in the economics context.",
        '<review_metadata>{"tier":"verified","tierRationale":"User-supplied economics are grounded as client brief context.","removedItems":[],"clientQuestions":[]}</review_metadata>',
      ].join("\n"),
    });

    await reviewAndUpgradeSection({
      artifact: marketCategoryFixtureArtifact,
      model: mockModel,
      researchInput: {
        ...saaslaunchResearchInput,
        onboarding: {
          ...saaslaunchResearchInput.onboarding,
          economics: {
            acv: "$40,000",
            avgSalesCycle: "90 days",
            provenance: {
              acv: "user-supplied",
              avgSalesCycle: "user-supplied",
            },
          },
        },
      },
      sectionId: "positioningMarketCategory",
    });

    const prompt = aiMocks.generateText.mock.calls[0]?.[0]?.prompt;
    expect(prompt).toContain(
      'Treat ResearchInput fields marked `provenance: "user-supplied"` as grounded client brief',
    );
    expect(prompt).toContain('"acv": "$40,000"');
    expect(prompt).toContain('"acv": "user-supplied"');
    expect(prompt).toContain(
      "flag those numbers as unsupported merely because no public source repeats them",
    );
  });

  it("disables thinking for DeepSeek review calls", async (): Promise<void> => {
    aiMocks.generateText.mockResolvedValue({
      text: [
        "## Reviewed market category",
        "",
        "The section is grounded enough to use.",
        '<review_metadata>{"tier":"verified","tierRationale":"Claims are supported by supplied sources.","removedItems":[],"clientQuestions":[]}</review_metadata>',
      ].join("\n"),
    });

    await reviewAndUpgradeSection({
      artifact: marketCategoryFixtureArtifact,
      model: mockDeepSeekModel,
      researchInput: saaslaunchResearchInput,
      sectionId: "positioningMarketCategory",
    });

    expect(aiMocks.generateText).toHaveBeenCalledWith(
      expect.objectContaining({
        providerOptions: {
          deepseek: {
            thinking: { type: "disabled" },
          },
        },
      }),
    );
  });

  it("marks review unavailable and preserves model diagnostics when a non-null artifact review fails", async (): Promise<void> => {
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

    const result = await reviewAndUpgradeSection({
      artifact: marketCategoryFixtureArtifact,
      model: mockModel,
      researchInput: saaslaunchResearchInput,
      sectionId: "positioningMarketCategory",
    });

    expect(result.tier).toBe("unavailable");
    expect(result.tierRationale).toContain(
      "Failed to process successful response",
    );
    expect(result.errorDiagnostics).toEqual(
      expect.objectContaining({
        cause: "No object generated",
        message: "Failed to process successful response",
        name: "AI_NoObjectGeneratedError",
        responseBody: '{"finishReason":"stop"}',
        statusCode: 200,
      }),
    );
    expect(result.upgradedMarkdown).toBe(
      buildOriginalArtifactMarkdown(
        marketCategoryFixtureArtifact,
        "positioningMarketCategory",
      ),
    );
    expect(result.upgradedMarkdown).not.toContain("## Structured artifact");
    expect(result.upgradedMarkdown).not.toContain("```json");
  });

  it("marks review unavailable when a non-null artifact review timeout aborts", async (): Promise<void> => {
    vi.useFakeTimers();
    aiMocks.generateText.mockImplementation(
      ({ abortSignal }: { abortSignal?: AbortSignal }) =>
        new Promise((_, reject) => {
          abortSignal?.addEventListener("abort", () => {
            reject(abortSignal.reason);
          });
        }),
    );

    const pendingReview = reviewAndUpgradeSection({
      artifact: marketCategoryFixtureArtifact,
      model: mockModel,
      researchInput: saaslaunchResearchInput,
      sectionId: "positioningMarketCategory",
      timeoutMs: 5,
    });

    await vi.advanceTimersByTimeAsync(5);
    const result = await pendingReview;

    expect(result.tier).toBe("unavailable");
    expect(result.tierRationale).toContain(
      "Agentic section review exceeded 5ms timeout",
    );
    expect(result.errorDiagnostics).toEqual(
      expect.objectContaining({
        message: "Agentic section review exceeded 5ms timeout.",
        name: "Error",
      }),
    );
    expect(result.upgradedMarkdown).toBe(
      buildOriginalArtifactMarkdown(
        marketCategoryFixtureArtifact,
        "positioningMarketCategory",
      ),
    );
    expect(result.upgradedMarkdown).not.toContain("## Structured artifact");
    expect(result.upgradedMarkdown).not.toContain("```json");
    vi.useRealTimers();
  });

  it("keeps null-artifact review fallback insufficient", async (): Promise<void> => {
    aiMocks.generateText.mockRejectedValue(new Error("review unavailable"));

    const result = await reviewAndUpgradeSection({
      artifact: null,
      model: mockModel,
      researchInput: saaslaunchResearchInput,
      sectionId: "positioningMarketCategory",
    });

    expect(result.tier).toBe("insufficient");
    expect(result.errorDiagnostics).toEqual(
      expect.objectContaining({
        message: "review unavailable",
        name: "Error",
      }),
    );
  });
});
