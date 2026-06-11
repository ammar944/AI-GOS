import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { MarketCategorySectionOutput } from "@/lib/lab-engine/artifacts/schemas/market-category";
import { marketCategoryFixtureArtifact } from "@/lib/lab-engine/fixtures/market-category-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";
import type { SectionOutput } from "@/lib/lab-engine/sections/section-registry";

import { runSection } from "../run-section";
import type { AgentStep, AnswerToolRunner } from "../section-agent";
import type { SectionWriterPassRunner } from "../writer-pass";

function buildMarketCategoryOutput(): MarketCategorySectionOutput {
  return {
    sectionTitle: marketCategoryFixtureArtifact.sectionTitle,
    verdict: marketCategoryFixtureArtifact.verdict,
    statusSummary: marketCategoryFixtureArtifact.statusSummary,
    confidence: marketCategoryFixtureArtifact.confidence,
    sources: marketCategoryFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
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
          text: "Fixture ad sources: https://example.com/fixtures/ad-library/pipelinepilot-google and https://example.com/fixtures/ad-library/signalforge-linkedin. Fixture TAM recipe support: 1,900 monthly searches from https://example.com/fixtures/keyword-volume/saaslaunch; 40% commercial-intent share from https://example.com/fixtures/ad-library/pipelinepilot-google; 2% visitor-to-opportunity conversion from https://example.com/saaslaunch/pricing; $6,000 ACV from https://example.com/saaslaunch/positioning-notes; $1.09M directional reachable revenue.",
        },
      },
    ],
  };
}

async function sourceLivenessUnavailableFetch(): Promise<Response> {
  throw new Error("source liveness network unavailable in test");
}

describe("runSection writer pen integration", (): void => {
  beforeEach((): void => {
    vi.stubEnv("DEEPSEEK_API_KEY", "test-deepseek-key");
    vi.stubEnv("LAB_SECTION_STREAMING", "false");
    vi.stubGlobal("fetch", sourceLivenessUnavailableFetch);
  });

  afterEach((): void => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("commits the penned narrative when the rewrite passes the gate", async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), "aigos-lab-engine-"));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ["positioningMarketCategory"],
      now: () => new Date("2026-06-11T12:00:00.000Z"),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildMarketCategoryOutput();
    const pennedStatusSummary =
      "Penned: harvest the bottom-funnel comparison demand before funding category education.";
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildMarketCategorySupportStep()],
      text: "",
      answerInput: output,
    }));
    const runWriterPass = vi.fn<SectionWriterPassRunner>(async (params) => {
      expect(params.sectionId).toBe("positioningMarketCategory");
      expect(params.remainingMs).toBeNull();

      const penned = structuredClone(params.output) as SectionOutput<
        Record<string, unknown>
      >;
      penned.statusSummary = pennedStatusSummary;

      return {
        output: penned,
        applied: true,
        rewrittenFieldCount: 1,
        durationMs: 1234,
        writerModelId: "deepseek-v4-pro",
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningMarketCategory",
      },
      {
        store,
        loadSkill: async () => "Use the injected corpus only.",
        allowedTools: [],
        runAnswerTool,
        runWriterPass,
        now: () => new Date("2026-06-11T12:00:00.000Z"),
      },
    );

    expect(runWriterPass).toHaveBeenCalledTimes(1);
    expect(result.artifact.statusSummary).toBe(pennedStatusSummary);
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
  });

  it("falls back to the runner draft when the penned output fails minimums", async (): Promise<void> => {
    const rootDir = await mkdtemp(join(tmpdir(), "aigos-lab-engine-"));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ["positioningMarketCategory"],
      now: () => new Date("2026-06-11T12:00:00.000Z"),
    });
    await store.createRun(saaslaunchResearchInput);

    const output = buildMarketCategoryOutput();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [buildMarketCategorySupportStep()],
      text: "",
      answerInput: output,
    }));
    const runWriterPass = vi.fn<SectionWriterPassRunner>(async (params) => {
      const penned = structuredClone(params.output) as SectionOutput<
        Record<string, unknown>
      >;
      const insight = (penned.body as { strategicInsight: Record<string, unknown> })
        .strategicInsight;
      // Duplicate strategic fields trip validateStrategicInsightMinimums, so
      // the penned attempt hard-fails the gate.
      insight.strategicVerdict =
        "Duplicate strategic judgment used to trip the distinctness gate.";
      insight.nonObviousRead =
        "Duplicate strategic judgment used to trip the distinctness gate.";

      return {
        output: penned,
        applied: true,
        rewrittenFieldCount: 2,
        durationMs: 1234,
        writerModelId: "deepseek-v4-pro",
      };
    });

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningMarketCategory",
      },
      {
        store,
        loadSkill: async () => "Use the injected corpus only.",
        allowedTools: [],
        runAnswerTool,
        runWriterPass,
        now: () => new Date("2026-06-11T12:00:00.000Z"),
      },
    );

    // The fallback commits the original draft without burning a repair attempt.
    expect(runAnswerTool).toHaveBeenCalledTimes(1);
    expect(result.artifact.statusSummary).toBe(
      marketCategoryFixtureArtifact.statusSummary,
    );
    expect(result.artifact.body).toEqual(marketCategoryFixtureArtifact.body);
  });
});
