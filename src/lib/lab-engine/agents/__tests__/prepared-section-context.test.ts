import { afterEach, describe, expect, it, vi } from "vitest";

import { researchInputSchema } from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { ResearchInput, RunRecord } from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { MarketCategorySectionOutput } from "@/lib/lab-engine/artifacts/schemas/market-category";
import { marketCategoryFixtureArtifact } from "@/lib/lab-engine/fixtures/market-category-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import {
  prepareSectionContext,
  runSection,
} from "@/lib/lab-engine/agents/run-section";
import { createInMemoryResearchFactStore } from "@/lib/lab-engine/evidence/research-fact";
import type {
  AgentStep,
  AnswerToolRunner,
  StructuredStreamer,
} from "@/lib/lab-engine/agents/section-agent";
import type { RunStore } from "@/lib/lab-engine/runs/run-store";

function buildPreparedContextResearchInput(): ResearchInput {
  return researchInputSchema.parse({
    runId: "run_prepared_context",
    fixtureId: "prepared_context_fixture",
    company: {
      id: "company_fellow",
      name: "Fellow",
      websiteUrl: "https://fellow.app",
      category: "Meeting automation",
      description: "Fellow automates meeting workflows.",
      stage: "growth",
      targetCustomer: "RevOps teams",
    },
    onboarding: {
      primaryGoal: "Improve pipeline meetings",
      targetSegments: ["RevOps leaders"],
      keyOffers: ["Meeting automation"],
      distributionChannels: ["paid-search"],
      constraints: [],
      notes: "Reviewed GTM brief",
    },
    corpus: {
      excerpts: [
        {
          id: "global_1",
          sourceUrl: "https://fellow.app/platform",
          title: "Fellow Platform",
          text: "Fellow coordinates revenue meeting workflows.",
          observedAt: "2026-06-19T01:00:00.000Z",
          sourceId: "source_global_1",
        },
        {
          id: "shared_1",
          sourceUrl: "https://fellow.app/customers",
          title: "Customer Stories",
          text: "Revenue leaders use Fellow to standardize account reviews.",
          observedAt: "2026-06-19T01:01:00.000Z",
          sourceId: "source_shared_1",
        },
      ],
      sectionExcerpts: {
        positioningMarketCategory: [],
        positioningBuyerICP: [
          {
            id: "shared_1",
            sourceUrl: "https://fellow.app/customers",
            title: "Customer Stories",
            text: "Revenue leaders use Fellow to standardize account reviews.",
            observedAt: "2026-06-19T01:01:00.000Z",
            sourceId: "source_shared_1",
          },
          {
            id: "buyer_1",
            sourceUrl: "https://fellow.app/revops",
            title: "RevOps Leaders",
            text: "RevOps directors use Fellow before weekly pipeline reviews.",
            observedAt: "2026-06-19T01:02:00.000Z",
            sourceId: "source_buyer_1",
          },
        ],
        positioningCompetitorLandscape: [],
        positioningVoiceOfCustomer: [],
        positioningDemandIntent: [],
        positioningOfferDiagnostic: [],
        positioningPaidMediaPlan: [],
      },
    },
    sources: [
      {
        id: "source_global_1",
        title: "Fellow Platform",
        url: "https://fellow.app/platform",
        observedAt: "2026-06-19T01:00:00.000Z",
      },
    ],
    competitorAds: [],
  });
}

function createReadOnlyStore(input: ResearchInput): Pick<RunStore, "readRun"> {
  return {
    readRun: async (): Promise<RunRecord> =>
      ({
        input,
      }) as RunRecord,
  };
}

function createPreparedContextRunStore(input: ResearchInput): RunStore {
  const record = { input } as RunRecord;

  return {
    createRun: async (): Promise<RunRecord> => record,
    readRun: async (): Promise<RunRecord> => record,
    appendEvent: async (): Promise<RunRecord> => record,
    saveArtifact: async (): Promise<RunRecord> => record,
    markSectionRunning: async (): Promise<RunRecord> => record,
    markSectionFailed: async (): Promise<RunRecord> => record,
  };
}

function buildMarketCategoryOutput(): MarketCategorySectionOutput {
  return {
    sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
    verdict: marketCategoryFixtureArtifact.verdict,
    statusSummary: marketCategoryFixtureArtifact.statusSummary,
    confidence: marketCategoryFixtureArtifact.confidence,
    sources: marketCategoryFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher === undefined ? {} : { publisher: source.publisher }),
    })),
    body: marketCategoryFixtureArtifact.body,
  };
}

function buildMarketCategorySupportStep(): AgentStep {
  return {
    stepNumber: 0,
    finishReason: "stop",
    text: "",
    toolCalls: [],
    toolResults: [
      {
        toolName: "fixture_support",
        output: {
          text:
            "Fixture ad sources: https://example.com/fixtures/ad-library/pipelinepilot-google and https://example.com/fixtures/ad-library/signalforge-linkedin. Fixture TAM recipe support: 1,900 monthly searches from https://example.com/fixtures/keyword-volume/saaslaunch; 40% commercial-intent share from https://example.com/fixtures/ad-library/pipelinepilot-google; 2% visitor-to-opportunity conversion from https://example.com/saaslaunch/pricing; $6,000 ACV from https://example.com/saaslaunch/positioning-notes; $1.09M directional reachable revenue.",
        },
      },
    ],
  };
}

describe("PreparedSectionContext", (): void => {
  afterEach((): void => {
    vi.unstubAllEnvs();
  });

  it("prepares deduped corpus rows with source provenance and section scope", async (): Promise<void> => {
    const researchInput = buildPreparedContextResearchInput();
    const context = await prepareSectionContext(
      {
        runId: researchInput.runId,
        sectionId: "positioningBuyerICP",
      },
      { store: createReadOnlyStore(researchInput) },
    );

    expect(Object.keys(context).sort()).toEqual([
      "corpusRows",
      "coverageRows",
      "factRows",
      "researchUseful",
      "sectionId",
      "toolGapRows",
    ]);
    expect(context.sectionId).toBe("positioningBuyerICP");
    expect(context.factRows).toEqual([]);
    expect(context.coverageRows).toEqual([]);
    expect(context.toolGapRows).toEqual([]);
    expect(context.researchUseful).toBe(true);
    expect(context.corpusRows).toHaveLength(3);
    expect(context.corpusRows).toContainEqual({
      id: "shared_1",
      sourceUrl: "https://fellow.app/customers",
      title: "Customer Stories",
      text: "Revenue leaders use Fellow to standardize account reviews.",
      observedAt: "2026-06-19T01:01:00.000Z",
      sourceId: "source_shared_1",
      scope: "section",
    });
    expect(context.corpusRows).toContainEqual({
      id: "global_1",
      sourceUrl: "https://fellow.app/platform",
      title: "Fellow Platform",
      text: "Fellow coordinates revenue meeting workflows.",
      observedAt: "2026-06-19T01:00:00.000Z",
      sourceId: "source_global_1",
      scope: "global",
    });
  });

  it("populates fact rows from the research fact ledger read side", async (): Promise<void> => {
    const researchInput = buildPreparedContextResearchInput();
    const factStore = createInMemoryResearchFactStore();
    await factStore.appendFacts([
      {
        runId: "section_run_buyer",
        parentAuditRunId: "parent_audit_1",
        sectionId: "positioningBuyerICP",
        factKind: "named_champion",
        sourceUrl: "https://fellow.app/customers/revops",
        sourceQuote: "A RevOps leader uses Fellow before weekly reviews.",
        claimToken: "RevOps",
        createdAt: "2026-06-19T02:00:00.000Z",
      },
      {
        runId: "section_run_offer",
        parentAuditRunId: "parent_audit_1",
        sectionId: "positioningOfferDiagnostic",
        factKind: "corpus_excerpt",
        sourceUrl: "https://fellow.app/pricing",
        sourceQuote: "Pricing page evidence belongs to a different section.",
        claimToken: "Pricing",
        createdAt: "2026-06-19T02:01:00.000Z",
      },
    ]);

    const buyerContext = await prepareSectionContext(
      {
        runId: "section_run_buyer",
        sectionId: "positioningBuyerICP",
      },
      {
        store: createReadOnlyStore(researchInput),
        factStore,
        parentAuditRunId: "parent_audit_1",
      },
    );
    const paidMediaContext = await prepareSectionContext(
      {
        runId: "section_run_paid_media",
        sectionId: "positioningPaidMediaPlan",
      },
      {
        store: createReadOnlyStore(researchInput),
        factStore,
        parentAuditRunId: "parent_audit_1",
      },
    );

    expect(buyerContext.factRows).toEqual([
      expect.objectContaining({
        factKind: "named_champion",
        sectionId: "positioningBuyerICP",
        sourceUrl: "https://fellow.app/customers/revops",
        text: "A RevOps leader uses Fellow before weekly reviews.",
        observedAt: "2026-06-19T02:00:00.000Z",
        claimToken: "RevOps",
      }),
    ]);
    expect(paidMediaContext.factRows.map((row) => row.sectionId)).toEqual([
      "positioningBuyerICP",
      "positioningOfferDiagnostic",
    ]);
  });

  it("admits orchestrator-seeded facts into every section's fact rows", async (): Promise<void> => {
    const researchInput = buildPreparedContextResearchInput();
    const factStore = createInMemoryResearchFactStore();
    await factStore.appendFacts([
      {
        runId: "orchestrator_run",
        parentAuditRunId: "parent_audit_seed",
        sectionId: "orchestrator",
        factKind: "corpus_excerpt",
        sourceUrl: "https://fellow.app/about",
        sourceQuote: "Fellow is the cross-section company seed evidence.",
        claimToken: "Fellow",
        createdAt: "2026-06-19T03:00:00.000Z",
      },
    ]);

    // The orchestrator fact carries section_id "orchestrator"; it must reach an
    // arbitrary positioning section (not its own id) because it is the
    // cross-section seed written before the sections run.
    const marketContext = await prepareSectionContext(
      {
        runId: "section_run_market",
        sectionId: "positioningMarketCategory",
      },
      {
        store: createReadOnlyStore(researchInput),
        factStore,
        parentAuditRunId: "parent_audit_seed",
      },
    );
    const voiceContext = await prepareSectionContext(
      {
        runId: "section_run_voice",
        sectionId: "positioningVoiceOfCustomer",
      },
      {
        store: createReadOnlyStore(researchInput),
        factStore,
        parentAuditRunId: "parent_audit_seed",
      },
    );

    // The orchestrator seed is presented under the CONSUMING section id (it is
    // the cross-section seed, so each section reads it as its own evidence),
    // but the source/quote identify the orchestrator origin.
    expect(marketContext.factRows).toEqual([
      expect.objectContaining({
        sectionId: "positioningMarketCategory",
        sourceUrl: "https://fellow.app/about",
        text: "Fellow is the cross-section company seed evidence.",
      }),
    ]);
    expect(voiceContext.factRows).toEqual([
      expect.objectContaining({
        sectionId: "positioningVoiceOfCustomer",
        sourceUrl: "https://fellow.app/about",
      }),
    ]);
  });

  it("does not expose external writer tools when a prepared context is supplied", async (): Promise<void> => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
    vi.stubEnv("LAB_SECTION_STREAMING", "false");
    vi.stubEnv("LAB_VERIFIER_MAX_UNSUPPORTED", "999");

    const store = createPreparedContextRunStore(saaslaunchResearchInput);
    const preparedContext = await prepareSectionContext(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningMarketCategory",
      },
      { store },
    );
    const runAnswerTool = vi.fn<AnswerToolRunner>(async (params) => {
      expect(Object.keys(params.externalTools)).toEqual([]);
      expect(params.instructions).toContain("Prepared evidence rows:");
      expect(params.instructions).toContain("excerpt_homepage_positioning");
      expect(params.instructions.indexOf("Prepared evidence rows:")).toBeLessThan(
        params.instructions.indexOf("ResearchInput JSON:"),
      );
      return {
        steps: [buildMarketCategorySupportStep()],
        text: "",
        answerInput: buildMarketCategoryOutput(),
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningMarketCategory",
      },
      {
        store,
        loadSkill: async (): Promise<string> => "Use the prepared context.",
        preparedContext,
        runAnswerTool,
        fetchImpl: async (): Promise<Response> =>
          new Response("ok", { status: 200 }),
        now: () => new Date("2026-06-19T01:00:00.000Z"),
      },
    );

    expect(result.artifact.sectionId).toBe("positioningMarketCategory");
    expect(runAnswerTool).toHaveBeenCalled();
    expect(
      runAnswerTool.mock.calls.some(([params]) =>
        params.prompt.includes("No external research tools are available."),
      ),
    ).toBe(true);
  });

  it("skips Buyer ICP acquisition prepass on the answer-tool path when prepared context is supplied", async (): Promise<void> => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
    vi.stubEnv("LAB_SECTION_STREAMING", "false");

    const store = createPreparedContextRunStore(saaslaunchResearchInput);
    const preparedContext = await prepareSectionContext(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningBuyerICP",
      },
      { store },
    );
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => {
      throw new Error("answer writer reached");
    });

    await expect(
      runSection(
        {
          runId: saaslaunchResearchInput.runId,
          sectionId: "positioningBuyerICP",
        },
        {
          store,
          loadSkill: async (): Promise<string> => "Use the prepared context.",
          preparedContext,
          runAnswerTool,
          now: () => new Date("2026-06-19T01:00:00.000Z"),
        },
      ),
    ).rejects.toThrow("answer writer reached");

    expect(runAnswerTool).toHaveBeenCalled();
  });

  it("skips Buyer ICP acquisition prepass on the structured path when prepared context is supplied", async (): Promise<void> => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
    vi.stubEnv("LAB_SECTION_STREAMING", "true");

    const store = createPreparedContextRunStore(saaslaunchResearchInput);
    const preparedContext = await prepareSectionContext(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningBuyerICP",
      },
      { store },
    );
    const streamStructured = vi.fn<StructuredStreamer>(() => {
      throw new Error("structured writer reached");
    });

    await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningBuyerICP",
      },
      {
        store,
        loadSkill: async (): Promise<string> => "Use the prepared context.",
        preparedContext,
        runThinkerPass: async (): Promise<string> => "",
        streamStructured,
        now: () => new Date("2026-06-19T01:00:00.000Z"),
      },
    ).catch((): void => undefined);

    expect(streamStructured).toHaveBeenCalled();
  });
});
