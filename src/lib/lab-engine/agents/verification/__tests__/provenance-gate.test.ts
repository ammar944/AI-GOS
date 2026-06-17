import { describe, expect, it } from "vitest";

import {
  buildPlaceholderTrustedHosts,
  downgradeUnpermalinkedVerbatimQuotes,
  downgradeUnpermalinkedVocQuotes,
  placeholderSourceUrlRelabel,
  scrubQuoteEmails,
  stripExemplarEchoes,
  stripPlaceholderSourceUrls,
  stripUncontainedSourceUrls,
  stripUnverifiedSourceUrls,
} from "../provenance-gate";

// Mirrors voice-of-customer.ts getSourceKey (distinct VoC pain sources are
// keyed by hostname): used to prove the systemic containment strip preserves
// the VOC_MIN_DOMAINS distinct-host count instead of collapsing every
// relabeled row onto one marker host.
function sourceHostKey(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

// Fixtures mirror run 8081e646 (Airtable E2E, 2026-06-11): the cold judge
// found Ramp-era exemplar copy inside deployable paid-media fields, an
// exemplar SOC 2 question inside demand-intent question mining, 4 of 5
// competitor "verbatim quotes" sitting on index pages, and an employee email
// inside a VoC quote.

describe("stripExemplarEchoes", (): void => {
  it("strips the leaked OCR-receipt sentence from paid-media creative copy", (): void => {
    const body = {
      audienceTypes: [
        {
          detail:
            "Airtable matches transactions with receipts via OCR — closing from 8 days to 3. Retarget visitors who viewed the pricing page.",
          grounding: "VoC section",
          name: "Warm retargeting",
        },
      ],
      campaignOverview: {
        prose:
          "Airtable's connected-apps positioning targets operations teams stuck between spreadsheets and point tools.",
      },
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningPaidMediaPlan",
    });

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.motif).toBe("fintech-receipt-ocr");
    const audienceTypes = result.body.audienceTypes as Array<
      Record<string, unknown>
    >;
    expect(audienceTypes[0]?.detail).toBe(
      "Retarget visitors who viewed the pricing page.",
    );
    expect(audienceTypes[0]?.grounding).toBe("UNVERIFIED");
  });

  it("replaces a fully-leaked hook with the gap line", (): void => {
    const body = {
      creativeRequirements: [
        {
          grounding: "DemandIntent",
          hook: "Stop chasing your team's receipts — close the month in 3 days.",
        },
      ],
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningPaidMediaPlan",
    });

    const rows = result.body.creativeRequirements as Array<
      Record<string, unknown>
    >;
    expect(rows[0]?.hook).toBe(
      "evidence gap: copy removed — exemplar-derived content could not be traced to this subject's research evidence",
    );
    expect(rows[0]?.grounding).toBe("UNVERIFIED");
  });

  it("keeps receipt language when structured evidence supports the domain", (): void => {
    const body = {
      audienceTypes: [
        {
          detail: "Finance teams drowning in receipts at month-end close.",
          grounding: "VoC section",
        },
      ],
      vocEvidence: [
        {
          verbatimText:
            "Every month-end close I'm chasing receipts across three systems.",
        },
      ],
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningPaidMediaPlan",
    });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });

  it("does not let model narrative vouch for a motif (self-vouching guard)", (): void => {
    const body = {
      campaignOverview: {
        prose:
          "The plan leans on receipt-chasing pain because buyers bleed hours at month-end close.",
      },
      creativeFramework: [
        {
          grounding:
            "mechanism (OCR) is product capability from the subject's own documentation",
          hook: "Stop chasing receipts — close the month in 3 days.",
        },
      ],
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningPaidMediaPlan",
    });

    const fields = result.stripped.map((item) => item.field);
    expect(fields).toContain("body.creativeFramework[0].hook");
    expect(fields).toContain("body.creativeFramework[0].grounding");
    expect(fields).toContain("body.campaignOverview.prose");
    const rows = result.body.creativeFramework as Array<
      Record<string, unknown>
    >;
    expect(rows[0]?.grounding).toBe("UNVERIFIED");
  });

  it("strips assertive echo narration from prose but keeps honest negations", (): void => {
    const body = {
      questionMining: {
        prose:
          "The highest-frequency buyer question cluster is cost-anxiety: 'how much did your soc 2 type 2 actually cost all-in'. Zero SOC 2 questions were observed for this subject's own category. Pricing anxiety dominates instead.",
        questions: [],
      },
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(1);
    const mining = result.body.questionMining as Record<string, unknown>;
    expect(mining.prose).toBe(
      "Zero SOC 2 questions were observed for this subject's own category. Pricing anxiety dominates instead.",
    );
  });

  it("is not shielded by a negation far from the motif (run 8081e646 sentence)", (): void => {
    const body = {
      questionMining: {
        prose:
          "The highest-frequency buyer question cluster is cost-anxiety: 'how much did your soc 2 type 2 actually cost all-in' and 'airtable per user pricing model is too high' surface as recurring Reddit threads in r/Airtable, not support tickets. These cost questions are creation-venue signals.",
        questions: [],
      },
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.motif).toBe("compliance-soc2");
    const mining = result.body.questionMining as Record<string, unknown>;
    expect(mining.prose).toBe(
      "These cost questions are creation-venue signals.",
    );
  });

  it("relabels the exemplar SOC 2 question in demand-intent question mining", (): void => {
    const body = {
      questionMining: {
        prose: "Cost anxiety dominates pre-category questions.",
        questions: [
          {
            question:
              "how much did your soc 2 type 2 actually cost all-in? auditor quotes are all over the place",
            sourceUrl: "https://www.reddit.com/r/startups/comments/abc123/x/",
            surface: "reddit",
          },
          {
            question: "is airtable worth it for a small ops team?",
            sourceUrl: "https://www.reddit.com/r/Airtable/comments/zzz999/x/",
            surface: "reddit",
          },
        ],
      },
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.motif).toBe("compliance-soc2");
    const mining = result.body.questionMining as Record<string, unknown>;
    const questions = mining.questions as Array<Record<string, unknown>>;
    expect(questions[0]?.question).toBe(
      "evidence gap: question removed — exemplar-derived question, not observed for this subject",
    );
    expect(questions[1]?.question).toBe(
      "is airtable worth it for a small ops team?",
    );
  });

  it("keeps SOC 2 questions for a subject whose evidence is about SOC 2", (): void => {
    const body = {
      keywordDemand: {
        rows: [{ keyword: "soc 2 compliance software", monthlyVolume: "1,300" }],
      },
      questionMining: {
        questions: [
          {
            question: "how much did your soc 2 type 2 actually cost all-in?",
            surface: "reddit",
          },
        ],
      },
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningDemandIntent",
    });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });

  it("strips the exemplar ERP-stack pair but keeps a single integration mention", (): void => {
    const body = {
      audienceTypes: [
        {
          detail:
            "Worried about ERP integration? Syncs with NetSuite, QuickBooks, Xero, and Sage. Airtable connects to your existing stack.",
        },
        {
          detail: "Teams already exporting reports to QuickBooks each week.",
        },
      ],
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningPaidMediaPlan",
    });

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.motif).toBe("fintech-erp-stack");
    const audienceTypes = result.body.audienceTypes as Array<
      Record<string, unknown>
    >;
    expect(audienceTypes[0]?.detail).toBe(
      "Worried about ERP integration? Airtable connects to your existing stack.",
    );
    expect(audienceTypes[1]?.detail).toBe(
      "Teams already exporting reports to QuickBooks each week.",
    );
  });

  it("does not touch sections without deployable-copy surfaces", (): void => {
    const body = {
      painLanguage: {
        prose: "Buyers complain about per-seat pricing and receipt chaos.",
      },
    };

    const result = stripExemplarEchoes({
      body,
      sectionId: "positioningVoiceOfCustomer",
    });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });
});

describe("downgradeUnpermalinkedVerbatimQuotes", (): void => {
  // The five real publicWeaknesses items from run 8081e646.
  const buildBody = (): Record<string, unknown> => ({
    publicWeaknesses: {
      items: [
        {
          competitor: "Smartsheet",
          source: "G2 review snippet (retrieved via search)",
          sourceUrl: "https://www.g2.com/products/smartsheet/reviews",
          verbatimQuote:
            "took us almost a month before the numbers matched our store data",
          whyItMatters: "Onboarding friction.",
        },
        {
          competitor: "Notion",
          source: "Reddit r/Airtable thread",
          sourceUrl:
            "https://www.reddit.com/r/Airtable/comments/1r1wice/looking_for_airtable_alternatives_for_small/",
          verbatimQuote:
            "Notion is great for docs but terrible for structured data",
          whyItMatters: "Structured-data gap.",
        },
        {
          competitor: "Monday.com",
          source: "G2 review snippet (retrieved via search)",
          sourceUrl: "https://www.g2.com/products/monday-com/reviews",
          verbatimQuote:
            "Monday.com is great for visual tracking but falls apart once you need reporting",
          whyItMatters: "Reporting ceiling.",
        },
        {
          competitor: "ClickUp",
          source: "Reddit community thread (retrieved via search)",
          sourceUrl: "https://www.reddit.com/r/clickup/",
          verbatimQuote:
            "ClickUp tries to do everything and as a result nothing works perfectly",
          whyItMatters: "Sprawl complaint.",
        },
        {
          competitor: "Smartsheet",
          source: "Smartsheet pricing page analysis (SmartSuite blog)",
          sourceUrl: "https://www.smartsuite.com/blog/smartsheet-pricing",
          verbatimQuote:
            "Smartsheet Business requires a minimum of 3 users at $19/seat",
          whyItMatters: "Pricing floor.",
        },
      ],
      prose: "Public weakness patterns across the competitive set.",
    },
  });

  it("downgrades index-page and vendor-blog quotes, keeps thread permalinks", (): void => {
    const result = downgradeUnpermalinkedVerbatimQuotes({ body: buildBody() });

    expect(result.stripped).toHaveLength(4);
    expect(result.stripped.map((item) => item.field)).toEqual([
      "body.publicWeaknesses.items[0].verbatimQuote",
      "body.publicWeaknesses.items[2].verbatimQuote",
      "body.publicWeaknesses.items[3].verbatimQuote",
      "body.publicWeaknesses.items[4].verbatimQuote",
    ]);

    const weaknesses = result.body.publicWeaknesses as Record<string, unknown>;
    const items = weaknesses.items as Array<Record<string, unknown>>;
    expect(items[0]?.verbatimQuote).toMatch(
      /^Paraphrased pattern \(no per-review permalink\): took us almost/,
    );
    expect(items[0]?.source).toMatch(/page-level source/);
    // The real Reddit thread permalink survives untouched.
    expect(items[1]?.verbatimQuote).toBe(
      "Notion is great for docs but terrible for structured data",
    );
    expect(items[1]?.source).toBe("Reddit r/Airtable thread");
  });

  it("keeps a true per-review permalink verbatim", (): void => {
    const body = {
      publicWeaknesses: {
        items: [
          {
            competitor: "Smartsheet",
            source: "G2 review",
            sourceUrl:
              "https://www.g2.com/products/smartsheet/reviews/smartsheet-review-10386642",
            verbatimQuote: "the formula syntax fights you at every step",
            whyItMatters: "Formula friction.",
          },
        ],
        prose: "x",
      },
    };

    const result = downgradeUnpermalinkedVerbatimQuotes({ body });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });

  it("is idempotent for already-downgraded quotes", (): void => {
    const first = downgradeUnpermalinkedVerbatimQuotes({ body: buildBody() });
    const second = downgradeUnpermalinkedVerbatimQuotes({ body: first.body });

    expect(second.stripped).toHaveLength(0);
    expect(second.body).toBe(first.body);
  });

  it("downgrades a Reddit pseudo-permalink whose id segment is a topic slug", (): void => {
    const body = {
      publicWeaknesses: {
        items: [
          {
            competitor: "Smartsheet",
            source: "Reddit thread",
            sourceUrl:
              "https://www.reddit.com/r/projectmanagement/comments/people-hate-pricing/",
            verbatimQuote: "the pricing doubled overnight",
            whyItMatters: "Pricing shock.",
          },
        ],
        prose: "x",
      },
    };

    const result = downgradeUnpermalinkedVerbatimQuotes({ body });

    expect(result.stripped).toHaveLength(1);
    const weaknesses = result.body.publicWeaknesses as Record<string, unknown>;
    const items = weaknesses.items as Array<Record<string, unknown>>;
    expect(items[0]?.verbatimQuote).toMatch(/^Paraphrased pattern/);
  });

  it("ignores bodies without publicWeaknesses", (): void => {
    const body = { competitorSet: { competitors: [], prose: "x" } };

    const result = downgradeUnpermalinkedVerbatimQuotes({ body });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });
});

describe("scrubQuoteEmails", (): void => {
  it("replaces an email address inside a quote card and records field + count only", (): void => {
    const body = {
      retentionSignals: {
        quotes: [
          {
            source: "Trustpilot",
            verbatimText:
              "Support never replied — I emailed riley.sparkman@airtable.com twice and got silence.",
          },
        ],
      },
    };

    const result = scrubQuoteEmails({ body });

    expect(result.stripped).toEqual([
      {
        count: 1,
        field: "body.retentionSignals.quotes[0].verbatimText",
      },
    ]);
    const signals = result.body.retentionSignals as Record<string, unknown>;
    const quotes = signals.quotes as Array<Record<string, unknown>>;
    expect(quotes[0]?.verbatimText).toBe(
      "Support never replied — I emailed [email removed] twice and got silence.",
    );
    expect(JSON.stringify(result.stripped)).not.toContain("airtable.com");
  });

  it("leaves emails outside quote-card fields alone", (): void => {
    const body = {
      contactChannel: { prose: "Press contact: press@example.com" },
    };

    const result = scrubQuoteEmails({ body });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });
});

describe("downgradeUnpermalinkedVocQuotes", (): void => {
  const buildVocBody = (): Record<string, unknown> => ({
    painLanguage: {
      prose: "Pain themes cluster around sync limits.",
      quotes: [
        {
          verbatimText: "the base just stops syncing once you cross 50k rows",
          source: "g2",
          sourceUrl: "https://www.g2.com/products/airtable/reviews",
          painTheme: "scale ceiling",
          painIntensity: "high",
        },
        {
          verbatimText: "we hit the API rate limit weekly",
          source: "reddit",
          sourceUrl:
            "https://www.reddit.com/r/Airtable/comments/1r1wice/looking_for_airtable_alternatives_for_small/",
          painTheme: "rate limits",
          painIntensity: "medium",
        },
      ],
    },
    successLanguage: {
      prose: "Wins cluster around onboarding speed.",
      quotes: [
        {
          verbatimText: "we shipped our tracker in a single afternoon",
          source: "capterra",
          sourceUrl: "https://www.capterra.com/p/146652/Airtable/reviews/",
          afterStatePattern: "fast time-to-value",
        },
      ],
    },
    decisionCriteria: {
      prose: "Buyers weigh integrations first.",
      criteria: [
        {
          criterion: "native integrations",
          statedBy: "buyer",
          evidenceQuote: "we picked it because it talks to everything we use",
          sourceUrl: "https://www.g2.com/products/airtable/reviews",
        },
      ],
    },
  });

  it("relabels index-page VoC quotes as paraphrased patterns without touching the source enum", (): void => {
    const body = buildVocBody();
    const result = downgradeUnpermalinkedVocQuotes({ body });

    expect(result.stripped.map((item) => item.field)).toEqual([
      "body.painLanguage.quotes[0].verbatimText",
      "body.successLanguage.quotes[0].verbatimText",
      "body.decisionCriteria.criteria[0].evidenceQuote",
    ]);

    const painLanguage = result.body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const successLanguage = result.body.successLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const decisionCriteria = result.body.decisionCriteria as {
      criteria: Array<Record<string, unknown>>;
    };

    expect(painLanguage.quotes[0]?.verbatimText).toMatch(
      /^Paraphrased pattern \(no per-review permalink\): the base just stops/,
    );
    // The VoC source field is a closed enum: never suffixed.
    expect(painLanguage.quotes[0]?.source).toBe("g2");
    // The real Reddit thread permalink survives untouched.
    expect(painLanguage.quotes[1]?.verbatimText).toBe(
      "we hit the API rate limit weekly",
    );
    expect(successLanguage.quotes[0]?.verbatimText).toMatch(
      /^Paraphrased pattern/,
    );
    expect(decisionCriteria.criteria[0]?.evidenceQuote).toMatch(
      /^Paraphrased pattern/,
    );
  });

  it("records the downgrade without prefixing text when prefixQuoteText is false", (): void => {
    const body = buildVocBody();
    const result = downgradeUnpermalinkedVocQuotes({
      body,
      prefixQuoteText: false,
    });

    // The deterministic downgrade is still RECORDED for the audit trail.
    expect(result.stripped.map((item) => item.field)).toEqual([
      "body.painLanguage.quotes[0].verbatimText",
      "body.successLanguage.quotes[0].verbatimText",
      "body.decisionCriteria.criteria[0].evidenceQuote",
    ]);

    const painLanguage = result.body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const successLanguage = result.body.successLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const decisionCriteria = result.body.decisionCriteria as {
      criteria: Array<Record<string, unknown>>;
    };

    // No "Paraphrased pattern …" prefix leaks into client-facing quote text on
    // the gap path; the block-level directional verdict carries the permalink
    // caveat instead.
    expect(painLanguage.quotes[0]?.verbatimText).toBe(
      "the base just stops syncing once you cross 50k rows",
    );
    expect(successLanguage.quotes[0]?.verbatimText).toBe(
      "we shipped our tracker in a single afternoon",
    );
    expect(decisionCriteria.criteria[0]?.evidenceQuote).toBe(
      "we picked it because it talks to everything we use",
    );
    // The real Reddit thread permalink still survives untouched.
    expect(painLanguage.quotes[1]?.verbatimText).toBe(
      "we hit the API rate limit weekly",
    );
  });

  it("is idempotent and ignores bodies without VoC quote blocks", (): void => {
    const first = downgradeUnpermalinkedVocQuotes({ body: buildVocBody() });
    const second = downgradeUnpermalinkedVocQuotes({ body: first.body });

    expect(second.stripped).toHaveLength(0);
    expect(second.body).toBe(first.body);

    const unrelated = { competitorSet: { competitors: [], prose: "x" } };
    const result = downgradeUnpermalinkedVocQuotes({ body: unrelated });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(unrelated);
  });
});

describe("stripUnverifiedSourceUrls", (): void => {
  it("relabels quote-row sourceUrls whose url-claim the verifier graded unsupported", (): void => {
    const body = {
      painLanguage: {
        quotes: [
          {
            verbatimText: "exports silently drop linked records",
            source: "capterra",
            sourceUrl: "https://www.capterra.com/p/147768/Airtable/reviews/",
          },
          {
            verbatimText: "the mobile app is read-only in practice",
            source: "capterra",
            sourceUrl: "https://www.capterra.com/p/146652/Airtable/reviews/",
          },
        ],
      },
      marketSize: {
        // Non-quote rows are out of scope for this strip.
        signals: [
          {
            evidence: "Category grows 12% annually.",
            sourceUrl: "https://www.capterra.com/p/147768/Airtable/reviews/",
          },
        ],
      },
    };

    const result = stripUnverifiedSourceUrls({
      body,
      unsupportedUrls: new Set([
        "https://www.capterra.com/p/147768/Airtable/reviews/",
      ]),
    });
    const painLanguage = result.body.painLanguage as {
      quotes: Array<Record<string, unknown>>;
    };
    const marketSize = result.body.marketSize as {
      signals: Array<Record<string, unknown>>;
    };

    // The fabricated product-id URL is relabeled to the evidence-gap marker;
    // the quote text survives. The tool-observed sibling URL is untouched.
    expect(painLanguage.quotes[0]?.sourceUrl).toBe(placeholderSourceUrlRelabel);
    expect(painLanguage.quotes[0]?.verbatimText).toBe(
      "exports silently drop linked records",
    );
    expect(painLanguage.quotes[1]?.sourceUrl).toBe(
      "https://www.capterra.com/p/146652/Airtable/reviews/",
    );
    expect(marketSize.signals[0]?.sourceUrl).toBe(
      "https://www.capterra.com/p/147768/Airtable/reviews/",
    );
    expect(result.stripped).toEqual([
      {
        field: "body.painLanguage.quotes[0].sourceUrl",
        reason:
          "model-authored URL graded unsupported by the claim verifier: no research tool ever observed it",
        sourceUrl: "https://www.capterra.com/p/147768/Airtable/reviews/",
      },
    ]);
  });

  it("returns the same body when no unsupported url claims exist", (): void => {
    const body = {
      painLanguage: {
        quotes: [
          {
            verbatimText: "q",
            sourceUrl: "https://www.capterra.com/p/146652/Airtable/reviews/",
          },
        ],
      },
    };

    const result = stripUnverifiedSourceUrls({
      body,
      unsupportedUrls: new Set<string>(),
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });

  it("leaves an array alone when EVERY row's URL is unsupported (verifier blind spot)", (): void => {
    const body = {
      painLanguage: {
        quotes: [
          {
            verbatimText: "quote one",
            sourceUrl: "https://one.example/review",
          },
          {
            verbatimText: "quote two",
            sourceUrl: "https://two.example/review",
          },
        ],
      },
    };

    const result = stripUnverifiedSourceUrls({
      body,
      unsupportedUrls: new Set([
        "https://one.example/review",
        "https://two.example/review",
      ]),
    });

    // No tool-observed sibling = no differential fabrication signal: a
    // wholesale relabel would collapse VoC distinct-source minimums into a
    // persistence hard-fail, so the array ships unchanged.
    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });
});

describe("stripUncontainedSourceUrls", (): void => {
  it("relabels a fabricated-persona sourceUrl graded unsupported by the verifier", (): void => {
    const body = {
      personas: [
        {
          name: "Rachel Pleasants McLean",
          company: "West Elm",
          sourceUrl: "https://www.airtable.com/customer-stories/fabricated",
        },
        {
          name: "Korin Thorig",
          company: "West Elm",
          sourceUrl: "https://www.airtable.com/customer-stories/west-elm",
        },
      ],
    };

    const result = stripUncontainedSourceUrls({
      body,
      unsupportedUrls: new Set([
        "https://www.airtable.com/customer-stories/fabricated",
      ]),
    });
    const personas = result.body.personas as Array<Record<string, unknown>>;

    // The fabricated persona's URL is relabeled to a per-row evidence-gap
    // marker host; the real one is untouched. The named human survives — only
    // the unverifiable provenance is removed.
    expect(personas[0]?.sourceUrl).not.toBe(
      "https://www.airtable.com/customer-stories/fabricated",
    );
    expect(personas[0]?.sourceUrl as string).toMatch(
      /^https:\/\/evidence-gap-\d+\.invalid\//,
    );
    expect(personas[0]?.name).toBe("Rachel Pleasants McLean");
    expect(personas[1]?.sourceUrl).toBe(
      "https://www.airtable.com/customer-stories/west-elm",
    );
    expect(result.stripped).toEqual([
      expect.objectContaining({
        field: "body.personas[0].sourceUrl",
        sourceUrl: "https://www.airtable.com/customer-stories/fabricated",
      }),
    ]);
  });

  it("relabels an inline market-stat URL the verifier graded unsupported", (): void => {
    const body = {
      marketSize: {
        signals: [
          {
            evidence: "The no-code market grows 23% annually.",
            sourceUrl: "https://invented-analyst.example/report",
          },
        ],
      },
    };

    const result = stripUncontainedSourceUrls({
      body,
      unsupportedUrls: new Set(["https://invented-analyst.example/report"]),
    });
    const signals = (result.body.marketSize as Record<string, unknown>)
      .signals as Array<Record<string, unknown>>;

    // Unlike stripUnverifiedSourceUrls, this strip is NOT gated on a quote-card
    // field or a tool-observed sibling, so a lone inline market-stat URL is
    // caught. The evidence text survives.
    expect(signals[0]?.sourceUrl as string).toMatch(
      /^https:\/\/evidence-gap-\d+\.invalid\//,
    );
    expect(signals[0]?.evidence).toBe("The no-code market grows 23% annually.");
    expect(result.stripped).toHaveLength(1);
  });

  it("does NOT relabel a trusted host even when graded unsupported", (): void => {
    const body = {
      personas: [
        {
          name: "Korin Thorig",
          company: "West Elm",
          sourceUrl: "https://www.airtable.com/customer-stories/west-elm",
        },
      ],
    };

    const result = stripUncontainedSourceUrls({
      body,
      unsupportedUrls: new Set([
        "https://www.airtable.com/customer-stories/west-elm",
      ]),
      trustedHosts: new Set(["airtable.com"]),
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });

  it("CRITICAL REGRESSION: 3 uncontained VoC pain sources still persist as 3 distinct hosts", (): void => {
    // The VoC distinct-source minimum (VOC_MIN_DOMAINS=3) keys on hostname.
    // A shared marker host would collapse these three uncontained rows to ONE
    // host and kill the section at persistence. Per-row UNIQUE marker hosts
    // keep the distinct-host count at 3.
    const body = {
      painLanguage: {
        prose: "Reviewers report recurring sync and mobile friction.",
        quotes: [
          {
            verbatimText: "sync silently fails",
            source: "g2",
            sourceUrl: "https://www.g2.com/products/airtable/reviews/1",
          },
          {
            verbatimText: "mobile app is read-only",
            source: "capterra",
            sourceUrl: "https://www.capterra.com/p/146652/Airtable/reviews/2",
          },
          {
            verbatimText: "randomly stops working",
            source: "trustpilot",
            sourceUrl: "https://www.trustpilot.com/review/airtable.com/3",
          },
        ],
      },
    };

    const result = stripUncontainedSourceUrls({
      body,
      unsupportedUrls: new Set([
        "https://www.g2.com/products/airtable/reviews/1",
        "https://www.capterra.com/p/146652/Airtable/reviews/2",
        "https://www.trustpilot.com/review/airtable.com/3",
      ]),
    });
    const quotes = (result.body.painLanguage as Record<string, unknown>)
      .quotes as Array<Record<string, unknown>>;

    // All three relabeled, every quote text preserved.
    expect(result.stripped).toHaveLength(3);
    expect(quotes.map((quote) => quote.verbatimText)).toEqual([
      "sync silently fails",
      "mobile app is read-only",
      "randomly stops working",
    ]);

    // The load-bearing guard: distinct hostname count stays at 3, so the
    // VOC_MIN_DOMAINS floor is NOT collapsed and the section persists.
    const distinctHosts = new Set(
      quotes.map((quote) => sourceHostKey(quote.sourceUrl as string)),
    );
    expect(distinctHosts.size).toBe(3);
    // ...and none of them is the shared single-host marker that would have
    // tripped the floor.
    expect(distinctHosts.has(sourceHostKey(placeholderSourceUrlRelabel))).toBe(
      false,
    );
  });

  it("returns the same body when no unsupported url claims exist", (): void => {
    const body = {
      personas: [
        {
          name: "Korin Thorig",
          sourceUrl: "https://www.airtable.com/customer-stories/west-elm",
        },
      ],
    };

    const result = stripUncontainedSourceUrls({
      body,
      unsupportedUrls: new Set<string>(),
    });

    expect(result.body).toBe(body);
    expect(result.stripped).toEqual([]);
  });
});

describe("stripPlaceholderSourceUrls", (): void => {
  it("relabels placeholder-shaped sourceUrls and records each strike", (): void => {
    const body = {
      audienceSignals: {
        items: [
          {
            detail: "B2B ops community",
            sourceUrl: "https://www.linkedin.com/groups/12345",
          },
          {
            detail: "Generic doc",
            sourceUrl: "https://example.com/research/report",
          },
          {
            detail: "Pseudo thread",
            sourceUrl:
              "https://www.reddit.com/r/airtable/comments/why-users-switch-tools/",
          },
          {
            detail: "Sequential id",
            sourceUrl:
              "https://www.g2.com/products/foo/reviews/foo-review-123456789",
          },
        ],
      },
    };

    const result = stripPlaceholderSourceUrls({ body });

    expect(result.stripped).toHaveLength(4);
    expect(result.stripped.map((item) => item.field)).toEqual([
      "body.audienceSignals.items[0].sourceUrl",
      "body.audienceSignals.items[1].sourceUrl",
      "body.audienceSignals.items[2].sourceUrl",
      "body.audienceSignals.items[3].sourceUrl",
    ]);
    expect(result.stripped[0]?.sourceUrl).toBe(
      "https://www.linkedin.com/groups/12345",
    );
    expect(result.stripped[0]?.reason).toMatch(/LinkedIn group/);
    expect(result.stripped[1]?.reason).toMatch(/example\.com/);
    expect(result.stripped[2]?.reason).toMatch(/pseudo-permalink/);
    expect(result.stripped[3]?.reason).toMatch(/sequential-digit/);

    const signals = result.body.audienceSignals as Record<string, unknown>;
    const items = signals.items as Array<Record<string, unknown>>;
    // Schema-legal null-equivalent: still a non-empty parseable URL.
    expect(items.map((item) => item.sourceUrl)).toEqual([
      placeholderSourceUrlRelabel,
      placeholderSourceUrlRelabel,
      placeholderSourceUrlRelabel,
      placeholderSourceUrlRelabel,
    ]);
    // The rows and their claims survive; only the fabricated URLs go.
    expect(items.map((item) => item.detail)).toEqual([
      "B2B ops community",
      "Generic doc",
      "Pseudo thread",
      "Sequential id",
    ]);
  });

  it("keeps real source URLs untouched and returns the same body", (): void => {
    const body = {
      rows: [
        {
          sourceUrl:
            "https://www.reddit.com/r/Airtable/comments/1r1wice/looking_for_airtable_alternatives_for_small/",
        },
        {
          sourceUrl:
            "https://www.g2.com/products/smartsheet/reviews/smartsheet-review-10386642",
        },
        { sourceUrl: "https://www.linkedin.com/groups/13720748/" },
        { sourceUrl: "https://www.smartsuite.com/blog/smartsheet-pricing" },
      ],
    };

    const result = stripPlaceholderSourceUrls({ body });

    expect(result.stripped).toHaveLength(0);
    expect(result.body).toBe(body);
  });

  it("exempts the example-host shape for hosts vouched by the research input", (): void => {
    const trustedHosts = buildPlaceholderTrustedHosts({
      company: { websiteUrl: "https://example.com/saaslaunch" },
      corpus: {
        excerpts: [{ sourceUrl: "https://www.example.com/notes" }],
      },
    });
    const body = {
      rows: [
        { sourceUrl: "https://example.com/saaslaunch/positioning-notes" },
        // Structural shapes stay struck even on a trusted host.
        { sourceUrl: "https://example.com/p/1234567" },
      ],
    };

    const result = stripPlaceholderSourceUrls({ body, trustedHosts });

    expect(result.stripped).toHaveLength(1);
    expect(result.stripped[0]?.reason).toMatch(/sequential-digit/);
    const rows = result.body.rows as Array<Record<string, unknown>>;
    expect(rows[0]?.sourceUrl).toBe(
      "https://example.com/saaslaunch/positioning-notes",
    );
    expect(rows[1]?.sourceUrl).toBe(placeholderSourceUrlRelabel);
  });

  it("is idempotent: relabeled sourceUrls are not re-struck", (): void => {
    const body = {
      rows: [
        { sourceUrl: "https://example.org/made-up" },
      ],
    };

    const first = stripPlaceholderSourceUrls({ body });
    const second = stripPlaceholderSourceUrls({ body: first.body });

    expect(first.stripped).toHaveLength(1);
    expect(second.stripped).toHaveLength(0);
    expect(second.body).toBe(first.body);
  });
});
