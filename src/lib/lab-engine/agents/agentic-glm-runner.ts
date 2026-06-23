/**
 * agentic-glm-runner.ts — agentic GLM GENERATION runner (standalone module).
 *
 * Faithful port of the PROVEN tool-loop from scripts/zz-agentic-section.ts
 * (blind A/B value 8-9, 2026-06-22). Given an assembled prompt context + a
 * sectionId, this loops GLM-5.2 with the section's permitted tools and returns
 * FREE MARKDOWN + a transcript typed as the provenance detector's
 * `TranscriptRecord[]`.
 *
 * Scope: GENERATION ONLY. No markdown -> typed projection, no provenance gate,
 * no run-section wiring — those live in sibling tasks. This module exposes the
 * generation primitive (model loop + helpers) that the projection + gate layers
 * consume.
 *
 * Provider: getAgenticGLMModel() from ../ai/models (dev = Ollama Cloud proxy at
 * localhost:11434/v1 serving glm-5.2:cloud; prod = z.ai/BigModel). The runner
 * never hardcodes the localhost URL or OLLAMA_API_KEY — all of that lives behind
 * the provider accessor.
 */
import { generateText, stepCountIs } from "ai";

import { getAgenticGLMModel } from "../ai/models";
import {
  SECTION_REGISTRY,
  isSupportedSectionId,
} from "../sections/section-registry";
import { TOOL_CATALOG, type ToolName } from "./tools/index";
import type { TranscriptRecord } from "./verification/provenance-detect";

// Bounded; do not raise above ~16. Ported verbatim from the proof harness
// (scripts/zz-agentic-section.ts MAX_STEPS). The loop's stopWhen(stepCountIs)
// uses this as the lookup cap: at most this many tool round-trips per section.
export const AGENTIC_GLM_MAX_STEPS = 16;

// GLM-5.2 is a reasoning model. Without a generous output ceiling the final
// markdown body comes back EMPTY (proven 2026-06-22). Keep this generous.
const AGENTIC_GLM_MAX_OUTPUT_TOKENS = 8000;

// ---------------------------------------------------------------------------
// Grounding law — shared across ALL sections (the thin floor, stated up front).
// Ported VERBATIM from scripts/zz-agentic-section.ts (the proven prefix).
// ---------------------------------------------------------------------------
export const GROUNDING_LAW = `
GROUNDING LAW (read this first — it is non-negotiable):
- Every load-bearing NUMBER, customer QUOTE, and competitor/URL CLAIM you state as fact MUST trace to a tool result you actually received in this session, or to a corpus excerpt you were given below. If you did not fetch it, you may NOT state it as fact.
- Inline-attribute every load-bearing claim with its source URL, e.g. "(g2.com/products/ramp/reviews)".
- A tool that returns { "type": "gap", ... } means NO DATA is available for that call (missing credential, rate limit, content unavailable, etc.). Do NOT invent the answer. Either try a different query/tool, or write that point as an explicit honest gap: "Not available from sources searched: <what>."
- Honest gaps are GOOD. Fabrication — inventing a quote, a number, a reviewer name, a CPC, or a URL you did not actually retrieve — is the CARDINAL SIN. This drives a real ad budget; a confident wrong number costs the user money.
- Research FREELY with the tools before you write. Prefer real, sourced evidence over generic best-practice filler.
- Write the FINAL section as clean, readable PROSE / markdown for a media buyer: a sharp lead insight first, then the supporting analysis they could act on Monday. No JSON, no schema fields, no apology framing, no meta-commentary about your process.
`.trim();

// ---------------------------------------------------------------------------
// Per-tool credential preflight. Each tool reads its own env key and returns a
// credentialGap when missing; skipping a tool whose key is absent up front
// keeps the loop from burning steps retrying a tool that can only ever gap.
// A tool with NO required key (pagespeed — public Google API) is never skipped.
// Tools listed with multiple keys pass when ANY ONE is present (e.g. adlibrary
// accepts FOREPLAY_API_KEY or SEARCHAPI_KEY; the ad tools delegate to it).
// ---------------------------------------------------------------------------
const TOOL_REQUIRED_ENV: Record<ToolName, readonly string[]> = {
  web_search: ["FIRECRAWL_API_KEY"],
  firecrawl: ["FIRECRAWL_API_KEY"],
  adlibrary: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  google_ads: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  meta_ads: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  linkedin_ads: ["FOREPLAY_API_KEY", "SEARCHAPI_KEY"],
  pagespeed: [],
  keyword_ad_probe: ["SEARCHAPI_KEY"],
  keyword_trends: ["SEARCHAPI_KEY"],
  keyword_volume: ["SPYFU_API_KEY"],
  keyword_discovery: ["SPYFU_API_KEY"],
  perplexity_research: ["PERPLEXITY_API_KEY"],
  reviews: ["SEARCHAPI_KEY", "FIRECRAWL_API_KEY"],
};

function hasRequiredCredential(
  tool: ToolName,
  env: Record<string, string | undefined>,
): boolean {
  const required = TOOL_REQUIRED_ENV[tool];
  if (required.length === 0) {
    return true;
  }
  return required.some((key) => {
    const value = env[key];
    return typeof value === "string" && value.trim().length > 0;
  });
}

/**
 * Build the tools object for a section: TOOL_CATALOG filtered to the section's
 * SECTION_REGISTRY allowedTools, then further filtered to drop any tool whose
 * required credential is missing (so the loop never wastes a step on a tool that
 * can only gap). Returns plain AI SDK Tool objects keyed by tool name.
 *
 * The lookup cap itself is enforced by generateAgenticGLMSection's
 * stopWhen(stepCountIs(maxSteps)) — the proven mechanism. This builder owns
 * registry-filtering + credential-skipping only.
 */
export function buildAgenticTools(
  sectionId: string,
  env: Record<string, string | undefined> = process.env,
  // Caller-supplied allowed-tools list (e.g. getAllowedTools(definition, deps),
  // which honors prepared-context tool-disabling + the deps.allowedTools /
  // LAB_ENGINE_LIVE_TOOLS kill-switch). When provided, it REPLACES the registry
  // default so the agentic path can't bypass those controls. Credential-filtering
  // still applies on top.
  allowedOverride?: readonly ToolName[],
): Record<string, unknown> {
  if (!isSupportedSectionId(sectionId)) {
    throw new Error(
      `buildAgenticTools: unknown sectionId "${sectionId}". Expected a SECTION_REGISTRY key.`,
    );
  }
  const allowed = allowedOverride ?? SECTION_REGISTRY[sectionId].allowedTools;
  const tools: Record<string, unknown> = {};
  for (const name of allowed) {
    if (!hasRequiredCredential(name, env)) {
      continue;
    }
    tools[name] = TOOL_CATALOG[name];
  }
  return tools;
}

// ---------------------------------------------------------------------------
// Transcript capture — join tool calls to their results by toolCallId.
// Ported from buildTranscript (scripts/zz-agentic-section.ts), conformed to the
// detector's TranscriptRecord (field-identical, so the mapping is 1:1).
// ---------------------------------------------------------------------------
interface RawToolCall {
  toolName: string;
  toolCallId: string;
  input: unknown;
}

interface RawToolResult {
  toolCallId: string;
  type?: string;
  output?: unknown;
  error?: unknown;
}

interface RawStep {
  toolCalls?: RawToolCall[];
  toolResults?: RawToolResult[];
}

export function buildTranscriptRecord(
  steps: unknown,
  // sectionId is accepted to match the agreed signature and to leave room for
  // section-scoped transcript tagging; the proven mapping does not need it.
  _sectionId: string,
): TranscriptRecord[] {
  const stepArray = Array.isArray(steps) ? (steps as RawStep[]) : [];
  const out: TranscriptRecord[] = [];

  stepArray.forEach((step, stepIdx) => {
    const calls = step.toolCalls ?? [];
    const results = step.toolResults ?? [];
    const resultById = new Map<string, RawToolResult>();
    for (const r of results) {
      resultById.set(r.toolCallId, r);
    }
    for (const call of calls) {
      const r = resultById.get(call.toolCallId);
      const isError = r ? r.type === "tool-error" : false;
      out.push({
        step: stepIdx,
        toolName: call.toolName,
        toolCallId: call.toolCallId,
        input: call.input,
        output: r
          ? isError
            ? { error: String(r.error) }
            : r.output
          : null,
        isError,
      });
    }
  });

  return out;
}

export interface GenerateAgenticGLMSectionArgs {
  sectionId: string;
  subject: string;
  /** Caller assembles role + section-system + section guidance; GROUNDING_LAW is prepended here. */
  systemPrompt: string;
  /** Caller provides corpus excerpts + the task instruction. */
  userPrompt: string;
  /** Defaults to buildAgenticTools(sectionId, env). */
  tools?: Record<string, unknown>;
  /** Defaults to AGENTIC_GLM_MAX_STEPS. Doubles as the per-section lookup cap. */
  maxSteps?: number;
  signal?: AbortSignal;
  env?: Record<string, string | undefined>;
}

export interface GenerateAgenticGLMSectionResult {
  markdown: string;
  transcript: TranscriptRecord[];
  steps: unknown;
  stepCount: number;
}

/**
 * Run the proven agentic GLM tool-loop for one section and return free markdown
 * + a TranscriptRecord[] transcript. This is the exact generateText + stopWhen
 * multi-step shape that scored 8-9 in the blind A/B — NOT ToolLoopAgent.
 *
 * Errors propagate: a non-recoverable provider error throws, and AbortSignal
 * cancellation propagates out of generateText unchanged (no 403-as-success
 * passthrough — that was a build-verification convenience in the harness only).
 */
export async function generateAgenticGLMSection(
  args: GenerateAgenticGLMSectionArgs,
): Promise<GenerateAgenticGLMSectionResult> {
  const env = args.env ?? process.env;
  const maxSteps = args.maxSteps ?? AGENTIC_GLM_MAX_STEPS;
  const tools = args.tools ?? buildAgenticTools(args.sectionId, env);

  const result = await generateText({
    model: getAgenticGLMModel(env),
    tools: tools as Parameters<typeof generateText>[0]["tools"],
    stopWhen: stepCountIs(maxSteps),
    system: `${GROUNDING_LAW}\n\n${args.systemPrompt}`,
    prompt: args.userPrompt,
    abortSignal: args.signal,
    maxOutputTokens: AGENTIC_GLM_MAX_OUTPUT_TOKENS,
  });

  const transcript = buildTranscriptRecord(result.steps, args.sectionId);

  return {
    markdown: result.text,
    transcript,
    steps: result.steps,
    stepCount: Array.isArray(result.steps) ? result.steps.length : 0,
  };
}
