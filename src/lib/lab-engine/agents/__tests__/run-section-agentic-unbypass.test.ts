import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ActivityEvent } from "@/lib/lab-engine/events/activity-event";
import { createRunStore } from "@/lib/lab-engine/runs/run-store";
import type { PreparedSectionContext } from "@/lib/lab-engine/agents/run-section";
import type { RunSectionInput } from "@/lib/lab-engine/agents/run-section";
import type {
  AgentStep,
  AnswerToolRunner,
} from "@/lib/lab-engine/agents/section-agent";
import type { TranscriptRecord } from "@/lib/lab-engine/agents/verification/provenance-detect";

// --- Mocks: keep the agentic generation + projection deterministic (no GLM). ---
// The regression under test is the empty-tools guard at the top of
// runAgenticGLMSection. We assert the guard does NOT fire under prepared-context
// (the unbypass) by observing that the agentic GENERATION runner is reached.
// The mocked generator returns a real transcript whose URLs/quotes the provenance
// detector accepts, so no remediation round fires (which would call live GLM).

const generateAgenticGLMSectionMock = vi.fn(
  async (..._args: unknown[]): Promise<{
    markdown: string;
    transcript: TranscriptRecord[];
  }> => {
    // Lazily import the fixture so the mock stays cheap at module-eval time.
    const { voiceOfCustomerFixtureArtifact } = await import(
      "@/lib/lab-engine/fixtures/voice-of-customer-artifact"
    );
    const body = voiceOfCustomerFixtureArtifact.body as Record<string, unknown>;
    // Collect every URL + quote string the fixture body asserts, then embed them
    // verbatim in ONE transcript record's output blob. The provenance detector
    // grounds URLs/quotes against the raw transcript JSON (regex over the JSON
    // string), so embedding them here yields ZERO violations — no remediation
    // round fires (which would call the un-mocked live GLM).
    const cited: string[] = [];
    const collect = (value: unknown): void => {
      if (typeof value === "string") {
        if (/https?:\/\//.test(value) || value.length > 12) cited.push(value);
        return;
      }
      if (Array.isArray(value)) {
        for (const item of value) collect(item);
        return;
      }
      if (value !== null && typeof value === "object") {
        for (const v of Object.values(value as Record<string, unknown>)) {
          collect(v);
        }
      }
    };
    collect(body);
    const transcript: TranscriptRecord[] = [
      {
        step: 0,
        toolName: "reviews",
        toolCallId: "c1",
        input: { domain: "saaslaunch.dev" },
        output: { evidence: cited.join("\n") },
        isError: false,
      },
    ];
    // The markdown cites the same URLs/quotes so the URL/quote-not-in-transcript
    // checks pass (body URLs appear in transcript; markdown URLs appear in body).
    const markdown =
      "# Voice of Customer — SaaSLaunch\n\n" +
      cited.filter((s) => /https?:\/\//.test(s)).slice(0, 6).join("\n") +
      "\n\nStrategic verdict: buyers frame the pain as loss of follow-up control.";
    return { markdown, transcript };
  },
);

const projectMarkdownToTypedBodyMock = vi.fn(
  async (..._args: unknown[]): Promise<{
    body: unknown;
    validates: true;
    completeness: unknown[];
  }> => {
    // Lazily import the fixture so the mock stays cheap at module-eval time and
    // avoids a circular import during vi.mock hoisting.
    const { voiceOfCustomerFixtureArtifact } = await import(
      "@/lib/lab-engine/fixtures/voice-of-customer-artifact"
    );
    return {
      body: voiceOfCustomerFixtureArtifact.body,
      validates: true,
      completeness: [],
    };
  },
);

vi.mock("../agentic-glm-runner", () => ({
  // Delegate to the mock fn (which ignores its args) so the module under test
  // gets the deterministic markdown + transcript the regression asserts on.
  generateAgenticGLMSection: (...args: unknown[]): unknown =>
    generateAgenticGLMSectionMock(...args),
  // buildAgenticTools must reflect the caller-supplied allowedOverride so the
  // empty-tools guard fires ONLY when the kill-switch empties the list (test 2).
  // When tools are allowed (test 1), it returns one fake tool per allowed name
  // so the agentic path proceeds past the guard to the generation runner.
  buildAgenticTools: (
    _sectionId: string,
    _env: unknown,
    allowedOverride?: readonly string[],
  ): Record<string, unknown> => {
    if (allowedOverride !== undefined && allowedOverride.length > 0) {
      return Object.fromEntries(
        allowedOverride.map((name) => [name, { execute: async () => ({}) }]),
      );
    }
    return {};
  },
  AGENTIC_GLM_MAX_STEPS: 16,
  GROUNDING_LAW: "GROUNDING LAW",
}));

vi.mock("../agentic-glm-projector", () => ({
  projectMarkdownToTypedBody: (...args: unknown[]): unknown =>
    projectMarkdownToTypedBodyMock(...args),
}));

// --- Store + runId fixtures (mirror lab-section-job.test.ts). ---

async function makeStore(runId: string): Promise<{
  store: ReturnType<typeof createRunStore>;
  runId: string;
}> {
  const rootDir = await mkdtemp(join(tmpdir(), "aigos-agentic-unbypass-"));
  const store = createRunStore({
    rootDir,
    defaultSectionIds: ["positioningVoiceOfCustomer"],
    now: () => new Date("2026-06-23T12:00:00.000Z"),
  });
  const { saaslaunchResearchInput } = await import(
    "@/lib/lab-engine/fixtures/saaslaunch"
  );
  await store.createRun({ ...saaslaunchResearchInput, runId });
  return { store, runId };
}

function preparedContextForVoC(): PreparedSectionContext {
  return {
    sectionId: "positioningVoiceOfCustomer",
    corpusRows: [
      {
        id: "prepared_1",
        sourceUrl: "https://example.com/prepared",
        title: "Prepared context source",
        text: "Prepared context row text.",
        observedAt: "2026-06-23T01:00:00.000Z",
        sourceId: "prepared_source_1",
        scope: "global",
      },
    ],
    factRows: [],
    coverageRows: [],
    toolGapRows: [],
    researchUseful: true,
  };
}

async function readEvents(
  store: ReturnType<typeof createRunStore>,
  runId: string,
): Promise<ActivityEvent[]> {
  const record = await store.readRun(runId);
  return record.events ?? [];
}

// A support step that carries every URL + quote string the fixture VoC body
// asserts, so the answer-tool evidence gate (which grounds load-bearing claims
// against modelSteps' toolResults) passes for the routing-only tests (2 & 3).
async function buildVoCSupportStep(): Promise<AgentStep> {
  const { voiceOfCustomerFixtureArtifact } = await import(
    "@/lib/lab-engine/fixtures/voice-of-customer-artifact"
  );
  const body = voiceOfCustomerFixtureArtifact.body as Record<string, unknown>;
  const cited: string[] = [];
  const collect = (value: unknown): void => {
    if (typeof value === "string") {
      if (/https?:\/\//.test(value) || value.length > 12) cited.push(value);
      return;
    }
    if (Array.isArray(value)) {
      for (const item of value) collect(item);
      return;
    }
    if (value !== null && typeof value === "object") {
      for (const v of Object.values(value as Record<string, unknown>)) {
        collect(v);
      }
    }
  };
  collect(body);
  return {
    stepNumber: 0,
    finishReason: "stop",
    text: "",
    toolCalls: [],
    toolResults: [
      { toolName: "fixture_support", output: { text: cited.join(" ") } },
    ],
  };
}

describe("runAgenticGLMSection unbypass (Phase 1 regression)", (): void => {
  const sectionId = "positioningVoiceOfCustomer";

  beforeEach((): void => {
    generateAgenticGLMSectionMock.mockClear();
    projectMarkdownToTypedBodyMock.mockClear();
  });

  afterEach((): void => {
    vi.resetModules();
  });

  it("does NOT fall back to answer-tool when preparedContext is present and live tools are on (the regression)", async (): Promise<void> => {
    const { store, runId } = await makeStore("run-agentic-unbypass");
    const runSection = (await import("../run-section")).runSection;
    const { voiceOfCustomerFixtureSectionOutput } = await import(
      "@/lib/lab-engine/fixtures/voice-of-customer-artifact"
    );
    // Provide a valid answerInput so any graceful agentic->answer-tool fallback
    // (e.g. verifier rejects the projected body) completes instead of throwing.
    // The regression assertion is that runAnswerTool is NOT called when the
    // agentic path succeeds; this mock only catches the fallback branch.
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [],
      text: "",
      answerInput: voiceOfCustomerFixtureSectionOutput,
    }));

    const input: RunSectionInput = { runId, sectionId };
    // The agentic commit spine may throw on VoC persistence minimums (a pre-
    // existing normalizer behavior unrelated to the unbypass). The regression
    // signals — agentic generation ran, answer-tool fallback did NOT, no
    // agentic-fallback event — are all observable regardless of commit outcome,
    // so wrap the call and assert them whether or not commit throws.
    let commitError: unknown = undefined;
    try {
      await runSection(input, {
        store,
        loadSkill: async () => "skill md",
        // preparedContext present — this is the condition getAllowedTools collapsed
        // to [] under, starving the agentic path of tools before the unbypass.
        preparedContext: preparedContextForVoC(),
        env: {
          LAB_AGENTIC_GLM_SECTIONS: sectionId,
          // live tools ON (not "false") so deps.allowedTools is undefined upstream;
          // the agentic path resolves tools from definition.allowedTools.
          LAB_ENGINE_LIVE_TOOLS: "true",
        },
        now: () => new Date("2026-06-23T12:00:00.000Z"),
        newId: () => "evt-unbypass",
        runAnswerTool,
      });
    } catch (error) {
      commitError = error;
    }

    // THE REGRESSION: the agentic GENERATION runner was reached (tools survived
    // the prepared-context guard) and the answer-tool fallback was NOT. The
    // agentic path may retry once on a thin body, so assert at-least-once rather
    // than exactly-once.
    expect(generateAgenticGLMSectionMock).toHaveBeenCalled();
    expect(generateAgenticGLMSectionMock.mock.calls.length).toBeGreaterThanOrEqual(1);
    expect(runAnswerTool).not.toHaveBeenCalled();

    // No agentic-fallback event should be present — the section proceeded agentic.
    const events = await readEvents(store, runId);
    const fallbackEvent = events.find((e) => e.type === "agentic-fallback");
    expect(fallbackEvent).toBeUndefined();

    // The only acceptable throw is a downstream persistence-minimums failure from
    // the VoC normalizer — never an answer-tool/agent-loop failure (which would
    // mean we took the wrong path).
    if (commitError !== undefined) {
      expect(String((commitError as Error).message)).toMatch(
        /failed persistence validation|minimums/i,
      );
    }
  });

  it("emits agentic-fallback reason=live_tools_disabled resolvedToolCount=0 when the kill-switch is off, then falls back to answer-tool", async (): Promise<void> => {
    const { store, runId } = await makeStore("run-agentic-killswitch");
    const runSection = (await import("../run-section")).runSection;
    const { voiceOfCustomerFixtureSectionOutput } = await import(
      "@/lib/lab-engine/fixtures/voice-of-customer-artifact"
    );
    const supportStep = await buildVoCSupportStep();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [supportStep],
      text: "",
      answerInput: voiceOfCustomerFixtureSectionOutput,
    }));

    // The answer-tool path may throw on VoC persistence minimums (pre-existing
    // normalizer behavior). The routing signals — agentic generation NOT reached,
    // answer-tool fallback ran, agentic-fallback event emitted with the right
    // metadata — are all observable regardless of commit outcome.
    try {
      await runSection(
        { runId, sectionId },
        {
          store,
          loadSkill: async () => "skill md",
          preparedContext: preparedContextForVoC(),
          // Kill-switch OFF: lab-section-job passes deps.allowedTools=[] in prod
          // when this is "false". We simulate that here directly.
          allowedTools: [],
          env: {
            LAB_AGENTIC_GLM_SECTIONS: sectionId,
            LAB_ENGINE_LIVE_TOOLS: "false",
          },
          now: () => new Date("2026-06-23T12:00:00.000Z"),
          newId: () => "evt-killswitch",
          runAnswerTool,
        },
      );
    } catch {
      // Persistence-minimums throw is acceptable here; the routing signals below
      // are the actual regression assertions.
    }

    // Agentic generation was NOT reached — tools were empty.
    expect(generateAgenticGLMSectionMock).not.toHaveBeenCalled();
    // The answer-tool fallback ran.
    expect(runAnswerTool).toHaveBeenCalled();

    const events = await readEvents(store, runId);
    const fallback = events.find((e) => e.type === "agentic-fallback");
    expect(fallback).toBeDefined();
    expect(fallback?.type).toBe("agentic-fallback");
    if (fallback?.type === "agentic-fallback") {
      expect(fallback.metadata.reason).toBe("live_tools_disabled");
      expect(fallback.metadata.resolvedToolCount).toBe(0);
      expect(fallback.metadata.hasPreparedContext).toBe(true);
    }
  });

  it("routes to the answer-tool path (no agentic run, no agentic-fallback) when LAB_AGENTIC_GLM_SECTIONS is unset", async (): Promise<void> => {
    const { store, runId } = await makeStore("run-agentic-flagoff");
    const runSection = (await import("../run-section")).runSection;
    const { voiceOfCustomerFixtureSectionOutput } = await import(
      "@/lib/lab-engine/fixtures/voice-of-customer-artifact"
    );
    const supportStep = await buildVoCSupportStep();
    const runAnswerTool = vi.fn<AnswerToolRunner>(async () => ({
      steps: [supportStep],
      text: "",
      answerInput: voiceOfCustomerFixtureSectionOutput,
    }));

    // Same persistence-minimums caveat as above; routing signals are what matter.
    try {
      await runSection(
        { runId, sectionId },
        {
          store,
          loadSkill: async () => "skill md",
          preparedContext: preparedContextForVoC(),
          // Flag OFF — shouldUseAgenticGLM returns false, so the existing answer-tool
          // / streaming path runs. No agentic generation, no agentic-fallback event.
          env: {
            LAB_AGENTIC_GLM_SECTIONS: "",
            LAB_SECTION_STREAMING: "false",
          },
          now: () => new Date("2026-06-23T12:00:00.000Z"),
          newId: () => "evt-flagoff",
          runAnswerTool,
        },
      );
    } catch {
      // Persistence-minimums throw is acceptable here.
    }

    expect(generateAgenticGLMSectionMock).not.toHaveBeenCalled();
    expect(runAnswerTool).toHaveBeenCalled();

    const events = await readEvents(store, runId);
    const fallback = events.find((e) => e.type === "agentic-fallback");
    expect(fallback).toBeUndefined();
  });
});