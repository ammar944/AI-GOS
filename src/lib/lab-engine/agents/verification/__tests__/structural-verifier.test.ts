import { describe, expect, it } from "vitest";

import { structuralVerifier } from "../structural-verifier";

describe("structuralVerifier", (): void => {
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
});
