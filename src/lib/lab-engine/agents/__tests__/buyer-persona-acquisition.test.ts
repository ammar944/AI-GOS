import { describe, expect, it } from "vitest";

import {
  acquireBuyerPersonaCandidates,
  BUYER_PERSONA_MAX_PERPLEXITY_CALLS,
  BUYER_PERSONA_SECOND_PASS_THRESHOLD,
  BUYER_PERSONA_SECOND_PASS_VENUES,
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
  it("fans out per venue and tops up from second-pass venues while the pack is thin", async (): Promise<void> => {
    let calls = 0;
    const result = await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return perplexityResult(personaLine(calls, `domain${calls}.com`));
      },
    });

    // 2 first-pass venues (1 hit each) leave the pack thin -> both
    // second-pass venues fire once each.
    expect(calls).toBe(
      BUYER_PERSONA_VENUES.length + BUYER_PERSONA_SECOND_PASS_VENUES.length,
    );
    expect(result.lookupCount).toBe(calls);
    expect(result.candidates).toHaveLength(4);
    expect(
      result.candidates.map((candidate) => candidate.venue),
    ).toEqual([
      "public_voices",
      "reviewer_identities",
      "case_study_champions",
      "event_speakers",
    ]);
  });

  it("skips the second pass when the first pass already fills the pack", async (): Promise<void> => {
    const names = [
      "Maya Chen",
      "Jordan Velez",
      "Sasha Bloom",
      "Lee Okafor",
      "Priya Nair",
      "Tomas Rivera",
      "Ana Duarte",
      "Marcus Webb",
    ];
    let calls = 0;
    const result = await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return perplexityResult(
          names
            .map(
              (name, index) =>
                `${name} — VP Demand Generation — Brightpath Labs — https://venue${calls}-${index}.com/talk`,
            )
            .join("\n"),
        );
      },
    });

    expect(calls).toBe(BUYER_PERSONA_VENUES.length);
    expect(result.candidates.length).toBeGreaterThanOrEqual(
      BUYER_PERSONA_SECOND_PASS_THRESHOLD,
    );
    expect(
      result.candidates.every((candidate) =>
        (BUYER_PERSONA_VENUES as readonly string[]).includes(candidate.venue),
      ),
    ).toBe(true);
  });

  it("caps zero-parse runs at first-pass retries plus one second-pass attempt per venue", async (): Promise<void> => {
    let calls = 0;
    await acquireBuyerPersonaCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return perplexityResult("No reliable names were found.");
      },
    });

    // 2 venues x (1 + 1 retry) + 2 second-pass venues x 1 = the structural cap.
    expect(calls).toBe(BUYER_PERSONA_MAX_PERPLEXITY_CALLS);
    expect(BUYER_PERSONA_MAX_PERPLEXITY_CALLS).toBe(6);
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

    // The gap also blocks the second pass entirely.
    expect(calls).toBe(BUYER_PERSONA_VENUES.length);
  });

  it("targets case studies and event rosters in the second-pass venue questions", (): void => {
    const caseStudyQuestion = buildBuyerPersonaVenueQuestion({
      company,
      venue: "case_study_champions",
    });
    const eventQuestion = buildBuyerPersonaVenueQuestion({
      company,
      venue: "event_speakers",
    });

    expect(caseStudyQuestion.toLowerCase()).toContain("case stud");
    expect(eventQuestion.toLowerCase()).toMatch(/webinar|conference/);
    expect(eventQuestion.toLowerCase()).toContain("linkedin");
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

describe("buildBuyerPersonaCandidates own-company filter (Fix B)", (): void => {
  const subject = { name: "Ramp", websiteUrl: "https://ramp.com" };

  it("drops subject-own-exec leads by company name and own-domain url, keeps externals", (): void => {
    const answer = [
      "Eric Glyman — Co-founder & CEO — Ramp — https://www.youtube.com/watch?v=abc",
      "Jane Doe — Controller — Ramp — https://ramp.com/team",
      "Bob Lee — VP Finance — Acme Corp — https://acme.com/story",
    ].join("\n");

    const candidates = buildBuyerPersonaCandidates({
      answer,
      venue: "event_speakers",
      subject,
    });
    const names = candidates.map((candidate) => candidate.name);

    expect(names).toContain("Bob Lee");
    expect(names).not.toContain("Eric Glyman");
    expect(names).not.toContain("Jane Doe");
  });

  it("without a subject keeps all named leads (back-compat)", (): void => {
    const candidates = buildBuyerPersonaCandidates({
      answer: "Eric Glyman — CEO — Ramp — https://www.youtube.com/watch?v=abc",
      venue: "event_speakers",
    });

    expect(candidates.map((candidate) => candidate.name)).toContain("Eric Glyman");
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
