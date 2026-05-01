/**
 * Tests for src/lib/ai/orchestrator.ts (T6).
 *
 * Strategy: we exercise the wrapping logic + sanitizer directly. The streamText
 * call itself is end-to-end-tested via T11 (airtable.com smoke). Pulling Ollama
 * into unit tests would defeat the purpose of dependency injection.
 */

import { describe, expect, it, vi } from "vitest";
import type { UIMessage } from "ai";
import {
  ORCHESTRATOR_SYSTEM_PROMPT,
  createOrchestratorToolDeps,
  sanitizeOrchestratorMessages,
  type RunOrchestratorDeps,
} from "./orchestrator";
import { LIGHTHOUSE_DAG_ORDER } from "@/lib/gtm/lighthouse-dag";
import type {
  ArtifactRow,
  DispatchSkillStageInput,
  DispatchSkillStageResult,
} from "@/lib/gtm/orchestrator-tools";

// Mock render-md so the test doesn't depend on real fixture shapes.
vi.mock("@/lib/gtm/render-md", () => ({
  renderSkillOutputToMd: vi.fn(
    (skill: string, output: unknown) => `# ${skill}\n\n${JSON.stringify(output)}\n`,
  ),
}));

type ExecuteFn<I, O> = (input: I, options: never) => Promise<O>;

function asExecute<I, O>(t: { execute?: unknown }): ExecuteFn<I, O> {
  if (!t.execute) throw new Error("tool.execute missing");
  return t.execute as ExecuteFn<I, O>;
}

function makeDeps(overrides: Partial<RunOrchestratorDeps> = {}): RunOrchestratorDeps {
  return {
    userId: "user_test",
    dispatchSkillRun: vi
      .fn()
      .mockResolvedValue({
        status: "completed",
        output: { run_id: "run_test", stage: "research-icp" },
      } satisfies DispatchSkillStageResult),
    fetchLatestVersion: vi.fn().mockResolvedValue(0),
    fetchArtifactById: vi.fn().mockResolvedValue(null),
    insertSkillArtifact: vi
      .fn()
      .mockResolvedValue({ id: "skill_artifact_1", version: 1 }),
    insertPatchedArtifact: vi
      .fn()
      .mockResolvedValue({ id: "patched_1", version: 2 }),
    generatePatchedMd: vi.fn().mockResolvedValue("# Patched\n"),
    classifyText: vi.fn().mockResolvedValue("no_action" as const),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// sanitizeOrchestratorMessages
// ---------------------------------------------------------------------------

describe("sanitizeOrchestratorMessages", () => {
  it("drops tool parts in incomplete states", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "user",
        parts: [{ type: "text", text: "hi" }],
      },
      {
        id: "2",
        role: "assistant",
        parts: [
          // @ts-expect-error — runtime tool part shape, not in SDK strict types
          { type: "tool-dispatch_skill", state: "input-streaming", input: {} },
          // @ts-expect-error — runtime tool part shape, not in SDK strict types
          { type: "tool-dispatch_skill", state: "output-available", input: {}, output: {} },
        ],
      },
    ];

    const sanitized = sanitizeOrchestratorMessages(messages);
    expect(sanitized).toHaveLength(2);
    expect(sanitized[1].parts).toHaveLength(1);
    expect(
      (sanitized[1].parts[0] as { state: string }).state,
    ).toBe("output-available");
  });

  it("preserves text parts and complete tool parts unchanged", () => {
    const messages: UIMessage[] = [
      {
        id: "1",
        role: "assistant",
        parts: [
          { type: "text", text: "ok" },
          // @ts-expect-error runtime tool part
          { type: "tool-classify_intent", state: "output-available", input: {}, output: { intent: "no_action" } },
        ],
      },
    ];
    const sanitized = sanitizeOrchestratorMessages(messages);
    expect(sanitized[0].parts).toHaveLength(2);
  });
});

// ---------------------------------------------------------------------------
// createOrchestratorToolDeps — dispatch_skill post-processing
// ---------------------------------------------------------------------------

describe("createOrchestratorToolDeps — dispatch wrapping", () => {
  it("renders MD and inserts a v1 skill_output artifact on first successful dispatch", async () => {
    const dispatchSkillRun = vi.fn().mockResolvedValue({
      status: "completed",
      output: { run_id: "run_test", stage: "research-icp", payload: 1 },
    });
    const fetchLatestVersion = vi.fn().mockResolvedValue(0);
    const insertSkillArtifact = vi
      .fn()
      .mockResolvedValue({ id: "skill_artifact_1", version: 1 });

    const deps = makeDeps({
      dispatchSkillRun,
      fetchLatestVersion,
      insertSkillArtifact,
    });
    const toolDeps = createOrchestratorToolDeps("run_test", deps);

    const result = await toolDeps.dispatchSkillStage({
      skill: "research-icp",
    } satisfies DispatchSkillStageInput);

    expect(dispatchSkillRun).toHaveBeenCalledWith({ skill: "research-icp" });
    expect(fetchLatestVersion).toHaveBeenCalledWith("research-icp");
    expect(insertSkillArtifact).toHaveBeenCalledWith({
      run_id: "run_test",
      user_id: "user_test",
      skill: "research-icp",
      version: 1,
      content_md: expect.stringContaining("# research-icp"),
    });
    expect(result.status).toBe("completed");
  });

  it("inserts vN+1 when prior versions exist", async () => {
    const fetchLatestVersion = vi.fn().mockResolvedValue(2);
    const insertSkillArtifact = vi
      .fn()
      .mockResolvedValue({ id: "skill_v3", version: 3 });

    const toolDeps = createOrchestratorToolDeps(
      "run_test",
      makeDeps({ fetchLatestVersion, insertSkillArtifact }),
    );

    await toolDeps.dispatchSkillStage({ skill: "research-competitor" });

    expect(insertSkillArtifact).toHaveBeenCalledWith(
      expect.objectContaining({ skill: "research-competitor", version: 3 }),
    );
  });

  it("does NOT insert an artifact when dispatch fails (status !== completed)", async () => {
    const dispatchSkillRun = vi
      .fn()
      .mockResolvedValue({ status: "failed", error: "timeout" });
    const insertSkillArtifact = vi.fn();

    const toolDeps = createOrchestratorToolDeps(
      "run_test",
      makeDeps({ dispatchSkillRun, insertSkillArtifact }),
    );

    const result = await toolDeps.dispatchSkillStage({ skill: "research-market" });

    expect(insertSkillArtifact).not.toHaveBeenCalled();
    expect(result.status).toBe("failed");
  });

  it("does NOT insert an artifact when dispatch returns null/empty output", async () => {
    const dispatchSkillRun = vi
      .fn()
      .mockResolvedValue({ status: "completed", output: null });
    const insertSkillArtifact = vi.fn();

    const toolDeps = createOrchestratorToolDeps(
      "run_test",
      makeDeps({ dispatchSkillRun, insertSkillArtifact }),
    );

    await toolDeps.dispatchSkillStage({ skill: "research-market" });
    expect(insertSkillArtifact).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// createOrchestratorToolDeps — patch_artifact pass-through
// ---------------------------------------------------------------------------

describe("createOrchestratorToolDeps — patch wrapping", () => {
  const sampleArtifact: ArtifactRow = {
    id: "11111111-1111-1111-1111-111111111111",
    run_id: "run_test",
    skill: "research-icp",
    version: 1,
    content_md: "# ICP\n\nMid-market.\n",
  };

  it("uses runId for the orchestrator tool deps so patch_artifact rejects mismatched runs", async () => {
    const fetchArtifactById = vi
      .fn()
      .mockResolvedValue({ ...sampleArtifact, run_id: "run_other" });
    const toolDeps = createOrchestratorToolDeps(
      "run_test",
      makeDeps({ fetchArtifactById }),
    );
    expect(toolDeps.runId).toBe("run_test");
    const fetched = await toolDeps.fetchArtifact(sampleArtifact.id);
    expect(fetched?.run_id).toBe("run_other");
  });

  it("forwards generatePatchedMd + insertPatchedArtifact deps unchanged", async () => {
    const generatePatchedMd = vi.fn().mockResolvedValue("# Patched\n\nNew text.\n");
    const insertPatchedArtifact = vi
      .fn()
      .mockResolvedValue({ id: "patched_2", version: 2 });

    const toolDeps = createOrchestratorToolDeps(
      "run_test",
      makeDeps({ generatePatchedMd, insertPatchedArtifact }),
    );

    await toolDeps.generatePatchedMd({ contentMd: "x", instruction: "y" });
    await toolDeps.insertPatchedArtifact({
      parent_id: sampleArtifact.id,
      run_id: "run_test",
      skill: "research-icp",
      version: 2,
      content_md: "x",
    });

    expect(generatePatchedMd).toHaveBeenCalled();
    expect(insertPatchedArtifact).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// System prompt sanity
// ---------------------------------------------------------------------------

describe("ORCHESTRATOR_SYSTEM_PROMPT", () => {
  it("enumerates LIGHTHOUSE_DAG_ORDER in canonical order", () => {
    for (const skill of LIGHTHOUSE_DAG_ORDER) {
      expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain(skill);
    }
    // Order check: each skill index must appear before the next
    let prevIdx = -1;
    for (const skill of LIGHTHOUSE_DAG_ORDER) {
      const idx = ORCHESTRATOR_SYSTEM_PROMPT.indexOf(skill);
      expect(idx).toBeGreaterThan(prevIdx);
      prevIdx = idx;
    }
  });

  it("mentions all three tools by name", () => {
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("dispatch_skill");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("patch_artifact");
    expect(ORCHESTRATOR_SYSTEM_PROMPT).toContain("classify_intent");
  });
});
