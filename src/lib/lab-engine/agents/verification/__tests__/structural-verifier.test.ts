import { describe, expect, it, vi } from "vitest";

import {
  structuralVerifier,
  structuralVerifierWithEntailment,
  type EntailmentJudge,
} from "../structural-verifier";

describe("structuralVerifier", (): void => {
  it("credits onboarding economics as user-asserted support", (): void => {
    const report = structuralVerifier({
      body: {
        economics: {
          monthlyBudget: "$75,000 monthly ad budget",
          targetCac: "$8K target CAC",
          demoToClose: "20% demo-to-close rate",
        },
      },
      toolResults: [],
      corpusExcerpts: [],
      onboarding: {
        economics: {
          monthlyAdBudget: "$75,000",
          targetCac: "$8K",
          demoToClose: "20%",
        },
      },
    });

    expect(report.unsupportedCount).toBe(0);
    expect(report.verifiedCount).toBeGreaterThanOrEqual(3);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$75,000" }),
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({
            kind: "userProvided",
            field: "economics.monthlyAdBudget",
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$8K" }),
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({
            kind: "userProvided",
            field: "economics.targetCac",
          }),
        }),
      ]),
    );
  });

  it("verifies numeric, quote, url, and entity-name claims against tool results and corpus excerpts", (): void => {
    const report = structuralVerifier({
      body: {
        competitorSet: {
          competitors: [
            {
              name: "Gong",
              sourceUrl: "https://www.gong.io/pricing",
              evidence:
                'Gong says "setup takes two weeks before forecast views stabilize" and references 200M interactions.',
            },
          ],
        },
        pricingReality: {
          dataPoints: [
            {
              competitor: "Gong",
              price: "$49.00/mo",
              sourceUrl: "https://www.gong.io/pricing",
            },
          ],
        },
      },
      toolResults: [
        {
          toolName: "web_search",
          input: { q: "Gong pricing" },
          output: {
            url: "https://www.gong.io/pricing",
            text:
              "Gong pricing includes a $49/mo plan. Gong reports 200 million interactions. Buyers say setup takes two weeks before forecast views stabilize.",
          },
        },
      ],
      corpusExcerpts: [
        {
          text: "Gong is a revenue intelligence competitor in this category.",
          sourceUrl: "https://www.gong.io/pricing",
        },
      ],
    });

    expect(report.unsupportedCount).toBe(0);
    expect(report.verifiedCount).toBeGreaterThanOrEqual(5);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$49.00/mo" }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "web_search",
            stepIndex: 0,
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "quote" }),
          matchedSourceRef: expect.objectContaining({ kind: "toolResult" }),
        }),
      ]),
    );
  });

  it("flags fabricated numeric and quote claims as unsupported", (): void => {
    const report = structuralVerifier({
      body: {
        pricingReality: {
          dataPoints: [{ price: "$99/mo", sourceUrl: "https://example.com/pricing" }],
        },
        proof: '"customers recover implementation costs in the first week"',
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            sourceUrl: "https://example.com/pricing",
            markdown: "Pricing starts at $49/mo. Customers report annual payback.",
          },
        },
      ],
      corpusExcerpts: [],
    });

    expect(report.unsupportedCount).toBe(2);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
          reason: "no_match",
        }),
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({
            kind: "quote",
            value: "customers recover implementation costs in the first week",
          }),
          reason: "no_match",
        }),
      ]),
    );
  });

  it("credits operator-self-labeled economics as user_asserted even when derived", (): void => {
    const report = structuralVerifier({
      body: {
        channelBudget:
          "Operator-supplied 35% of $75K/mo budget ($26.25K/mo) allocated to paid search.",
      },
      toolResults: [],
      corpusExcerpts: [],
    });

    // The derived $26.25K is not in any public source, but the claim self-labels
    // as operator-supplied, so it is honestly user_asserted (not unsupported).
    expect(report.unsupportedCount).toBe(0);
    expect(report.verifiedCount).toBeGreaterThanOrEqual(1);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({ kind: "userProvided" }),
        }),
      ]),
    );
  });

  it("does not rescue genuinely-inferred or undisclosed claims", (): void => {
    const report = structuralVerifier({
      body: {
        retentionHealth:
          "Inferred average ACV ~$14.3K. Ramp does not publicly disclose churn or NDR.",
      },
      toolResults: [],
      corpusExcerpts: [],
    });

    expect(report.verifiedCount).toBe(0);
    expect(report.unsupportedCount).toBeGreaterThanOrEqual(1);
    expect(
      report.claims.every((verdict) => verdict.status === "unsupported"),
    ).toBe(true);
  });

  it("uses a single batched entailment judge for paraphrase support and refuted numbers", async (): Promise<void> => {
    const judge = vi.fn<EntailmentJudge>(async ({ claims }) => ({
      verdicts: claims.map((claim, claimIndex) => ({
        claimIndex,
        verdict: claim.value === "$49/mo" ? "supported" : "refuted",
        ...(claim.value === "$49/mo" ? { sourceIndex: 0 } : {}),
        rationale:
          claim.value === "$49/mo"
            ? "The source says entry pricing is forty-nine dollars per month."
            : "The source does not support the fabricated $99/mo price.",
      })),
    }));

    const report = await structuralVerifierWithEntailment({
      body: {
        pricingReality: {
          supportedPrice: "$49/mo",
          fabricatedPrice: "$99/mo",
        },
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            sourceUrl: "https://example.com/pricing",
            markdown:
              "Entry pricing is forty-nine dollars per month for the starter plan.",
          },
        },
      ],
      corpusExcerpts: [],
      judge,
    });

    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge.mock.calls[0]?.[0].claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "numeric", value: "$49/mo" }),
        expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
      ]),
    );
    expect(report.verifiedCount).toBe(1);
    expect(report.unsupportedCount).toBe(1);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$49/mo" }),
          entailmentVerdict: "supported",
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "firecrawl",
          }),
        }),
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
          entailmentVerdict: "refuted",
          reason: "no_match",
        }),
      ]),
    );
  });

  it("falls back to deterministic verification when the entailment judge fails", async (): Promise<void> => {
    const judge = vi.fn<EntailmentJudge>(async () => {
      throw new Error("judge unavailable");
    });

    const report = await structuralVerifierWithEntailment({
      body: {
        pricingReality: {
          supportedPrice: "$49/mo",
          fabricatedPrice: "$99/mo",
        },
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            sourceUrl: "https://example.com/pricing",
            markdown: "Pricing starts at $49/mo.",
          },
        },
      ],
      corpusExcerpts: [],
      judge,
    });

    expect(judge).toHaveBeenCalledTimes(1);
    expect(report.verifiedCount).toBe(1);
    expect(report.unsupportedCount).toBe(1);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$49/mo" }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "firecrawl",
          }),
        }),
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
          reason: "no_match",
        }),
      ]),
    );
  });
});
