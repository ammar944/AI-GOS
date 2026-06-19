/**
 * Input Bridge Tests — GAPs 1–5
 * RED→GREEN: operator intelligence must flow from brief → ResearchInput → section prompts.
 */
import { describe, expect, it } from "vitest";

import { researchInputSchema } from "@/lib/lab-engine/artifacts/artifact-envelope";
import {
  buildOnboardingStrategicFrame,
  buildPreparedEvidencePromptRows,
  type PromptPreparedSectionContext,
} from "@/lib/lab-engine/agents/build-prompts";
import { corpusToResearchInput } from "@/lib/research-v2/corpus-to-research-input";

// ---------------------------------------------------------------------------
// Shared minimal corpus fixture (no real Perplexity data needed)
// ---------------------------------------------------------------------------
const baseCorpusFixture = {
  corpus: {
    researchSummary: "Acme is a B2B SaaS company.",
    sources: [{ title: "Acme homepage", url: "https://acme.example.com/" }],
    evidence: [
      {
        claim: "Acme automates finance workflows.",
        quote: "Finance teams use Acme to close the books 3x faster.",
        source: "Acme homepage",
        url: "https://acme.example.com/",
      },
    ],
  },
  onboardingFields: {
    companyName: { value: "Acme" },
    productDescription: { value: "Acme automates B2B finance workflows." },
    primaryIcpDescription: { value: "CFOs at mid-market companies." },
    coreDeliverables: { value: ["Finance automation", "Close-the-books tool"] },
    topCompetitors: { value: "Rippling, Brex" },
  },
};

function makeCorpusParams(extra: Record<string, unknown> = {}) {
  return {
    runId: "run_test_bridge",
    deepResearchProgramData: baseCorpusFixture,
    onboardingData: {
      websiteUrl: "https://acme.example.com/",
      primaryGoal: "Drive demo requests from CFOs.",
      ...extra,
    },
  };
}

// ---------------------------------------------------------------------------
// GAP 1 — Operator voice reaches ResearchInput (TEST A)
// ---------------------------------------------------------------------------
describe("GAP 1 — operator voice fields reach ResearchInput", () => {
  it("TEST A: voiceOfClient carries buyingTriggers, commonObjections, valueProp", () => {
    const params = makeCorpusParams({
      buyingTriggers: "New CFO hired; board pressure on cash burn.",
      commonObjections: "Too expensive; we already have Excel.",
      valueProp: "Close books 3× faster with zero manual reconciliation.",
    });
    const result = corpusToResearchInput(params);

    const voc = result.onboarding.voiceOfClient;
    expect(voc).toBeDefined();
    expect(voc?.buyingTriggers).toBe("New CFO hired; board pressure on cash burn.");
    expect(voc?.commonObjections).toBe("Too expensive; we already have Excel.");
    expect(voc?.valueProp).toBe("Close books 3× faster with zero manual reconciliation.");
  });

  it("TEST A2: all 16 voice fields map through when provided", () => {
    const params = makeCorpusParams({
      buyingTriggers: "trigger text",
      commonObjections: "objection text",
      competitorFrustrations: "frustration text",
      situationBeforeBuying: "before state",
      desiredTransformation: "after state",
      easiestToClose: "VP Finance",
      bestClientSources: "LinkedIn outbound",
      salesProcessOverview: "Demo → POC → Close",
      salesCycleLength: "30–45 days",
      testimonialQuote: "\"Saved us 20 hours a month\" — Jane, CFO",
      marketProblem: "Month-end close is broken",
      marketBottlenecks: "Data silos, manual CSV exports",
      uniqueEdge: "Only tool that reconciles in real-time",
      valueProp: "3× faster close",
      guarantees: "30-day money-back",
      jobTitles: "CFO, VP Finance, Controller",
    });
    const result = corpusToResearchInput(params);
    const voc = result.onboarding.voiceOfClient;

    expect(voc?.buyingTriggers).toBe("trigger text");
    expect(voc?.commonObjections).toBe("objection text");
    expect(voc?.competitorFrustrations).toBe("frustration text");
    expect(voc?.situationBeforeBuying).toBe("before state");
    expect(voc?.desiredTransformation).toBe("after state");
    expect(voc?.easiestToClose).toBe("VP Finance");
    expect(voc?.bestClientSources).toBe("LinkedIn outbound");
    expect(voc?.salesProcessOverview).toBe("Demo → POC → Close");
    expect(voc?.salesCycleLength).toBe("30–45 days");
    expect(voc?.testimonialQuote).toBe("\"Saved us 20 hours a month\" — Jane, CFO");
    expect(voc?.marketProblem).toBe("Month-end close is broken");
    expect(voc?.marketBottlenecks).toBe("Data silos, manual CSV exports");
    expect(voc?.uniqueEdge).toBe("Only tool that reconciles in real-time");
    expect(voc?.valueProp).toBe("3× faster close");
    expect(voc?.guarantees).toBe("30-day money-back");
    expect(voc?.jobTitles).toBe("CFO, VP Finance, Controller");
  });
});

// ---------------------------------------------------------------------------
// GAP 1 — Operator voice rendered in prompt (TEST B)
// ---------------------------------------------------------------------------
describe("GAP 1 — buildOnboardingStrategicFrame renders operator voice block", () => {
  it("TEST B: prompt contains OPERATOR-SUPPLIED CUSTOMER VOICE block with objections+triggers+valueProp", () => {
    const input = researchInputSchema.parse({
      runId: "run_test_b",
      fixtureId: "test_b",
      company: {
        id: "company_acme",
        name: "Acme",
        websiteUrl: "https://acme.example.com/",
        category: "Finance automation",
        description: "Acme automates finance.",
        stage: "growth",
        targetCustomer: "CFOs",
      },
      onboarding: {
        primaryGoal: "Drive CFO demos.",
        targetSegments: ["CFOs"],
        keyOffers: ["Finance automation"],
        distributionChannels: ["paid-search"],
        constraints: [],
        notes: "Test note.",
        voiceOfClient: {
          buyingTriggers: "New CFO; board pressure",
          commonObjections: "Too expensive",
          valueProp: "3× faster close",
        },
      },
      corpus: {
        excerpts: [
          {
            id: "ex_1",
            sourceUrl: "https://acme.example.com/",
            title: "Acme homepage",
            text: "Finance teams use Acme.",
            observedAt: "2026-01-01T00:00:00.000Z",
            sourceId: "src_1",
          },
        ],
      },
      sources: [
        {
          id: "src_1",
          title: "Acme homepage",
          url: "https://acme.example.com/",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      competitorAds: [],
    });

    const frame = buildOnboardingStrategicFrame(input);

    expect(frame).toContain("OPERATOR-SUPPLIED CUSTOMER VOICE");
    expect(frame).toContain("New CFO; board pressure");
    expect(frame).toContain("Too expensive");
    expect(frame).toContain("3× faster close");
  });
});

// ---------------------------------------------------------------------------
// GAP 2 — Provenance: brief field sourceUrl → sources[] (TEST C)
// ---------------------------------------------------------------------------
describe("GAP 2 — field sourceUrl flows into sources[]", () => {
  it("TEST C: brief field with sourceUrl appears as a source in ResearchInput.sources", () => {
    // The onboardingFields path carries sourceUrl on individual field objects.
    // We simulate this by passing a field with a sourceUrl in onboardingFields.
    const params = {
      runId: "run_test_c",
      deepResearchProgramData: {
        ...baseCorpusFixture,
        onboardingFields: {
          ...baseCorpusFixture.onboardingFields,
          valueProp: {
            value: "3× faster close",
            sourceUrl: "https://acme.example.com/customers",
            confidence: 0.9,
          },
        },
      },
      onboardingData: {
        websiteUrl: "https://acme.example.com/",
        primaryGoal: "Drive demos.",
      },
    };

    const result = corpusToResearchInput(params);

    const sourceUrls = result.sources.map((s) => s.url);
    expect(sourceUrls).toContain("https://acme.example.com/customers");
  });
});

// ---------------------------------------------------------------------------
// GAP 3 — Supplied URLs reach ResearchInput.suppliedAssetUrls (TEST D)
// ---------------------------------------------------------------------------
describe("GAP 3 — supplied asset URLs reach ResearchInput", () => {
  it("TEST D: caseStudiesUrl and pricingUrl land in ResearchInput.suppliedAssetUrls", () => {
    const params = makeCorpusParams({
      caseStudiesUrl: "https://acme.example.com/case-studies",
      pricingUrl: "https://acme.example.com/pricing",
      testimonialsUrl: "https://acme.example.com/testimonials",
      demoUrl: "https://acme.example.com/demo",
    });
    const result = corpusToResearchInput(params);

    expect(result.suppliedAssetUrls).toBeDefined();
    expect(result.suppliedAssetUrls?.caseStudiesUrl).toBe(
      "https://acme.example.com/case-studies",
    );
    expect(result.suppliedAssetUrls?.pricingUrl).toBe(
      "https://acme.example.com/pricing",
    );
    expect(result.suppliedAssetUrls?.testimonialsUrl).toBe(
      "https://acme.example.com/testimonials",
    );
    expect(result.suppliedAssetUrls?.demoUrl).toBe(
      "https://acme.example.com/demo",
    );
  });
});

// ---------------------------------------------------------------------------
// GAP 3 — Supplied URLs rendered in prompt (TEST E)
// ---------------------------------------------------------------------------
describe("GAP 3 — supplied URLs rendered with scrape directive in prompt", () => {
  it("TEST E: prompt contains PRE-SUPPLIED URLS directive listing caseStudiesUrl and pricingUrl", () => {
    const input = researchInputSchema.parse({
      runId: "run_test_e",
      fixtureId: "test_e",
      company: {
        id: "company_acme",
        name: "Acme",
        websiteUrl: "https://acme.example.com/",
        category: "Finance automation",
        description: "Acme automates finance.",
        stage: "growth",
        targetCustomer: "CFOs",
      },
      onboarding: {
        primaryGoal: "Drive CFO demos.",
        targetSegments: ["CFOs"],
        keyOffers: ["Finance automation"],
        distributionChannels: ["paid-search"],
        constraints: [],
        notes: "Test note.",
      },
      suppliedAssetUrls: {
        caseStudiesUrl: "https://acme.example.com/case-studies",
        pricingUrl: "https://acme.example.com/pricing",
      },
      corpus: {
        excerpts: [
          {
            id: "ex_1",
            sourceUrl: "https://acme.example.com/",
            title: "Acme homepage",
            text: "Finance teams use Acme.",
            observedAt: "2026-01-01T00:00:00.000Z",
            sourceId: "src_1",
          },
        ],
      },
      sources: [
        {
          id: "src_1",
          title: "Acme homepage",
          url: "https://acme.example.com/",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      competitorAds: [],
    });

    const frame = buildOnboardingStrategicFrame(input);

    expect(frame).toContain("PRE-SUPPLIED URLS");
    expect(frame).toContain("acme.example.com/case-studies");
    expect(frame).toContain("acme.example.com/pricing");
    expect(frame.toLowerCase()).toContain("scrape");
  });
});

// ---------------------------------------------------------------------------
// GAP 4 — Channel signals, honest default (TEST F)
// ---------------------------------------------------------------------------
describe("GAP 4 — channel signals and honest fallback label", () => {
  it("TEST F: currentMarketingActivities reaches channelSignals", () => {
    const params = makeCorpusParams({
      currentMarketingActivities: "LinkedIn ads, SEO content, cold outbound",
    });
    const result = corpusToResearchInput(params);

    expect(result.onboarding.channelSignals).toBeDefined();
    expect(result.onboarding.channelSignals?.currentMarketingActivities).toBe(
      "LinkedIn ads, SEO content, cold outbound",
    );
  });

  it("TEST F2: paid-search fallback distributionChannels is labeled model-estimated", () => {
    // When no distributionChannels or currentMarketingActivities are supplied,
    // the fallback is used. It must be annotated as model-estimated, not operator intent.
    const params = makeCorpusParams({
      // no distributionChannels, no currentMarketingActivities
    });
    const result = corpusToResearchInput(params);

    // The distributionChannelsMeta flag indicates the fallback is model-estimated
    expect(result.onboarding.distributionChannelsMeta).toBe("model-estimated");
  });
});

// ---------------------------------------------------------------------------
// GAP 5 — prepared row prompt helper (TEST G)
// ---------------------------------------------------------------------------
describe("GAP 5 — prepared evidence rows stay addressable", () => {
  it("TEST G: prepared prompt rows preserve row IDs, kinds, source URLs, and source text", () => {
    const preparedContext: PromptPreparedSectionContext = {
      sectionId: "positioningPaidMediaPlan",
      factRows: [
        {
          id: "fact_buyer_1",
          factKind: "named_champion",
          sectionId: "positioningBuyerICP",
          sourceId: "research_fact:positioningBuyerICP:named_champion:1",
          sourceUrl: "https://acme.example.com/customer",
          title: "Research fact: Buyer ICP / named_champion",
          text: "Sourced buyer evidence from a customer page.",
          observedAt: "2026-01-01T00:00:00.000Z",
          claimToken: "buyer evidence",
        },
      ],
      corpusRows: [
        {
          id: "corpus_voc_1",
          scope: "section",
          sourceId: "src_1",
          sourceUrl: "https://acme.example.com/reviews",
          title: "Review source",
          text: "Customer-language evidence from a review page.",
          observedAt: "2026-01-01T00:00:00.000Z",
        },
      ],
      coverageRows: [],
      toolGapRows: [],
      researchUseful: true,
    };

    const rows = buildPreparedEvidencePromptRows(preparedContext);

    expect(rows).toEqual([
      expect.objectContaining({
        rowId: "fact_buyer_1",
        kind: "fact:named_champion",
        sectionId: "positioningBuyerICP",
        sourceUrl: "https://acme.example.com/customer",
        sourceQuoteOrText: "Sourced buyer evidence from a customer page.",
      }),
      expect.objectContaining({
        rowId: "corpus_voc_1",
        kind: "corpus:section",
        sectionId: "positioningPaidMediaPlan",
        sourceUrl: "https://acme.example.com/reviews",
        sourceQuoteOrText: "Customer-language evidence from a review page.",
      }),
    ]);
  });
});
