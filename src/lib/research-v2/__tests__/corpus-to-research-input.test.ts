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
});
