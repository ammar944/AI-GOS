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
      ]),
    );

    // Constructed ad-library search deep-links are UI affordances, not citations;
    // the verifier must not treat them as URL claims, else every empty-ad run
    // triggers a needless repair loop (2026-06-01 live audit: 4 repairs / 186s).
    expect(
      claims.some(
        (claim) =>
          claim.kind === "url" &&
          claim.value.includes("adstransparency.google.com"),
      ),
    ).toBe(false);
  });

  it("emits one whole-span claim for a symbolic numeric range, not its fragments", (): void => {
    const claims = extractClaims({
      marketSize: "TAM is $1M–$5M ARR per segment.",
      pricingBand: "Plans run $49–$99/mo across tiers.",
      audience: "Reaches 10,000–50,000 users in the funnel.",
    });

    const numericValues = claims
      .filter((claim) => claim.kind === "numeric")
      .map((claim) => claim.value);

    expect(numericValues).toContain("$1M–$5M ARR");
    expect(numericValues).toContain("$49–$99/mo");
    expect(numericValues).toContain("10,000–50,000 users");
    // The fragments must NOT appear as standalone claims (verification theater).
    expect(numericValues).not.toContain("$1");
    expect(numericValues).not.toContain("$5");
    expect(numericValues).not.toContain("1M ARR");
    expect(numericValues).not.toContain("5M");
    expect(numericValues).not.toContain("$49");
    expect(numericValues).not.toContain("$99/mo");
  });

  it("leaves single values, dates, and phone numbers unchanged by the range pass", (): void => {
    const claims = extractClaims({
      pricing: "Seat price is $49.00/mo.",
      growth: "Saw 32% lift and 200M interactions.",
      window: "Founded 2024-2025; call 555-1234.",
    });

    const numericValues = claims
      .filter((claim) => claim.kind === "numeric")
      .map((claim) => claim.value);

    expect(numericValues).toContain("$49.00/mo");
    expect(numericValues).toContain("32%");
    expect(numericValues).toContain("200M interactions");
    // Dates / phone numbers carry no currency/percent/magnitude/comma → not claims.
    expect(numericValues).not.toContain("2024-2025");
    expect(numericValues).not.toContain("555-1234");
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
