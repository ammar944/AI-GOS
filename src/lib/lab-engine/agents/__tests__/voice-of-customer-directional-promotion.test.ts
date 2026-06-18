import { describe, expect, it } from "vitest";

import { downgradeUnpermalinkedVocQuotes } from "../verification/provenance-gate";
import {
  buildVoiceOfCustomerEvidenceGapBody,
  buildVoiceOfCustomerShortfallNote,
  buildVoiceOfCustomerShortfallPainQuotes,
  getDirectionalVoiceOfCustomerCandidates,
  getVoiceOfCustomerCandidateEvidenceGapFacts,
} from "../run-section";
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

// FIX-VOC directional lane: a clean independent-domain pain quote that lacks a
// per-review permalink (Trustpilot/TrustRadius/Reddit LISTING url) must be KEPT
// and labeled directional, not dropped before any surfacing. Without the
// directional tier the second domain disappears and the section renders one G2
// domain + empty blocks (4.5/10).
describe("VoC directional admission lane (FIX-VOC)", () => {
  const g2PermalinkQuote = candidate({
    url: "https://www.g2.com/products/x/reviews/x-review-99001",
    domain: "g2.com",
    snippet:
      "The pricing is way too expensive for what you get and the billing is confusing.",
  });
  // Clean human-voice pain quote on a Trustpilot LISTING url
  // (trustpilot.com/review/<domain>) — admissible on every check EXCEPT the
  // per-review-permalink shape. isAdmissibleQuote drops it today.
  const trustpilotListingQuote = candidate({
    url: "https://www.trustpilot.com/review/acme.example",
    domain: "trustpilot.com",
    snippet:
      "We struggled for months — the dashboard is painfully slow and support never responds.",
  });

  it("keeps the trusted-host listing-url quote as a directional candidate", () => {
    const directional = getDirectionalVoiceOfCustomerCandidates({
      candidates: [g2PermalinkQuote, trustpilotListingQuote],
      subjectDomain: "acme.example",
    });

    expect(directional.map((entry) => entry.url)).toEqual([
      g2PermalinkQuote.url,
      trustpilotListingQuote.url,
    ]);
  });

  it("carries both domains into the gap body with the listing quote downgraded, not dropped", () => {
    const directional = getDirectionalVoiceOfCustomerCandidates({
      candidates: [g2PermalinkQuote, trustpilotListingQuote],
      subjectDomain: "acme.example",
    });
    const facts = getVoiceOfCustomerCandidateEvidenceGapFacts({
      quoteCandidates: directional,
      result: {
        ok: false,
        gap: {
          reason: "insufficient_independent_domains",
          message: "shortfall",
          domains: ["g2.com", "trustpilot.com"],
          candidateCount: 2,
        },
      },
    });

    expect(facts.foundDistinctPainSourceCount).toBe(2);

    const body = buildVoiceOfCustomerEvidenceGapBody({
      facts,
      issue: "",
      quoteCandidates: directional,
      subjectDomain: "acme.example",
    });
    const painLanguage = body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };

    expect(painLanguage.quotes).toHaveLength(2);
    expect(painLanguage.quotes.map((quote) => quote.sourceUrl)).toContain(
      trustpilotListingQuote.url,
    );

    // The listing-url quote must be relabeled directional (paraphrase prefix),
    // never surfaced as independently-verified verbatim VoC.
    const downgraded = downgradeUnpermalinkedVocQuotes({ body });
    const downgradedPain = downgraded.body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const trustpilotQuote = downgradedPain.quotes.find(
      (quote) => quote.sourceUrl === trustpilotListingQuote.url,
    );
    expect(String(trustpilotQuote?.verbatimText)).toContain(
      "Paraphrased pattern (no per-review permalink):",
    );

    // The G2 per-review permalink quote stays verbatim (no directional prefix).
    const g2Quote = downgradedPain.quotes.find(
      (quote) => quote.sourceUrl === g2PermalinkQuote.url,
    );
    expect(String(g2Quote?.verbatimText)).not.toContain(
      "Paraphrased pattern (no per-review permalink):",
    );
  });
});

// R-D: the shortfall note framed a directional VoC pack as "verified" and
// contradicted itself by quoting the 6/3 bar even when the pack EXCEEDED it.
// The honest note states the quotes are directional (they failed verified
// admission), names the real reason (no per-review permalink), and drops the
// "Our bar is 6 quotes across 3 sites" line once the pack is over the floor.
describe("buildVoiceOfCustomerShortfallNote", () => {
  it("is honest when the pack EXCEEDS the floor: directional, real reason, no bar line", () => {
    const note = buildVoiceOfCustomerShortfallNote({
      ok: true,
      foundPainQuoteCount: 11,
      foundDistinctPainSourceCount: 5,
      observedPainSourceDomains: [
        "g2.com",
        "capterra.com",
        "trustpilot.com",
        "reddit.com",
        "trustradius.com",
      ],
    });

    expect(note).toContain("directional");
    expect(note).not.toContain("verified");
    // The self-contradicting "exceeds the bar yet directional" line is dropped.
    expect(note).not.toContain("Our bar is 6 quotes");
    // The real reason for directional status is the missing permalink.
    expect(note.toLowerCase()).toContain("permalink");
  });

  it("keeps an honest under-floor line when the pack is genuinely below the bar", () => {
    const note = buildVoiceOfCustomerShortfallNote({
      ok: true,
      foundPainQuoteCount: 2,
      foundDistinctPainSourceCount: 1,
      observedPainSourceDomains: ["g2.com"],
    });

    expect(note).toContain("directional");
    expect(note).not.toContain("verified");
    // Genuinely under the floor → an honest under-floor line is allowed.
    expect(note).toContain("6 quotes");
  });
});
