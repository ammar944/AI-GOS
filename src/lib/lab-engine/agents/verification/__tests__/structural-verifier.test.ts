import { describe, expect, it, vi } from "vitest";

import { buildAdEvidenceWallDigestStep } from "../../ad-evidence-wall-digest";
import {
  formatKeywordVolumeDisplay,
  SPYFU_SOURCE_URL,
} from "../../tools/keyword-volume";
import {
  structuralVerifier,
  structuralVerifierWithEntailment,
  type EntailmentJudge,
} from "../structural-verifier";

describe("structuralVerifier", (): void => {
  it("credits onboarding economics as user-asserted support", (): void => {
    const report = structuralVerifier({
      body: {
        economics: {
          monthlyBudget: "$75,000 monthly ad budget",
          targetCac: "$8K target CAC",
          demoToClose: "20% demo-to-close rate",
        },
      },
      toolResults: [],
      corpusExcerpts: [],
      onboarding: {
        economics: {
          monthlyAdBudget: "$75,000",
          targetCac: "$8K",
          demoToClose: "20%",
        },
      },
    });

    expect(report.unsupportedCount).toBe(0);
    expect(report.verifiedCount).toBeGreaterThanOrEqual(3);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$75,000" }),
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({
            kind: "userProvided",
            field: "economics.monthlyAdBudget",
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$8K" }),
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({
            kind: "userProvided",
            field: "economics.targetCac",
          }),
        }),
      ]),
    );
  });

  it("credits a brief-economics money range as user_asserted despite format variance", (): void => {
    // The operator brief stores the ACV range as "1k_10k" (underscore-joined,
    // no currency symbol). The section model writes it as "$1k–$10k" and
    // honestly flags it operator-reported. The current substring/range matcher
    // misses it (underscore separator breaks the full-span match) and the
    // literal operator-provenance markers ("operator-supplied"/"client brief")
    // do not match "operator-reported" — so the honest operator number gate-fails.
    // It must be credited as user_asserted: the value IS in the brief.
    const report = structuralVerifier({
      body: {
        marketSize: {
          prose:
            "Operator-reported ACV is $1k–$10k; no independently sourced ACV benchmark was found.",
        },
      },
      toolResults: [],
      corpusExcerpts: [],
      onboarding: {
        economics: {
          acv: "1k_10k",
        },
      },
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({
            kind: "numeric",
            value: "$1k–$10k",
          }),
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({ kind: "userProvided" }),
        }),
      ]),
    );
  });

  it("does not credit an invented magnitude numeric as operator input when only small digits overlap the brief", (): void => {
    // $20B is fabricated. A NAIVE brief-digit exemption would credit it because
    // the bare token "20" appears in the brief (demoToClose "20%"). The credit
    // must require the claim's SIGNIFICANT money tokens (magnitude-resolved /
    // multi-digit) to be present in the brief — never a bare small-int overlap —
    // or the gate is laundered.
    const report = structuralVerifier({
      body: {
        marketSize: {
          prose: "The total addressable market is $20B.",
        },
      },
      toolResults: [],
      corpusExcerpts: [],
      onboarding: {
        economics: {
          acv: "1k_10k",
          demoToClose: "20%",
        },
      },
    });

    expect(
      report.claims.filter(
        (verdict) =>
          verdict.claim.kind === "numeric" &&
          verdict.entailmentVerdict === "user_asserted",
      ),
    ).toEqual([]);
  });

  it("verifies numeric, quote, url, and entity-name claims against tool results and corpus excerpts", (): void => {
    const report = structuralVerifier({
      body: {
        competitorSet: {
          competitors: [
            {
              name: "Gong",
              sourceUrl: "https://www.gong.io/pricing",
              evidence:
                'Gong says "setup takes two weeks before forecast views stabilize" and references 200M interactions.',
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
      },
      toolResults: [
        {
          toolName: "web_search",
          input: { q: "Gong pricing" },
          output: {
            url: "https://www.gong.io/pricing",
            text:
              "Gong pricing includes a $49/mo plan. Gong reports 200 million interactions. Buyers say setup takes two weeks before forecast views stabilize.",
          },
        },
      ],
      corpusExcerpts: [
        {
          text: "Gong is a revenue intelligence competitor in this category.",
          sourceUrl: "https://www.gong.io/pricing",
        },
      ],
    });

    expect(report.unsupportedCount).toBe(0);
    expect(report.verifiedCount).toBeGreaterThanOrEqual(5);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$49.00/mo" }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "web_search",
            stepIndex: 0,
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "quote" }),
          matchedSourceRef: expect.objectContaining({ kind: "toolResult" }),
        }),
      ]),
    );
  });

  it("flags fabricated numeric and quote claims as unsupported", (): void => {
    const report = structuralVerifier({
      body: {
        pricingReality: {
          dataPoints: [{ price: "$99/mo", sourceUrl: "https://example.com/pricing" }],
        },
        proof: '"customers recover implementation costs in the first week"',
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            sourceUrl: "https://example.com/pricing",
            markdown: "Pricing starts at $49/mo. Customers report annual payback.",
          },
        },
      ],
      corpusExcerpts: [],
    });

    expect(report.unsupportedCount).toBe(2);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
          reason: "no_match",
        }),
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({
            kind: "quote",
            value: "customers recover implementation costs in the first week",
          }),
          reason: "no_match",
        }),
      ]),
    );
  });

  it("does not verify a numeric range from scalar endpoint-like source text", (): void => {
    const report = structuralVerifier({
      body: {
        marketSize:
          "Reachable revenue is $1.3M–$2.6M based on current demand.",
      },
      toolResults: [
        {
          toolName: "web_search",
          output: {
            text:
              "The category includes $1.3B and $11.7B market estimates, but no reachable-revenue range.",
          },
        },
      ],
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: expect.objectContaining({ value: "$1.3M–$2.6M" }),
          reason: "no_match",
          status: "unsupported",
        }),
      ]),
    );
  });

  it("verifies a numeric range only when the full span is present with normalized separators", (): void => {
    const report = structuralVerifier({
      body: {
        marketSize:
          "Reachable revenue is $1.3M–$2.6M based on current demand.",
      },
      toolResults: [
        {
          toolName: "web_search",
          output: {
            text:
              "The source reports a reachable revenue span of $1.3m-$2.6m for the target segment.",
          },
        },
      ],
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: expect.objectContaining({ value: "$1.3M–$2.6M" }),
          matchedSourceRef: expect.objectContaining({ kind: "toolResult" }),
          status: "verified",
        }),
      ]),
    );
  });

  it("flags source-scoped prose when the cited source lacks a named entity in the claim", (): void => {
    const report = structuralVerifier({
      body: {
        structuralForces: {
          forces: [
            {
              evidence:
                "Both Microsoft and Google embed low-code database and automation capabilities in enterprise suites (Power Apps in E5, AppSheet in Workspace) at zero marginal cost.",
              sourceUrl: "https://about.google/appsheet/",
            },
          ],
        },
      },
      toolResults: [
        {
          toolName: "web_search",
          output: {
            sourceUrl: "https://about.google/appsheet/",
            text:
              "Google AppSheet helps teams build apps and automations for Google Workspace users.",
          },
        },
      ],
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: expect.objectContaining({
            assertedSourceUrl: "https://about.google/appsheet/",
            kind: "sourceAttribution",
          }),
          reason: "no_match",
          status: "unsupported",
        }),
      ]),
    );
  });

  it("verifies source-scoped prose when the cited source contains all named entities", (): void => {
    const report = structuralVerifier({
      body: {
        structuralForces: {
          forces: [
            {
              evidence:
                "Both Microsoft and Google embed low-code database and automation capabilities in enterprise suites (Power Apps in E5, AppSheet in Workspace) at zero marginal cost.",
              sourceUrl: "https://example.com/platform-bundles",
            },
          ],
        },
      },
      toolResults: [
        {
          toolName: "web_search",
          output: {
            sourceUrl: "https://example.com/platform-bundles",
            text:
              "Microsoft Power Apps is included in E5, while Google AppSheet is bundled for Google Workspace customers.",
          },
        },
      ],
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          claim: expect.objectContaining({
            assertedSourceUrl: "https://example.com/platform-bundles",
            kind: "sourceAttribution",
          }),
          matchedSourceRef: expect.objectContaining({ kind: "toolResult" }),
          status: "verified",
        }),
      ]),
    );
  });

  it("credits operator-self-labeled economics as user_asserted even when derived", (): void => {
    const report = structuralVerifier({
      body: {
        channelBudget:
          "Operator-supplied 35% of $75K/mo budget ($26.25K/mo) allocated to paid search.",
      },
      toolResults: [],
      corpusExcerpts: [],
    });

    // The derived $26.25K is not in any public source, but the claim self-labels
    // as operator-supplied, so it is honestly user_asserted (not unsupported).
    expect(report.unsupportedCount).toBe(0);
    expect(report.verifiedCount).toBeGreaterThanOrEqual(1);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          entailmentVerdict: "user_asserted",
          matchedSourceRef: expect.objectContaining({ kind: "userProvided" }),
        }),
      ]),
    );
  });

  it("does not rescue genuinely-inferred or undisclosed claims", (): void => {
    const report = structuralVerifier({
      body: {
        retentionHealth:
          "Inferred average ACV ~$14.3K. Ramp does not publicly disclose churn or NDR.",
      },
      toolResults: [],
      corpusExcerpts: [],
    });

    expect(report.verifiedCount).toBe(0);
    expect(report.unsupportedCount).toBeGreaterThanOrEqual(1);
    expect(
      report.claims.every((verdict) => verdict.status === "unsupported"),
    ).toBe(true);
  });

  it("uses a single batched entailment judge for paraphrase support and refuted numbers", async (): Promise<void> => {
    const judge = vi.fn<EntailmentJudge>(async ({ claims }) => ({
      verdicts: claims.map((claim, claimIndex) => ({
        claimIndex,
        verdict: claim.value === "$49/mo" ? "supported" : "refuted",
        ...(claim.value === "$49/mo" ? { sourceIndex: 0 } : {}),
        rationale:
          claim.value === "$49/mo"
            ? "The source says entry pricing is forty-nine dollars per month."
            : "The source does not support the fabricated $99/mo price.",
      })),
    }));

    const report = await structuralVerifierWithEntailment({
      body: {
        pricingReality: {
          supportedPrice: "$49/mo",
          fabricatedPrice: "$99/mo",
        },
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            sourceUrl: "https://example.com/pricing",
            markdown:
              "Entry pricing is forty-nine dollars per month for the starter plan.",
          },
        },
      ],
      corpusExcerpts: [],
      judge,
    });

    expect(judge).toHaveBeenCalledTimes(1);
    expect(judge.mock.calls[0]?.[0].claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "numeric", value: "$49/mo" }),
        expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
      ]),
    );
    expect(report.verifiedCount).toBe(1);
    expect(report.unsupportedCount).toBe(1);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$49/mo" }),
          entailmentVerdict: "supported",
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "firecrawl",
          }),
        }),
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
          entailmentVerdict: "refuted",
          reason: "no_match",
        }),
      ]),
    );
  });

  it("falls back to deterministic verification when the entailment judge fails", async (): Promise<void> => {
    const judge = vi.fn<EntailmentJudge>(async () => {
      throw new Error("judge unavailable");
    });

    const report = await structuralVerifierWithEntailment({
      body: {
        pricingReality: {
          supportedPrice: "$49/mo",
          fabricatedPrice: "$99/mo",
        },
      },
      toolResults: [
        {
          toolName: "firecrawl",
          output: {
            sourceUrl: "https://example.com/pricing",
            markdown: "Pricing starts at $49/mo.",
          },
        },
      ],
      corpusExcerpts: [],
      judge,
    });

    expect(judge).toHaveBeenCalledTimes(1);
    expect(report.verifiedCount).toBe(1);
    expect(report.unsupportedCount).toBe(1);
    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$49/mo" }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "firecrawl",
          }),
        }),
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({ kind: "numeric", value: "$99/mo" }),
          reason: "no_match",
        }),
      ]),
    );
  });
});

// W5 tool-evidence provenance bridge: tool-measured figures must verify against
// the tool's own output. Run 1d0a4831 baseline: every SpyFu keyword row and
// every ad-wall evidence line died as no_match because the keyword_volume
// output carried no URL (numericAttribution filters sources by assertedSourceUrl)
// and wall counts existed only in group metadata, not in any source text.
describe("structuralVerifier tool-evidence provenance bridge", (): void => {
  const spyFuToolResult = {
    toolName: "keyword_volume",
    input: { keywords: ["airtable pricing", "airtable vs notion"] },
    output: {
      type: "result",
      source: "SpyFu",
      sourceUrl: SPYFU_SOURCE_URL,
      keywords: [
        {
          keyword: "airtable pricing",
          searchVolume: 4800,
          cpc: 38.63,
          difficulty: 27,
          display: formatKeywordVolumeDisplay({
            cpc: 38.63,
            difficulty: 27,
            keyword: "airtable pricing",
            searchVolume: 4800,
          }),
        },
        {
          keyword: "airtable vs notion",
          searchVolume: 660,
          cpc: null,
          difficulty: 15,
          display: formatKeywordVolumeDisplay({
            cpc: null,
            difficulty: 15,
            keyword: "airtable vs notion",
            searchVolume: 660,
          }),
        },
      ],
    },
  };

  it("verifies SpyFu-attributed keyword rows against the enriched keyword_volume output", (): void => {
    const report = structuralVerifier({
      body: {
        keywordDemand: {
          keywords: [
            {
              keyword: "airtable pricing",
              monthlyVolume: "4,800 (SpyFu-estimated)",
              cpc: "$38.63 (SpyFu-estimated)",
              sourceUrl: SPYFU_SOURCE_URL,
            },
            {
              keyword: "airtable vs notion",
              monthlyVolume: "660 (SpyFu-estimated)",
              cpc: "n/a",
              sourceUrl: SPYFU_SOURCE_URL,
            },
          ],
        },
      },
      toolResults: [spyFuToolResult],
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({
            kind: "numericAttribution",
            value: "4,800 (SpyFu-estimated)",
          }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "keyword_volume",
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({
            kind: "numericAttribution",
            value: "660 (SpyFu-estimated)",
          }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "keyword_volume",
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "numeric", value: "$38.63" }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "keyword_volume",
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({
            kind: "url",
            value: SPYFU_SOURCE_URL,
          }),
        }),
      ]),
    );
    expect(report.unsupportedCount).toBe(0);
  });

  it("keeps invented SpyFu figures unsupported", (): void => {
    const report = structuralVerifier({
      body: {
        keywordDemand: {
          keywords: [
            {
              keyword: "airtable pricing",
              monthlyVolume: "9,999 (SpyFu-estimated)",
              sourceUrl: SPYFU_SOURCE_URL,
            },
          ],
        },
      },
      toolResults: [spyFuToolResult],
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "unsupported",
          claim: expect.objectContaining({
            kind: "numericAttribution",
            value: "9,999 (SpyFu-estimated)",
          }),
          reason: "no_match",
        }),
      ]),
    );
  });

  it("verifies ad-wall evidence lines against the wall digest step", (): void => {
    const digestStep = buildAdEvidenceWallDigestStep([
      {
        advertiserName: "Notion",
        domain: "notion.so",
        platforms: ["google", "meta"],
        rawCounts: { google: 13, meta: 17, linkedin: 0 },
        displayableCounts: { google: 13, meta: 15, linkedin: 0 },
        displayableTotal: 28,
        returnedCreativeCount: 12,
        creatives: [
          {
            id: "creative-1",
            platform: "meta",
            advertiserName: "Notion",
            headline: "See the Power in Your Automations",
            body: "One workspace for every team.",
            landingUrl: "https://www.notion.so/",
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl:
              "https://www.facebook.com/ads/library/?id=680819654125583",
            sourceUrl:
              "https://www.facebook.com/ads/library/?id=680819654125583",
            firstSeen: "2026-05-01",
            lastSeen: "2026-06-01",
            format: "image",
            isActive: true,
            source: "meta_ads",
            transcript: null,
            cta: "Learn more",
            verified: true,
          },
        ],
        libraryLinks: { meta: "https://www.facebook.com/ads/library/" },
        rawSourceSamples: [],
        dataGaps: [],
        sourceErrors: [],
        observedAt: "2026-06-11",
        identityConfidence: "verified",
        quarantinedCount: 2,
        verifiedCount: 26,
      },
    ]);

    if (digestStep === undefined) {
      throw new Error("expected a digest step for a non-empty wall");
    }

    const report = structuralVerifier({
      body: {
        adPresence: {
          rows: [
            {
              advertiser: "Notion",
              evidence:
                "28 displayable creatives (13 Google, 15 Meta). Top hook: 'See the Power in Your Automations'",
              sourceUrl:
                "https://www.facebook.com/ads/library/?id=680819654125583",
            },
          ],
        },
      },
      toolResults: digestStep.toolResults,
      corpusExcerpts: [],
    });

    expect(report.claims).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({ kind: "sourceAttribution" }),
          matchedSourceRef: expect.objectContaining({
            kind: "toolResult",
            toolName: "ad_evidence_wall_digest",
          }),
        }),
        expect.objectContaining({
          status: "verified",
          claim: expect.objectContaining({
            kind: "url",
            value: "https://www.facebook.com/ads/library/?id=680819654125583",
          }),
        }),
      ]),
    );
  });
});
