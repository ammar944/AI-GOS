import { describe, expect, it } from "vitest";

import cleanMarketCategoryFixture from "../__evals__/fixtures/ramp-market-category.json";
import fabricatedPriceFixture from "../__evals__/fixtures/synthetic-fabricated-price.json";
import fabricatedQuoteFixture from "../__evals__/fixtures/synthetic-fabricated-quote.json";
import {
  collectBriefMoneyDigits,
  deriveClaimSupportCountsForTrust,
  deriveGroundedConfidence,
  evaluateEvidenceSupport,
  getMaxUnsupportedAllowed,
  redactUnsupportedNumericClaims,
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

function buildUnsupportedNumericReport(
  values: readonly string[],
): VerificationReport {
  return {
    claims: values.map((value) => ({
      claim: {
        kind: "numeric" as const,
        raw: `Unsupported numeric claim ${value}`,
        value,
      },
      reason: "no_match" as const,
      status: "unsupported" as const,
    })),
    unsupportedCount: values.length,
    verifiedCount: 0,
  };
}

function buildMixedNumericReport({
  unsupported,
  verified,
}: {
  unsupported: readonly string[];
  verified: readonly string[];
}): VerificationReport {
  return {
    claims: [
      ...verified.map((value) => ({
        claim: {
          kind: "numeric" as const,
          raw: `Verified numeric claim ${value}`,
          value,
        },
        matchedSourceRef: {
          kind: "toolResult" as const,
          stepIndex: 0,
          toolName: "fixture_support",
        },
        status: "verified" as const,
      })),
      ...unsupported.map((value) => ({
        claim: {
          kind: "numeric" as const,
          raw: `Unsupported numeric claim ${value}`,
          value,
        },
        reason: "no_match" as const,
        status: "unsupported" as const,
      })),
    ],
    unsupportedCount: unsupported.length,
    verifiedCount: verified.length,
  };
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

  it("returns unsupported source-scoped prose as a load-bearing issue", (): void => {
    const report = structuralVerifier({
      body: {
        structuralForces: {
          forces: [
            {
              evidence:
                "Microsoft Power Apps in E5 and Google AppSheet in Workspace are bundled at zero marginal cost.",
              sourceUrl: "https://about.google/appsheet/",
            },
          ],
        },
      },
      toolResults: [
        {
          toolName: "web_search",
          output: {
            sourceUrl: "https://about.google/appsheet/",
            text:
              "Google AppSheet helps Google Workspace users create low-code apps.",
          },
        },
      ],
      corpusExcerpts: [],
    });
    const shortfall = evaluateEvidenceSupport({ verification: report });

    expect(shortfall.unsupportedLoadBearing).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: expect.objectContaining({ kind: "sourceAttribution" }),
        }),
      ]),
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

    // Default scope leaves the unsupported quote ungated...
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

describe("redactUnsupportedNumericClaims", (): void => {
  it("strips model-authored verified markers even without unsupported numeric claims", (): void => {
    const body = {
      statusSummary:
        "The claim is [verified: vendor docs] useful, while the next sentence stays [unverified].",
      rawSourceSamples: [{ text: "Source said [verified: do not alter raw]." }],
      quote: "A buyer said [verified: leave quoted evidence untouched].",
      sourceUrl: "https://example.com/[verified]",
    };
    const result = redactUnsupportedNumericClaims({
      body,
      verification: buildUnsupportedNumericReport([]),
    });
    const redacted = result.body as typeof body;

    expect(redacted.statusSummary).toBe(
      "The claim is useful, while the next sentence stays [unverified].",
    );
    expect(redacted.rawSourceSamples).toEqual(body.rawSourceSamples);
    expect(redacted.quote).toBe(body.quote);
    expect(redacted.sourceUrl).toBe(body.sourceUrl);
    expect(result.stripped).toEqual([
      {
        action: "verified-marker-removed",
        field: "body.statusSummary",
        value: "[verified: vendor docs]",
      },
    ]);
  });

  it("records unsupported numeric tokens as metadata without touching the body string", (): void => {
    const body = {
      statusSummary:
        "The community claims 450K members and another 450K members in launch copy.",
    };
    const report = buildUnsupportedNumericReport(["450K members"]);

    const first = redactUnsupportedNumericClaims({
      body,
      verification: report,
    });
    const firstBody = first.body as { statusSummary: string };
    const second = redactUnsupportedNumericClaims({
      body: first.body,
      verification: report,
    });
    const secondBody = second.body as { statusSummary: string };

    // The body string ships unchanged: no inline [unverified] splice, no
    // aggregate footnote — the claim is carried as metadata only.
    expect(firstBody.statusSummary).toBe(body.statusSummary);
    expect(first.stripped).toEqual([
      {
        action: "recorded",
        field: "body.statusSummary",
        value: "450K members",
      },
    ]);
    // Re-running is deterministic: same untouched body, same metadata.
    expect(secondBody.statusSummary).toBe(body.statusSummary);
    expect(second.stripped).toEqual(first.stripped);
  });

  it("strips fake verified markers and records unsupported numeric ranges", (): void => {
    const body = {
      statusSummary:
        "Reachable revenue is $1.3M–$2.6M [verified: SpyFu] based on demand.",
    };
    const result = redactUnsupportedNumericClaims({
      body,
      verification: buildUnsupportedNumericReport(["$1.3M–$2.6M"]),
    });
    const redacted = result.body as typeof body;

    // The fake [verified] marker is removed; the range itself stays in the
    // prose unmarked and is recorded as metadata.
    expect(redacted.statusSummary).toBe(
      "Reachable revenue is $1.3M–$2.6M based on demand.",
    );
    expect(result.stripped).toEqual([
      {
        action: "verified-marker-removed",
        field: "body.statusSummary",
        value: "[verified: SpyFu]",
      },
      {
        action: "recorded",
        field: "body.statusSummary",
        value: "$1.3M–$2.6M",
      },
    ]);
  });

  it("leaves verified numerics and exempt source/verbatim/raw fields untouched", (): void => {
    const body = {
      statusSummary: "Pricing is $99/mo and the forum claims 450K members.",
      sourceUrl: "450K members",
      url: "450K members",
      verbatimText: "450K members",
      evidenceQuote: "450K members",
      quote: "450K members",
      rawSourceSamples: [{ text: "450K members" }],
    };
    const report = buildMixedNumericReport({
      unsupported: ["450K members"],
      verified: ["$99/mo"],
    });

    const result = redactUnsupportedNumericClaims({
      body,
      verification: report,
    });
    const redacted = result.body as typeof body;

    expect(redacted.statusSummary).toBe(
      "Pricing is $99/mo and the forum claims 450K members.",
    );
    expect(redacted.sourceUrl).toBe("450K members");
    expect(redacted.url).toBe("450K members");
    expect(redacted.verbatimText).toBe("450K members");
    expect(redacted.evidenceQuote).toBe("450K members");
    expect(redacted.quote).toBe("450K members");
    expect(redacted.rawSourceSamples).toEqual([{ text: "450K members" }]);
    expect(result.stripped).toEqual([
      {
        action: "recorded",
        field: "body.statusSummary",
        value: "450K members",
      },
    ]);

    const verifiedOnlyBody = {
      statusSummary: "Pricing is $99/mo.",
    };
    const verifiedOnly = redactUnsupportedNumericClaims({
      body: verifiedOnlyBody,
      verification: buildMixedNumericReport({
        unsupported: [],
        verified: ["$99/mo"],
      }),
    });

    expect(verifiedOnly.body).toBe(verifiedOnlyBody);
    expect(verifiedOnly.stripped).toEqual([]);
  });

  it("relabels unsourced bottom-up TAM inputs without deleting the recipe row", (): void => {
    const body = {
      marketSize: {
        bottomUpTam: {
          inputs: [
            {
              inputType: "monthly-search-volume",
              label: "Monthly search demand",
              sourceTitle: "Keyword volume fixture",
              status: "sourced",
              value: "450K members",
            },
          ],
          reachableRevenueEstimate:
            "evidence gap: $1.09M reachable revenue until recipe inputs are sourced.",
        },
      },
    };
    const [firstInput] = body.marketSize.bottomUpTam.inputs;

    if (firstInput === undefined) {
      throw new Error("Expected bottom-up TAM fixture inputs.");
    }

    firstInput.status = "sourced";
    firstInput.value = "450K members";
    body.marketSize.bottomUpTam.reachableRevenueEstimate =
      "evidence gap: $1.09M reachable revenue until recipe inputs are sourced.";

    const result = redactUnsupportedNumericClaims({
      body,
      verification: buildUnsupportedNumericReport([
        "450K members",
        "$1.09M",
      ]),
    });
    const redactedBody = result.body as typeof body;
    const redactedInput =
      redactedBody.marketSize.bottomUpTam.inputs[0];

    expect(redactedInput?.status).toBe("evidence-gap");
    expect(redactedInput?.value).toBe(
      "evidence gap: monthly-search-volume unsourced",
    );
    // The estimate keeps its existing evidence-gap label; the unsupported
    // figure inside it is recorded as metadata, never marker-spliced.
    expect(
      redactedBody.marketSize.bottomUpTam.reachableRevenueEstimate,
    ).toBe(
      "evidence gap: $1.09M reachable revenue until recipe inputs are sourced.",
    );
    expect(result.stripped).toEqual([
      {
        action: "evidence-gap",
        field: "body.marketSize.bottomUpTam.inputs[0].value",
        value: "450K members",
      },
      {
        action: "recorded",
        field: "body.marketSize.bottomUpTam.reachableRevenueEstimate",
        value: "$1.09M",
      },
    ]);
  });

  it("downgrades unearned user-supplied money provenance to model-estimated", (): void => {
    const body = {
      campaignOverview: {
        monthlyBudget: "$99,999 / Month",
        monthlyBudgetValue: 99_999,
        monthlyBudgetProvenance: "model-estimated",
        dailySpend: "$3,333 / day",
        dailySpendValue: 3_333,
        dailySpendProvenance: "user-supplied",
      },
    };

    // No brief money values: the model-asserted "user-supplied" label is
    // unearned and downgrades to "model-estimated" (display string and
    // numeric value stay); untrusted provenance still snaps to "unknown".
    const result = redactUnsupportedNumericClaims({
      body,
      verification: buildUnsupportedNumericReport(["$99,999", "$3,333"]),
    });
    const overview = (result.body.campaignOverview ??
      {}) as Record<string, unknown>;

    expect(overview.monthlyBudget).toBe("$99,999 / Month");
    expect(overview.monthlyBudgetProvenance).toBe("unknown");
    expect(overview).not.toHaveProperty("monthlyBudgetValue");
    expect(overview.dailySpend).toBe("$3,333 / day");
    expect(overview.dailySpendProvenance).toBe("model-estimated");
    expect(overview.dailySpendValue).toBe(3_333);
    expect(result.stripped).toEqual([
      {
        action: "provenance-unknown",
        field: "body.campaignOverview.monthlyBudget",
        value: "$99,999",
      },
      {
        action: "provenance-downgraded",
        field: "body.campaignOverview.dailySpend",
        value: "$3,333",
      },
    ]);
  });

  it("keeps code-derived paid-media money values even when their numeric token is unsupported", (): void => {
    const body = {
      campaignOverview: {
        dailySpend: "$3,333/day",
        dailySpendValue: 3_333,
        dailySpendProvenance: "derived",
      },
    };

    const result = redactUnsupportedNumericClaims({
      body,
      verification: buildUnsupportedNumericReport(["$3,333"]),
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });

  it("keeps user-supplied money provenance when the figure appears in the brief economics", (): void => {
    const body = {
      campaignOverview: {
        dailySpend: "$3,333 / day",
        dailySpendValue: 3_333,
        dailySpendProvenance: "user-supplied",
      },
    };

    const result = redactUnsupportedNumericClaims({
      body,
      briefMoneyDigits: collectBriefMoneyDigits({
        monthlyAdBudget: "$100k/month (about $3,333 a day)",
      }),
      verification: buildUnsupportedNumericReport(["$3,333"]),
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });

  it("expands brief magnitude shorthand when earning user-supplied provenance", (): void => {
    const body = {
      campaignOverview: {
        monthlyBudget: "$5,000 / Month",
        monthlyBudgetProvenance: "user-supplied",
      },
    };

    const result = redactUnsupportedNumericClaims({
      body,
      briefMoneyDigits: collectBriefMoneyDigits({ monthlyAdBudget: "$5k" }),
      verification: buildUnsupportedNumericReport(["$5,000"]),
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });

  it("excludes paid-media own cascade money and prescriptions from trust counts while retaining fabricated benchmarks", (): void => {
    const body = {
      campaignOverview: {
        dailySpend: "$833/day",
        dailySpendValue: 833,
        dailySpendProvenance: "derived",
        prose: "A fabricated CAC benchmark is $12,000.",
      },
      audienceTypes: [
        {
          dailyBudget: "$500/day",
          dailyBudgetValue: 500,
          dailyBudgetProvenance: "derived",
        },
        {
          dailyBudget: "$200/day",
          dailyBudgetValue: 200,
          dailyBudgetProvenance: "derived",
        },
      ],
      channelSuggestions: [
        {
          recommendation:
            "Increase LinkedIn budget to 20% if enterprise trial CVR exceeds bottoms-up by 2x.",
        },
      ],
    };
    const report: VerificationReport = {
      claims: [
        ...["one", "two", "three", "four"].map((value) => ({
          claim: {
            kind: "quote" as const,
            raw: `Verified claim ${value}`,
            value: `Verified claim ${value}`,
          },
          matchedSourceRef: {
            excerptIndex: 0,
            kind: "corpusExcerpt" as const,
            sourceUrl: "https://example.com/source",
          },
          status: "verified" as const,
        })),
        ...[
          { raw: "$833/day", value: "$833/day" },
          { raw: "$500/day", value: "$500" },
          { raw: "$200/day", value: "$200" },
          {
            raw:
              "Increase LinkedIn budget to 20% if enterprise trial CVR exceeds bottoms-up by 2x.",
            value: "20%",
          },
          {
            raw: "A fabricated CAC benchmark is $12,000.",
            value: "$12,000",
          },
        ].map(({ raw, value }) => ({
          claim: {
            kind: "numeric" as const,
            raw,
            value,
          },
          reason: "no_match" as const,
          status: "unsupported" as const,
        })),
      ],
      unsupportedCount: 5,
      verifiedCount: 4,
    };

    expect(
      deriveClaimSupportCountsForTrust({
        body,
        briefMoneyDigits: collectBriefMoneyDigits({
          monthlyAdBudget: "$25,000/month",
        }),
        report,
        sectionId: "positioningPaidMediaPlan",
      }),
    ).toEqual({
      unsupportedCount: 1,
      verifiedCount: 4,
    });
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

describe("redactUnsupportedNumericClaims body-untouched contract", (): void => {
  function proseAfterRedaction({
    prose,
    unsupported,
  }: {
    prose: string;
    unsupported: readonly string[];
  }): { prose: string; stripped: ReturnType<typeof redactUnsupportedNumericClaims>["stripped"] } {
    const result = redactUnsupportedNumericClaims({
      body: { marketSize: { prose } },
      verification: buildUnsupportedNumericReport(unsupported),
    });

    return {
      prose: (result.body.marketSize as { prose: string }).prose,
      stripped: result.stripped,
    };
  }

  it("records a standalone token but never an embedded match inside a longer word", (): void => {
    const result = proseAfterRedaction({
      prose: "Trackers run $450/month on ten seats; the audit cites $450/mo directly.",
      unsupported: ["$450/mo"],
    });

    expect(result.prose).toBe(
      "Trackers run $450/month on ten seats; the audit cites $450/mo directly.",
    );
    expect(result.stripped).toEqual([
      {
        action: "recorded",
        field: "body.marketSize.prose",
        value: "$450/mo",
      },
    ]);
  });

  it("records a standalone token but never a match inside a larger comma-grouped figure", (): void => {
    const result = proseAfterRedaction({
      prose: "The shelf lists 1,300 products while the niche holds 300 buyers.",
      unsupported: ["300"],
    });

    expect(result.prose).toBe(
      "The shelf lists 1,300 products while the niche holds 300 buyers.",
    );
    expect(result.stripped).toEqual([
      {
        action: "recorded",
        field: "body.marketSize.prose",
        value: "300",
      },
    ]);
  });

  it("does not record a token glued to a percent sign (different figure)", (): void => {
    const result = proseAfterRedaction({
      prose: "Coverage of 100% is claimed on the pricing page.",
      unsupported: ["100"],
    });

    expect(result.prose).toBe("Coverage of 100% is claimed on the pricing page.");
    expect(result.stripped).toEqual([]);
  });

  it("records every distinct present token once per field with no cap, footnote, or splice", (): void => {
    const prose =
      "Growth of 17% on 240 accounts produced $9.2M against a $48 CPC baseline.";
    const result = proseAfterRedaction({
      prose,
      unsupported: ["17%", "240", "$9.2M", "$48"],
    });

    expect(result.prose).toBe(prose);
    expect(result.prose).not.toContain("[unverified]");
    expect(result.prose).not.toContain("see section badge");
    expect(result.stripped).toHaveLength(4);
    expect(
      result.stripped.every((entry) => entry.action === "recorded"),
    ).toBe(true);
  });

  it("records repeated occurrences of one token as a single metadata entry", (): void => {
    const prose =
      "Plans run $48 monthly, renew at $48, expand at $48, and cap at $48.";
    const result = proseAfterRedaction({
      prose,
      unsupported: ["$48"],
    });

    expect(result.prose).toBe(prose);
    expect(result.stripped).toEqual([
      {
        action: "recorded",
        field: "body.marketSize.prose",
        value: "$48",
      },
    ]);
  });

  it("records across all fields with no section-wide budget and leaves every body string unchanged", (): void => {
    const body = {
      alpha: { prose: "Adoption hit 17% with 240 accounts and $9.2M booked." },
      beta: { prose: "Pipeline added 55% more, 610 leads, and $4.1M closed." },
      gamma: { prose: "Churn fell 12% across 980 accounts." },
    };
    const result = redactUnsupportedNumericClaims({
      body,
      verification: buildUnsupportedNumericReport([
        "17%",
        "240",
        "$9.2M",
        "55%",
        "610",
        "$4.1M",
        "12%",
        "980",
      ]),
    });
    const redacted = result.body as typeof body;

    expect(redacted.alpha.prose).toBe(body.alpha.prose);
    expect(redacted.beta.prose).toBe(body.beta.prose);
    expect(redacted.gamma.prose).toBe(body.gamma.prose);
    expect(JSON.stringify(result.body)).not.toContain("[unverified]");
    expect(result.stripped).toHaveLength(8);
    expect(
      result.stripped.every((entry) => entry.action === "recorded"),
    ).toBe(true);
    expect(
      result.stripped.filter((entry) => entry.field === "body.gamma.prose"),
    ).toEqual([
      { action: "recorded", field: "body.gamma.prose", value: "12%" },
      { action: "recorded", field: "body.gamma.prose", value: "980" },
    ]);
  });
});
