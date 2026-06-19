import { describe, expect, it } from "vitest";

import { voiceOfCustomerBodySchema } from "../../artifacts/schemas/voice-of-customer";
import { downgradeUnpermalinkedVocQuotes } from "../verification/provenance-gate";
import {
  buildVoiceOfCustomerEvidenceGapBody,
  buildVoiceOfCustomerShortfallNote,
  buildVoiceOfCustomerShortfallPainQuotes,
  getDirectionalVoiceOfCustomerCandidates,
  getVoiceOfCustomerCandidateEvidenceGapFacts,
} from "../run-section";
import type { VoiceOfCustomerCandidate } from "../voice-of-customer-candidates";

// Sparse VoC sourcing-shortfall mode promotes captured extracts into the
// pain-language block AND, ONLY when the directional pool exceeds the pain
// floor, carves the surplus DISJOINTLY into objections / switching stories /
// decision criteria (each quote feeds at most one block — never the c9bc2056
// slice-fan that laundered one verbatim into five blocks). A floor-sized (or
// smaller) pack keeps every surplus block as an honest blockGap.

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

// FIX-VOC directional COMMIT lane. A 2-domain pack of admissible-but-directional
// quotes (strict select returns ok:false on the >=3-domain floor) must COMMIT a
// directional body — pain quotes labeled directional — and the body must pass
// the schema validator instead of zeroing to an empty gap shell.
function directionalCandidate(
  partial: Partial<VoiceOfCustomerCandidate> & { snippet: string; url: string },
): VoiceOfCustomerCandidate {
  return candidate(partial);
}

describe("VoC directional COMMIT lane — 2-domain pack (TEST 1)", () => {
  // 8 admissible (per-review-permalink) pain quotes across exactly 2 domains —
  // strict selection ok:false on the 3-domain floor, but every quote is real.
  const twoDomainPack: VoiceOfCustomerCandidate[] = [
    directionalCandidate({
      url: "https://www.g2.com/products/x/reviews/p-1",
      domain: "g2.com",
      snippet:
        "The pricing is way too expensive for what you get and the billing is confusing.",
    }),
    directionalCandidate({
      url: "https://www.g2.com/products/x/reviews/p-2",
      domain: "g2.com",
      snippet:
        "Support never responds — I waited a week for a ticket reply and got ignored.",
    }),
    directionalCandidate({
      url: "https://www.g2.com/products/x/reviews/p-3",
      domain: "g2.com",
      snippet:
        "It crashes constantly and is painfully slow, a total nightmare to rely on.",
    }),
    directionalCandidate({
      url: "https://www.g2.com/products/x/reviews/p-4",
      domain: "g2.com",
      snippet:
        "The integration with our CRM keeps breaking and the API sync drops records.",
    }),
    directionalCandidate({
      url: "https://www.capterra.com/reviews/p-5",
      domain: "capterra.com",
      snippet:
        "It is confusing and hard to use; the onboarding learning curve is steep.",
    }),
    directionalCandidate({
      url: "https://www.capterra.com/reviews/p-6",
      domain: "capterra.com",
      snippet:
        "Missing the one feature we need; there is no way to export tags at all.",
    }),
    directionalCandidate({
      url: "https://www.capterra.com/reviews/p-7",
      domain: "capterra.com",
      snippet:
        "The handoff between teams keeps getting dropped and follow-up falls through.",
    }),
    directionalCandidate({
      url: "https://www.capterra.com/reviews/p-8",
      domain: "capterra.com",
      snippet:
        "Refunds are a nightmare and the charges on our invoice never reconcile.",
    }),
  ];

  function buildBody(): Record<string, unknown> {
    const facts = getVoiceOfCustomerCandidateEvidenceGapFacts({
      quoteCandidates: twoDomainPack,
      result: {
        ok: false,
        gap: {
          reason: "insufficient_independent_domains",
          message: "shortfall",
          domains: ["g2.com", "capterra.com"],
          candidateCount: twoDomainPack.length,
        },
      },
    });

    return buildVoiceOfCustomerEvidenceGapBody({
      facts,
      issue: "",
      quoteCandidates: twoDomainPack,
      subjectDomain: "acme.example",
    });
  }

  it("commits the directional pain quotes (not a zeroed gap body)", () => {
    const body = buildBody();
    const painLanguage = body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };

    expect(painLanguage.quotes.length).toBeGreaterThanOrEqual(6);
    expect(body.evidenceGap).toBe(true);
  });

  it("passes the voiceOfCustomerBodySchema validator", () => {
    const body = buildBody();
    const parsed = voiceOfCustomerBodySchema.safeParse(body);

    if (!parsed.success) {
      throw new Error(
        `directional body failed schema: ${parsed.error.issues
          .map((issue) => issue.message)
          .join("; ")}`,
      );
    }

    expect(parsed.success).toBe(true);
  });

  // TEST 2: when the directional pool EXCEEDS the pain floor, objections /
  // switching stories / decision criteria are populated from the SURPLUS with
  // DISJOINT partitioning — no quote/source feeds two blocks.
  it("populates secondary blocks DISJOINTLY from the surplus (TEST 2)", () => {
    const body = buildBody();
    const painLanguage = body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const objections = body.objections as {
      items: Array<Record<string, unknown>>;
    };
    const switchingStories = body.switchingStories as {
      stories: Array<Record<string, unknown>>;
    };
    const decisionCriteria = body.decisionCriteria as {
      criteria: Array<Record<string, unknown>>;
    };

    const secondaryCount =
      objections.items.length +
      switchingStories.stories.length +
      decisionCriteria.criteria.length;
    // An 8-quote pack has surplus above the 6-quote pain floor, so at least one
    // secondary block must carry directional content (the 86→9 throughput fix).
    expect(secondaryCount).toBeGreaterThanOrEqual(1);

    const usage = new Map<string, string[]>();
    const record = (block: string, sourceUrl: unknown, verbatim: unknown) => {
      const key = `${String(sourceUrl)}::${String(verbatim)}`;
      usage.set(key, [...(usage.get(key) ?? []), block]);
    };

    painLanguage.quotes.forEach((quote) =>
      record("pain", quote.sourceUrl, quote.verbatimText),
    );
    objections.items.forEach((item) =>
      record("objections", item.sourceUrl, item.objectionText),
    );
    switchingStories.stories.forEach((story) =>
      record("switching", story.sourceUrl, story.reasonToLeave),
    );
    decisionCriteria.criteria.forEach((criterion) =>
      record("decision", criterion.sourceUrl, criterion.evidenceQuote),
    );

    // DISJOINT: no (sourceUrl, verbatim) appears in two distinct blocks.
    for (const [key, blocks] of usage) {
      const distinctBlocks = new Set(blocks);
      expect(
        distinctBlocks.size,
        `quote ${key} laundered across blocks ${[...distinctBlocks].join(", ")}`,
      ).toBe(1);
    }
  });

  it("still passes the schema validator with secondary blocks populated", () => {
    const body = buildBody();
    expect(voiceOfCustomerBodySchema.safeParse(body).success).toBe(true);
  });
});

// TEST 4 (no-regression): a floor-sized (or smaller) directional pack keeps the
// surplus blocks as honest blockGaps — the disjoint carve only fires on surplus,
// so a 6-quote pack does NOT fan out fake objections (c9bc2056 guard).
describe("VoC directional COMMIT lane — floor-sized pack keeps empty blocks gapped (TEST 4 no-regression)", () => {
  it("does not populate secondary blocks for a 6-quote pack", () => {
    const body = buildVoiceOfCustomerEvidenceGapBody({
      facts: getVoiceOfCustomerCandidateEvidenceGapFacts({
        quoteCandidates: mixedPack,
        result: {
          ok: false,
          gap: {
            reason: "insufficient_candidates",
            message: "shortfall",
            domains: ["g2.com", "capterra.com", "trustpilot.com"],
            candidateCount: mixedPack.length,
          },
        },
      }),
      issue: "",
      quoteCandidates: mixedPack,
      subjectDomain: "acme.example",
    });

    const objections = body.objections as { items: unknown[] };
    const switchingStories = body.switchingStories as { stories: unknown[] };
    const decisionCriteria = body.decisionCriteria as { criteria: unknown[] };

    // mixedPack has exactly 6 pain candidates (= floor), so there is no surplus
    // to carve — every secondary block stays an honest blockGap.
    expect(objections.items).toHaveLength(0);
    expect(switchingStories.stories).toHaveLength(0);
    expect(decisionCriteria.criteria).toHaveLength(0);
    expect((body.objections as { blockGap?: unknown }).blockGap).toBeDefined();
    expect(
      (body.switchingStories as { blockGap?: unknown }).blockGap,
    ).toBeDefined();
    expect(
      (body.decisionCriteria as { blockGap?: unknown }).blockGap,
    ).toBeDefined();
  });
});
