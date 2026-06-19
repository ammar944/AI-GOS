import { mkdtemp } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { describe, expect, it, vi } from "vitest";

import { buyerICPFixtureArtifact } from "@/lib/lab-engine/fixtures/buyer-icp-artifact";
import { saaslaunchResearchInput } from "@/lib/lab-engine/fixtures/saaslaunch";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";
import {
  createInMemoryResearchFactStore,
  type ResearchFactStore,
} from "@/lib/lab-engine/evidence/research-fact";

import {
  labSectionRepairFloorMs,
  runSection,
  type BuyerPersonaCandidatePrepass,
} from "../run-section";
import type { BuyerPersonaCandidate } from "../buyer-persona-acquisition";

// Durability contract for the research-fact ledger (failure mode #3):
// "a timeout kills the agent, never its facts." BuyerICP acquires real named
// customer champions from public case studies, then the deadline-exhaustion
// path discards the structured body. The acquired champions must already be in
// the ledger BEFORE the body is discarded, so a timeout can never drop them.
const groundedChampions: BuyerPersonaCandidate[] = [
  {
    name: "Jane Doe",
    title: "CFO",
    company: "Acme Robotics",
    url: "https://vendor.example/customers/acme-robotics",
    venue: "case_study_champions",
  },
  {
    name: "John Smith",
    title: "VP of Finance",
    company: "Beta Logistics",
    url: "https://vendor.example/customers/beta-logistics",
    venue: "case_study_champions",
  },
  {
    name: "Maria Garcia",
    title: "Controller",
    company: "Gamma Health",
    url: "https://vendor.example/customers/gamma-health",
    venue: "case_study_champions",
  },
];

function buildStubbedPrepass(
  candidates: readonly BuyerPersonaCandidate[],
): BuyerPersonaCandidatePrepass {
  return {
    candidateBlock: candidates
      .map((candidate) => `${candidate.name} — ${candidate.title}`)
      .join("\n"),
    candidates: [...candidates],
    caseStudyPages: [],
    lookups: [],
    events: [],
    steps: [],
  };
}

describe("research-fact ledger durability (a timeout kills the agent, never its facts)", () => {
  it("preserves acquired named champions in the fact store even when the deadline discards the body", async (): Promise<void> => {
    const nowIso = "2026-06-18T04:39:37.613Z";
    const rootDir = await mkdtemp(join(tmpdir(), "aigos-lab-engine-facts-"));
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ["positioningBuyerICP"],
      now: () => new Date(nowIso),
    });
    await store.createRun(saaslaunchResearchInput);

    // The ledger no-ops unless BOTH a store and a parentAuditRunId are present.
    // Assert both are wired so the test cannot pass vacuously.
    const factStore: ResearchFactStore = createInMemoryResearchFactStore();
    const parentAuditRunId = "parent_audit_facts_1";
    expect(factStore).toBeDefined();
    expect(parentAuditRunId.length).toBeGreaterThan(0);

    // Stub champion acquisition: >=3 valid named champions, no network.
    const acquireBuyerPersonaPrepass = vi.fn(async () =>
      buildStubbedPrepass(groundedChampions),
    );

    // The answer tool returns a decodable fixture body; combined with the
    // breached deadline floor this drives BuyerICP onto the deadline / gap path
    // (the structured body is discarded), exactly as run b0d12b45.
    const runAnswerTool = vi.fn(async () => ({
      steps: [],
      text: "",
      answerInput: {
        sectionTitle: buyerICPFixtureArtifact.sectionTitle,
        verdict: buyerICPFixtureArtifact.verdict,
        statusSummary: buyerICPFixtureArtifact.statusSummary,
        confidence: buyerICPFixtureArtifact.confidence,
        sources: buyerICPFixtureArtifact.sources.map((source) => ({
          title: source.title,
          url: source.url,
          ...(source.publisher ? { publisher: source.publisher } : {}),
        })),
        body: buyerICPFixtureArtifact.body,
      },
    }));

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningBuyerICP",
        deadlineAt: Date.parse(nowIso) + labSectionRepairFloorMs - 1,
      },
      {
        store,
        loadSkill: async () => "Use the injected corpus only.",
        allowedTools: [],
        runAnswerTool: runAnswerTool as never,
        acquireBuyerPersonaPrepass,
        factStore,
        parentAuditRunId,
        env: {
          LAB_SECTION_STREAMING: "false",
          LAB_VERIFIER_MAX_UNSUPPORTED: "999",
        },
        now: () => new Date(nowIso),
      },
    );

    // The deadline floor was breached: the structured body is discarded and the
    // committed artifact is the honest evidence-gap body — exactly the path that
    // dropped champions in run b0d12b45. (Proves the facts did NOT merely ride
    // the structured body.)
    const body = result.artifact.body as { evidenceGap?: unknown };
    expect(body.evidenceGap).toBe(true);

    // The champion acquisition ran exactly once (the stub seam is exercised).
    expect(acquireBuyerPersonaPrepass).toHaveBeenCalledTimes(1);

    const championFacts = factStore
      .getFacts()
      .filter((fact) => fact.factKind === "named_champion");

    // The marquee assertion: a timeout discarded the body, but the facts survive.
    expect(championFacts.length).toBeGreaterThanOrEqual(3);

    for (const fact of championFacts) {
      expect(fact.sourceUrl).toMatch(/^https:\/\//);
      expect(fact.sourceQuote).toContain(fact.claimToken);
      expect(fact.parentAuditRunId).toBe(parentAuditRunId);
      expect(fact.runId).toBe(saaslaunchResearchInput.runId);
    }
  });
});
