import { describe, expect, it } from "vitest";

import {
  acquireBuyerPersonaCandidates,
  BUYER_PERSONA_MAX_PERPLEXITY_CALLS,
  BUYER_PERSONA_VENUES,
  buildBuyerPersonaCandidates,
  buildBuyerPersonaVenueQuestion,
  deriveVendorSourced,
  formatBuyerPersonaCandidateBlock,
  parseNamedPersonaLines,
} from "../buyer-persona-acquisition";

const company = {
  category: "ad-fraud detection platform",
  name: "Anura",
  websiteUrl: "https://anura.io",
};

function perplexityResult(answer: string): Record<string, unknown> {
  return {
    type: "result",
    source: "Perplexity sonar-pro",
    answer,
    citations: [],
  };
}

const credentialGapOutput = {
  type: "gap",
  reason: "missing_credential",
  envVar: "PERPLEXITY_API_KEY",
  message: "PERPLEXITY_API_KEY not configured - set the env var to enable this tool.",
};

function personaLine(index: number, domain = `site${index}.com`): string {
  return `Maya Chen — VP Demand Generation — Brightpath Labs — https://${domain}/podcast/${index}`;
}

describe("parseNamedPersonaLines", (): void => {
  it("parses the name — title — company — url line format", (): void => {
    const lines = parseNamedPersonaLines(
      "Jordan Velez — Head of Paid Media — Crateful — https://example.com/webinar",
    );

    expect(lines).toEqual([
      {
        name: "Jordan Velez",
        title: "Head of Paid Media",
        company: "Crateful",
        url: "https://example.com/webinar",
      },
    ]);
  });

  it("tolerates list markers, markdown bold, and en dashes", (): void => {
    const answer = [
      "1. **Sasha Bloom** – Director of Growth – Nimbus Metrics – https://nimbus.example.com/talk",
      "2. Lee Okafor — Performance Lead — AdShield — https://adshield.example.com/review.",
    ].join("\n");

    const lines = parseNamedPersonaLines(answer);

    expect(lines).toHaveLength(2);
    expect(lines[0]?.name).toBe("Sasha Bloom");
    expect(lines[1]?.url).toBe("https://adshield.example.com/review");
  });

  it("drops lines without a URL or with too few fields", (): void => {
    expect(parseNamedPersonaLines("Maya Chen — VP Marketing")).toEqual([]);
    expect(
      parseNamedPersonaLines("Maya Chen — https://example.com/only-name"),
    ).toEqual([]);
  });

  it("drops commentary lines from a mixed answer", (): void => {
    const answer = [
      "Here are named individuals I found:",
      personaLine(1),
      "No further reliable names were found.",
    ].join("\n");

    expect(parseNamedPersonaLines(answer)).toHaveLength(1);
  });
});

describe("buildBuyerPersonaVenueQuestion", (): void => {
  it("carries brand + category + line format for both venues", (): void => {
    for (const venue of BUYER_PERSONA_VENUES) {
      const question = buildBuyerPersonaVenueQuestion({ company, venue });

      expect(question).toContain("Anura");
      expect(question).toContain("ad-fraud detection platform");
      expect(question).toContain("<full name> — <title> — <company> — <url>");
    }
  });

  it("targets review platforms in the reviewer-identities venue", (): void => {
    const question = buildBuyerPersonaVenueQuestion({
      company,
      venue: "reviewer_identities",
    });

    expect(question.toLowerCase()).toMatch(/g2|capterra/);
  });
});

describe("buildBuyerPersonaCandidates", (): void => {
  it("keeps only lines that look like named buyer identities", (): void => {
    const answer = [
      personaLine(1),
      "Economic buyer — VP Finance — Some Co — https://example.com/generic",
    ].join("\n");

    const candidates = buildBuyerPersonaCandidates({
      answer,
      venue: "public_voices",
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.name).toBe("Maya Chen");
    expect(candidates[0]?.venue).toBe("public_voices");
  });
});

describe("acquireBuyerPersonaCandidates", (): void => {
  it("fans out one lookup per venue when answers parse", async (): Promise<void> => {
    let calls = 0;
    const result = await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return perplexityResult(personaLine(calls, `domain${calls}.com`));
      },
    });

    expect(calls).toBe(BUYER_PERSONA_VENUES.length);
    expect(result.lookupCount).toBe(calls);
    expect(result.candidates).toHaveLength(2);
  });

  it("retries each venue at most once on zero parsed lines (cap 4)", async (): Promise<void> => {
    let calls = 0;
    await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return perplexityResult("No reliable names were found.");
      },
    });

    expect(calls).toBe(BUYER_PERSONA_VENUES.length * 2);
    expect(calls).toBeLessThanOrEqual(BUYER_PERSONA_MAX_PERPLEXITY_CALLS);
  });

  it("aborts retries on a credential gap", async (): Promise<void> => {
    let calls = 0;
    await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return credentialGapOutput;
      },
    });

    expect(calls).toBe(BUYER_PERSONA_VENUES.length);
  });

  it("dedupes identical name+url pairs across venues", async (): Promise<void> => {
    const result = await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> =>
        perplexityResult(personaLine(1, "same.com")),
    });

    expect(result.candidates).toHaveLength(1);
  });
});

describe("deriveVendorSourced", (): void => {
  it.each([
    ["https://anura.io/case-studies/acme", true],
    ["https://www.anura.io/customers", true],
    ["https://blog.anura.io/story", true],
    ["https://g2.com/products/anura/reviews", false],
    ["not a url", false],
  ])("%s -> %s", (sourceUrl, expected): void => {
    expect(
      deriveVendorSourced({
        sourceUrl,
        subjectWebsiteUrl: "https://anura.io",
      }),
    ).toBe(expected);
  });
});

describe("formatBuyerPersonaCandidateBlock", (): void => {
  it("renders leads with full identity fields and the promotion rule", (): void => {
    const candidates = buildBuyerPersonaCandidates({
      answer: personaLine(1, "g2.com"),
      venue: "reviewer_identities",
    });

    const block = formatBuyerPersonaCandidateBlock(candidates);

    expect(block).toContain("Maya Chen");
    expect(block).toContain("VP Demand Generation");
    expect(block).toContain("Brightpath Labs");
    expect(block).toContain("https://g2.com/podcast/1");
    expect(block.toLowerCase()).toContain("promote a persona only");
  });

  it("renders the empty state with the gap-report rule", (): void => {
    const block = formatBuyerPersonaCandidateBlock([]);

    expect(block.toLowerCase()).toContain("none acquired");
  });
});
