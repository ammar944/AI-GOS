import { z } from "zod";

import { sectionWriterModel, type SectionLanguageModel } from "../ai/models";
import type { CrossSectionFactConflict } from "./cross-section-facts";
import {
  defaultStructuredCaller,
  type StructuredCaller,
} from "./section-agent";

// W3 executive brief: the one reader that sees the WHOLE report before the
// client does. Runs AFTER the paid-media plan commits (all seven bodies in
// hand), on the strongest writer model in the stack, and produces the report's
// spine: one thesis, three ranked moves with which-section-proves-it pointers,
// and a resolution for every deterministic cross-section fact conflict.
// Additive only — stored in research_artifacts.thesis (existing unused jsonb
// column), no section schema is touched, and failure never blocks a run.

export const executiveBriefTimeoutMs = 120_000;
export const executiveBriefMaxOutputTokens = 8_192;
const maxRankedMoves = 3;

export interface ExecutiveBriefSectionInput {
  sectionId: string;
  sectionTitle: string;
  verdict: string;
  statusSummary: string;
  body: Record<string, unknown>;
}

export interface ExecutiveBriefRankedMove {
  rank: number;
  move: string;
  provingSections: string[];
}

export interface ExecutiveBriefResolvedConflict {
  factKey: string;
  readings: Array<{ sectionId: string; value: string }>;
  resolution: string;
  winningSectionId: string;
}

export interface ExecutiveBriefResult {
  executiveThesis: string;
  rankedMoves: ExecutiveBriefRankedMove[];
  factConflicts: ExecutiveBriefResolvedConflict[];
}

export interface RunExecutiveBriefParams {
  sections: readonly ExecutiveBriefSectionInput[];
  conflicts: readonly CrossSectionFactConflict[];
  companyName: string;
  companyWebsiteUrl: string;
  signal?: AbortSignal;
  // Test seams; production callers leave these unset.
  callStructured?: StructuredCaller;
  model?: SectionLanguageModel;
}

const briefSchema = z.object({
  executiveThesis: z
    .string()
    .describe(
      "The executive brief: 600-900 words, argument-first, written for the paying client.",
    ),
  rankedMoves: z.array(
    z.object({
      rank: z.number().describe("1, 2, or 3 — rank 1 is the first move."),
      move: z
        .string()
        .describe("One committed, specific move the client should make."),
      provingSections: z
        .array(z.string())
        .describe(
          "Canonical section ids whose evidence proves this move (e.g. positioningDemandIntent).",
        ),
    }),
  ),
  factConflicts: z.array(
    z.object({
      factKey: z.string().describe("The conflicting fact's key, verbatim from the input conflict list."),
      resolution: z
        .string()
        .describe(
          "One or two sentences resolving the conflict: which reading is correct and why.",
        ),
      winningSectionId: z
        .string()
        .describe("The section id whose reading wins."),
    }),
  ),
});

const briefInstructions = [
  "You are the senior partner at SaaSLaunch signing the executive brief of a paid GTM research report. Seven research sections are committed below; you are the only reader who sees the whole document before the client does. Write the spine the sections cannot write for themselves.",
  "",
  "Deliverables:",
  "1. executiveThesis — 600-900 words, argument-first. Open with the ONE argument the whole report makes. Every paragraph opens with its conclusion. Use only facts present in the section bodies; quote a number only when it is load-bearing. No verification furniture ([unverified], (estimated)); no hedging filler; if a competent B2B generalist could write the sentence about any company, cut it. Close with what the client should do Monday and the cost of the position taken.",
  "2. rankedMoves — exactly 3, rank 1 first. Each move is committed and specific (a campaign, an asset, a fix — never 'consider' or 'optimize'), with provingSections naming the canonical section ids whose evidence carries it.",
  "3. factConflicts — one entry per input conflict, factKey verbatim. Resolve each: prefer scraped/tool-measured readings over corpus-reported readings over model-stated readings; name the winning section id and say in one or two sentences why that reading wins and what the client should treat as true.",
  "",
  "Honesty contract: never introduce a fact, number, name, or quote absent from the section bodies. Where the sections genuinely disagree beyond the listed conflicts, fold the strongest reading into the thesis and say which section carries it.",
].join("\n");

function buildBriefPrompt(params: RunExecutiveBriefParams): string {
  const sectionsBlock = params.sections
    .map((section) =>
      [
        `### ${section.sectionId} — ${section.sectionTitle}`,
        `verdict: ${section.verdict}`,
        `statusSummary: ${section.statusSummary}`,
        `body: ${JSON.stringify(section.body)}`,
      ].join("\n"),
    )
    .join("\n\n");

  const conflictsBlock =
    params.conflicts.length === 0
      ? "none detected"
      : JSON.stringify(params.conflicts, null, 1);

  return [
    `Company: ${params.companyName} (${params.companyWebsiteUrl})`,
    "",
    "DETERMINISTIC CROSS-SECTION FACT CONFLICTS (resolve every one):",
    conflictsBlock,
    "",
    "COMMITTED SECTIONS (ground truth — the only permissible source of facts):",
    sectionsBlock,
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// The model resolves what it resolves; unresolved input conflicts are filled
// deterministically (no repair round — repairs are paid and flaky) so the UI
// always renders one row per detected conflict.
function alignConflicts({
  conflicts,
  modelConflicts,
}: {
  conflicts: readonly CrossSectionFactConflict[];
  modelConflicts: z.infer<typeof briefSchema>["factConflicts"];
}): ExecutiveBriefResolvedConflict[] {
  return conflicts.map((conflict) => {
    const resolved = modelConflicts.find(
      (candidate) => candidate.factKey === conflict.factKey,
    );

    return {
      factKey: conflict.factKey,
      readings: conflict.readings.map((reading) => ({
        sectionId: reading.sectionId,
        value: reading.value,
      })),
      resolution:
        resolved?.resolution ??
        "unresolved — readings disagree; verify against the cited sections before using this figure.",
      winningSectionId: resolved?.winningSectionId ?? "",
    };
  });
}

export async function runExecutiveBrief(
  params: RunExecutiveBriefParams,
): Promise<ExecutiveBriefResult> {
  const callStructured = params.callStructured ?? defaultStructuredCaller;
  const model = params.model ?? sectionWriterModel;
  const abortSignals = [AbortSignal.timeout(executiveBriefTimeoutMs)];

  if (params.signal !== undefined) {
    abortSignals.push(params.signal);
  }

  const raw = await callStructured({
    model,
    schema: briefSchema,
    schemaName: "ExecutiveBrief",
    schemaDescription:
      "Executive brief for a multi-section GTM research report: thesis, ranked moves, resolved fact conflicts.",
    instructions: briefInstructions,
    prompt: buildBriefPrompt(params),
    maxOutputTokens: executiveBriefMaxOutputTokens,
    signal: AbortSignal.any(abortSignals),
  });

  if (!isRecord(raw)) {
    throw new Error("executive brief returned a non-object result");
  }

  const parsed = briefSchema.parse(raw);

  return {
    executiveThesis: parsed.executiveThesis,
    factConflicts: alignConflicts({
      conflicts: params.conflicts,
      modelConflicts: parsed.factConflicts,
    }),
    rankedMoves: parsed.rankedMoves
      .slice(0, maxRankedMoves)
      .map((move, index) => ({
        move: move.move,
        provingSections: move.provingSections,
        rank: index + 1,
      })),
  };
}
