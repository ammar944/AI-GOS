import { describe, expect, it } from "vitest";

import cleanMarketCategoryFixture from "../__evals__/fixtures/ramp-market-category.json";
import fabricatedPriceFixture from "../__evals__/fixtures/synthetic-fabricated-price.json";
import fabricatedQuoteFixture from "../__evals__/fixtures/synthetic-fabricated-quote.json";
import {
  deriveGroundedConfidence,
  evaluateEvidenceSupport,
  getMaxUnsupportedAllowed,
  stripMisattributedQuoteAttributions,
} from "../evidence-support";
import { structuralVerifier } from "../structural-verifier";
import type { VerificationReport } from "../types";

interface VerifierFixture {
  body: Record<string, unknown>;
  toolResults: Array<{
    toolName: string;
    input?: unknown;
    output: unknown;
  }>;
  corpusExcerpts: Array<{
    text: string;
    sourceUrl: string;
  }>;
}

function buildFixtureReport(fixture: VerifierFixture): VerificationReport {
  return structuralVerifier({
    body: fixture.body,
    toolResults: fixture.toolResults,
    corpusExcerpts: fixture.corpusExcerpts,
  });
}

describe("evaluateEvidenceSupport", (): void => {
  it("returns unsupported numeric claims from the fabricated price fixture", (): void => {
    const shortfall = evaluateEvidenceSupport({
      verification: buildFixtureReport(fabricatedPriceFixture),
    });

    expect(shortfall.unsupportedLoadBearing).toHaveLength(1);
    expect(shortfall.unsupportedLoadBearing[0]?.claim).toEqual(
      expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
    );
    expect(shortfall.issues).toEqual([
      'numeric claim "$99/mo" is not supported by any fetched source or corpus excerpt - cite a real source for it or remove it / restate it as a data gap.',
    ]);
  });

  it("returns unsupported source URLs as load-bearing issues", (): void => {
    const report = structuralVerifier({
      body: {
        proof: {
          sourceUrl: "https://fabricated.example/pricing",
        },
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            text: "The actual pricing page is available.",
            url: "https://example.com/pricing",
          },
        },
      ],
      corpusExcerpts: [],
    });
    const shortfall = evaluateEvidenceSupport({ verification: report });

    expect(shortfall.unsupportedLoadBearing).toHaveLength(1);
    expect(shortfall.unsupportedLoadBearing[0]?.claim).toEqual(
      expect.objectContaining({
        kind: "url",
        value: "https://fabricated.example/pricing",
      }),
    );
  });

  it("does not gate unsupported quote-only claims", (): void => {
    const shortfall = evaluateEvidenceSupport({
      verification: buildFixtureReport(fabricatedQuoteFixture),
    });

    expect(shortfall.unsupportedLoadBearing).toHaveLength(0);
    expect(shortfall.issues).toEqual([]);
  });

  it("gates unsupported quote claims when quotes are explicitly load-bearing", (): void => {
    const report = buildFixtureReport(fabricatedQuoteFixture);
    const defaultShortfall = evaluateEvidenceSupport({ verification: report });
    const vocShortfall = evaluateEvidenceSupport({
      verification: report,
      loadBearingKinds: ["numeric", "url", "quote"],
    });

    // Default scope (numeric + url) leaves the unsupported quote ungated...
    expect(defaultShortfall.unsupportedLoadBearing).toHaveLength(0);
    // ...but an explicit numeric + url + quote scope gates it.
    expect(vocShortfall.unsupportedLoadBearing.length).toBeGreaterThan(0);
    expect(
      vocShortfall.unsupportedLoadBearing.some(
        (verdict) => verdict.claim.kind === "quote",
      ),
    ).toBe(true);
  });

  it("returns no issues for a clean fixture", (): void => {
    const shortfall = evaluateEvidenceSupport({
      verification: buildFixtureReport(cleanMarketCategoryFixture),
    });

    expect(shortfall.unsupportedLoadBearing).toHaveLength(0);
    expect(shortfall.issues).toEqual([]);
  });

  it("scopes the paid-media gate to url claims, ignoring unsupported numbers", (): void => {
    const report = structuralVerifier({
      body: {
        plan: {
          budget: "$99/mo",
          sourceUrl: "https://fabricated.example/plan",
        },
      },
      toolResults: [],
      corpusExcerpts: [],
    });

    const defaultShortfall = evaluateEvidenceSupport({ verification: report });
    const urlOnlyShortfall = evaluateEvidenceSupport({
      verification: report,
      loadBearingKinds: ["url"],
    });

    // Default scope (numeric + url) flags the fabricated $99/mo number.
    expect(
      defaultShortfall.unsupportedLoadBearing.some(
        (verdict) => verdict.claim.kind === "numeric",
      ),
    ).toBe(true);
    // url-only scope drops the numeric and keeps only the fabricated url.
    expect(urlOnlyShortfall.unsupportedLoadBearing.length).toBeGreaterThan(0);
    expect(
      urlOnlyShortfall.unsupportedLoadBearing.every(
        (verdict) => verdict.claim.kind === "url",
      ),
    ).toBe(true);
  });

  it("flags count attribution when digits are absent from its asserted source URL", (): void => {
    const report = structuralVerifier({
      body: {
        clusters: {
          venues: [
            {
              name: "Airtable Community",
              audienceSize: "450,000+ members",
              sourceUrl: "https://community.airtable.com/t5/forums",
            },
          ],
        },
      },
      corpusExcerpts: [
        {
          sourceUrl: "https://community.airtable.com/t5/forums",
          text: "Airtable community discussions and help topics.",
        },
      ],
      toolResults: [],
    });
    const shortfall = evaluateEvidenceSupport({ verification: report });

    expect(shortfall.unsupportedLoadBearing).toHaveLength(0);
    expect(shortfall.provenanceFlags).toEqual([
      expect.objectContaining({
        reason: "no-source",
        value: "450,000+ members",
      }),
    ]);
  });

  it("does not verify count attribution against an unrelated pooled source", (): void => {
    const report = structuralVerifier({
      body: {
        keywordDemand: {
          keywords: [
            {
              keyword: "open source database",
              monthlyVolume: "85K searches",
              sourceUrl: "https://baserow.io/community",
            },
          ],
        },
      },
      corpusExcerpts: [
        {
          sourceUrl: "https://baserow.io/community",
          text: "Baserow community forum without public keyword volume.",
        },
      ],
      toolResults: [
        {
          toolName: "web_search",
          output: {
            text: "An unrelated SaaS category page says 85K subscribers.",
          },
        },
      ],
    });
    const shortfall = evaluateEvidenceSupport({ verification: report });

    expect(shortfall.provenanceFlags).toEqual([
      expect.objectContaining({
        reason: "no-source",
        value: "85K searches",
      }),
    ]);
  });

  it("trusts operator-marked economics and tight economics user fields only", (): void => {
    const operatorReport = structuralVerifier({
      body: {
        budget: "The operator-supplied derived budget is $26.25K.",
      },
      corpusExcerpts: [],
      toolResults: [],
    });
    const economicsFieldReport: VerificationReport = {
      claims: [
        {
          claim: {
            kind: "numeric",
            raw: "Target ACV is $75K.",
            value: "$75K",
          },
          entailmentVerdict: "user_asserted",
          matchedSourceRef: { kind: "userProvided", field: "economics.acv" },
          status: "verified",
        },
      ],
      unsupportedCount: 0,
      verifiedCount: 1,
    };
    const phoneFieldReport: VerificationReport = {
      claims: [
        {
          claim: {
            kind: "numeric",
            raw: "Community has 82 comments.",
            value: "82",
          },
          entailmentVerdict: "user_asserted",
          matchedSourceRef: { kind: "userProvided", field: "phone" },
          status: "verified",
        },
      ],
      unsupportedCount: 0,
      verifiedCount: 1,
    };

    expect(
      evaluateEvidenceSupport({ verification: operatorReport }).provenanceFlags,
    ).toEqual([]);
    expect(
      evaluateEvidenceSupport({ verification: economicsFieldReport })
        .provenanceFlags,
    ).toEqual([]);
    expect(
      evaluateEvidenceSupport({ verification: phoneFieldReport })
        .provenanceFlags,
    ).toEqual([
      expect.objectContaining({
        reason: "no-source",
        value: "82",
      }),
    ]);
  });

  it("flags known-platform quote source URLs with mismatched hosts outside load-bearing scope", (): void => {
    const report = structuralVerifier({
      body: {
        publicWeaknesses: {
          items: [
            {
              verbatimQuote: "missing table stakes",
              source: "G2",
              sourceUrl: "https://baserow.io/reviews",
            },
          ],
        },
      },
      corpusExcerpts: [
        {
          sourceUrl: "https://baserow.io/reviews",
          text: "A buyer wrote missing table stakes after comparing tools.",
        },
      ],
      toolResults: [],
    });
    const shortfall = evaluateEvidenceSupport({
      verification: report,
      loadBearingKinds: ["numeric", "url"],
    });

    expect(shortfall.unsupportedLoadBearing).toHaveLength(0);
    expect(shortfall.provenanceFlags).toEqual([
      expect.objectContaining({
        reason: "misattributed",
        value: "missing table stakes",
      }),
    ]);
  });

  it("does not flag known-platform quote source URLs with accepted hosts", (): void => {
    const report = structuralVerifier({
      body: {
        publicWeaknesses: {
          items: [
            {
              verbatimQuote: "missing table stakes",
              source: "G2",
              sourceUrl: "https://www.g2.com/products/acme/reviews",
            },
            {
              verbatimQuote: "hard to administer",
              source: "Reddit",
              sourceUrl: "https://old.reddit.com/r/sales/comments/example",
            },
          ],
        },
      },
      corpusExcerpts: [
        {
          sourceUrl: "https://www.g2.com/products/acme/reviews",
          text: "The G2 review says missing table stakes.",
        },
        {
          sourceUrl: "https://old.reddit.com/r/sales/comments/example",
          text: "The Reddit thread says hard to administer.",
        },
      ],
      toolResults: [],
    });
    const shortfall = evaluateEvidenceSupport({ verification: report });

    expect(shortfall.provenanceFlags).toEqual([]);
  });

  it("keeps empty-body verification as honest insufficient without provenance flags", (): void => {
    const shortfall = evaluateEvidenceSupport({
      verification: {
        claims: [],
        unsupportedCount: 0,
        verifiedCount: 0,
      },
    });

    expect(shortfall.provenanceFlags).toEqual([]);
    expect(deriveGroundedConfidence({
      unsupportedCount: 0,
      verifiedCount: 0,
    })).toBe(0);
  });
});

describe("deriveGroundedConfidence", (): void => {
  it("returns 0 when nothing is grounded (0 verified / 18 unsupported)", (): void => {
    expect(
      deriveGroundedConfidence({ verifiedCount: 0, unsupportedCount: 18 }),
    ).toBe(0);
  });

  it("returns 1 when every load-bearing claim is verified", (): void => {
    expect(
      deriveGroundedConfidence({ verifiedCount: 7, unsupportedCount: 0 }),
    ).toBe(1);
  });

  it("returns the verified ratio for a mixed report", (): void => {
    expect(
      deriveGroundedConfidence({ verifiedCount: 3, unsupportedCount: 1 }),
    ).toBe(0.75);
  });

  it("falls back to 0 when the verifier extracted zero claims", (): void => {
    expect(
      deriveGroundedConfidence({ verifiedCount: 0, unsupportedCount: 0 }),
    ).toBe(0);
  });

  it("lowers confidence for provenance flags on otherwise verified claims", (): void => {
    expect(
      deriveGroundedConfidence(
        { verifiedCount: 1, unsupportedCount: 0 },
        {
          issues: [],
          provenanceFlags: [
            {
              detail: "possible misattribution",
              reason: "misattributed",
              value: "missing table stakes",
            },
          ],
          unsupportedLoadBearing: [],
        },
      ),
    ).toBeLessThan(1);
  });
});

describe("getMaxUnsupportedAllowed", (): void => {
  it("returns Infinity when the verifier threshold is unset, empty, or invalid", (): void => {
    expect(getMaxUnsupportedAllowed({})).toBe(Infinity);
    expect(
      getMaxUnsupportedAllowed({ LAB_VERIFIER_MAX_UNSUPPORTED: "" }),
    ).toBe(Infinity);
    expect(
      getMaxUnsupportedAllowed({ LAB_VERIFIER_MAX_UNSUPPORTED: "not-a-number" }),
    ).toBe(Infinity);
    expect(
      getMaxUnsupportedAllowed({ LAB_VERIFIER_MAX_UNSUPPORTED: "-1" }),
    ).toBe(Infinity);
  });

  it("returns the configured integer verifier threshold", (): void => {
    expect(
      getMaxUnsupportedAllowed({ LAB_VERIFIER_MAX_UNSUPPORTED: "0" }),
    ).toBe(0);
    expect(
      getMaxUnsupportedAllowed({ LAB_VERIFIER_MAX_UNSUPPORTED: "2" }),
    ).toBe(2);
  });
});

describe("stripMisattributedQuoteAttributions", (): void => {
  function weaknessItems(
    body: Record<string, unknown>,
  ): Array<Record<string, unknown>> {
    const weaknesses = body.publicWeaknesses as {
      items: Array<Record<string, unknown>>;
    };

    return weaknesses.items;
  }

  it("relabels a G2-claimed quote whose sourceUrl is a vendor blog to the actual host", (): void => {
    const body = {
      publicWeaknesses: {
        items: [
          {
            competitor: "Baserow",
            verbatimQuote: "missing table stakes",
            source: "G2",
            sourceUrl: "https://baserow.io/reviews",
            whyItMatters: "Buyers churn over missing basics.",
          },
        ],
      },
    };

    const result = stripMisattributedQuoteAttributions({
      body,
      relabelSource: ({ actualHost }) => actualHost,
    });

    expect(weaknessItems(result.body)[0]?.source).toBe("baserow.io");
    expect(result.stripped).toEqual([
      {
        actualHost: "baserow.io",
        claimedPlatform: "g2",
        claimedSource: "G2",
        field: "source",
        path: "body.publicWeaknesses.items[0]",
        relabeledTo: "baserow.io",
        value: "missing table stakes",
      },
    ]);
    // The input body is never mutated — the strip works on a clone.
    expect(weaknessItems(body)[0]?.source).toBe("G2");
  });

  it("relabels VoC enum sources via the section relabeler (g2 -> other)", (): void => {
    const result = stripMisattributedQuoteAttributions({
      body: {
        painLanguage: {
          quotes: [
            {
              verbatimText: "the CRM sync constantly breaks for us",
              source: "g2",
              sourceUrl: "https://airtable.com/blog/customer-stories",
              painTheme: "reliability",
              painIntensity: "high",
            },
          ],
        },
      },
      relabelSource: () => "other",
    });

    const quotes = (
      result.body.painLanguage as { quotes: Array<Record<string, unknown>> }
    ).quotes;

    expect(quotes[0]?.source).toBe("other");
    expect(result.stripped).toEqual([
      expect.objectContaining({
        actualHost: "airtable.com",
        claimedPlatform: "g2",
        claimedSource: "g2",
        relabeledTo: "other",
        value: "the CRM sync constantly breaks for us",
      }),
    ]);
  });

  it("relabels a platform-keyed asserted source when no source field exists", (): void => {
    const result = stripMisattributedQuoteAttributions({
      body: {
        threads: [
          {
            quote: "support takes a week to answer anything",
            platform: "Reddit",
            sourceUrl: "https://example.com/why-we-switched",
          },
        ],
      },
      relabelSource: ({ actualHost }) => actualHost,
    });

    const threads = result.body.threads as Array<Record<string, unknown>>;

    expect(threads[0]?.platform).toBe("example.com");
    expect(result.stripped).toEqual([
      expect.objectContaining({
        claimedPlatform: "reddit",
        field: "platform",
        path: "body.threads[0]",
      }),
    ]);
  });

  it("leaves matching-host platform attributions untouched and returns the same body", (): void => {
    const body = {
      publicWeaknesses: {
        items: [
          {
            verbatimQuote: "missing table stakes",
            source: "G2",
            sourceUrl: "https://www.g2.com/products/acme/reviews",
          },
          {
            verbatimQuote: "hard to administer at scale",
            source: "Reddit",
            sourceUrl: "https://old.reddit.com/r/sales/comments/example",
          },
        ],
      },
    };

    const result = stripMisattributedQuoteAttributions({
      body,
      relabelSource: ({ actualHost }) => actualHost,
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toBe(body);
  });

  it("leaves non-platform sources and unattributable records untouched", (): void => {
    const body = {
      quotes: [
        {
          verbatimText: "we ripped out three tools after onboarding",
          source: "sales-call",
          sourceUrl: "https://example.com/notes",
        },
        {
          verbatimText: "their CSM team is genuinely responsive",
          source: "Company blog",
          sourceUrl: "https://vendor.example/blog",
        },
        {
          verbatimQuote: "quote with no sourceUrl is skipped",
          source: "G2",
        },
        {
          verbatimQuote: "quote with unparseable url is skipped",
          source: "G2",
          sourceUrl: "not-a-url",
        },
      ],
    };

    const result = stripMisattributedQuoteAttributions({
      body,
      relabelSource: ({ actualHost }) => actualHost,
    });

    expect(result.stripped).toEqual([]);
    expect(result.body).toBe(body);
  });

  it("strips every offending record, not just the first", (): void => {
    const result = stripMisattributedQuoteAttributions({
      body: {
        painLanguage: {
          quotes: [
            {
              verbatimText: "billing surprises every quarter",
              source: "g2",
              sourceUrl: "https://vendor-a.example/blog",
            },
            {
              verbatimText: "billing surprises every quarter",
              source: "reddit",
              sourceUrl: "https://vendor-b.example/blog",
            },
          ],
        },
      },
      relabelSource: () => "other",
    });

    expect(result.stripped).toHaveLength(2);
    expect(
      (
        result.body.painLanguage as {
          quotes: Array<Record<string, unknown>>;
        }
      ).quotes.map((quote) => quote.source),
    ).toEqual(["other", "other"]);
  });
});
