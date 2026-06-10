import { describe, expect, it } from "vitest";

import {
  acquireVoiceOfCustomerClassCandidates,
  buildVoiceOfCustomerClassCandidates,
  buildVoiceOfCustomerClassQuestion,
  formatVoiceOfCustomerClassCandidateBlock,
  parseVerbatimQuoteLines,
  selectVoiceOfCustomerClassCandidates,
  VOC_CLASS_MAX_PERPLEXITY_CALLS,
  VOC_CLASS_PACK_MAX_SIZE,
  VOC_SECONDARY_CLASSES,
  type VoiceOfCustomerClassCandidate,
  type VoiceOfCustomerSecondaryClass,
} from "../voice-of-customer-class-acquisition";

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

function quoteLine(index: number, domain = `site${index}.com`): string {
  return `"this took our team weeks to untangle, quote ${index}" — ${domain} — https://${domain}/thread/${index}`;
}

describe("parseVerbatimQuoteLines", (): void => {
  it("parses the strict quote — source — url line format", (): void => {
    const lines = parseVerbatimQuoteLines(
      '"the false positives were eating 20% of our traffic" — G2 — https://g2.com/products/anura/reviews/1',
    );

    expect(lines).toEqual([
      {
        quote: "the false positives were eating 20% of our traffic",
        sourceLabel: "G2",
        url: "https://g2.com/products/anura/reviews/1",
      },
    ]);
  });

  it("parses curly quotes, en dashes, and numbered list markers", (): void => {
    const answer = [
      "1. “we switched off ClickCease after the renewal doubled” – Reddit – https://reddit.com/r/PPC/comments/abc",
      "2. “support fixed our integration in a day” — Capterra — https://capterra.com/p/anura/reviews/2.",
    ].join("\n");

    const lines = parseVerbatimQuoteLines(answer);

    expect(lines).toHaveLength(2);
    expect(lines[0]).toEqual({
      quote: "we switched off ClickCease after the renewal doubled",
      sourceLabel: "Reddit",
      url: "https://reddit.com/r/PPC/comments/abc",
    });
    expect(lines[1]?.url).toBe("https://capterra.com/p/anura/reviews/2");
  });

  it("drops lines without a URL", (): void => {
    expect(
      parseVerbatimQuoteLines('"a real quote with no trace" — G2'),
    ).toEqual([]);
  });

  it("drops lines without quotation-marked text", (): void => {
    expect(
      parseVerbatimQuoteLines(
        "buyers generally dislike the pricing — G2 — https://g2.com/x",
      ),
    ).toEqual([]);
  });

  it("drops commentary lines and keeps quote-bearing lines from a mixed answer", (): void => {
    const answer = [
      "Here are the quotes I found:",
      quoteLine(1),
      "No further reliable quotes were found.",
    ].join("\n");

    const lines = parseVerbatimQuoteLines(answer);

    expect(lines).toHaveLength(1);
    expect(lines[0]?.url).toBe("https://site1.com/thread/1");
  });

  it("drops near-empty quotes", (): void => {
    expect(
      parseVerbatimQuoteLines('"ok" — G2 — https://g2.com/x'),
    ).toEqual([]);
  });
});

describe("buildVoiceOfCustomerClassQuestion", (): void => {
  it("carries the brand + category disambiguator and the strict line format in every class question", (): void => {
    for (const vocClass of VOC_SECONDARY_CLASSES) {
      const question = buildVoiceOfCustomerClassQuestion({
        company,
        vocClass,
      });

      expect(question).toContain("Anura");
      expect(question).toContain("ad-fraud detection platform");
      expect(question).toContain('"<verbatim quote>" — <source site> — <url>');
    }
  });

  it("asks the switching question for named prior tools", (): void => {
    const question = buildVoiceOfCustomerClassQuestion({
      company,
      vocClass: "switching",
    });

    expect(question.toLowerCase()).toContain("switch");
    expect(question.toLowerCase()).toContain("prior");
  });
});

describe("buildVoiceOfCustomerClassCandidates", (): void => {
  it("promotes parsed lines into class-tagged candidates with perplexity provenance", (): void => {
    const candidates = buildVoiceOfCustomerClassCandidates({
      answer: [quoteLine(1, "g2.com"), quoteLine(2, "reddit.com")].join("\n"),
      auditedCompanyDomain: company.websiteUrl,
      vocClass: "success",
    });

    expect(candidates).toHaveLength(2);
    expect(candidates[0]?.vocClass).toBe("success");
    expect(candidates[0]?.source).toBe("perplexity_research");
    expect(candidates[0]?.snippet).toContain("quote 1");
    expect(candidates[0]?.url).toContain("g2.com");
  });

  it("drops quotes sourced from the audited company's own domain", (): void => {
    const candidates = buildVoiceOfCustomerClassCandidates({
      answer: quoteLine(1, "anura.io"),
      auditedCompanyDomain: company.websiteUrl,
      vocClass: "objections",
    });

    expect(candidates).toEqual([]);
  });
});

describe("selectVoiceOfCustomerClassCandidates", (): void => {
  function classCandidate(
    index: number,
    domain: string,
    vocClass: VoiceOfCustomerSecondaryClass,
  ): VoiceOfCustomerClassCandidate {
    const built = buildVoiceOfCustomerClassCandidates({
      answer: quoteLine(index, domain),
      auditedCompanyDomain: company.websiteUrl,
      vocClass,
    });
    const candidate = built[0];

    if (candidate === undefined) {
      throw new Error(`fixture candidate ${index} did not build`);
    }

    return candidate;
  }

  it("dedupes identical quote+url pairs and caps per-domain within the class", (): void => {
    const sameDomain = Array.from({ length: 6 }, (_, index) =>
      classCandidate(index + 1, "g2.com", "success"),
    );
    const duplicate = classCandidate(1, "g2.com", "success");

    const selected = selectVoiceOfCustomerClassCandidates([
      ...sameDomain,
      duplicate,
    ]);

    expect(selected.length).toBeLessThanOrEqual(4);
    const keys = selected.map((candidate) => candidate.url + candidate.snippet);
    expect(new Set(keys).size).toBe(selected.length);
  });

  it("caps the class pack size", (): void => {
    const spread = Array.from({ length: VOC_CLASS_PACK_MAX_SIZE + 4 }, (_, index) =>
      classCandidate(index + 1, `site${index + 1}.com`, "criteria"),
    );

    const selected = selectVoiceOfCustomerClassCandidates(spread);

    expect(selected).toHaveLength(VOC_CLASS_PACK_MAX_SIZE);
  });
});

describe("acquireVoiceOfCustomerClassCandidates", (): void => {
  it("fans out one lookup per secondary class when answers parse", async (): Promise<void> => {
    const questions: string[] = [];
    const result = await acquireVoiceOfCustomerClassCandidates({
      company,
      executeLookup: async (question: string): Promise<unknown> => {
        questions.push(question);
        return perplexityResult(
          [quoteLine(questions.length, `domain${questions.length}.com`)].join(
            "\n",
          ),
        );
      },
    });

    expect(questions).toHaveLength(VOC_SECONDARY_CLASSES.length);
    expect(result.lookupCount).toBe(VOC_SECONDARY_CLASSES.length);
    for (const vocClass of VOC_SECONDARY_CLASSES) {
      expect(result.candidatesByClass[vocClass]).toHaveLength(1);
    }
  });

  it("retries a class at most once on zero parsed lines and respects the hard cap", async (): Promise<void> => {
    let calls = 0;
    const result = await acquireVoiceOfCustomerClassCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return perplexityResult("No reliable quotes were found.");
      },
    });

    expect(calls).toBe(VOC_SECONDARY_CLASSES.length * 2);
    expect(calls).toBeLessThanOrEqual(VOC_CLASS_MAX_PERPLEXITY_CALLS);
    expect(result.lookupCount).toBe(calls);
    for (const vocClass of VOC_SECONDARY_CLASSES) {
      expect(result.candidatesByClass[vocClass]).toEqual([]);
    }
  });

  it("aborts all retries when the credential gap surfaces", async (): Promise<void> => {
    let calls = 0;
    const result = await acquireVoiceOfCustomerClassCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return credentialGapOutput;
      },
    });

    expect(calls).toBe(VOC_SECONDARY_CLASSES.length);
    expect(result.lookupCount).toBe(calls);
  });

  it("treats a null tool output as zero lines (single retry, no crash)", async (): Promise<void> => {
    let calls = 0;
    await acquireVoiceOfCustomerClassCandidates({
      company,
      executeLookup: async (): Promise<unknown> => {
        calls += 1;
        return null;
      },
    });

    expect(calls).toBe(VOC_SECONDARY_CLASSES.length * 2);
  });
});

describe("formatVoiceOfCustomerClassCandidateBlock", (): void => {
  it("renders class tags, schema targets, and blockGap guidance for empty classes", (): void => {
    const successCandidates = buildVoiceOfCustomerClassCandidates({
      answer: quoteLine(1, "g2.com"),
      auditedCompanyDomain: company.websiteUrl,
      vocClass: "success",
    });

    const block = formatVoiceOfCustomerClassCandidateBlock({
      criteria: [],
      objections: [],
      success: successCandidates,
      switching: [],
    });

    expect(block).toContain("body.successLanguage.quotes");
    expect(block).toContain("[success]");
    expect(block).toContain("quote 1");
    expect(block).toContain("body.objections.blockGap");
  });
});
