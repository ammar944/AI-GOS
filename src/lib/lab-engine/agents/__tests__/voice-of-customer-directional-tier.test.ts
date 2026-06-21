import { describe, expect, it } from "vitest";

import { stampDirectionalVoiceOfCustomerEvidenceTier } from "../run-section";

function rows(value: unknown, key: string): Array<{ evidenceTier?: unknown }> {
  const block = value as Record<string, unknown>;
  return block[key] as Array<{ evidenceTier?: unknown }>;
}

describe("stampDirectionalVoiceOfCustomerEvidenceTier", () => {
  it("stamps directional_signal on quote-bearing rows that lack a tier, leaving existing tiers and prose intact", () => {
    const body: Record<string, unknown> = {
      painLanguage: {
        quotes: [
          { verbatimText: "too slow", sourceUrl: "https://www.g2.com/x" },
          { verbatimText: "already tiered", evidenceTier: "hard_evidence" },
        ],
      },
      successLanguage: { quotes: [{ verbatimText: "love it" }] },
      objections: { items: [{ verbatimText: "too pricey" }] },
      switchingStories: { stories: [{ verbatimText: "moved off X" }] },
      decisionCriteria: { criteria: [{ evidenceQuote: "needs SSO" }] },
      strategicInsight: { strategicVerdict: "lead with speed" },
    };

    stampDirectionalVoiceOfCustomerEvidenceTier(body);

    expect(rows(body.painLanguage, "quotes")[0].evidenceTier).toBe(
      "directional_signal",
    );
    // an existing tier is never downgraded
    expect(rows(body.painLanguage, "quotes")[1].evidenceTier).toBe(
      "hard_evidence",
    );
    expect(rows(body.successLanguage, "quotes")[0].evidenceTier).toBe(
      "directional_signal",
    );
    expect(rows(body.objections, "items")[0].evidenceTier).toBe(
      "directional_signal",
    );
    expect(rows(body.switchingStories, "stories")[0].evidenceTier).toBe(
      "directional_signal",
    );
    expect(rows(body.decisionCriteria, "criteria")[0].evidenceTier).toBe(
      "directional_signal",
    );
    // derived prose blocks are untouched (claim-inert, no verbatimText mutation)
    expect((body.strategicInsight as { strategicVerdict: string }).strategicVerdict).toBe(
      "lead with speed",
    );
  });

  it("is a no-op on a body with no quote blocks", () => {
    const body: Record<string, unknown> = {
      strategicInsight: { strategicVerdict: "x" },
    };
    expect(() =>
      stampDirectionalVoiceOfCustomerEvidenceTier(body),
    ).not.toThrow();
    expect(body).toEqual({ strategicInsight: { strategicVerdict: "x" } });
  });
});
