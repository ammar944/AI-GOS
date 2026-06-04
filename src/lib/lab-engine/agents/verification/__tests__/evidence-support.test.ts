import { describe, expect, it } from "vitest";

import cleanMarketCategoryFixture from "../__evals__/fixtures/ramp-market-category.json";
import fabricatedPriceFixture from "../__evals__/fixtures/synthetic-fabricated-price.json";
import fabricatedQuoteFixture from "../__evals__/fixtures/synthetic-fabricated-quote.json";
import {
  deriveGroundedConfidence,
  evaluateEvidenceSupport,
  getMaxUnsupportedAllowed,
  voiceOfCustomerLoadBearingKinds,
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

  it("gates unsupported quote claims under the VoC load-bearing scope", (): void => {
    const report = buildFixtureReport(fabricatedQuoteFixture);
    const defaultShortfall = evaluateEvidenceSupport({ verification: report });
    const vocShortfall = evaluateEvidenceSupport({
      verification: report,
      loadBearingKinds: voiceOfCustomerLoadBearingKinds,
    });

    // Default scope (numeric + url) leaves the unsupported quote ungated...
    expect(defaultShortfall.unsupportedLoadBearing).toHaveLength(0);
    // ...but the VoC scope (numeric + url + quote) gates it.
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
