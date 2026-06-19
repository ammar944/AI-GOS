import { describe, expect, it } from "vitest";

import type { BuyerPersonaCandidate } from "@/lib/lab-engine/agents/buyer-persona-acquisition";
import {
  buildResearchFactsFromBuyerPersonaCandidates,
  buildResearchFactsFromCorpusExcerpts,
  buildResearchFactsFromVoiceOfCustomerCandidates,
  researchFactSchema,
} from "@/lib/lab-engine/evidence/research-fact";

const promoterContext = {
  runId: "run_123",
  sectionId: "positioningBuyerICP" as const,
  parentAuditRunId: "parent_1",
  createdAt: "2026-06-18T00:00:00.000Z",
};

function namedCandidate(
  overrides: Partial<BuyerPersonaCandidate> = {},
): BuyerPersonaCandidate {
  return {
    name: "Bill Cox",
    title: "VP Finance",
    company: "Example Co",
    url: "https://ramp.com/customers/example",
    venue: "case_study_champions",
    ...overrides,
  };
}

describe("buildResearchFactsFromBuyerPersonaCandidates", () => {
  it("emits one named_champion fact per named, http-sourced candidate", () => {
    const facts = buildResearchFactsFromBuyerPersonaCandidates(
      [namedCandidate()],
      promoterContext,
    );

    expect(facts).toHaveLength(1);
    const [fact] = facts;
    expect(fact.factKind).toBe("named_champion");
    expect(fact.sourceUrl).toBe("https://ramp.com/customers/example");
    expect(fact.claimToken).toBe("Bill Cox");
    // claimToken is trivially a substring of sourceQuote.
    expect(fact.sourceQuote).toContain(fact.claimToken);
    // Every emitted fact is a valid ResearchFact.
    expect(researchFactSchema.safeParse(fact).success).toBe(true);
  });

  it("drops candidates whose name is not a named identity", () => {
    const facts = buildResearchFactsFromBuyerPersonaCandidates(
      [namedCandidate({ name: "Finance Team" })],
      promoterContext,
    );
    expect(facts).toHaveLength(0);
  });

  it("drops candidates whose url is not http(s)", () => {
    const facts = buildResearchFactsFromBuyerPersonaCandidates(
      [namedCandidate({ url: "ftp://ramp.com/file" })],
      promoterContext,
    );
    expect(facts).toHaveLength(0);
  });
});

describe("buildResearchFactsFromVoiceOfCustomerCandidates", () => {
  it("emits one voc_quote fact per candidate with a verbatim substring token", () => {
    const facts = buildResearchFactsFromVoiceOfCustomerCandidates(
      [
        {
          verbatim: "the renewal doubled overnight and nobody warned us",
          sourceUrl: "https://g2.com/reviews/abc",
        },
      ],
      promoterContext,
    );

    expect(facts).toHaveLength(1);
    const [fact] = facts;
    expect(fact.factKind).toBe("voc_quote");
    expect(fact.sourceQuote).toBe(
      "the renewal doubled overnight and nobody warned us",
    );
    expect(fact.sourceQuote).toContain(fact.claimToken);
    expect(researchFactSchema.safeParse(fact).success).toBe(true);
  });

  it("drops candidates whose source url is not http(s)", () => {
    const facts = buildResearchFactsFromVoiceOfCustomerCandidates(
      [{ verbatim: "this keeps breaking", sourceUrl: "not-a-url" }],
      promoterContext,
    );
    expect(facts).toHaveLength(0);
  });
});

describe("buildResearchFactsFromCorpusExcerpts", () => {
  it("emits one corpus_excerpt fact per input excerpt", () => {
    const excerpts = [
      {
        id: "ex_1",
        sourceUrl: "https://example.com/a",
        title: "Pricing page",
        text: "Plans start at $99 per seat per month.",
        observedAt: "2026-06-18T00:00:00.000Z",
        sourceId: "src_1",
      },
      {
        id: "ex_2",
        sourceUrl: "https://example.com/b",
        title: "Security page",
        text: "SOC 2 Type II certified.",
        observedAt: "2026-06-18T00:00:00.000Z",
        sourceId: "src_2",
      },
    ];

    const facts = buildResearchFactsFromCorpusExcerpts(
      excerpts,
      promoterContext,
    );

    expect(facts).toHaveLength(excerpts.length);
    for (const fact of facts) {
      expect(fact.factKind).toBe("corpus_excerpt");
      expect(fact.sourceQuote).toContain(fact.claimToken);
      expect(researchFactSchema.safeParse(fact).success).toBe(true);
    }
    expect(facts.map((fact) => fact.sourceUrl)).toEqual([
      "https://example.com/a",
      "https://example.com/b",
    ]);
    expect(facts.map((fact) => fact.sourceQuote)).toEqual([
      "Plans start at $99 per seat per month.",
      "SOC 2 Type II certified.",
    ]);
  });
});
