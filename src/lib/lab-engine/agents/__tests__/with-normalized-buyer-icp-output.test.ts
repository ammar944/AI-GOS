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
});
