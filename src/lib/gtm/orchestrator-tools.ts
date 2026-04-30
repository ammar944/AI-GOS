/**
 * Orchestrator tool definitions for the GTM conversational canvas.
 *
 * PRD: gtm-conversational-canvas (T5)
 *
 * Three tools exposed to the orchestrator chat brain (Ollama):
 *   - dispatch_skill   → kicks off one of the 5 lighthouse skills via the
 *                        existing /api/gtm/runs/:id/dispatch route
 *   - patch_artifact   → free, Ollama-only edit of an existing artifact's
 *                        markdown; writes a new gtm_artifacts row v+1
 *   - classify_intent  → routes a user message to one of four intents
 *
 * Skill bodies (research-market, etc.) stay on Anthropic + Perplexity per
 * .claude/rules/ai-sdk-patterns.md. Only this orchestrator surface and the
 * patch_artifact body run on Ollama.
 *
 * Design constraints (from PRD + project rules):
 * - AI SDK v6 patterns only: inputSchema (NOT parameters), maxOutputTokens
 *   (NOT maxTokens).
 * - Tools are factory functions that close over runId/userId + injected
 *   callbacks, mirroring the createEditMediaPlanTool pattern in
 *   src/lib/ai/media-plan-chat-tools/.
 * - Dependency injection for the LLM + DB calls keeps unit tests deterministic
 *   without mocking the `ai` module.
 */

import { generateText, tool } from "ai";
import { z } from "zod";
import { ORCHESTRATOR_MODEL, ollama } from "@/lib/ai/providers";
import { lighthouseSkillSchema, type LighthouseSkill } from "@/lib/gtm/types";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export const INTENT_KINDS = [
  "rerun_skill",
  "patch_artifact",
  "ask_question",
  "no_action",
] as const;
export type IntentKind = (typeof INTENT_KINDS)[number];

export interface DispatchSkillStageInput {
  skill: LighthouseSkill;
  refinement_context?: string;
}

export interface DispatchSkillStageResult {
  status: "queued" | "running" | "completed" | "failed";
  output?: unknown;
  error?: string;
}

export interface ArtifactRow {
  id: string;
  run_id: string;
  skill: string;
  version: number;
  content_md: string;
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

export interface OrchestratorToolDeps {
  runId: string;
  userId: string;
  dispatchSkillStage: (
    input: DispatchSkillStageInput,
  ) => Promise<DispatchSkillStageResult>;
  fetchArtifact: (artifactId: string) => Promise<ArtifactRow | null>;
  insertPatchedArtifact: (
    input: InsertPatchedArtifactInput,
  ) => Promise<InsertPatchedArtifactResult>;
  generatePatchedMd: (input: {
    contentMd: string;
    instruction: string;
  }) => Promise<string>;
  classifyText: (userMessage: string) => Promise<IntentKind>;
}

// ---------------------------------------------------------------------------
// Input schemas (Zod, AI SDK v6 patterns)
// ---------------------------------------------------------------------------

export const dispatchSkillInputSchema = z.object({
  skill: lighthouseSkillSchema.describe(
    "Which lighthouse skill to dispatch. Must be one of the 5 canonical skills.",
  ),
  refinement_context: z
    .string()
    .optional()
    .describe(
      "Optional plain-text refinement instruction for re-runs (e.g. 'use G2-only sources', 'focus on enterprise mid-market'). Forwarded to the skill body.",
    ),
});

export const patchArtifactInputSchema = z.object({
  artifact_id: z
    .string()
    .uuid()
    .describe(
      "ID of the artifact to patch. A new version (v+1) is inserted; the original is preserved.",
    ),
  instruction: z
    .string()
    .min(1)
    .describe(
      "Plain-English edit instruction (e.g. 'tighten the ICP description to focus on mid-market').",
    ),
});

export const classifyIntentInputSchema = z.object({
  user_message: z
    .string()
    .min(1)
    .describe("The most recent user message to classify."),
});

// ---------------------------------------------------------------------------
// Tool factories
// ---------------------------------------------------------------------------

export function createDispatchSkillTool(deps: OrchestratorToolDeps) {
  return tool({
    description:
      "Dispatch one of the 5 lighthouse skills to run on the current GTM run. Use when the user asks to research, generate, or rerun a section. Optional refinement_context lets a re-run focus on a narrower angle. Costs paid skill spend (Anthropic + Perplexity) — prefer patch_artifact for wording-only edits.",
    inputSchema: dispatchSkillInputSchema,
    execute: async ({ skill, refinement_context }) => {
      try {
        const result = await deps.dispatchSkillStage({
          skill,
          refinement_context,
        });
        return {
          ok: true as const,
          skill,
          status: result.status,
          output: result.output ?? null,
          error: result.error ?? null,
        };
      } catch (error) {
        return {
          ok: false as const,
          skill,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
  });
}

export function createPatchArtifactTool(deps: OrchestratorToolDeps) {
  return tool({
    description:
      "Edit an existing artifact's markdown via a plain-English instruction. Inserts a new version (v+1); the original is preserved. Free — runs on Ollama, no paid skill spend. Use for wording, tone, focus, or scope tweaks. Use dispatch_skill if the user wants new research data instead.",
    inputSchema: patchArtifactInputSchema,
    execute: async ({ artifact_id, instruction }) => {
      const original = await deps.fetchArtifact(artifact_id);
      if (!original) {
        return {
          ok: false as const,
          error: "artifact_not_found" as const,
          artifact_id,
        };
      }
      if (original.run_id !== deps.runId) {
        return {
          ok: false as const,
          error: "artifact_run_mismatch" as const,
          artifact_id,
        };
      }

      const patched = await deps.generatePatchedMd({
        contentMd: original.content_md,
        instruction,
      });
      const trimmed = patched.trim();
      if (!trimmed) {
        return {
          ok: false as const,
          error: "empty_patch_output" as const,
          artifact_id,
        };
      }

      const inserted = await deps.insertPatchedArtifact({
        parent_id: original.id,
        run_id: original.run_id,
        skill: original.skill,
        version: original.version + 1,
        content_md: trimmed.endsWith("\n") ? trimmed : `${trimmed}\n`,
      });

      return {
        ok: true as const,
        artifact_id: inserted.id,
        skill: original.skill,
        version: inserted.version,
        parent_id: original.id,
      };
    },
  });
}

export function createClassifyIntentTool(deps: OrchestratorToolDeps) {
  return tool({
    description:
      "Classify a user message into exactly one intent: rerun_skill, patch_artifact, ask_question, or no_action. Use as a routing helper before deciding whether to call dispatch_skill, patch_artifact, or just answer in chat.",
    inputSchema: classifyIntentInputSchema,
    execute: async ({ user_message }) => {
      const intent = await deps.classifyText(user_message);
      return { intent };
    },
  });
}

export function createOrchestratorTools(deps: OrchestratorToolDeps) {
  return {
    dispatch_skill: createDispatchSkillTool(deps),
    patch_artifact: createPatchArtifactTool(deps),
    classify_intent: createClassifyIntentTool(deps),
  };
}

// ---------------------------------------------------------------------------
// Default Ollama-backed implementations of the LLM-side deps
// ---------------------------------------------------------------------------

const PATCH_ARTIFACT_SYSTEM_PROMPT =
  "You are a precise markdown editor for GTM strategy documents. Apply the user's instruction to the existing markdown. Output ONLY the edited markdown — no preamble, no explanation, no code fences. Preserve heading structure, evidence/source URLs, and source-gap callouts unless the instruction explicitly asks to change them.";

const CLASSIFY_INTENT_SYSTEM_PROMPT = [
  "Classify the user message into exactly one intent. Output a single token, nothing else.",
  "",
  "Intents:",
  "- rerun_skill: re-run an existing analysis with new constraints (e.g. 'rerun the competitor analysis with G2-only sources').",
  "- patch_artifact: edit/refine wording in an existing card (e.g. 'make the ICP description focus on enterprise').",
  "- ask_question: ask a question about an existing card or about the data (e.g. 'what's the TAM here?').",
  "- no_action: greeting, chitchat, or anything not actionable.",
  "",
  "Output: rerun_skill | patch_artifact | ask_question | no_action",
].join("\n");

export async function defaultGeneratePatchedMd(input: {
  contentMd: string;
  instruction: string;
}): Promise<string> {
  const { text } = await generateText({
    model: ollama(ORCHESTRATOR_MODEL),
    system: PATCH_ARTIFACT_SYSTEM_PROMPT,
    prompt: `Existing markdown:\n\n${input.contentMd}\n\n---\n\nInstruction: ${input.instruction}\n\nReturn the edited markdown only.`,
    maxOutputTokens: 4096,
  });
  return text;
}

export async function defaultClassifyText(
  userMessage: string,
): Promise<IntentKind> {
  const { text } = await generateText({
    model: ollama(ORCHESTRATOR_MODEL),
    system: CLASSIFY_INTENT_SYSTEM_PROMPT,
    prompt: userMessage,
    maxOutputTokens: 16,
  });
  return parseIntent(text);
}

export function parseIntent(raw: string): IntentKind {
  const norm = raw.trim().toLowerCase().replace(/[`"'.\s]/g, "");
  for (const kind of INTENT_KINDS) {
    if (norm === kind || norm.endsWith(kind) || norm.startsWith(kind)) {
      return kind;
    }
  }
  return "no_action";
}
