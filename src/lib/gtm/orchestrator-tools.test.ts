/**
 * Tests for orchestrator-tools.ts
 *
 * PRD: gtm-conversational-canvas (T5)
 *
 * Strategy: dependency injection. Every tool factory accepts an
 * OrchestratorToolDeps bag whose LLM + DB callbacks we replace with mocks,
 * so we never need to mock the `ai` module or hit Supabase. Same pattern as
 * src/lib/ai/chat-tools/__tests__/deep-dive.test.ts (extract `tool.execute`
 * and call it directly).
 */

import { describe, expect, it, vi } from "vitest";
import {
  INTENT_KINDS,
  classifyIntentInputSchema,
  createClassifyIntentTool,
  createDispatchSkillTool,
  createOrchestratorTools,
  createPatchArtifactTool,
  dispatchSkillInputSchema,
  parseIntent,
  type ArtifactRow,
  type DispatchSkillStageResult,
  type IntentKind,
  type OrchestratorToolDeps,
} from "./orchestrator-tools";

type ExecuteFn<I, O> = (input: I, options: never) => Promise<O>;

function asExecute<I, O>(t: { execute?: unknown }): ExecuteFn<I, O> {
  if (!t.execute) throw new Error("tool.execute missing");
  return t.execute as ExecuteFn<I, O>;
}

function makeDeps(overrides: Partial<OrchestratorToolDeps> = {}): OrchestratorToolDeps {
  return {
    runId: "run_test_1",
    userId: "user_test_1",
    dispatchSkillStage: vi
      .fn()
      .mockResolvedValue({ status: "completed", output: { ok: true } } satisfies DispatchSkillStageResult),
    fetchArtifact: vi.fn().mockResolvedValue(null),
    insertPatchedArtifact: vi
      .fn()
      .mockResolvedValue({ id: "artifact_new", version: 2 }),
    generatePatchedMd: vi.fn().mockResolvedValue("# Patched\n"),
    classifyText: vi.fn().mockResolvedValue("no_action" as IntentKind),
    ...overrides,
  };
}

const sampleArtifact: ArtifactRow = {
  id: "11111111-1111-1111-1111-111111111111",
  run_id: "run_test_1",
  skill: "research-icp",
  version: 1,
  content_md: "# ICP\n\nMid-market SaaS buyers.\n",
};

// ---------------------------------------------------------------------------
// dispatch_skill
// ---------------------------------------------------------------------------

describe("dispatch_skill tool", () => {
  it("forwards skill + refinement_context to the dispatch dep and returns ok=true", async () => {
    const dispatchSkillStage = vi
      .fn()
      .mockResolvedValue({ status: "completed", output: { artifact: "x" } });
    const deps = makeDeps({ dispatchSkillStage });
    const t = createDispatchSkillTool(deps);
    const execute = asExecute<
      { skill: "research-competitor"; refinement_context?: string },
      { ok: boolean; status?: string; error?: string | null }
    >(t);

    const result = await execute(
      { skill: "research-competitor", refinement_context: "G2-only sources" },
      {} as never,
    );

    expect(dispatchSkillStage).toHaveBeenCalledWith({
      skill: "research-competitor",
      refinement_context: "G2-only sources",
    });
    expect(result.ok).toBe(true);
    expect(result.status).toBe("completed");
  });

  it("returns ok=false on dispatch failure", async () => {
    const dispatchSkillStage = vi.fn().mockRejectedValue(new Error("boom"));
    const t = createDispatchSkillTool(makeDeps({ dispatchSkillStage }));
    const execute = asExecute<
      { skill: "research-icp" },
      { ok: boolean; error?: string }
    >(t);

    const result = await execute({ skill: "research-icp" }, {} as never);
    expect(result.ok).toBe(false);
    expect(result.error).toContain("boom");
  });

  it("rejects non-lighthouse skill enum values via inputSchema", () => {
    // research-offer is not in LIGHTHOUSE_5 — Zod enum should reject it.
    const parsed = dispatchSkillInputSchema.safeParse({ skill: "research-offer" });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// patch_artifact
// ---------------------------------------------------------------------------

describe("patch_artifact tool", () => {
  it("reads artifact, calls Ollama, and writes a v+1 row with parent_id link", async () => {
    const fetchArtifact = vi.fn().mockResolvedValue(sampleArtifact);
    const insertPatchedArtifact = vi
      .fn()
      .mockResolvedValue({ id: "artifact_v2", version: 2 });
    const generatePatchedMd = vi
      .fn()
      .mockResolvedValue("# ICP\n\nEnterprise mid-market SaaS buyers, $50M+ ARR.");
    const deps = makeDeps({ fetchArtifact, insertPatchedArtifact, generatePatchedMd });
    const t = createPatchArtifactTool(deps);
    const execute = asExecute<
      { artifact_id: string; instruction: string },
      { ok: boolean; artifact_id?: string; version?: number; parent_id?: string; error?: string }
    >(t);

    const result = await execute(
      { artifact_id: sampleArtifact.id, instruction: "focus on enterprise" },
      {} as never,
    );

    expect(fetchArtifact).toHaveBeenCalledWith(sampleArtifact.id);
    expect(generatePatchedMd).toHaveBeenCalledWith({
      contentMd: sampleArtifact.content_md,
      instruction: "focus on enterprise",
    });
    expect(insertPatchedArtifact).toHaveBeenCalledWith({
      parent_id: sampleArtifact.id,
      run_id: sampleArtifact.run_id,
      skill: sampleArtifact.skill,
      version: 2,
      content_md: "# ICP\n\nEnterprise mid-market SaaS buyers, $50M+ ARR.\n",
    });
    expect(result.ok).toBe(true);
    expect(result.artifact_id).toBe("artifact_v2");
    expect(result.version).toBe(2);
    expect(result.parent_id).toBe(sampleArtifact.id);
  });

  it("returns artifact_not_found when fetchArtifact returns null", async () => {
    const t = createPatchArtifactTool(
      makeDeps({ fetchArtifact: vi.fn().mockResolvedValue(null) }),
    );
    const execute = asExecute<
      { artifact_id: string; instruction: string },
      { ok: boolean; error?: string }
    >(t);

    const result = await execute(
      {
        artifact_id: "00000000-0000-0000-0000-000000000000",
        instruction: "tighten",
      },
      {} as never,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("artifact_not_found");
  });

  it("returns artifact_run_mismatch when artifact belongs to a different run", async () => {
    const otherRunArtifact: ArtifactRow = { ...sampleArtifact, run_id: "run_other" };
    const t = createPatchArtifactTool(
      makeDeps({ fetchArtifact: vi.fn().mockResolvedValue(otherRunArtifact) }),
    );
    const execute = asExecute<
      { artifact_id: string; instruction: string },
      { ok: boolean; error?: string }
    >(t);

    const result = await execute(
      { artifact_id: sampleArtifact.id, instruction: "tighten" },
      {} as never,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("artifact_run_mismatch");
  });

  it("returns empty_patch_output when Ollama returns whitespace only", async () => {
    const t = createPatchArtifactTool(
      makeDeps({
        fetchArtifact: vi.fn().mockResolvedValue(sampleArtifact),
        generatePatchedMd: vi.fn().mockResolvedValue("   \n  "),
      }),
    );
    const execute = asExecute<
      { artifact_id: string; instruction: string },
      { ok: boolean; error?: string }
    >(t);

    const result = await execute(
      { artifact_id: sampleArtifact.id, instruction: "x" },
      {} as never,
    );
    expect(result.ok).toBe(false);
    expect(result.error).toBe("empty_patch_output");
  });
});

// ---------------------------------------------------------------------------
// classify_intent
// ---------------------------------------------------------------------------

describe("classify_intent tool", () => {
  it("returns the intent from classifyText dep", async () => {
    const classifyText = vi.fn().mockResolvedValue("patch_artifact" as IntentKind);
    const t = createClassifyIntentTool(makeDeps({ classifyText }));
    const execute = asExecute<
      { user_message: string },
      { intent: IntentKind }
    >(t);

    const result = await execute(
      { user_message: "tighten the ICP wording" },
      {} as never,
    );
    expect(classifyText).toHaveBeenCalledWith("tighten the ICP wording");
    expect(result.intent).toBe("patch_artifact");
  });

  it("rejects empty user_message via inputSchema", () => {
    const parsed = classifyIntentInputSchema.safeParse({ user_message: "" });
    expect(parsed.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// parseIntent (default classifier output normalizer)
// ---------------------------------------------------------------------------

describe("parseIntent", () => {
  it.each(INTENT_KINDS)("recognizes plain '%s'", (kind) => {
    expect(parseIntent(kind)).toBe(kind);
  });

  it("strips quotes, periods, whitespace, code fences", () => {
    expect(parseIntent("`patch_artifact`")).toBe("patch_artifact");
    expect(parseIntent('"rerun_skill".')).toBe("rerun_skill");
    expect(parseIntent("  ask_question \n")).toBe("ask_question");
  });

  it("falls back to no_action on garbage", () => {
    expect(parseIntent("¯\\_(ツ)_/¯")).toBe("no_action");
    expect(parseIntent("")).toBe("no_action");
  });
});

// ---------------------------------------------------------------------------
// createOrchestratorTools (factory bundle)
// ---------------------------------------------------------------------------

describe("createOrchestratorTools", () => {
  it("returns all three tools keyed by name", () => {
    const tools = createOrchestratorTools(makeDeps());
    expect(Object.keys(tools).sort()).toEqual([
      "classify_intent",
      "dispatch_skill",
      "patch_artifact",
    ]);
  });
});
