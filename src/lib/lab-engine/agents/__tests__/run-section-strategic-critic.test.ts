import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import type { CrossSectionReasoningSectionOutput } from "@/lib/lab-engine/artifacts/schemas/cross-section-reasoning";
import { crossSectionReasoningFixtureArtifact } from "@/lib/lab-engine/fixtures/cross-section-reasoning-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";

const aiMocks = vi.hoisted(() => ({
  generateText: vi.fn(),
}));

vi.mock("ai", async () => {
  const actual = await vi.importActual<typeof import("ai")>("ai");
  return {
    ...actual,
    generateText: aiMocks.generateText,
  };
});

import { runSection } from "../run-section";
import type { AgentStep, EvidencePassRunner, StructuredCaller } from "../section-agent";

async function makeStore(
  researchInput: ResearchInput,
): Promise<ReturnType<typeof createRunStore>> {
  const rootDir = await mkdtemp(join(tmpdir(), "aigos-lab-critic-"));
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

function buildOutput(
  body = crossSectionReasoningFixtureArtifact.body,
): CrossSectionReasoningSectionOutput {
  return {
    body,
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

function buildCriticResponse(
  body: typeof crossSectionReasoningFixtureArtifact.body,
): string {
  return `<strategic_critic>${JSON.stringify({
    body,
    critique: {
      items: [
        {
          action: "deepened",
          path: "body.crossSectionThreads[0].claim",
          rationale:
            "The final claim names the tension and the consequence.",
          text: body.crossSectionThreads[0]?.claim ?? "",
          verdict: "passes",
        },
        {
          action: "kept",
          path: "body.namedTension.side",
          rationale: "The final side chooses one position and its cost.",
          text: body.namedTension.side,
          verdict: "passes",
        },
      ],
      summary: "The critic deepened the main cross-section thread.",
    },
  })}</strategic_critic>`;
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

describe("runSection strategic critic", (): void => {
  it("upgrades cross-section reasoning before saving the artifact", async (): Promise<void> => {
    const researchInput: ResearchInput = {
      ...saaslaunchResearchInput,
      runId: "run_cross_section_critic",
    };
    const store = await makeStore(researchInput);
    const upgradedBody = structuredClone(crossSectionReasoningFixtureArtifact.body);
    upgradedBody.crossSectionThreads[0].claim =
      "Buyer urgency, competitor inertia, and customer anxiety collide around implementation delay, so the defensible wedge is a proof-backed time-to-first-campaign promise rather than a generic speed claim.";
    aiMocks.generateText.mockResolvedValue({
      text: buildCriticResponse(upgradedBody),
    });
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

    const body = result.artifact.body as typeof crossSectionReasoningFixtureArtifact.body;
    expect(body.crossSectionThreads[0]?.claim).toContain(
      "proof-backed time-to-first-campaign",
    );
    expect(result.artifact.strategicCritique).toEqual(
      expect.objectContaining({
        summary: "The critic deepened the main cross-section thread.",
        target: "cross_section_reasoning",
      }),
    );
    expect(record.events.map((event) => event.type)).toEqual(
      expect.arrayContaining([
        "strategic-critic-started",
        "strategic-critic-finished",
        "artifact-saved",
      ]),
    );
    expect(record.sections.positioningCrossSectionReasoning?.artifact?.body).toEqual(
      result.artifact.body,
    );
  });
});
