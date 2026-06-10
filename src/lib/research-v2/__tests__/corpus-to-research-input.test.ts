import { describe, expect, it } from "vitest";

import { researchInputSchema } from "../../lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "../corpus-to-research-input";

const observedAt = new Date("2026-05-25T12:00:00.000Z");

const corpusFixture = {
  runId: "run_airtable_corpus",
  deepResearchProgramData: {
    corpus: {
      researchSummary:
        "Airtable is positioned as a collaborative app platform for teams that need flexible operations software without rebuilding every workflow from scratch.",
      sources: [
        {
          title: "Airtable homepage",
          url: "https://www.airtable.com/",
        },
        {
          title: "Airtable AI product page",
          url: "https://www.airtable.com/platform/ai",
        },
      ],
      evidence: [
        {
          claim: "Airtable combines workflow data, app interfaces, and automation in one platform.",
          quote:
            "Teams can build apps on shared data, automate work, and coordinate operational workflows without needing a dedicated engineering team.",
          source: "Airtable homepage",
          url: "https://www.airtable.com/",
        },
        {
          claim: "Airtable AI extends the workspace into assisted app building and analysis.",
          quote:
            "The product page describes AI assistance for categorizing information, generating content, and helping teams move faster inside their existing operational workflows.",
          source: "Airtable AI product page",
          url: "https://www.airtable.com/platform/ai",
        },
      ],
    },
    onboardingFields: {
      companyName: { value: "Airtable" },
      industryVertical: { value: "Collaborative work management" },
      productDescription: {
        value:
          "Airtable helps operations teams build flexible apps, track shared data, and automate workflows.",
      },
      primaryIcpDescription: {
        value:
          "Operations leaders and team managers who need custom workflow software without a long engineering queue.",
      },
      coreDeliverables: {
        value: ["Shared operational apps", "Workflow automation"],
      },
      topCompetitors: { value: "Notion, Monday.com" },
    },
  },
  onboardingData: {
    websiteUrl: "https://www.airtable.com/",
    primaryGoal: "Clarify the strongest paid-media positioning angle.",
    pricingModel: "subscription",
    conversionPath: "demo_required",
    acv: "10k_50k",
    pricingTiers: "Team: $20/seat/mo; Business: $45/seat/mo",
    targetPlan: "Business",
    avgLtv: "$18,000",
    targetCac: "$4,500",
    monthlyAdBudget: "$25,000",
    budgetSplit: "60% paid search, 40% paid social",
    currentCac: "$5,200",
    monthlyRevenue: "$180,000",
    avgSalesCycle: "45 days",
    visitorToSignup: "8%",
    signupToActivation: "35%",
    activationToPaid: "12%",
    demoToClose: "22%",
    growthTrend: "Revenue is growing 9% month over month.",
    distributionChannels: ["paid search", "paid social"],
    constraints: ["Do not imply fully autonomous workflow ownership."],
    salesProcessDocs: [
      { label: "Process overview", url: "https://docs.airtable.com/process" },
      { label: "SDR outreach SOP", url: "https://docs.airtable.com/sdr" },
    ],
    salesLoomUrl: "https://www.loom.com/share/airtable-sales-process",
    gtmMotion: "SLG",
    creativeCapacity: "standard",
    leadListAvailable: true,
  },
};

describe("corpusToResearchInput", (): void => {
  it("maps an AI-GOS deepResearchProgram corpus into a valid lab ResearchInput", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.runId).toBe("run_airtable_corpus");
    expect(parsed.fixtureId).toBe("brand_airtable");
    expect(parsed.company.stage).toBe("growth");
    expect(parsed.corpus.excerpts).toHaveLength(2);
    expect(parsed.corpus.excerpts.every((excerpt) => excerpt.text.length > 0)).toBe(
      true,
    );
    expect(parsed.competitorAds).toEqual([]);
    expect(parsed.onboarding.salesProcessDocs).toEqual([
      { label: "Process overview", url: "https://docs.airtable.com/process" },
      { label: "SDR outreach SOP", url: "https://docs.airtable.com/sdr" },
    ]);
    expect(parsed.onboarding.salesLoomUrl).toBe(
      "https://www.loom.com/share/airtable-sales-process",
    );
    expect(parsed.onboarding.gtmMotion).toBe("SLG");
    expect(parsed.onboarding.creativeCapacity).toBe("standard");
    expect(parsed.onboarding.leadListAvailable).toBe(true);
    expect(parsed.onboarding.economics).toEqual({
      pricingModel: "subscription",
      conversionPath: "demo_required",
      acv: "10k_50k",
      pricingTiers: "Team: $20/seat/mo; Business: $45/seat/mo",
      targetPlan: "Business",
      avgLtv: "$18,000",
      targetCac: "$4,500",
      monthlyAdBudget: "$25,000",
      budgetSplit: "60% paid search, 40% paid social",
      currentCac: "$5,200",
      monthlyRevenue: "$180,000",
      avgSalesCycle: "45 days",
      visitorToSignup: "8%",
      signupToActivation: "35%",
      activationToPaid: "12%",
      demoToClose: "22%",
      growthTrend: "Revenue is growing 9% month over month.",
      provenance: {
        pricingModel: "user-supplied",
        conversionPath: "user-supplied",
        acv: "user-supplied",
        pricingTiers: "user-supplied",
        targetPlan: "user-supplied",
        avgLtv: "user-supplied",
        targetCac: "user-supplied",
        monthlyAdBudget: "user-supplied",
        budgetSplit: "user-supplied",
        currentCac: "user-supplied",
        monthlyRevenue: "user-supplied",
        avgSalesCycle: "user-supplied",
        visitorToSignup: "user-supplied",
        signupToActivation: "user-supplied",
        activationToPaid: "user-supplied",
        demoToClose: "user-supplied",
        growthTrend: "user-supplied",
      },
    });
    expect(JSON.stringify(parsed)).not.toContain("Synthetic");
    expect(JSON.stringify(parsed)).not.toContain("example.com");
  });

  it("injects uploaded documents into lab corpus excerpts without section tag filtering", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      uploadedDocuments: [
        {
          id: "doc_123",
          fileName: "enterprise-buyers.md",
          docKind: "client_briefing",
          sectionTags: ["positioningBuyerICP"],
          tokenCount: 180,
          parsedMarkdown:
            "Enterprise buyers care about governance, approval workflows, and implementation speed when replacing spreadsheet-heavy operating processes.",
        },
      ],
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "source_uploaded_enterprise-buyers-md_1",
          title: "Uploaded document: enterprise-buyers.md",
          url: "https://app.ai-gos.local/uploaded-documents/doc_123",
        }),
      ]),
    );
    expect(parsed.corpus.excerpts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "excerpt_uploaded_enterprise-buyers-md_1",
          sourceId: "source_uploaded_enterprise-buyers-md_1",
          text: expect.stringContaining("Enterprise buyers care about governance"),
        }),
      ]),
    );
  });

  it("attributes evidence excerpts to evidence URLs missing from corpus sources", (): void => {
    const evidenceUrl =
      "https://www.airtable.com/blog/connected-apps-operations-report";
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        corpus: {
          ...corpusFixture.deepResearchProgramData.corpus,
          sources: corpusFixture.deepResearchProgramData.corpus.sources.slice(0, 1),
          evidence: [
            {
              claim:
                "Operations teams use Airtable connected apps to coordinate cross-functional work.",
              quote:
                "Connected apps keep teams aligned around shared operational workflows.",
              source: "Airtable connected apps report",
              url: evidenceUrl,
            },
          ],
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);
    const excerpt = parsed.corpus.excerpts[0];

    expect(parsed.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Airtable connected apps report",
          url: evidenceUrl,
        }),
      ]),
    );
    expect(excerpt.sourceUrl).toBe(evidenceUrl);
    expect(excerpt.sourceUrl).not.toBe(parsed.sources[0].url);
  });

  it("does not fabricate source-zero attribution for unmatched evidence without a URL", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        corpus: {
          ...corpusFixture.deepResearchProgramData.corpus,
          evidence: [
            ...corpusFixture.deepResearchProgramData.corpus.evidence,
            {
              claim: "Unmatched no-url evidence should not borrow another source.",
              quote: "This quote intentionally has no usable URL.",
              source: "Unlisted research note",
            },
          ],
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);
    const noUrlExcerpt = parsed.corpus.excerpts.find((excerpt) =>
      excerpt.text.includes("Unmatched no-url evidence"),
    );

    expect(noUrlExcerpt).toBeUndefined();
    expect(parsed._capabilities?.capabilityGaps).toEqual([
      {
        class: "evidence_excerpt_dropped",
        reason: "no_source_url",
        count: 1,
      },
    ]);
    expect(parsed.sources).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          title: "Unlisted research note",
        }),
      ]),
    );
  });

  it("builds keyword-scoped corpus excerpt pools for each lab section", (): void => {
    const sharedClaim = "Implementation timing depends on the customer's internal rollout sequence.";
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        corpus: {
          ...corpusFixture.deepResearchProgramData.corpus,
          sources: [
            {
              title: "Airtable category report",
              url: "https://www.airtable.com/category-report",
            },
            {
              title: "Airtable buyer guide",
              url: "https://www.airtable.com/buyer-guide",
            },
            {
              title: "Airtable rollout guide",
              url: "https://www.airtable.com/rollout-guide",
            },
          ],
          evidence: [
            {
              claim:
                "Collaborative work management is the category and market Airtable competes in.",
              quote:
                "The category report describes market maturity and adjacent categories.",
              source: "Airtable category report",
              url: "https://www.airtable.com/category-report",
            },
            {
              claim:
                "Operations leaders are the buyer persona for Airtable's governance motion.",
              quote:
                "The buyer guide names operations leaders as the persona with approval pain.",
              source: "Airtable buyer guide",
              url: "https://www.airtable.com/buyer-guide",
            },
            {
              claim: sharedClaim,
              quote: "The rollout guide focuses on implementation timing.",
              source: "Airtable rollout guide",
              url: "https://www.airtable.com/rollout-guide",
            },
          ],
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);
    const marketExcerpts =
      parsed.corpus.sectionExcerpts?.positioningMarketCategory ?? [];
    const buyerExcerpts = parsed.corpus.sectionExcerpts?.positioningBuyerICP ?? [];

    expect(marketExcerpts.map((excerpt) => excerpt.text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("category and market"),
        expect.stringContaining(sharedClaim),
      ]),
    );
    expect(marketExcerpts.map((excerpt) => excerpt.text)).not.toEqual(
      expect.arrayContaining([expect.stringContaining("buyer persona")]),
    );
    expect(buyerExcerpts.map((excerpt) => excerpt.text)).toEqual(
      expect.arrayContaining([
        expect.stringContaining("buyer persona"),
        expect.stringContaining(sharedClaim),
      ]),
    );
    expect(buyerExcerpts.map((excerpt) => excerpt.text)).not.toEqual(
      expect.arrayContaining([expect.stringContaining("category and market")]),
    );
  });

  it("routes intelligence topic evidence into global and section-scoped corpus excerpts", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        corpus: {
          ...corpusFixture.deepResearchProgramData.corpus,
          sources: [
            {
              title: "Airtable category memo",
              url: "https://www.airtable.com/category-memo",
            },
            {
              title: "Airtable buyer memo",
              url: "https://www.airtable.com/buyer-memo",
            },
            {
              title: "Airtable VoC memo",
              url: "https://www.airtable.com/voc-memo",
            },
            {
              title: "Airtable event memo",
              url: "https://www.airtable.com/event-memo",
            },
          ],
          intelligenceTopics: [
            {
              topic: "market_category",
              summary: "Category summary without a source URL should not become a dropped excerpt.",
              evidence: [
                {
                  claim: "Airtable category topic evidence",
                  quote: "Category-specific topic evidence for market section routing.",
                  source: "Airtable category memo",
                  url: "https://www.airtable.com/category-memo",
                },
              ],
            },
            {
              topic: "buyer_icp",
              summary: "Buyer summary without a source URL should not become a dropped excerpt.",
              evidence: [
                {
                  claim: "Airtable buyer topic evidence",
                  quote: "Buyer-specific topic evidence for ICP section routing.",
                  source: "Airtable buyer memo",
                  url: "https://www.airtable.com/buyer-memo",
                },
              ],
            },
            {
              topic: "voice_of_customer",
              summary: "Review summary without a source URL should not become a dropped excerpt.",
              evidence: [
                {
                  claim: "Airtable review topic evidence",
                  quote: "Review-specific topic evidence for VoC section routing.",
                  source: "Airtable VoC memo",
                  url: "https://www.airtable.com/voc-memo",
                },
              ],
            },
            {
              topic: "recent_events",
              summary: "Recent-event summary without a source URL should remain shared context.",
              evidence: [
                {
                  claim: "Airtable buyer event topic evidence",
                  quote:
                    "Recent-event evidence mentions a buyer rollout but should still be shared.",
                  source: "Airtable event memo",
                  url: "https://www.airtable.com/event-memo",
                },
              ],
            },
          ],
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);
    const allExcerptText = parsed.corpus.excerpts.map((excerpt) => excerpt.text);
    const marketExcerptText = (
      parsed.corpus.sectionExcerpts?.positioningMarketCategory ?? []
    ).map((excerpt) => excerpt.text);
    const buyerExcerptText = (
      parsed.corpus.sectionExcerpts?.positioningBuyerICP ?? []
    ).map((excerpt) => excerpt.text);
    const vocExcerptText = (
      parsed.corpus.sectionExcerpts?.positioningVoiceOfCustomer ?? []
    ).map((excerpt) => excerpt.text);

    expect(allExcerptText).toEqual(
      expect.arrayContaining([
        expect.stringContaining("category topic evidence"),
        expect.stringContaining("buyer topic evidence"),
        expect.stringContaining("review topic evidence"),
        expect.stringContaining("buyer event topic evidence"),
      ]),
    );
    expect(marketExcerptText).toEqual(
      expect.arrayContaining([
        expect.stringContaining("category topic evidence"),
        expect.stringContaining("buyer event topic evidence"),
      ]),
    );
    expect(marketExcerptText).not.toEqual(
      expect.arrayContaining([expect.stringContaining("buyer topic evidence")]),
    );
    expect(buyerExcerptText).toEqual(
      expect.arrayContaining([
        expect.stringContaining("buyer topic evidence"),
        expect.stringContaining("buyer event topic evidence"),
      ]),
    );
    expect(buyerExcerptText).not.toEqual(
      expect.arrayContaining([expect.stringContaining("review topic evidence")]),
    );
    expect(vocExcerptText).toEqual(
      expect.arrayContaining([
        expect.stringContaining("review topic evidence"),
        expect.stringContaining("buyer event topic evidence"),
      ]),
    );
    expect(parsed._capabilities?.capabilityGaps ?? []).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          class: "evidence_excerpt_dropped",
        }),
      ]),
    );
  });

  it("seeds competitorSeeds from the onboarding topCompetitors field", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    // The corpus sources are airtable.com only, so neither competitor gets a
    // domain (conservative enrichment avoids mis-attribution).
    expect(parsed.competitorSeeds).toEqual([
      { name: "Notion", provenance: "user-supplied" },
      { name: "Monday.com", provenance: "user-supplied" },
    ]);
  });

  it("preserves explicit same-item competitor domains when they safely match the cleaned competitor", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        onboardingFields: {
          ...corpusFixture.deepResearchProgramData.onboardingFields,
          topCompetitors: {
            value:
              "- Notion - https://www.notion.so\n- Monday.com - monday.com\n- Asana - https://monday.com",
          },
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.competitorSeeds).toEqual([
      { name: "Notion", domain: "notion.so", provenance: "user-supplied" },
      { name: "Monday.com", domain: "monday.com", provenance: "user-supplied" },
      { name: "Asana", provenance: "user-supplied" },
    ]);
  });

  it("splits prose 'X and Y' / 'X & Y' competitor lists into separate seeds (run 9a9412a2 regression)", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        onboardingFields: {
          ...corpusFixture.deepResearchProgramData.onboardingFields,
          topCompetitors: {
            value: "SinglePlatform and restaurantji.com & Popmenu",
          },
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.competitorSeeds?.map((seed) => seed.name)).toEqual([
      "SinglePlatform",
      "restaurantji.com",
      "Popmenu",
    ]);
  });

  it("parses numbered/bulleted topCompetitors, dedupes, and caps at 5", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        onboardingFields: {
          ...corpusFixture.deepResearchProgramData.onboardingFields,
          topCompetitors: {
            value: "1. Asana\n2. Asana\n- Smartsheet\n- Wrike\n- ClickUp\n- Trello\n- Basecamp",
          },
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.competitorSeeds?.map((seed) => seed.name)).toEqual([
      "Asana",
      "Smartsheet",
      "Wrike",
      "ClickUp",
      "Trello",
    ]);
  });
  it("keeps Brex-style numbered competitors intact while stripping parenthetical deal descriptions", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        onboardingFields: {
          ...corpusFixture.deepResearchProgramData.onboardingFields,
          topCompetitors: {
            value:
              "1. Brex (acquired by Capital One, closed Apr 7, 2026 — $5.15B deal; expense platform); 2. BILL (AP automation, payments); 3. American Express (corporate cards)",
          },
        },
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.competitorSeeds?.map((seed) => seed.name)).toEqual([
      "Brex",
      "BILL",
      "American Express",
    ]);
  });

  it("treats an 'idk idk' brief topCompetitors value as a gap (no competitor seeds)", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      deepResearchProgramData: {
        ...corpusFixture.deepResearchProgramData,
        onboardingFields: {
          ...corpusFixture.deepResearchProgramData.onboardingFields,
          topCompetitors: { value: null },
        },
      },
      onboardingData: {
        ...corpusFixture.onboardingData,
        topCompetitors: "idk idk",
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.competitorSeeds ?? []).toEqual([]);
  });

  it("treats an 'idk' brief monthlyAdBudget as a gap (no economics budget)", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      onboardingData: {
        ...corpusFixture.onboardingData,
        monthlyAdBudget: "idk",
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.onboarding.economics?.monthlyAdBudget).toBeUndefined();
  });

  it("prefers a real corpus competitor over an 'idk' brief value", (): void => {
    const input = corpusToResearchInput({
      ...corpusFixture,
      onboardingData: {
        ...corpusFixture.onboardingData,
        topCompetitors: "idk",
      },
      now: () => observedAt,
    });

    const parsed = researchInputSchema.parse(input);

    expect(parsed.competitorSeeds?.map((seed) => seed.name)).toEqual([
      "Notion",
      "Monday.com",
    ]);
  });

});
