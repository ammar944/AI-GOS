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
      reachableRevenue:
        "Reachable revenue is $1.3M–$2.6M based on current demand.",
    });

    const numericValues = claims
      .filter((claim) => claim.kind === "numeric")
      .map((claim) => claim.value);

    expect(numericValues).toContain("$1M–$5M ARR");
    expect(numericValues).toContain("$49–$99/mo");
    expect(numericValues).toContain("10,000–50,000 users");
    expect(numericValues).toContain("$1.3M–$2.6M");
    // The fragments must NOT appear as standalone claims (verification theater).
    expect(numericValues).not.toContain("$1");
    expect(numericValues).not.toContain("$5");
    expect(numericValues).not.toContain("1M ARR");
    expect(numericValues).not.toContain("5M");
    expect(numericValues).not.toContain("$49");
    expect(numericValues).not.toContain("$99/mo");
    expect(numericValues).not.toContain("$1.3M");
    expect(numericValues).not.toContain("$2.6M");
    expect(numericValues).not.toContain("$1.3M–$2.6M based");
  });

  it("leaves single values, dates, and phone numbers unchanged by the range pass", (): void => {
    const claims = extractClaims({
      pricing: "Seat price is $49.00/mo.",
      cac: "Target CAC is $8K.",
      growth: "Saw 32% lift and 200M interactions.",
      window: "Founded 2024-2025; call 555-1234.",
    });

    const numericValues = claims
      .filter((claim) => claim.kind === "numeric")
      .map((claim) => claim.value);

    expect(numericValues).toContain("$49.00/mo");
    expect(numericValues).toContain("$8K");
    expect(numericValues).toContain("32%");
    expect(numericValues).toContain("200M interactions");
    // Dates / phone numbers carry no currency/percent/magnitude/comma → not claims.
    expect(numericValues).not.toContain("2024-2025");
    expect(numericValues).not.toContain("555-1234");
  });

  it("extracts count-field numeric attribution with the sibling source URL", (): void => {
    const claims = extractClaims({
      clusters: {
        venues: [
          {
            name: "Airtable Community",
            audienceSize: "450,000+ members",
            sourceUrl: "https://community.airtable.com/t5/forums",
          },
        ],
      },
    });

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assertedSourceUrl: "https://community.airtable.com/t5/forums",
          kind: "numericAttribution",
          value: "450,000+ members",
        }),
      ]),
    );
  });

  it("extracts source-scoped prose attribution from evidence records", (): void => {
    const claims = extractClaims({
      structuralForces: {
        forces: [
          {
            evidence:
              "Both Microsoft and Google bundle low-code tools through Power Apps and AppSheet.",
            sourceUrl: "https://about.google/appsheet/",
          },
        ],
      },
    });

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assertedSourceUrl: "https://about.google/appsheet/",
          kind: "sourceAttribution",
          value:
            "Both Microsoft and Google bundle low-code tools through Power Apps and AppSheet.",
        }),
      ]),
    );
  });

  it("does not extract bare comma-integers from non-count prose fields", (): void => {
    const claims = extractClaims({
      summary: "The community page mentions 450,000 members in passing.",
    });

    expect(
      claims.some(
        (claim) =>
          claim.kind === "numeric" &&
          claim.value === "450,000 members",
      ),
    ).toBe(false);
    expect(
      claims.some((claim) => claim.kind === "numericAttribution"),
    ).toBe(false);
  });

  it("extracts quote attribution from verbatim quote records", (): void => {
    const claims = extractClaims({
      publicWeaknesses: {
        items: [
          {
            verbatimQuote: "missing table stakes",
            source: "G2",
            sourceUrl: "https://www.g2.com/products/acme/reviews",
          },
        ],
      },
    });

    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          assertedSource: "G2",
          assertedSourceUrl: "https://www.g2.com/products/acme/reviews",
          kind: "quoteAttribution",
          value: "missing table stakes",
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

  it("exempts the competitor display homepage (competitor.url) from url claims while keeping every sourceUrl citation load-bearing", (): void => {
    const claims = extractClaims({
      competitorSet: {
        competitors: [
          {
            name: "Brex",
            url: "https://brex.com",
            sourceUrl: "https://www.brex.com/spend-trends/ramp-competitors",
          },
        ],
      },
      keywordDemand: {
        topKeywords: [
          { sourceUrl: "https://www.spyfu.com/overview/domain?query=ramp.com" },
        ],
      },
    });

    // (a) the bare competitor display/navigation homepage is NOT a load-bearing
    // url claim (the field at fieldPath body.competitorSet.competitors.url is exempt).
    expect(
      claims.some(
        (claim) => claim.kind === "url" && claim.value === "https://brex.com",
      ),
    ).toBe(false);

    // (b) the sibling competitor.sourceUrl citation IS still load-bearing, and
    // (c) a url at a DIFFERENT fieldPath (keywordDemand…sourceUrl) IS still
    // load-bearing — proving the exemption is exact-fieldPath-scoped, NOT
    // fieldName-scoped (a fieldName==='url' rebroadening would mute these).
    expect(claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "url",
          value: "https://www.brex.com/spend-trends/ramp-competitors",
        }),
        expect.objectContaining({
          kind: "url",
          value: "https://www.spyfu.com/overview/domain?query=ramp.com",
        }),
      ]),
    );
  });

  it("surfaces a benchmark.typicalRange percent as a load-bearing numeric claim", (): void => {
    const claims = extractClaims({
      funnelDiagnosis: {
        breaks: [
          {
            stageName: "Trial activation",
            metric: "Trial-to-paid conversion",
            magnitude: "below median",
            hypothesis: "Onboarding friction stalls first-value.",
            sourceUrl: "https://example.com/x",
            benchmark: {
              stageLabel: "Trial-to-paid",
              typicalRange: "trial-to-paid typically 15–20%",
              excellentRange: "above 25%",
              sourceUrl: "https://example.com/bench",
            },
          },
        ],
      },
    });

    // The benchmark band is verifier-visible (a load-bearing numeric claim),
    // NOT a blind fabrication surface: at least one numeric claim must carry
    // the percent token from benchmark.typicalRange.
    const numericPercentClaim = claims.find(
      (claim) =>
        claim.kind === "numeric" &&
        claim.value.includes("15") &&
        claim.value.includes("%"),
    );

    expect(numericPercentClaim).toBeDefined();
  });

  it("captures a Wikipedia disambiguation URL whole (balanced parens) and strips an unbalanced trailing paren", (): void => {
    const claims = extractClaims({
      marketSize: {
        prose:
          "Ramp is a corporate card company (see https://en.wikipedia.org/wiki/Ramp_(company)).",
        signals: [
          {
            signalType: "funding-flow",
            sourceUrl: "https://en.wikipedia.org/wiki/Ramp_(company)",
          },
        ],
      },
    });

    const urlValues = claims
      .filter((claim) => claim.kind === "url")
      .map((claim) => claim.value);

    // The balanced disambiguation slug is preserved WITH its closing paren — the
    // truncated ".../Ramp_(company" that hard-failed the live evidence gate must
    // never be emitted.
    expect(urlValues).toContain("https://en.wikipedia.org/wiki/Ramp_(company)");
    expect(
      urlValues.some((v) => v === "https://en.wikipedia.org/wiki/Ramp_(company"),
    ).toBe(false);
  });
});

describe("self-authored label paths", (): void => {
  it("does not extract funnel/force/trigger labels as entityName claims", (): void => {
    const claims = extractClaims({
      funnelIdeation: [
        { name: "PRIMARY - Cold Social to Comparison Page", rank: "1" },
        { name: "SECONDARY - Paid Search to Product Page", rank: "2" },
      ],
      structuralForces: {
        forces: [{ name: "Evidence and privacy pressure around AI sales automation" }],
      },
      buyingContext: {
        triggers: [{ name: "Fraud loss event", window: "weeks" }],
      },
    });

    expect(
      claims.filter((claim) => claim.kind === "entityName"),
    ).toEqual([]);
  });

  it("still extracts real entity names at other paths named `name`", (): void => {
    const claims = extractClaims({
      clusters: {
        venues: [{ name: "r/PPC", audienceSize: "180k members" }],
      },
      personaReality: {
        personas: [{ name: "Brett Kaufmann", company: "Successful Media" }],
      },
    });

    const entityNames = claims
      .filter((claim) => claim.kind === "entityName")
      .map((claim) => claim.value);
    expect(entityNames).toContain("r/PPC");
    expect(entityNames).toContain("Brett Kaufmann");
  });
});
