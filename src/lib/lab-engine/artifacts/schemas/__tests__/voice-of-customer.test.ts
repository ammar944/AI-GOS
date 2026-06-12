import { describe, expect, it } from "vitest";

import { voiceOfCustomerFixtureArtifact } from "../../../fixtures/voice-of-customer-artifact";
import {
  classifyVoiceOfCustomerEvidenceGap,
  checkVoiceOfCustomerSelfSourcing,
  validateVoiceOfCustomerMinimums,
  voiceOfCustomerBodySchema,
  type VoiceOfCustomerArtifact,
} from "../voice-of-customer";

type PainQuote =
  VoiceOfCustomerArtifact["body"]["painLanguage"]["quotes"][number];

function painQuote(sourceUrl: string, index: number): PainQuote {
  return {
    verbatimText: `this keeps breaking on us ${index}`,
    source: "g2",
    sourceUrl,
    painTheme: "fragmentation",
    painIntensity: "high",
  };
}

// Reuse the valid fixture envelope/body and swap only the pain quotes so the
// re-parse inside checkVoiceOfCustomerSelfSourcing always sees a valid VoC body.
function withPainQuotes(quotes: PainQuote[]): VoiceOfCustomerArtifact {
  return {
    ...voiceOfCustomerFixtureArtifact,
    body: {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes,
      },
    },
  };
}

const subjectDomain = "https://acme.com";

describe("painQuoteSchema role/date", (): void => {
  it("accepts optional role and date on a pain quote", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes: [
          {
            ...painQuote("https://g2.com/review/1", 1),
            role: "VP Revenue Operations",
            date: "2026-03-02",
          },
        ],
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });

  it("accepts a pain quote without role or date (both optional)", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes: [painQuote("https://g2.com/review/1", 1)],
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });

  it("accepts capterra, trustpilot, and trustradius as quote sources", (): void => {
    // The dominant review platforms must be expressible — a closed enum used
    // to force every Capterra/Trustpilot/TrustRadius quote to source 'other'.
    const quotes = [
      { ...painQuote("https://capterra.com/p/146652/Acme/reviews/901", 1), source: "capterra" as const },
      { ...painQuote("https://trustpilot.com/reviews/abc123", 2), source: "trustpilot" as const },
      { ...painQuote("https://trustradius.com/reviews/acme-2026", 3), source: "trustradius" as const },
    ];
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        quotes,
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });
});

describe("Voice of Customer evidence-gap classification", (): void => {
  it("accepts honest pain-quote/source acquisition insufficiency as degradable", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://g2.com/review/2", 2),
      painQuote("https://g2.com/review/3", 3),
      painQuote("https://reddit.com/r/sales/4", 4),
      painQuote("https://reddit.com/r/sales/5", 5),
      painQuote("https://reddit.com/r/sales/6", 6),
    ]);
    const minimums = validateVoiceOfCustomerMinimums(artifact);

    const result = classifyVoiceOfCustomerEvidenceGap({
      artifact,
      errors: minimums.errors,
      subjectDomain,
    });

    expect(minimums.ok).toBe(false);
    expect(result).toMatchObject({
      ok: true,
      foundDistinctPainSourceCount: 2,
      foundPainQuoteCount: 6,
      observedPainSourceDomains: ["g2.com", "reddit.com"],
    });
  });

  it("accepts a typed evidenceGap body with an honest sourcing plan", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      evidenceGap: true,
      evidenceGapReport: {
        acquisitionAttempts: [
          {
            acquisitionMode: "review_body",
            domain: "g2.com",
            gapReason: "empty_markdown",
            source: "G2",
            status: "failed",
            title: "Acme G2 reviews",
            url: "https://g2.com/products/acme/reviews",
          },
        ],
        acquisitionLedger: [
          {
            acquisitionMode: "review_body",
            candidateText:
              "Finance buyers described manual approval cleanup in a recovered review.",
            domain: "g2.com",
            evidenceKind: "review",
            observedAt: "2026-06-01T00:00:00.000Z",
            parserStatus: "failed",
            promotionStatus: "rejected",
            query: "Acme reviews",
            rejectionReason: "parser_no_match",
            scrapeStatus: "succeeded",
            source: "G2",
            sourceUrl: "https://g2.com/products/acme/reviews",
            toolGapReason: "parser_no_match",
          },
        ],
        foundDistinctPainSourceCount: 2,
        foundPainQuoteCount: 6,
        observedPainSourceDomains: ["g2.com", "reddit.com"],
        reason: "insufficient_voice_of_customer_sources",
        requiredDistinctPainSourceCount: 3,
        requiredPainQuoteCount: 10,
        sourcingPlan: [
          "Pull first-party review bodies from G2/Capterra/Trustpilot or an approved review data provider.",
          "Search independent community/forum threads and recover full quotes with Firecrawl when pages render.",
        ],
        summary:
          "Only two independent pain-language domains were available in the live acquisition budget.",
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });

  it("classifies self-sourced pain quotes as a degradable sourcing gap", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://reddit.com/r/sales/2", 2),
      painQuote("https://acme.com/customers", 3),
    ]);
    const selfSourcing = checkVoiceOfCustomerSelfSourcing({
      artifact,
      subjectDomain,
    });

    const result = classifyVoiceOfCustomerEvidenceGap({
      artifact,
      errors: selfSourcing.errors,
      subjectDomain,
    });

    expect(result).toMatchObject({
      ok: true,
      foundDistinctPainSourceCount: 3,
      foundPainQuoteCount: 3,
      observedPainSourceDomains: ["g2.com", "reddit.com", "acme.com"],
    });
  });

  it("classifies a single-source majority as a degradable sourcing gap", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://g2.com/review/2", 2),
      painQuote("https://g2.com/review/3", 3),
      painQuote("https://g2.com/review/4", 4),
      painQuote("https://g2.com/review/5", 5),
      painQuote("https://g2.com/review/6", 6),
      painQuote("https://reddit.com/r/sales/7", 7),
      painQuote("https://reddit.com/r/sales/8", 8),
      painQuote("https://trustpilot.com/review/9", 9),
      painQuote("https://trustpilot.com/review/10", 10),
    ]);
    const selfSourcing = checkVoiceOfCustomerSelfSourcing({
      artifact,
      subjectDomain,
    });

    const result = classifyVoiceOfCustomerEvidenceGap({
      artifact,
      errors: selfSourcing.errors,
      subjectDomain,
    });

    expect(result).toMatchObject({
      ok: true,
      foundDistinctPainSourceCount: 3,
      foundPainQuoteCount: 10,
      observedPainSourceDomains: ["g2.com", "reddit.com", "trustpilot.com"],
    });
  });

  it("does not classify structural corruption as an evidence gap", (): void => {
    const artifact = {
      ...voiceOfCustomerFixtureArtifact,
      body: {
        ...voiceOfCustomerFixtureArtifact.body,
        painLanguage: {
          prose: "missing quotes array",
        },
      },
    };

    const result = classifyVoiceOfCustomerEvidenceGap({
      artifact,
      errors: ["body.painLanguage.quotes: have 0, need >=10."],
      subjectDomain,
    });

    expect(result).toMatchObject({
      ok: false,
      reason: "structural_corruption",
    });
  });
});

describe("checkVoiceOfCustomerSelfSourcing", (): void => {
  it("passes when pain quotes come from independent domains", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://g2.com/review/2", 2),
      painQuote("https://reddit.com/r/sales/3", 3),
      painQuote("https://reddit.com/r/sales/4", 4),
      painQuote("https://trustpilot.com/review/5", 5),
      painQuote("https://trustpilot.com/review/6", 6),
    ]);

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it("rejects a pain quote sourced from the subject's own registrable domain", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://reddit.com/r/sales/2", 2),
      painQuote("https://trustpilot.com/review/3", 3),
      painQuote("https://acme.com/customers", 4),
    ]);

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("own domain");
  });

  it("defeats subdomain evasion via registrable-domain match", (): void => {
    const artifact = withPainQuotes([
      painQuote("https://g2.com/review/1", 1),
      painQuote("https://reddit.com/r/sales/2", 2),
      painQuote("https://trustpilot.com/review/3", 3),
      painQuote("https://blog.acme.com/testimonials", 4),
    ]);

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("own domain");
  });

  it("rejects a single-source majority of pain quotes", (): void => {
    const artifact = withPainQuotes(
      Array.from({ length: 6 }, (_, index) =>
        painQuote(`https://g2.com/review/${index + 1}`, index + 1),
      ),
    );

    const result = checkVoiceOfCustomerSelfSourcing({ artifact, subjectDomain });

    expect(result.ok).toBe(false);
    expect(result.errors.join(" ")).toContain("single-source majority");
  });
});

type SecondaryBlockKey =
  | "successLanguage"
  | "objections"
  | "switchingStories"
  | "decisionCriteria";

interface TestBlockGap {
  summary: string;
  foundCount: number;
  requiredCount: number;
  sourcingPlan: string[];
}

const secondaryBlockArrayKey = {
  decisionCriteria: "criteria",
  objections: "items",
  successLanguage: "quotes",
  switchingStories: "stories",
} as const;

function blockGapFor(blockKey: SecondaryBlockKey): TestBlockGap {
  return {
    summary: `Independent retrieval surfaced no promotable ${blockKey} language.`,
    foundCount: 0,
    requiredCount: blockKey === "switchingStories" ? 3 : 5,
    sourcingPlan: [
      "Mine the named competitors' G2 comparison categories for this language.",
    ],
  };
}

function withGuttedBlock(
  blockKey: SecondaryBlockKey,
  options: { blockGap: boolean },
): VoiceOfCustomerArtifact {
  const block = voiceOfCustomerFixtureArtifact.body[blockKey];

  return {
    ...voiceOfCustomerFixtureArtifact,
    body: {
      ...voiceOfCustomerFixtureArtifact.body,
      [blockKey]: {
        ...block,
        [secondaryBlockArrayKey[blockKey]]: [],
        ...(options.blockGap ? { blockGap: blockGapFor(blockKey) } : {}),
      },
    },
  } as VoiceOfCustomerArtifact;
}

describe("Voice of Customer per-block gaps", (): void => {
  const secondaryBlocks: SecondaryBlockKey[] = [
    "successLanguage",
    "objections",
    "switchingStories",
    "decisionCriteria",
  ];

  it.each(secondaryBlocks)(
    "accepts an empty %s block when it declares a blockGap",
    (blockKey): void => {
      const artifact = withGuttedBlock(blockKey, { blockGap: true });

      const result = validateVoiceOfCustomerMinimums(artifact);

      expect(result.errors).toEqual([]);
      expect(result.ok).toBe(true);
    },
  );

  it.each(secondaryBlocks)(
    "still enforces the %s minimum when no blockGap is declared",
    (blockKey): void => {
      const artifact = withGuttedBlock(blockKey, { blockGap: false });

      const result = validateVoiceOfCustomerMinimums(artifact);

      expect(result.ok).toBe(false);
      expect(result.errors.join(" ")).toContain(`body.${blockKey}`);
      expect(result.errors.join(" ")).toContain(`body.${blockKey}.blockGap`);
      expect(result.errors.join(" ")).toContain("instead of inventing");
    },
  );

  it("accepts all four secondary blocks gutted when each carries a blockGap", (): void => {
    const result = validateVoiceOfCustomerMinimums({
      ...voiceOfCustomerFixtureArtifact,
      body: {
        ...voiceOfCustomerFixtureArtifact.body,
        decisionCriteria: withGuttedBlock("decisionCriteria", { blockGap: true })
          .body.decisionCriteria,
        objections: withGuttedBlock("objections", { blockGap: true }).body
          .objections,
        successLanguage: withGuttedBlock("successLanguage", { blockGap: true })
          .body.successLanguage,
        switchingStories: withGuttedBlock("switchingStories", {
          blockGap: true,
        }).body.switchingStories,
      },
    });

    expect(result.errors).toEqual([]);
    expect(result.ok).toBe(true);
  });

  it("accepts an empty painLanguage block when it declares a blockGap", (): void => {
    const artifact: VoiceOfCustomerArtifact = {
      ...voiceOfCustomerFixtureArtifact,
      body: {
        ...voiceOfCustomerFixtureArtifact.body,
        painLanguage: {
          ...voiceOfCustomerFixtureArtifact.body.painLanguage,
          quotes: [],
          blockGap: {
            ...blockGapFor("successLanguage"),
            summary:
              "Independent retrieval surfaced no promotable pain language.",
          },
        },
      },
    };

    const result = validateVoiceOfCustomerMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects a blockGap with extra keys (strict shape)", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      successLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.successLanguage,
        blockGap: {
          ...blockGapFor("successLanguage"),
          padding: "not allowed",
        },
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).toThrow();
  });

  it("accepts a blockGap on painLanguage", (): void => {
    const body = {
      ...voiceOfCustomerFixtureArtifact.body,
      painLanguage: {
        ...voiceOfCustomerFixtureArtifact.body.painLanguage,
        blockGap: blockGapFor("successLanguage"),
      },
    };

    expect(() => voiceOfCustomerBodySchema.parse(body)).not.toThrow();
  });

  it("accepts an entirely empty VoC when all quote blocks are gapped and retrievalSummary is present", (): void => {
    const artifact: VoiceOfCustomerArtifact = {
      ...voiceOfCustomerFixtureArtifact,
      body: {
        ...voiceOfCustomerFixtureArtifact.body,
        retrievalSummary:
          "Searched review, forum, and public community surfaces; no admissible customer-authored quotes were retrieved.",
        painLanguage: {
          ...voiceOfCustomerFixtureArtifact.body.painLanguage,
          quotes: [],
          blockGap: {
            ...blockGapFor("successLanguage"),
            summary:
              "Independent retrieval surfaced no promotable pain language.",
          },
        },
        decisionCriteria: withGuttedBlock("decisionCriteria", { blockGap: true })
          .body.decisionCriteria,
        objections: withGuttedBlock("objections", { blockGap: true }).body
          .objections,
        successLanguage: withGuttedBlock("successLanguage", { blockGap: true })
          .body.successLanguage,
        switchingStories: withGuttedBlock("switchingStories", {
          blockGap: true,
        }).body.switchingStories,
      },
    };

    const result = validateVoiceOfCustomerMinimums(artifact);

    expect(result.ok).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("keeps the section-level evidence-gap bypass unchanged", (): void => {
    const artifact = withPainQuotes([painQuote("https://g2.com/review/1", 1)]);
    const gapped: VoiceOfCustomerArtifact = {
      ...artifact,
      body: {
        ...artifact.body,
        evidenceGap: true,
        evidenceGapReport: {
          reason: "insufficient_voice_of_customer_sources",
          summary: "Acquisition fell short of the pain floors.",
          foundPainQuoteCount: 1,
          requiredPainQuoteCount: 6,
          foundDistinctPainSourceCount: 1,
          requiredDistinctPainSourceCount: 3,
          observedPainSourceDomains: ["g2.com"],
          sourcingPlan: ["Scrape the named competitor comparison categories."],
        },
      },
    };

    const result = validateVoiceOfCustomerMinimums(gapped);

    expect(result.ok).toBe(true);
  });
});
