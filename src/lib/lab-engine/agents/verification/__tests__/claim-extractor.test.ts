import { describe, expect, it } from "vitest";

import { extractClaims } from "../claim-extractor";

describe("extractClaims", (): void => {
  it("extracts numeric, quote, url, and entity-name claims from known section fields and prose", (): void => {
    const claims = extractClaims({
      competitorSet: {
        competitors: [
          {
            name: "Gong",
            sourceUrl: "https://www.gong.io/pricing",
            evidence:
              'Gong says "setup takes two weeks before forecast views stabilize" and cites 200M interactions.',
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
      adEvidence: {
        advertiserGroups: [
          {
            advertiserName: "Clari",
            rawSourceSamples: [
              { sourceUrl: "https://adstransparency.google.com/?region=US&query=Clari" },
            ],
          },
        ],
      },
      summary: "Pipeline teams report 32% faster follow-up after switching.",
    });

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "entityName", value: "Gong" }),
        expect.objectContaining({ kind: "entityName", value: "Clari" }),
        expect.objectContaining({ kind: "numeric", value: "$49.00/mo" }),
        expect.objectContaining({ kind: "numeric", value: "200M interactions" }),
        expect.objectContaining({ kind: "numeric", value: "32%" }),
        expect.objectContaining({
          kind: "quote",
          value: "setup takes two weeks before forecast views stabilize",
        }),
        expect.objectContaining({
          kind: "url",
          value: "https://www.gong.io/pricing",
        }),
        expect.objectContaining({
          kind: "url",
          value: "https://adstransparency.google.com/?region=US&query=Clari",
        }),
      ]),
    );
  });

  it("deduplicates repeated claims while preserving their first raw occurrence", (): void => {
    const claims = extractClaims({
      competitorSet: {
        competitors: [
          { name: "Ramp", sourceUrl: "https://ramp.com" },
          { name: "Ramp", sourceUrl: "https://ramp.com" },
        ],
      },
      summary: "Ramp is mentioned again with 12% adoption and 12% adoption.",
    });

    expect(claims.filter((claim) => claim.value === "Ramp")).toHaveLength(1);
    expect(claims.filter((claim) => claim.value === "https://ramp.com")).toHaveLength(1);
    expect(claims.filter((claim) => claim.value === "12%")).toHaveLength(1);
  });
});
