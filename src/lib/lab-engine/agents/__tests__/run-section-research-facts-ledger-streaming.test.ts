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
import type { AnswerToolRunner, StructuredStreamer } from "../section-agent";

// Streaming-DEFAULT companion to run-section-research-facts-ledger.test.ts.
// Failure mode #3 ("a timeout kills the agent, never its facts") is identical
// on both paths, but the durability contract was previously pinned only on the
// answer-tool path (LAB_SECTION_STREAMING=false). The PRODUCTION default leaves
// LAB_SECTION_STREAMING unset, so runSection dispatches to
// runSectionViaStructuredBodyStream — its buyer-persona prepass + champion-fact
// wiring was verified only by inspection. This test drives that path: the
// stubbed prepass acquires >=3 named champions, then the streamed structured
// body decodes but fails the named-persona floor, raising the BuyerICP persona
// evidence gap; the breached deadline floor blocks any repair, so BuyerICP
// commits the honest-gap body (evidenceGap===true, the structured personas
// discarded) — the same gap commit run b0d12b45 took on the answer-tool path —
// and the champions must already be in the ledger so the gap can never drop them.
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

// The streamed draft decodes to the BuyerICP fixture body — the structurer
// "succeeded". But that body does not clear the named-persona floor, so the
// verifier raises a BuyerICP persona evidence gap (committed body
// evidenceGap===true). The breached deadline floor then blocks any repair, so
// the gap commits — exactly run b0d12b45's deadline / gap path on the streaming
// default. Mirror of the answer-tool fixture-body return.
function buildFixtureBodyStreamer(): StructuredStreamer {
  return vi.fn<StructuredStreamer>(() => ({
    consumeStream: () => Promise.resolve(),
    output: Promise.resolve({
      verdict: buyerICPFixtureArtifact.verdict,
      statusSummary: buyerICPFixtureArtifact.statusSummary,
      sources: buyerICPFixtureArtifact.sources.map((source) => ({
        title: source.title,
        url: source.url,
        ...(source.publisher ? { publisher: source.publisher } : {}),
      })),
      body: buyerICPFixtureArtifact.body,
    }),
    partialOutputStream: (async function* () {
      // intentionally empty — durability does not depend on streamed partials
    })(),
  }));
}

describe("research-fact ledger durability on the streaming-DEFAULT path (a timeout kills the agent, never its facts)", () => {
  it("preserves acquired named champions in the fact store when the streaming deadline discards the body", async (): Promise<void> => {
    const nowIso = "2026-06-18T04:39:37.613Z";
    const rootDir = await mkdtemp(
      join(tmpdir(), "aigos-lab-engine-facts-streaming-"),
    );
    const store = createRunStore({
      rootDir,
      defaultSectionIds: ["positioningBuyerICP"],
      now: () => new Date(nowIso),
    });
    await store.createRun(saaslaunchResearchInput);

    // The ledger no-ops unless BOTH a store and a parentAuditRunId are present.
    // Assert both are wired so the test cannot pass vacuously.
    const factStore: ResearchFactStore = createInMemoryResearchFactStore();
    const parentAuditRunId = "parent_audit_facts_streaming_1";
    expect(factStore).toBeDefined();
    expect(parentAuditRunId.length).toBeGreaterThan(0);

    // Stub champion acquisition: >=3 valid named champions, no network. Same
    // injectable seam (deps.acquireBuyerPersonaPrepass) the answer-tool path
    // uses — both paths share runBuyerPersonaCandidatePrepass.
    const acquireBuyerPersonaPrepass = vi.fn(async () =>
      buildStubbedPrepass(groundedChampions),
    );

    // The answer-tool fallback MUST NOT run: this asserts we are on the
    // streaming-default path, not the LAB_SECTION_STREAMING=false fallback.
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => {
      throw new Error(
        "Answer-tool fallback must not run on the streaming-default path.",
      );
    });

    const streamStructured = buildFixtureBodyStreamer();

    const result = await runSection(
      {
        runId: saaslaunchResearchInput.runId,
        sectionId: "positioningBuyerICP",
        // Below the repair floor: a repair cannot be funded, so the BuyerICP
        // persona evidence-gap (the streamed fixture body fails the named-persona
        // floor) commits as the honest gap instead of looping — exactly run
        // b0d12b45's deadline / gap path, and identical to the answer-tool case.
        deadlineAt: Date.parse(nowIso) + labSectionRepairFloorMs - 1,
      },
      {
        store,
        loadSkill: async () => "Use the injected corpus only.",
        allowedTools: [],
        streamStructured,
        runAnswerTool,
        acquireBuyerPersonaPrepass,
        factStore,
        parentAuditRunId,
        // NO LAB_SECTION_STREAMING override: production default keeps streaming
        // ON, so runSection dispatches to runSectionViaStructuredBodyStream.
        env: { LAB_VERIFIER_MAX_UNSUPPORTED: "999" },
        now: () => new Date(nowIso),
      },
    );

    // Proves we drove the streaming-default path (the answer-tool fallback was
    // never invoked) and the streaming stream attempt actually ran.
    expect(runAnswerTool).not.toHaveBeenCalled();
    expect(streamStructured).toHaveBeenCalled();

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

    // The marquee assertion: a streaming timeout discarded the body, but the
    // facts survive in the durable ledger.
    expect(championFacts.length).toBeGreaterThanOrEqual(3);

    for (const fact of championFacts) {
      expect(fact.sourceUrl).toMatch(/^https:\/\//);
      expect(fact.sourceQuote).toContain(fact.claimToken);
      expect(fact.parentAuditRunId).toBe(parentAuditRunId);
      expect(fact.runId).toBe(saaslaunchResearchInput.runId);
    }
  });
});
