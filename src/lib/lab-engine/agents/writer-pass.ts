import { z } from "zod";

import {
  getWriterModelId,
  isSectionWriterPenEnabled,
  sectionWriterModel,
  type SectionLanguageModel,
} from "../ai/models";
import type { SectionOutput } from "../sections/section-registry";
import {
  defaultStructuredCaller,
  type StructuredCaller,
} from "./section-agent";

// W1 pro-pen/flash-hands: the section runner (flash) gathers evidence and
// drafts the full structured output; this pass hands ONLY the narrative layer
// (prose fields, strategicInsight, verdict, statusSummary) to the stronger
// writer model for an argument-first rewrite. Evidence rows are never sent for
// rewriting, the verifier/redactor run downstream on the penned prose, and any
// skip or failure keeps the runner's draft — the pen can degrade, never block.
export const sectionWriterPassFloorMs = 90_000;
export const sectionWriterPassTimeoutMs = 150_000;
export const sectionWriterPassEmitFloorMs = 20_000;
export const sectionWriterPassMaxOutputTokens = 12_288;

// `evidence gap: <missing signal>` values are validator-recognized sentinels
// (see validateStrategicText); the pen must leave them byte-for-byte intact.
const evidenceGapSentinelPattern = /^\s*evidence\s+gap:/i;

export interface NarrativeRewriteTarget {
  path: string;
  value: string;
}

export interface SectionWriterPassParams {
  output: SectionOutput<Record<string, unknown>>;
  sectionId: string;
  sectionTitle: string;
  mission: string;
  companyName: string;
  companyWebsiteUrl: string;
  remainingMs: number | null;
  signal?: AbortSignal;
  // Test seams; production callers leave these unset.
  callStructured?: StructuredCaller;
  model?: SectionLanguageModel;
  enabled?: boolean;
}

export interface SectionWriterPassResult {
  output: SectionOutput<Record<string, unknown>>;
  applied: boolean;
  rewrittenFieldCount: number;
  durationMs: number;
  writerModelId?: string;
  skipReason?: string;
}

export type SectionWriterPassRunner = (
  params: SectionWriterPassParams,
) => Promise<SectionWriterPassResult>;

// No-op writer pass: returns the input untouched. Used on the GLM-agentic path
// where GLM already authored the narrative prose end-to-end (mirrors the proven
// 8/9 standalone harness). Running the DeepSeek writer pen on GLM output both
// slows the section (~30-300s extra) AND can sink a committable GLM body when
// DeepSeek's rewrite fails the gate, forcing a fallback to the answer-tool path.
export const noopSectionWriterPassRunner: SectionWriterPassRunner = async (
  params,
): Promise<SectionWriterPassResult> => ({
  output: params.output,
  applied: false,
  rewrittenFieldCount: 0,
  durationMs: 0,
  skipReason: "writer_pen_disabled_glm_agentic",
});

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isRewritableNarrativeValue(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.trim().length > 0 &&
    !evidenceGapSentinelPattern.test(value)
  );
}

function collectStringLeaves(
  record: Record<string, unknown>,
  prefix: string,
  targets: NarrativeRewriteTarget[],
): void {
  for (const [key, value] of Object.entries(record)) {
    const path = `${prefix}.${key}`;

    if (isRewritableNarrativeValue(value)) {
      targets.push({ path, value });
      continue;
    }

    if (isPlainRecord(value)) {
      collectStringLeaves(value, path, targets);
    }
  }
}

function collectBodyTargets(
  record: Record<string, unknown>,
  prefix: string,
  targets: NarrativeRewriteTarget[],
): void {
  for (const [key, value] of Object.entries(record)) {
    const path = `${prefix}.${key}`;

    if (key === "prose" && isRewritableNarrativeValue(value)) {
      targets.push({ path, value });
      continue;
    }

    if (key === "strategicInsight" && isPlainRecord(value)) {
      collectStringLeaves(value, path, targets);
      continue;
    }

    // Narrative lives on objects; evidence rows live in arrays and stay
    // out of the pen by design.
    if (isPlainRecord(value)) {
      collectBodyTargets(value, path, targets);
    }
  }
}

export function collectNarrativeRewriteTargets(
  output: SectionOutput<Record<string, unknown>>,
): NarrativeRewriteTarget[] {
  const targets: NarrativeRewriteTarget[] = [];

  if (isRewritableNarrativeValue(output.verdict)) {
    targets.push({ path: "verdict", value: output.verdict });
  }

  if (isRewritableNarrativeValue(output.statusSummary)) {
    targets.push({ path: "statusSummary", value: output.statusSummary });
  }

  collectBodyTargets(output.body, "body", targets);

  return targets;
}

function setStringAtPath(
  root: Record<string, unknown>,
  path: string,
  value: string,
): boolean {
  const segments = path.split(".");
  const lastSegment = segments[segments.length - 1];
  let cursor: unknown = root;

  for (const segment of segments.slice(0, -1)) {
    if (!isPlainRecord(cursor)) {
      return false;
    }

    cursor = cursor[segment];
  }

  if (
    lastSegment === undefined ||
    !isPlainRecord(cursor) ||
    typeof cursor[lastSegment] !== "string"
  ) {
    return false;
  }

  cursor[lastSegment] = value;

  return true;
}

const writerPassInstructions = [
  "You are the senior strategist at SaaSLaunch making the final editorial pass on one section of a paid client research report. A research agent gathered the evidence and produced a complete draft. Rewrite ONLY the narrative fields you are given so the section reads like a top-tier consulting deliverable: thesis-driven, specific, confident, free of filler.",
  "",
  "Hard requirements:",
  "1. ARGUMENT FIRST. Every field opens with its sharpest conclusion in one sentence; evidence and reasoning follow the claim. Never open with throat-clearing (\"Three structural forces are reshaping...\", \"This section examines...\") — open with the take itself.",
  "2. GROUNDED ONLY. Use only facts, numbers, names, quotes, and prices that appear in the draft JSON. Do not introduce, estimate, derive, or round ANY new figure. If a sentence cannot be supported from the draft, cut it.",
  "3. PROSE ARGUES, TABLES RECITE. The structured rows already carry the numbers; quote a number in prose only when it is load-bearing for the argument.",
  "4. NO HEDGING FURNITURE. Never write \"[unverified]\", \"(estimated)\", \"(SpyFu-estimated)\", \"evidence gap:\" or similar markers — verification chrome is applied downstream. If the draft text discloses missing evidence, keep that disclosure as ONE tight plain sentence at the END of the field.",
  "5. CUT BOILERPLATE. If a competent B2B generalist could write the sentence about any company, delete it. Every retained sentence must be specific to this company, market, and evidence.",
  "6. DISTINCT FIELDS. Each rewritten field must make a different point. Do not restate the verdict in the statusSummary or the statusSummary in a prose field; when content would duplicate another field, take its next-strongest distinct angle.",
  "7. PRESERVE MEANING, SHARPEN LANGUAGE. Reorder, compress, and re-argue freely; never change the factual position of the draft (a weak fit cannot become a strong fit).",
  "8. LENGTH. Stay between half and 1.3x the draft field's length. statusSummary stays a single dense paragraph.",
  "",
  "Return JSON only, with exactly the keys you were given, each mapping to the rewritten text.",
].join("\n");

function buildWriterPassPrompt({
  companyName,
  companyWebsiteUrl,
  mission,
  output,
  sectionTitle,
  targets,
}: {
  companyName: string;
  companyWebsiteUrl: string;
  mission: string;
  output: SectionOutput<Record<string, unknown>>;
  sectionTitle: string;
  targets: readonly NarrativeRewriteTarget[];
}): string {
  const fieldMap = Object.fromEntries(
    targets.map((target) => [target.path, target.value]),
  );

  return [
    `Company: ${companyName} (${companyWebsiteUrl})`,
    `Section: ${sectionTitle} — ${mission}`,
    "",
    "FULL SECTION DRAFT (ground truth — the only permissible source of facts):",
    JSON.stringify(output),
    "",
    "REWRITE THESE FIELDS (key = field path, value = current draft text):",
    JSON.stringify(fieldMap, null, 1),
  ].join("\n");
}

function buildRewriteSchema(
  targets: readonly NarrativeRewriteTarget[],
): z.ZodType<Record<string, string>> {
  // Every requested field is a REQUIRED property: a z.record here would
  // compile to a JSON schema with no required keys and the constrained
  // decoder could legally return {} (see learned-patterns.md).
  return z.object(
    Object.fromEntries(
      targets.map((target) => [target.path, z.string().min(1)]),
    ),
  ) as unknown as z.ZodType<Record<string, string>>;
}

function describeWriterPassError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

// Telemetry-only; model-resolution failures must not fail a successful rewrite
// (tests inject callStructured without a resolvable provider env).
function getWriterModelIdSafe(): string | undefined {
  try {
    return getWriterModelId();
  } catch {
    return undefined;
  }
}

export const defaultSectionWriterPassRunner: SectionWriterPassRunner = async (
  params,
): Promise<SectionWriterPassResult> => {
  const startedAt = Date.now();
  const skipped = (skipReason: string): SectionWriterPassResult => ({
    output: params.output,
    applied: false,
    rewrittenFieldCount: 0,
    durationMs: Date.now() - startedAt,
    skipReason,
  });

  const enabled = params.enabled ?? isSectionWriterPenEnabled();

  if (!enabled) {
    return skipped("writer_pen_disabled");
  }

  if (
    params.remainingMs !== null &&
    params.remainingMs < sectionWriterPassFloorMs
  ) {
    return skipped(
      `deadline: remaining ${params.remainingMs}ms below writer pass floor ${sectionWriterPassFloorMs}ms`,
    );
  }

  const targets = collectNarrativeRewriteTargets(params.output);

  if (targets.length === 0) {
    return skipped("no_narrative_targets");
  }

  const timeoutMs =
    params.remainingMs === null
      ? sectionWriterPassTimeoutMs
      : Math.min(
          sectionWriterPassTimeoutMs,
          Math.max(1, params.remainingMs - sectionWriterPassEmitFloorMs),
        );
  const abortSignals = [AbortSignal.timeout(timeoutMs)];

  if (params.signal !== undefined) {
    abortSignals.push(params.signal);
  }

  const callStructured = params.callStructured ?? defaultStructuredCaller;
  const model = params.model ?? sectionWriterModel;

  try {
    const raw = await callStructured({
      model,
      schema: buildRewriteSchema(targets),
      schemaName: "SectionNarrativeRewrite",
      schemaDescription:
        "Rewritten narrative fields for one research section, keyed by field path.",
      instructions: writerPassInstructions,
      prompt: buildWriterPassPrompt({
        companyName: params.companyName,
        companyWebsiteUrl: params.companyWebsiteUrl,
        mission: params.mission,
        output: params.output,
        sectionTitle: params.sectionTitle,
        targets,
      }),
      maxOutputTokens: sectionWriterPassMaxOutputTokens,
      signal: AbortSignal.any(abortSignals),
    });

    if (!isPlainRecord(raw)) {
      return skipped("rewrite_result_not_an_object");
    }

    const rewritten = structuredClone(params.output) as SectionOutput<
      Record<string, unknown>
    > &
      Record<string, unknown>;
    let rewrittenFieldCount = 0;

    for (const target of targets) {
      const replacement = raw[target.path];

      if (
        typeof replacement !== "string" ||
        replacement.trim().length === 0 ||
        replacement === target.value
      ) {
        continue;
      }

      if (setStringAtPath(rewritten, target.path, replacement)) {
        rewrittenFieldCount += 1;
      }
    }

    if (rewrittenFieldCount === 0) {
      return skipped("no_fields_rewritten");
    }

    const writerModelId = getWriterModelIdSafe();

    return {
      output: rewritten,
      applied: true,
      rewrittenFieldCount,
      durationMs: Date.now() - startedAt,
      ...(writerModelId === undefined ? {} : { writerModelId }),
    };
  } catch (error) {
    return skipped(`writer_pass_failed: ${describeWriterPassError(error)}`);
  }
};
