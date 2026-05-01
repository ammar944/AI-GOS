/**
 * GTM conversational canvas — orchestrator chat agent loop.
 *
 * PRD: gtm-conversational-canvas (T6)
 *
 * Wires the Ollama-backed orchestrator brain (cheap tool-calling) to the three
 * tools defined in src/lib/gtm/orchestrator-tools.ts (T5). Each user turn:
 *
 *   1. Sanitize incomplete tool parts (per .claude/rules/learned-patterns.md —
 *      AI SDK is strict about tool call/result pairing).
 *   2. streamText with all three tools attached and the LIGHTHOUSE_5 DAG order
 *      baked into the system prompt so "run the full pipeline" works.
 *   3. After dispatch_skill returns, render the skill JSON to markdown via
 *      src/lib/gtm/render-md.ts and insert a versioned gtm_artifacts row
 *      (source = 'skill_output').
 *   4. patch_artifact and classify_intent are pure pass-through to the T5 tool
 *      bodies — they already write their own rows and resolve their own intents.
 *
 * Skill BODIES (research-market et al.) stay on Anthropic + Perplexity per
 * .claude/rules/ai-sdk-patterns.md. Only this surface and patch_artifact's
 * editor body run on Ollama.
 */

import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  type StreamTextResult,
  type UIMessage,
} from "ai";
import { ORCHESTRATOR_MODEL, ollama } from "@/lib/ai/providers";
import { LIGHTHOUSE_DAG_ORDER } from "@/lib/gtm/lighthouse-dag";
import {
  createOrchestratorTools,
  defaultClassifyText,
  defaultGeneratePatchedMd,
  type ArtifactRow,
  type DispatchSkillStageInput,
  type DispatchSkillStageResult,
  type IntentKind,
  type OrchestratorToolDeps,
} from "@/lib/gtm/orchestrator-tools";
import { renderSkillOutputToMd } from "@/lib/gtm/render-md";
import type { LighthouseSkill } from "@/lib/gtm/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InsertSkillArtifactInput {
  run_id: string;
  user_id: string;
  skill: LighthouseSkill;
  version: number;
  content_md: string;
}

export interface InsertSkillArtifactResult {
  id: string;
  version: number;
}

export interface InsertPatchedArtifactInput {
  parent_id: string;
  run_id: string;
  skill: string;
  version: number;
  content_md: string;
}

export interface InsertPatchedArtifactResult {
  id: string;
  version: number;
}

export interface RunOrchestratorDeps {
  userId: string;
  /** Run a lighthouse skill via the existing dispatch route (T5 contract). */
  dispatchSkillRun: (
    input: DispatchSkillStageInput,
  ) => Promise<DispatchSkillStageResult>;
  /** Highest version currently in gtm_artifacts for (run_id, skill). 0 if none. */
  fetchLatestVersion: (skill: LighthouseSkill) => Promise<number>;
  fetchArtifactById: (id: string) => Promise<ArtifactRow | null>;
  insertSkillArtifact: (
    input: InsertSkillArtifactInput,
  ) => Promise<InsertSkillArtifactResult>;
  insertPatchedArtifact: (
    input: InsertPatchedArtifactInput,
  ) => Promise<InsertPatchedArtifactResult>;
  generatePatchedMd?: (input: {
    contentMd: string;
    instruction: string;
  }) => Promise<string>;
  classifyText?: (userMessage: string) => Promise<IntentKind>;
}

// ---------------------------------------------------------------------------
// Message sanitizer (per learned-patterns.md)
// ---------------------------------------------------------------------------

const INCOMPLETE_TOOL_STATES = new Set([
  "input-streaming",
  "input-available",
  "approval-requested",
]);

function isIncompleteToolPart(part: UIMessage["parts"][number]): boolean {
  if (
    typeof part !== "object" ||
    part === null ||
    !("type" in part) ||
    typeof part.type !== "string" ||
    !part.type.startsWith("tool-") ||
    part.type === "tool-invocation"
  ) {
    return false;
  }
  const state =
    "state" in part && typeof part.state === "string" ? part.state : undefined;
  return state !== undefined && INCOMPLETE_TOOL_STATES.has(state);
}

export function sanitizeOrchestratorMessages(
  messages: UIMessage[],
): UIMessage[] {
  return messages.map((msg) => ({
    ...msg,
    parts: msg.parts.filter((part) => !isIncompleteToolPart(part)),
  })) as UIMessage[];
}

// ---------------------------------------------------------------------------
// Tool-deps wrapping (post-processing on dispatch_skill)
// ---------------------------------------------------------------------------

/**
 * Build the tool-side deps for createOrchestratorTools by wrapping
 * dispatchSkillRun so that on a successful run we render the JSON output to
 * markdown and persist a gtm_artifacts row (source = 'skill_output'). The
 * row's version is computed as fetchLatestVersion(skill) + 1, so re-runs
 * accumulate v1 → v2 → ... naturally.
 */
export function createOrchestratorToolDeps(
  runId: string,
  deps: RunOrchestratorDeps,
): OrchestratorToolDeps {
  return {
    runId,
    userId: deps.userId,
    dispatchSkillStage: async (input) => {
      const result = await deps.dispatchSkillRun(input);
      if (result.status === "completed" && result.output) {
        const md = renderSkillOutputToMd(input.skill, result.output);
        const nextVersion = (await deps.fetchLatestVersion(input.skill)) + 1;
        await deps.insertSkillArtifact({
          run_id: runId,
          user_id: deps.userId,
          skill: input.skill,
          version: nextVersion,
          content_md: md,
        });
      }
      return result;
    },
    fetchArtifact: deps.fetchArtifactById,
    insertPatchedArtifact: deps.insertPatchedArtifact,
    generatePatchedMd: deps.generatePatchedMd ?? defaultGeneratePatchedMd,
    classifyText: deps.classifyText ?? defaultClassifyText,
  };
}

// ---------------------------------------------------------------------------
// System prompt
// ---------------------------------------------------------------------------

export const ORCHESTRATOR_SYSTEM_PROMPT = [
  "You are the orchestrator for AIGOS GTM Conversational Canvas — a chat agent that helps users analyze a SaaS company's go-to-market position. You have three tools:",
  "",
  "  - dispatch_skill: kicks off ONE of the 5 lighthouse skills as new research. Use when the user wants new data. Costs paid skill spend.",
  "  - patch_artifact: edits an existing artifact's markdown via plain-English instruction. FREE — runs on Ollama. Use when the user wants to refine wording, tone, or focus on existing output.",
  "  - classify_intent: classifies a user message into one of {rerun_skill, patch_artifact, ask_question, no_action}. Use as a routing helper if the intent is unclear.",
  "",
  "The 5 lighthouse skills run in this DAG order — earlier skills feed context to later ones:",
  ...LIGHTHOUSE_DAG_ORDER.map((s, i) => `  ${i + 1}. ${s}`),
  "",
  "Rules:",
  "  - When the user asks 'run the full pipeline' or similar, dispatch all 5 skills in the order above.",
  "  - When the user references a section by name (e.g. 'the ICP' or 'competitors'), they almost always want patch_artifact (free) — not rerun_skill (paid).",
  "  - Never invent artifact IDs. If you need an artifact ID and the user hasn't given you one, ask which version they mean.",
  "  - Default to NO action for greetings or unclear requests. Ask one clarifying question.",
].join("\n");

// ---------------------------------------------------------------------------
// runOrchestrator — main entry
// ---------------------------------------------------------------------------

export type OrchestratorStreamResult = StreamTextResult<
  ReturnType<typeof createOrchestratorTools>,
  never
>;

export async function runOrchestrator(
  messages: UIMessage[],
  runId: string,
  deps: RunOrchestratorDeps,
): Promise<OrchestratorStreamResult> {
  const sanitized = sanitizeOrchestratorMessages(messages);
  const toolDeps = createOrchestratorToolDeps(runId, deps);
  const tools = createOrchestratorTools(toolDeps);

  return streamText({
    model: ollama(ORCHESTRATOR_MODEL),
    system: ORCHESTRATOR_SYSTEM_PROMPT,
    messages: await convertToModelMessages(sanitized),
    tools,
    stopWhen: stepCountIs(8),
    temperature: 0.3,
  }) as OrchestratorStreamResult;
}
