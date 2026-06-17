import { describe, expect, it } from "vitest";

import { buildVoiceOfCustomerShortfallPainQuotes } from "../run-section";
import type { VoiceOfCustomerCandidate } from "../voice-of-customer-candidates";

// Sparse VoC sourcing-shortfall mode only promotes captured extracts into the
// pain-language block. Secondary blocks must stay honest blockGaps so a sparse
// quote pack is never fanned out as fake objections / switching stories /
// decision criteria. These tests keep the pain classifier precise.

function candidate(
  partial: Partial<VoiceOfCustomerCandidate> & { snippet: string; url: string },
): VoiceOfCustomerCandidate {
  return {
    acquisitionMode: "review_body",
    source: "reviews",
    evidenceKind: "review",
    title: "Review",
    domain: "g2.com",
    ...partial,
  };
}

// A pack with a positive/after-state snippet mixed in, plus six distinct pain
// vocabularies so multiple themes emerge.
const mixedPack: VoiceOfCustomerCandidate[] = [
  candidate({
    url: "https://www.g2.com/products/x/reviews/1",
    domain: "g2.com",
    snippet:
      "The pricing is way too expensive for what you get and the billing is confusing.",
  }),
  candidate({
    url: "https://www.capterra.com/reviews/2",
    domain: "capterra.com",
    snippet:
      "Support never responds — I waited a week for a ticket reply and got ignored.",
  }),
  candidate({
    url: "https://www.trustpilot.com/reviews/3",
    domain: "trustpilot.com",
    snippet:
      "It crashes constantly and is painfully slow, total nightmare to rely on.",
  }),
  candidate({
    url: "https://www.reddit.com/r/saas/comments/4",
    domain: "reddit.com",
    snippet:
      "The integration with our CRM keeps breaking and the API sync drops records.",
  }),
  candidate({
    url: "https://news.ycombinator.com/item?id=5",
    domain: "news.ycombinator.com",
    snippet:
      "It's confusing and hard to use, the onboarding learning curve is steep.",
  }),
  candidate({
    url: "https://www.g2.com/products/x/reviews/6",
    domain: "g2.com",
    snippet: "Missing the one feature we need; there is no way to export tags.",
  }),
  // After-state / positive snippet — MUST be excluded from pain.
  candidate({
    url: "https://www.capterra.com/reviews/7",
    domain: "capterra.com",
    snippet:
      "After switching, approvals now take seconds and the team finally has real-time visibility — we love it.",
  }),
];

describe("VoC pain classification (Gap 2)", () => {
  it("excludes positive / after-state snippets from the pain quotes", () => {
    const quotes = buildVoiceOfCustomerShortfallPainQuotes(mixedPack);

    // 6 pain candidates promoted; the 7th (positive/after-state) is dropped.
    expect(quotes).toHaveLength(6);
    expect(
      quotes.map((quote) => quote.verbatimText),
    ).not.toContain(mixedPack[6]?.snippet);
  });

  it("assigns at least 3 distinct themes for a 6-quote pack (not one repeated theme)", () => {
    const quotes = buildVoiceOfCustomerShortfallPainQuotes(mixedPack);
    const themes = new Set(quotes.map((quote) => quote.painTheme));

    expect(themes.size).toBeGreaterThanOrEqual(3);
  });

  it("derives painIntensity from snippet sentiment, not row position", () => {
    const quotes = buildVoiceOfCustomerShortfallPainQuotes(mixedPack);

    // The "nightmare ... total" reliability snippet (index 2) is high-severity
    // even though it is not in the first positional bucket the old code used.
    const nightmare = quotes.find((quote) =>
      String(quote.verbatimText).includes("nightmare"),
    );
    expect(nightmare?.painIntensity).toBe("high");
  });
});

describe("VoC sparse-gap promotion", () => {
  it("keeps pain quotes empty when there are no candidates", () => {
    expect(buildVoiceOfCustomerShortfallPainQuotes([])).toEqual([]);
  });
});
