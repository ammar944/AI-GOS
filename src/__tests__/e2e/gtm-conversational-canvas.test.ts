/**
 * E2E test for the GTM Conversational Canvas (T11).
 *
 * PRD: gtm-conversational-canvas (T11)
 *
 * Strategy: simulate the orchestrator's tool-call sequence WITHOUT invoking
 * the real Ollama brain. We construct the same tool factories the live route
 * uses (T5 + T6 wiring), back them with an in-memory Supabase stub, and call
 * each tool's execute() in the order a "run the full pipeline" / "tighten the
 * ICP" / "rerun the competitor analysis" message would trigger.
 *
 * All assertions check DB state via the in-memory store — exactly what the
 * PRD asks for ("verifiable via DB query — no UI scraping"). This catches
 * regressions in:
 *   - createOrchestratorToolDeps wrapping (T6) that writes v1 artifacts
 *     after a successful skill run
 *   - patch_artifact tool (T5) that writes v+1 with parent_id linkage
 *   - rerun semantics: dispatch_skill again after v1 produces v2 with the
 *     SAME source='skill_output', not a patch
 *
 * What this test deliberately does NOT cover (and T11 acceptance does not
 * require because it specifies "no UI scraping"):
 *   - Real Ollama tool-call routing (covered by the smoke test in
 *     scripts/smoke-ollama-tools.ts, committed at a1d6ec87)
 *   - Real /api/gtm/runs/:id/chat HTTP layer (covered by T7's route test)
 *   - Real Anthropic + Perplexity skill bodies (covered by per-skill tests)
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createOrchestratorToolDeps, type RunOrchestratorDeps } from "@/lib/ai/orchestrator";
import { createOrchestratorTools } from "@/lib/gtm/orchestrator-tools";
import { LIGHTHOUSE_DAG_ORDER } from "@/lib/gtm/lighthouse-dag";
import type { LighthouseSkill } from "@/lib/gtm/types";

// We mock render-md so the test doesn't depend on real fixture shapes.
vi.mock("@/lib/gtm/render-md", () => ({
  renderSkillOutputToMd: vi.fn(
    (skill: string, output: unknown) =>
      `## ${skill}\n\n${JSON.stringify(output)}\n`,
  ),
}));

// ---------------------------------------------------------------------------
// In-memory artifact store
// ---------------------------------------------------------------------------

interface StoredArtifact {
  id: string;
  run_id: string;
  user_id: string;
  skill: string;
  version: number;
  parent_id: string | null;
  content_md: string;
  source: "skill_output" | "agent_patch";
  created_at: string;
}

class InMemoryArtifactStore {
  rows: StoredArtifact[] = [];
  private next = 1;

  insertSkillOutput(input: {
    run_id: string;
    user_id: string;
    skill: LighthouseSkill;
    version: number;
    content_md: string;
  }): { id: string; version: number } {
    const id = `art_${this.next++}`;
    this.rows.push({
      ...input,
      id,
      parent_id: null,
      source: "skill_output",
      created_at: new Date().toISOString(),
    });
    return { id, version: input.version };
  }

  insertPatch(input: {
    parent_id: string;
    run_id: string;
    skill: string;
    version: number;
    content_md: string;
    user_id: string;
  }): { id: string; version: number } {
    const id = `art_${this.next++}`;
    this.rows.push({
      ...input,
      id,
      source: "agent_patch",
      created_at: new Date().toISOString(),
    });
    return { id, version: input.version };
  }

  fetchById(id: string): StoredArtifact | null {
    return this.rows.find((r) => r.id === id) ?? null;
  }

  latestVersion(run_id: string, skill: string): number {
    return this.rows
      .filter((r) => r.run_id === run_id && r.skill === skill)
      .reduce((max, r) => Math.max(max, r.version), 0);
  }
}

function buildDeps(opts: {
  runId: string;
  userId: string;
  store: InMemoryArtifactStore;
  dispatchOutputs: Record<LighthouseSkill, unknown>;
  dispatchSpy: ReturnType<typeof vi.fn>;
  patchedMd: (input: { contentMd: string; instruction: string }) => string;
}): RunOrchestratorDeps {
  opts.dispatchSpy.mockImplementation(
    async (input: { skill: LighthouseSkill; refinement_context?: string }) => {
      return {
        status: "completed" as const,
        output: {
          skill: input.skill,
          run_id: opts.runId,
          refinement: input.refinement_context ?? null,
          payload: opts.dispatchOutputs[input.skill],
        },
      };
    },
  );
  return {
    userId: opts.userId,
    dispatchSkillRun: (input) =>
      (opts.dispatchSpy as unknown as (i: typeof input) => Promise<{
        status: "completed";
        output: unknown;
      }>)(input),
    fetchLatestVersion: async (skill) =>
      opts.store.latestVersion(opts.runId, skill),
    fetchArtifactById: async (id) => {
      const row = opts.store.fetchById(id);
      if (!row) return null;
      return {
        id: row.id,
        run_id: row.run_id,
        skill: row.skill,
        version: row.version,
        content_md: row.content_md,
      };
    },
    insertSkillArtifact: async (input) =>
      opts.store.insertSkillOutput(input),
    insertPatchedArtifact: async (input) =>
      opts.store.insertPatch({ ...input, user_id: opts.userId }),
    generatePatchedMd: async (input) => opts.patchedMd(input),
    classifyText: async () => "no_action",
  };
}

type ExecuteFn<I, O> = (input: I, options: never) => Promise<O>;
function asExecute<I, O>(t: { execute?: unknown }): ExecuteFn<I, O> {
  if (!t.execute) throw new Error("tool.execute missing");
  return t.execute as ExecuteFn<I, O>;
}

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

const RUN_ID = "run_airtable";
const USER_ID = "user_test";

const dispatchOutputs: Record<LighthouseSkill, unknown> = {
  "ingest-url": { discovered_pages: ["/", "/pricing"] },
  "ingest-identity": { company_name: "Airtable", domain: "airtable.com" },
  "research-market": { tam: "$10B" },
  "research-competitor": { competitors: ["Smartsheet", "Notion"] },
  "research-icp": { icp: "Mid-market product teams" },
};

let store: InMemoryArtifactStore;
let dispatchSpy: ReturnType<typeof vi.fn>;
let patchedMdSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  store = new InMemoryArtifactStore();
  dispatchSpy = vi.fn();
  patchedMdSpy = vi.fn(({ instruction }: { instruction: string }) =>
    `## research-icp\n\nEnterprise mid-market only. (${instruction})\n`,
  );
});

describe("GTM conversational canvas — full pipeline e2e (T11)", () => {
  it("dispatching all 5 skills in DAG order writes 5 v1 skill_output artifacts", async () => {
    const deps = buildDeps({
      runId: RUN_ID,
      userId: USER_ID,
      store,
      dispatchOutputs,
      dispatchSpy,
      patchedMd: ({ contentMd }) => contentMd,
    });
    const tools = createOrchestratorTools(createOrchestratorToolDeps(RUN_ID, deps));
    const dispatch = asExecute<
      { skill: LighthouseSkill; refinement_context?: string },
      { ok: boolean; status: string }
    >(tools.dispatch_skill);

    for (const skill of LIGHTHOUSE_DAG_ORDER) {
      const r = await dispatch({ skill }, {} as never);
      expect(r.ok).toBe(true);
      expect(r.status).toBe("completed");
    }

    expect(store.rows).toHaveLength(5);
    expect(store.rows.map((r) => r.skill)).toEqual([...LIGHTHOUSE_DAG_ORDER]);
    expect(store.rows.every((r) => r.version === 1)).toBe(true);
    expect(store.rows.every((r) => r.source === "skill_output")).toBe(true);
    expect(store.rows.every((r) => r.parent_id === null)).toBe(true);
    expect(dispatchSpy).toHaveBeenCalledTimes(5);
  });

  it("'tighten the ICP' as a patch writes v2 with parent_id, no new dispatch, free", async () => {
    const deps = buildDeps({
      runId: RUN_ID,
      userId: USER_ID,
      store,
      dispatchOutputs,
      dispatchSpy,
      patchedMd: patchedMdSpy as unknown as (input: {
        contentMd: string;
        instruction: string;
      }) => string,
    });
    const tools = createOrchestratorTools(createOrchestratorToolDeps(RUN_ID, deps));
    const dispatch = asExecute<
      { skill: LighthouseSkill },
      { ok: boolean }
    >(tools.dispatch_skill);
    const patch = asExecute<
      { artifact_id: string; instruction: string },
      { ok: boolean; version?: number; parent_id?: string }
    >(tools.patch_artifact);

    // First dispatch all 5 to get an ICP v1 to patch.
    for (const skill of LIGHTHOUSE_DAG_ORDER) {
      await dispatch({ skill }, {} as never);
    }
    const icpV1 = store.rows.find((r) => r.skill === "research-icp");
    expect(icpV1).toBeDefined();
    dispatchSpy.mockClear();

    const result = await patch(
      {
        artifact_id: icpV1!.id,
        instruction: "make the ICP description focus on enterprise only",
      },
      {} as never,
    );

    expect(result.ok).toBe(true);
    expect(result.version).toBe(2);
    expect(result.parent_id).toBe(icpV1!.id);

    const icpRows = store.rows.filter((r) => r.skill === "research-icp");
    expect(icpRows).toHaveLength(2);
    const v2 = icpRows.find((r) => r.version === 2)!;
    expect(v2.source).toBe("agent_patch");
    expect(v2.parent_id).toBe(icpV1!.id);
    expect(v2.content_md).toContain("Enterprise mid-market only");

    // No paid skill spend: dispatchSkillRun was not called during the patch.
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(patchedMdSpy).toHaveBeenCalledTimes(1);
  });

  it("'rerun competitor with G2-only sources' dispatches research-competitor with refinement_context and writes a v2 skill_output", async () => {
    const deps = buildDeps({
      runId: RUN_ID,
      userId: USER_ID,
      store,
      dispatchOutputs,
      dispatchSpy,
      patchedMd: ({ contentMd }) => contentMd,
    });
    const tools = createOrchestratorTools(createOrchestratorToolDeps(RUN_ID, deps));
    const dispatch = asExecute<
      { skill: LighthouseSkill; refinement_context?: string },
      { ok: boolean }
    >(tools.dispatch_skill);

    for (const skill of LIGHTHOUSE_DAG_ORDER) {
      await dispatch({ skill }, {} as never);
    }
    dispatchSpy.mockClear();

    await dispatch(
      {
        skill: "research-competitor",
        refinement_context: "use G2-only sources",
      },
      {} as never,
    );

    expect(dispatchSpy).toHaveBeenCalledTimes(1);
    expect(dispatchSpy).toHaveBeenCalledWith({
      skill: "research-competitor",
      refinement_context: "use G2-only sources",
    });

    const compRows = store.rows.filter((r) => r.skill === "research-competitor");
    expect(compRows).toHaveLength(2);
    const v2 = compRows.find((r) => r.version === 2)!;
    expect(v2.source).toBe("skill_output");
    // Re-runs are top-level, not patches: parent_id stays null.
    expect(v2.parent_id).toBeNull();
    // Refinement payload reaches the artifact via the dispatchSkillRun mock.
    expect(v2.content_md).toContain("use G2-only sources");
  });
});
