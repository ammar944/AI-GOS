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
    expect(JSON.stringify(parsed)).not.toContain("Synthetic");
    expect(JSON.stringify(parsed)).not.toContain("example.com");
  });
});
