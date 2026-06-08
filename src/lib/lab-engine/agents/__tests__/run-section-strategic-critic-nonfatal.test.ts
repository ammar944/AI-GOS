import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { CrossSectionReasoningSectionOutput } from "@/lib/lab-engine/artifacts/schemas/cross-section-reasoning";
import { crossSectionReasoningFixtureArtifact } from "@/lib/lab-engine/fixtures/cross-section-reasoning-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";

// The strategic critic is an UPGRADE pass. A live E2E (2026-06-08) showed the
// 270s job timeout fires mid-critic; applyCrossSectionStrategicCritic re-throws
// the caller-abort (throwIfCallerAborted), which used to fail the whole section
// and discard an already-validated body — so the capstone chain (synthesis +
// paid-media) never dispatched. Mock the critic to throw and assert the
// validated body still commits.
const criticMocks = vi.hoisted(() => ({
  applyCrossSectionStrategicCritic: vi.fn(),
}));

vi.mock("../strategic-critic", async () => {
  const actual =
    await vi.importActual<typeof import("../strategic-critic")>(
      "../strategic-critic",
    );
  return {
    ...actual,
    applyCrossSectionStrategicCritic:
      criticMocks.applyCrossSectionStrategicCritic,
  };
});

import { runSection } from "../run-section";
import type {
  AgentStep,
  EvidencePassRunner,
  StructuredCaller,
} from "../section-agent";

async function makeStore(
  researchInput: ResearchInput,
): Promise<ReturnType<typeof createRunStore>> {
  const rootDir = await mkdtemp(join(tmpdir(), "aigos-lab-critic-nonfatal-"));
  const store = createRunStore({
    defaultSectionIds: ["positioningCrossSectionReasoning"],
    now: () => new Date("2026-06-04T13:00:00.000Z"),
    rootDir,
  });
  await store.createRun(researchInput);
  return store;
}

function collectSourceUrls(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => collectSourceUrls(item));
  }

  if (typeof value !== "object" || value === null) {
    return [];
  }

  const record = value as Record<string, unknown>;
  const current =
    typeof record.sourceUrl === "string" ? [record.sourceUrl] : [];

  return [
    ...current,
    ...Object.values(record).flatMap((item) => collectSourceUrls(item)),
  ];
}

function buildOutput(): CrossSectionReasoningSectionOutput {
  return {
    body: crossSectionReasoningFixtureArtifact.body,
    confidence: crossSectionReasoningFixtureArtifact.confidence,
    sectionTitle: crossSectionReasoningFixtureArtifact.sectionTitle,
    sources: crossSectionReasoningFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
      ...(source.publisher ? { publisher: source.publisher } : {}),
    })),
    statusSummary: crossSectionReasoningFixtureArtifact.statusSummary,
    verdict: crossSectionReasoningFixtureArtifact.verdict,
  };
}

function buildEvidenceStep(): AgentStep {
  return {
    finishReason: "stop",
    stepNumber: 1,
    text: "Fixture evidence for cross-section reasoning.",
    toolCalls: [],
    toolResults: Array.from(
      new Set(collectSourceUrls(crossSectionReasoningFixtureArtifact.body)),
    ).map((sourceUrl) => ({
      output: {
        sourceUrl,
        text: `Fixture evidence for ${sourceUrl}`,
      },
      toolName: "fixture_evidence",
    })),
  };
}

describe("runSection strategic critic — non-fatal", (): void => {
  it("commits the validated body when the strategic critic throws (job-timeout abort)", async (): Promise<void> => {
    const researchInput: ResearchInput = {
      ...saaslaunchResearchInput,
      runId: "run_cross_section_critic_abort",
    };
    const store = await makeStore(researchInput);

    // Simulate the caller-abort re-throw applyCrossSectionStrategicCritic emits
    // when the 270s job timeout fires mid-critic.
    criticMocks.applyCrossSectionStrategicCritic.mockRejectedValue(
      new Error("lab section job timed out after 270000ms"),
    );

    const runEvidencePass = vi.fn<EvidencePassRunner>(async () => ({
      steps: [buildEvidenceStep()],
      text: "Fixture evidence ready.",
    }));
    const callStructured = vi.fn<StructuredCaller>(async () => buildOutput());

    const result = await runSection(
      {
        runId: researchInput.runId,
        sectionId: "positioningCrossSectionReasoning",
      },
      {
        allowedTools: [],
        callStructured,
        loadSkill: async () => "Find non-obvious cross-section threads.",
        now: () => new Date("2026-06-04T13:00:00.000Z"),
        runEvidencePass,
        store,
      },
    );
    const record = await store.readRun(researchInput.runId);

    // The critic was attempted (and threw).
    expect(
      criticMocks.applyCrossSectionStrategicCritic,
    ).toHaveBeenCalledTimes(1);

    // The pre-critic validated body is committed, NOT upgraded and NOT dropped.
    const body =
      result.artifact.body as typeof crossSectionReasoningFixtureArtifact.body;
    expect(body.crossSectionThreads[0]?.claim).toBe(
      crossSectionReasoningFixtureArtifact.body.crossSectionThreads[0]?.claim,
    );

    // The section reached terminal commit — so the job resolves and the server
    // capstone chain (onJobComplete -> synthesis + paid-media) can fire.
    expect(record.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "strategic-critic-started",
        "artifact-saved",
        "section-completed",
      ]),
    );
    expect(
      record.sections.positioningCrossSectionReasoning?.artifact?.body,
    ).toEqual(result.artifact.body);
  });
});
