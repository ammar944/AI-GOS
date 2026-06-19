import { describe, it, expect } from "vitest";

import {
  checkPersonasBackedByLedger,
  type PersonaLike,
} from "../lib/persona-ledger-check";
import type { ResearchFact } from "@/lib/lab-engine/evidence/research-fact";

function champion(
  name: string,
  title: string,
  company: string,
  sourceUrl: string,
): ResearchFact {
  return {
    runId: "test",
    sectionId: "positioningBuyerICP",
    factKind: "named_champion",
    sourceUrl,
    sourceQuote: `${name} — ${title}, ${company}`,
    claimToken: name,
    createdAt: "2026-06-18T00:00:00.000Z",
  };
}

describe("checkPersonasBackedByLedger", () => {
  it("marks a persona backed when a fact at the same URL names them", () => {
    const personas: PersonaLike[] = [
      {
        name: "Bill Cox",
        title: "VP Finance",
        company: "Ramp",
        sourceUrl: "https://ramp.com/customers/bill-cox",
      },
    ];
    const ledger = [
      champion("Bill Cox", "VP Finance", "Ramp", "https://ramp.com/customers/bill-cox"),
    ];

    const result = checkPersonasBackedByLedger(personas, ledger);

    expect(result.total).toBe(1);
    expect(result.backed).toBe(1);
    expect(result.unbacked).toBe(0);
    expect(result.details[0].reason).toBe("backed");
  });

  it("flags a persona whose cited URL has no ledger fact (fabricated source)", () => {
    const personas: PersonaLike[] = [
      {
        name: "Jane Doe",
        title: "CFO",
        company: "Acme",
        sourceUrl: "https://acme.com/no-such-fact",
      },
    ];
    const ledger = [
      champion("Bill Cox", "VP Finance", "Ramp", "https://ramp.com/customers/bill-cox"),
    ];

    const result = checkPersonasBackedByLedger(personas, ledger);

    expect(result.backed).toBe(0);
    expect(result.unbacked).toBe(1);
    expect(result.details[0].reason).toBe("no-ledger-fact-for-source");
  });

  it("flags persona laundering: a shared listing URL that names someone else", () => {
    // Two personas claim the SAME generic G2 listing URL, but the only fact at
    // that URL names a different person. The persona whose name is absent is
    // laundered — backed=false with name-token-not-in-ledger-quote.
    const sharedUrl = "https://www.g2.com/products/ramp/reviews";
    const personas: PersonaLike[] = [
      { name: "Bill Cox", title: "VP Finance", company: "Ramp", sourceUrl: sharedUrl },
      { name: "Laundered Persona", title: "Director", company: "Ramp", sourceUrl: sharedUrl },
    ];
    const ledger = [champion("Bill Cox", "VP Finance", "Ramp", sharedUrl)];

    const result = checkPersonasBackedByLedger(personas, ledger);

    expect(result.total).toBe(2);
    expect(result.backed).toBe(1);
    expect(result.unbacked).toBe(1);
    expect(
      result.details.find((d) => d.name === "Laundered Persona")?.reason,
    ).toBe("name-token-not-in-ledger-quote");
  });

  it("does not match an embedded substring (Cox inside Coxwell)", () => {
    const url = "https://example.com/p";
    const personas: PersonaLike[] = [
      { name: "Cox", title: "X", company: "Y", sourceUrl: url },
    ];
    // Fact quote contains 'Coxwell' but never the standalone token 'Cox'.
    const ledger: ResearchFact[] = [
      {
        runId: "t",
        sectionId: "positioningBuyerICP",
        factKind: "named_champion",
        sourceUrl: url,
        sourceQuote: "Coxwell — VP, Z",
        claimToken: "Coxwell",
        createdAt: "2026-06-18T00:00:00.000Z",
      },
    ];

    const result = checkPersonasBackedByLedger(personas, ledger);

    expect(result.backed).toBe(0);
    expect(result.details[0].reason).toBe("name-token-not-in-ledger-quote");
  });
});
