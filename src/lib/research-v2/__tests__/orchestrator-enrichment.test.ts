import { describe, expect, it, vi } from "vitest";

import { researchInputSchema } from "../../lab-engine/artifacts/artifact-envelope";
import { corpusToResearchInput } from "../corpus-to-research-input";
import {
  mergeOrchestratorEnrichment,
  persistOrchestratorEnrichment,
} from "../orchestrator-enrichment";

const gtmFields = {
  companyName: "Airtable",
  category: "Collaborative work management",
  productDescription: "Airtable helps ops teams build flexible apps.",
  targetCustomer: "Operations leaders",
  topCompetitors: ["Notion", "Monday.com", "Smartsheet"],
  marketProblem:
    "Teams rebuild operational software from scratch in spreadsheets.",
};

describe("mergeOrchestratorEnrichment", (): void => {
  it("fills blank topCompetitors / marketProblem from the orchestrator gtm fields", (): void => {
    const merged = mergeOrchestratorEnrichment(
      { websiteUrl: "https://www.airtable.com/" },
      { gtmFields, researchDigest: "## Market\nAirtable competes with Notion." },
    );

    expect(merged.topCompetitors).toBe("Notion, Monday.com, Smartsheet");
    expect(merged.marketProblem).toBe(
      "Teams rebuild operational software from scratch in spreadsheets.",
    );
    expect(merged.orchestratorResearchDigest).toBe(
      "## Market\nAirtable competes with Notion.",
    );
    // Existing user-supplied fields are preserved.
    expect(merged.websiteUrl).toBe("https://www.airtable.com/");
  });

  it("does NOT overwrite a non-empty user-supplied topCompetitors / marketProblem", (): void => {
    const merged = mergeOrchestratorEnrichment(
      {
        topCompetitors: "Coda, Smartsheet",
        marketProblem: "Operator-supplied problem statement.",
      },
      { gtmFields, researchDigest: "digest" },
    );

    expect(merged.topCompetitors).toBe("Coda, Smartsheet");
    expect(merged.marketProblem).toBe("Operator-supplied problem statement.");
  });

  it("is a no-op when gtmFields is null (orchestrator returned no fields)", (): void => {
    const onboarding = { websiteUrl: "https://x.com" };
    const merged = mergeOrchestratorEnrichment(onboarding, {
      gtmFields: null,
      researchDigest: "",
    });

    expect(merged).toEqual(onboarding);
  });

  it("delivers the seeded topCompetitors into a non-empty competitorSeeds ResearchInput", (): void => {
    const mergedOnboarding = mergeOrchestratorEnrichment(
      { websiteUrl: "https://www.airtable.com/" },
      { gtmFields, researchDigest: "digest" },
    );

    const input = corpusToResearchInput({
      runId: "run_seed_delivery",
      deepResearchProgramData: {
        corpus: {
          researchSummary: "Airtable corpus summary.",
          sources: [{ title: "Airtable", url: "https://www.airtable.com/" }],
          evidence: [],
        },
        onboardingFields: {
          companyName: { value: "Airtable" },
        },
      },
      onboardingData: mergedOnboarding,
    });

    const parsed = researchInputSchema.parse(input);
    const competitorSeeds = parsed.competitorSeeds ?? [];
    expect(competitorSeeds.length).toBeGreaterThan(0);
    expect(competitorSeeds.map((s) => s.name)).toContain("Notion");
    expect(parsed.onboarding.voiceOfClient?.marketProblem).toBe(
      "Teams rebuild operational software from scratch in spreadsheets.",
    );
  });
});

describe("persistOrchestratorEnrichment", (): void => {
  it("merges and writes the enriched onboarding_data back to journey_sessions", async (): Promise<void> => {
    const updateEq2 = vi.fn().mockResolvedValue({ error: null });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const update = vi.fn().mockReturnValue({ eq: updateEq1 });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as Parameters<
      typeof persistOrchestratorEnrichment
    >[0]["supabase"];

    await persistOrchestratorEnrichment({
      supabase,
      userId: "user_1",
      runId: "run_1",
      onboardingData: { websiteUrl: "https://www.airtable.com/" },
      gtmFields,
      researchDigest: "digest",
    });

    expect(from).toHaveBeenCalledWith("journey_sessions");
    const [[updateArg]] = update.mock.calls;
    expect(updateArg.onboarding_data.topCompetitors).toBe(
      "Notion, Monday.com, Smartsheet",
    );
    expect(updateArg.onboarding_data.marketProblem).toBe(
      "Teams rebuild operational software from scratch in spreadsheets.",
    );
    expect(updateEq1).toHaveBeenCalledWith("user_id", "user_1");
    expect(updateEq2).toHaveBeenCalledWith("run_id", "run_1");
  });

  it("never throws when the orchestrator returned no gtm fields (skips the write)", async (): Promise<void> => {
    const from = vi.fn();
    const supabase = { from } as unknown as Parameters<
      typeof persistOrchestratorEnrichment
    >[0]["supabase"];

    await expect(
      persistOrchestratorEnrichment({
        supabase,
        userId: "user_1",
        runId: "run_1",
        onboardingData: { websiteUrl: "https://x.com" },
        gtmFields: null,
        researchDigest: "",
      }),
    ).resolves.toBeUndefined();
    expect(from).not.toHaveBeenCalled();
  });

  it("never throws when the supabase update errors", async (): Promise<void> => {
    const updateEq2 = vi
      .fn()
      .mockResolvedValue({ error: { message: "boom" } });
    const updateEq1 = vi.fn().mockReturnValue({ eq: updateEq2 });
    const update = vi.fn().mockReturnValue({ eq: updateEq1 });
    const from = vi.fn().mockReturnValue({ update });
    const supabase = { from } as unknown as Parameters<
      typeof persistOrchestratorEnrichment
    >[0]["supabase"];

    await expect(
      persistOrchestratorEnrichment({
        supabase,
        userId: "user_1",
        runId: "run_1",
        onboardingData: {},
        gtmFields,
        researchDigest: "d",
      }),
    ).resolves.toBeUndefined();
  });
});
