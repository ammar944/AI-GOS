import { describe, expect, it } from "vitest";

import { withNormalizedVoiceOfCustomerOutput } from "../run-section";

function vocOutput(body: Record<string, unknown>): Record<string, unknown> {
  return {
    sectionTitle: "Voice of Customer & Objection Evidence",
    verdict: "verdict",
    statusSummary: "status",
    confidence: 0.5,
    sources: [
      { title: "Source", url: "https://g2.com/x", publisher: "g2.com" },
    ],
    body,
  };
}

function bodyOf(output: unknown): Record<string, unknown> {
  return (output as { body: Record<string, unknown> }).body;
}

describe("withNormalizedVoiceOfCustomerOutput blockGap coercion", (): void => {
  it("drops a null blockGap (DeepSeek 'absent' near-miss)", (): void => {
    const body = bodyOf(
      withNormalizedVoiceOfCustomerOutput(
        vocOutput({
          successLanguage: { prose: "p", quotes: [], blockGap: null },
        }),
      ),
    );

    expect(body.successLanguage).toEqual({ prose: "p", quotes: [] });
  });

  it("coerces numeric-string counts and wraps a bare-string sourcingPlan", (): void => {
    const body = bodyOf(
      withNormalizedVoiceOfCustomerOutput(
        vocOutput({
          objections: {
            prose: "p",
            items: [],
            blockGap: {
              summary: "No independent objection language surfaced.",
              foundCount: "0",
              requiredCount: "5",
              sourcingPlan: "Mine competitor G2 comparison categories.",
            },
          },
        }),
      ),
    );

    expect(body.objections).toEqual({
      prose: "p",
      items: [],
      blockGap: {
        summary: "No independent objection language surfaced.",
        foundCount: 0,
        requiredCount: 5,
        sourcingPlan: ["Mine competitor G2 comparison categories."],
      },
    });
  });

  it("drops unknown keys inside a blockGap (strict shape survives)", (): void => {
    const body = bodyOf(
      withNormalizedVoiceOfCustomerOutput(
        vocOutput({
          decisionCriteria: {
            prose: "p",
            criteria: [],
            blockGap: {
              summary: "s",
              foundCount: 0,
              requiredCount: 5,
              sourcingPlan: ["plan"],
              confidence: 0.4,
              note: "stray",
            },
          },
        }),
      ),
    );

    expect(
      (body.decisionCriteria as Record<string, unknown>).blockGap,
    ).toEqual({
      summary: "s",
      foundCount: 0,
      requiredCount: 5,
      sourcingPlan: ["plan"],
    });
  });

  it("strips a model-authored blockGap from painLanguage (pain has no escape)", (): void => {
    const body = bodyOf(
      withNormalizedVoiceOfCustomerOutput(
        vocOutput({
          painLanguage: {
            prose: "p",
            quotes: [],
            blockGap: {
              summary: "s",
              foundCount: 0,
              requiredCount: 6,
              sourcingPlan: ["plan"],
            },
          },
        }),
      ),
    );

    expect(body.painLanguage).toEqual({ prose: "p", quotes: [] });
  });

  it("leaves a well-formed blockGap and blocks without blockGap untouched", (): void => {
    const wellFormed = {
      summary: "s",
      foundCount: 1,
      requiredCount: 3,
      sourcingPlan: ["plan"],
    };
    const body = bodyOf(
      withNormalizedVoiceOfCustomerOutput(
        vocOutput({
          switchingStories: { prose: "p", stories: [], blockGap: wellFormed },
          objections: { prose: "p", items: [] },
        }),
      ),
    );

    expect(
      (body.switchingStories as Record<string, unknown>).blockGap,
    ).toEqual(wellFormed);
    expect(body.objections).toEqual({ prose: "p", items: [] });
  });
});
