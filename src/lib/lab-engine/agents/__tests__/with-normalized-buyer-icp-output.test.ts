import { describe, expect, it } from "vitest";

import { withNormalizedBuyerICPOutput } from "../run-section";

function buyerOutput(personas: Record<string, unknown>[]): Record<string, unknown> {
  return {
    sectionTitle: "Buyer ICP",
    verdict: "verdict",
    statusSummary: "status",
    confidence: 0.5,
    sources: [{ title: "Source", url: "https://g2.com/x" }],
    body: {
      personaReality: { prose: "p", personas },
    },
  };
}

function personasOf(output: unknown): Record<string, unknown>[] {
  const body = (output as { body: Record<string, unknown> }).body;
  const personaReality = body.personaReality as Record<string, unknown>;
  return personaReality.personas as Record<string, unknown>[];
}

const subjectWebsiteUrl = "https://anura.io";

describe("withNormalizedBuyerICPOutput vendorSourced derivation", (): void => {
  it("labels subject-domain personas vendorSourced=true (www/subdomain collapse)", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          { name: "A", sourceUrl: "https://anura.io/case-studies/x" },
          { name: "B", sourceUrl: "https://www.anura.io/customers" },
          { name: "C", sourceUrl: "https://blog.anura.io/story" },
        ]),
        { subjectWebsiteUrl },
      ),
    );

    expect(personas.map((persona) => persona.vendorSourced)).toEqual([
      true,
      true,
      true,
    ]);
  });

  it("labels independent-domain personas vendorSourced=false", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          { name: "A", sourceUrl: "https://g2.com/products/anura/reviews" },
        ]),
        { subjectWebsiteUrl },
      ),
    );

    expect(personas[0]?.vendorSourced).toBe(false);
  });

  it("overwrites a model-authored vendorSourced value (derive-don't-ask)", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "A",
            sourceUrl: "https://anura.io/case-studies/x",
            vendorSourced: false,
          },
        ]),
        { subjectWebsiteUrl },
      ),
    );

    expect(personas[0]?.vendorSourced).toBe(true);
  });

  it("leaves personas untouched when no subject URL is supplied", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([{ name: "A", sourceUrl: "https://g2.com/x" }]),
        {},
      ),
    );

    expect(personas[0]?.vendorSourced).toBeUndefined();
  });

  it("drops subject-company employees posing as buyer personas", (): void => {
    const personas = personasOf(
      withNormalizedBuyerICPOutput(
        buyerOutput([
          {
            name: "Rich Kahn",
            title: "CEO and Co-Founder",
            company: "Anura.io",
            sourceUrl: "https://emarketingassociation.com/rich-kahn",
          },
          {
            name: "Maya Chen",
            title: "VP Marketing",
            company: "Brightpath Labs",
            sourceUrl: "https://g2.com/products/anura/reviews",
          },
        ]),
        { subjectWebsiteUrl, subjectCompanyName: "Anura" },
      ),
    );

    expect(personas).toHaveLength(1);
    expect(personas[0]?.name).toBe("Maya Chen");
  });
});

describe("withNormalizedBuyerICPOutput unnecessary-gap strip", (): void => {
  const threeValidPersonas = [
    {
      name: "Maya Chen",
      title: "VP Marketing",
      company: "Brightpath Labs",
      role: "buyer",
      seniority: "VP",
      evidence: "Quoted in the case study about fraud-filter rollout.",
      sourceUrl: "https://anura.io/case-studies/brightpath",
    },
    {
      name: "Jordan Velez",
      title: "Head of Paid Media",
      company: "Crateful",
      role: "champion",
      seniority: "Head",
      evidence: "Named speaker on the ad-fraud webinar.",
      sourceUrl: "https://anura.io/webinars/crateful",
    },
    {
      name: "Sasha Bloom",
      title: "Director of Growth",
      company: "Nimbus Metrics",
      role: "buyer",
      seniority: "Director",
      evidence: "Named reviewer on G2 with title and company.",
      sourceUrl: "https://g2.com/products/anura/reviews/sasha",
    },
  ];

  function gappedOutput(personas: Record<string, unknown>[]): Record<string, unknown> {
    const output = buyerOutput(personas);
    const body = output.body as Record<string, unknown>;
    body.evidenceGap = true;
    body.evidenceGapReport = {
      reason: "insufficient_named_buyer_personas",
      summary: "Model filed a gap anyway.",
      foundNamedPersonaCount: personas.length,
      requiredNamedPersonaCount: 5,
      rejectedPersonaLabels: [],
      sourcingPlan: ["More mining."],
    };
    return output;
  }

  it("strips a model-authored gap when >=3 validator-grade personas remain", (): void => {
    const output = withNormalizedBuyerICPOutput(gappedOutput(threeValidPersonas), {
      subjectWebsiteUrl,
      subjectCompanyName: "Anura",
    }) as { body: Record<string, unknown> };

    expect(output.body.evidenceGap).toBeUndefined();
    expect(output.body.evidenceGapReport).toBeUndefined();
  });

  it("keeps the gap when fewer than 3 validator-grade personas remain", (): void => {
    const output = withNormalizedBuyerICPOutput(
      gappedOutput(threeValidPersonas.slice(0, 2)),
      { subjectWebsiteUrl, subjectCompanyName: "Anura" },
    ) as { body: Record<string, unknown> };

    expect(output.body.evidenceGap).toBe(true);
    expect(output.body.evidenceGapReport).toBeDefined();
  });
});
