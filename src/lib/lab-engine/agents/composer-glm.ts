/**
 * composer-glm.ts — GLM-5.2 COMPOSER for the 13-block paid-media deck.
 *
 * The last stage of the research arc (LOCK 2026-06-24 §2/§7E). One GLM call
 * (via OpenRouter in prod, Ollama Cloud in dev — same getAgenticGLMModel
 * accessor as the orchestrator) reads the union of the 6 committed section
 * markdowns + the shared ledger digest and emits the 13-block
 * positioningPaidMediaPlan deck.
 *
 * Owner decisions (this session):
 * - NO Opus. The composer stays on GLM 5.2 (OpenRouter prod / Ollama dev).
 * - NO Opus anti-fab oracle. Deterministic strips only (quote-at-URL,
 *   exemplar-motif, numeric-coherence) — the same floor the sections use.
 *
 - Schema binding: GLM-via-Ollama/OpenRouter does NOT support responseFormat /
 * Output.object (proven live in Step D). The composer mirrors the orchestrator's
 * proven free-markdown + fenced-JSON pattern: emit the deck body as a fenced
 * ```paid-media-plan JSON block, parse against paidMediaPlanBodySchema.
 *
 * Cross-section coherence by construction (final-arch §1): the system prompt
 * forces ICP ⟷ competitors ⟷ demand keywords to agree across the deck rows.
 */
import { generateText, stepCountIs } from "ai";

import { getAgenticGLMModel } from "../ai/models";
import {
  buildTranscriptRecord,
  GROUNDING_LAW,
} from "./agentic-glm-runner";
import {
  normalizePaidMediaPlanBody,
  type NormalizePaidMediaPlanBodyOptions,
  type PaidMediaPlanBody,
} from "../artifacts/schemas/paid-media-plan";
import type { TranscriptRecord } from "./verification/provenance-detect";
import type { PositioningSectionId } from "@/lib/ai/prompts/positioning-skills";

// ---------------------------------------------------------------------------
// Composer loop constants. The deck is a single high-value synthesis emit —
// it needs room for the 13 blocks but NOT a 16-step tool loop (the gather is
// done; the composer reconciles + writes). 3 tool round-trips for top-up
// verification only, generous output ceiling for the full deck.
// ---------------------------------------------------------------------------
export const COMPOSER_MAX_STEPS = 4;
const COMPOSER_MAX_OUTPUT_TOKENS = 12000;

export const COMPOSER_COHERENCE_LAW = `
CROSS-SECTION COHERENCE (non-negotiable):
- The deck is built FROM the six committed sections below. Every audience, competitor, angle, and channel you put in a deck row MUST trace to a fact those sections established (or the ledger digest provided).
- ICP ⟷ competitors ⟷ demand keywords MUST agree. You may NOT invent an audience the BuyerICP section never named, a competitor the Competitor section never found, or a demand keyword the Demand section never surfaced.
- Where the sections disagree or gap, surface it as a crossSectionInsight (Block 13) — do NOT paper over it.
- Cite each load-bearing deck row with its source section id, e.g. "(source: positioningVoiceOfCustomer)".
`.trim();

export interface ComposePaidMediaPlanArgs {
  /** The 6 committed section markdowns, keyed by positioning section id. */
  committedSectionMarkdown: Partial<Record<PositioningSectionId, string>>;
  /** The orchestrator/ledger research digest (cross-section evidence). */
  ledgerDigest: string;
  /** Operator onboarding frame (GTM brief) for the deck's template blocks. */
  onboardingFrame: string;
  /** Optional: a bounded tool set for top-up verification. Defaults to none. */
  tools?: Record<string, unknown>;
  maxSteps?: number;
  signal?: AbortSignal;
  env?: Record<string, string | undefined>;
  /**
   * Structured onboarding economics (targetCac / cvrChain / creativeCapacity /
   * channelHint), threaded the same way `withNormalizedPaidMediaPlanOutput`
   * does (run-section.ts) so the budget cascade + CAC math survive the deck
   * normalization. P5 (compose-route) populates this from onboarding; absent it
   * the decoder still produces a valid deck, just without the economics bridge.
   */
  normalizeOptions?: NormalizePaidMediaPlanBodyOptions;
}

/** How the deck body was obtained — visible so a parse-miss is not silent. */
export type ComposerDeckSource = "decoded" | "honest_gap";

export interface ComposePaidMediaPlanResult {
  deck: PaidMediaPlanBody;
  /** "decoded" = GLM JSON normalized cleanly; "honest_gap" = parse miss, body is a gap shell. */
  deckSource: ComposerDeckSource;
  deckMarkdown: string;
  transcript: TranscriptRecord[];
  stepCount: number;
}

export async function composePaidMediaPlan(
  args: ComposePaidMediaPlanArgs,
): Promise<ComposePaidMediaPlanResult> {
  const env = args.env ?? process.env;
  const maxSteps = args.maxSteps ?? COMPOSER_MAX_STEPS;
  const tools = args.tools ?? {};

  const sectionsBlock = Object.entries(args.committedSectionMarkdown)
    .filter(([, markdown]) => typeof markdown === "string" && markdown.length > 0)
    .map(([id, markdown]) => `<section id="${id}">\n${markdown}\n</section>`)
    .join("\n\n");

  const systemPrompt = [
    GROUNDING_LAW,
    COMPOSER_COHERENCE_LAW,
    `
You are the COMPOSER writing the 13-block Paid Media Plan a team bills to a SaaS client. The research is DONE — your job is to reconcile the six committed positioning sections + the ledger digest into ONE coherent deck, not to research again.

The 13 deck blocks (emit ALL):
1. campaignOverview · 2. campaignPhases (1-3) · 3. audienceTypes (1-4) · 4. (template) · 5. anglesToTest (2-6, evidence-backed) · 6. creativeStrategy + creativeFramework (3-12 slots) · 7. funnelIdeation (1-3) · 8. (template) · 9. competitorMarketingInsights (>=2) · 10. competitorReviewInsights (EXACTLY 3 complaints + leverage) · 11. channelSuggestions (1-6) · 12. (template) · 13. crossSectionInsight (1-3 tensions that drove the plan) + projectedResults + kpis + salesProcess.

OUTPUT FORMAT — emit the JSON block FIRST, then the prose. Do NOT skip the JSON block:
1. FIRST, a fenced JSON block tagged \`\`\`paid-media-plan containing the COMPLETE deck body as a SINGLE JSON object matching the paidMediaPlanBodySchema shape (campaignOverview, campaignPhases, audienceTypes, anglesToTest, creativeStrategy, creativeFramework, funnelIdeation, salesProcess, competitorMarketingInsights, competitorReviewInsights, channelSuggestions, projectedResults, kpis, crossSectionInsight). Every field must be present. This JSON is the billable deliverable — without it the deck does not exist.
2. THEN, a short markdown readout of the deck for the audit reader (## per block, the operator-facing summary).

CRITICAL: the \`\`\`paid-media-plan JSON block must come before any prose, and it must be valid JSON parseable on its own. Do not wrap it in any other fence. Do not omit it.
`,
  ].join("\n\n");

  const userPrompt = [
    "<committed-research>",
    sectionsBlock,
    "</committed-research>",
    "<ledger-digest>",
    args.ledgerDigest,
    "</ledger-digest>",
    "<operator-frame>",
    args.onboardingFrame,
    "</operator-frame>",
    "Compose the 13-block Paid Media Plan. Reconcile cross-section coherence by construction. Emit the paid-media-plan JSON block + the markdown readout.",
  ].join("\n\n");

  const result = await generateText({
    model: getAgenticGLMModel(env),
    ...(Object.keys(tools).length > 0
      ? { tools: tools as Parameters<typeof generateText>[0]["tools"] }
      : {}),
    stopWhen: stepCountIs(maxSteps),
    system: systemPrompt,
    prompt: userPrompt,
    abortSignal: args.signal,
    maxOutputTokens: COMPOSER_MAX_OUTPUT_TOKENS,
  });

  const transcript = buildTranscriptRecord(result.steps, "paidMediaPlan");
  // TOLERANT decode (LOCK 2026-06-24 P3): the strict parser nulled the WHOLE
  // billable deck on any shape drift the section path already survives. We snap
  // aliased/wrapper keys via the proven normalizePaidMediaPlanBody and, on a
  // hard parse miss, return an honest-gap body — never a content-losing null.
  const { deck, deckSource } = decodePaidMediaPlanFromText(
    result.text,
    args.normalizeOptions,
  );
  // deckMarkdown is the free narrative; preserved verbatim (incl. any
  // [grounded]/[inferred]/[gap] markers the model emitted) regardless of the
  // JSON decode — the human reviews it even when deckSource === "honest_gap".
  const deckMarkdown = stripPaidMediaPlanFence(result.text);

  return {
    deck,
    deckSource,
    deckMarkdown,
    transcript,
    stepCount: Array.isArray(result.steps) ? result.steps.length : 0,
  };
}

// ---------------------------------------------------------------------------
// Fenced-JSON extraction (mirrors the orchestrator's GTM parse). Tolerates
// surrounding prose; pulls the ```paid-media-plan block, falls back to the
// first ```json block. Returns the raw JSON string (un-validated) or null.
// ---------------------------------------------------------------------------
function extractPaidMediaPlanJson(text: string): string | null {
  if (text.length === 0) {
    return null;
  }
  const fenceMatch = /```paid-media-plan\s*([\s\S]*?)```/i.exec(text);
  const jsonMatch = /```json\s*([\s\S]*?)```/i.exec(text);
  const raw = (fenceMatch?.[1] ?? jsonMatch?.[1] ?? "").trim();
  return raw.length === 0 ? null : raw;
}

// ---------------------------------------------------------------------------
// TOLERANT decoder (LOCK 2026-06-24 P3 — drop the strict output cage).
//
// The OLD strict path did `paidMediaPlanBodySchema.safeParse` and returned
// null on ANY drift ({audiences:[...]} wrappers, <2-leg cross-section insights,
// funnel overshoot, missing rows) — silently losing the whole billable GLM
// deck, a regression vs the DeepSeek section path which already survives drift.
//
// This routes the extracted JSON through `normalizePaidMediaPlanBody` (the
// proven tolerant decoder + budget cascade the section path uses — REUSED, not
// reimplemented). It snaps aliased/wrapper keys, synthesizes honest gap rows
// for undershot floors, and clamps overshoots. On a hard miss (no fence,
// unparseable JSON, or normalization that still throws) it returns an
// honest-gap body — NEVER a content-losing null. The free deckMarkdown is
// preserved separately by the caller so the human always sees the GLM text.
// ---------------------------------------------------------------------------
export function decodePaidMediaPlanFromText(
  text: string,
  options?: NormalizePaidMediaPlanBodyOptions,
): { deck: PaidMediaPlanBody; deckSource: ComposerDeckSource } {
  const raw = extractPaidMediaPlanJson(text);
  if (raw !== null) {
    try {
      const parsed = JSON.parse(raw);
      // normalizePaidMediaPlanBody is the snap/alias/gap-synthesis path; it can
      // still throw if the schema floors aren't satisfiable from the input —
      // catch that and fall through to the honest-gap shell.
      const deck = normalizePaidMediaPlanBody(parsed, options);
      return { deck, deckSource: "decoded" };
    } catch {
      // fall through to honest-gap
    }
  }
  return { deck: buildHonestGapDeckBody(options), deckSource: "honest_gap" };
}

// Strict back-compat view kept for callers/tests that want a null-on-miss
// signal. NOTE (deviation, stated loudly): unlike the pre-P3 strict parser,
// this now DECODES drift via the tolerant path — it only returns null when no
// usable deck could be produced AT ALL (no fence / unparseable / un-normalizable).
export function parsePaidMediaPlanFromText(
  text: string,
): PaidMediaPlanBody | null {
  const { deck, deckSource } = decodePaidMediaPlanFromText(text);
  return deckSource === "decoded" ? deck : null;
}

// An honest-gap deck shell: schema-valid, but every load-bearing string is
// prefixed "Evidence gap:" so the reader (isGapText / rowIsHonestGap) renders
// amber-probe cards, not confident grounded blocks. Built THROUGH
// normalizePaidMediaPlanBody (the same total decoder) with a seed proven to
// clear every hard schema floor (campaignPhases / funnelIdeation /
// channelSuggestions / crossSectionInsight / projectedResults all min 1).
function buildHonestGapDeckBody(
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody {
  const GAP = "Evidence gap: composer could not decode the deck body; the GLM narrative is preserved for human review.";
  return normalizePaidMediaPlanBody(
    {
      campaignOverview: {
        objective: "Evidence gap: campaign objective not composed.",
        primaryKpi: "Evidence gap: primary KPI not composed.",
      },
      campaignPhases: [
        { phaseName: "Evidence gap: phase not composed", monthsLabel: "Months 1-3" },
      ],
      audienceTypes: [{ archetype: "Evidence gap: audience not composed" }],
      anglesToTest: [
        { hypothesis: "Evidence gap: angle not composed (1)" },
        { hypothesis: "Evidence gap: angle not composed (2)" },
      ],
      creativeStrategy: { summary: GAP },
      creativeFramework: [{ format: "Evidence gap", hook: GAP }],
      funnelIdeation: [
        { funnelStage: "TOFU", recommendation: "Evidence gap: funnel not composed" },
      ],
      salesProcess: [],
      competitorMarketingInsights: [
        { competitor: "Evidence gap" },
        { competitor: "Evidence gap" },
      ],
      competitorReviewInsights: [
        { complaint: "Evidence gap" },
        { complaint: "Evidence gap" },
        { complaint: "Evidence gap" },
      ],
      channelSuggestions: [
        { channel: "Evidence gap", verdict: "REVIEW", rationale: GAP },
      ],
      projectedResults: [
        {
          targetIcp: "Evidence gap",
          kpi: "Evidence gap",
          objective: "Evidence gap",
          durationLabel: "Months 1-3",
          kpiCostProvenance: "unknown",
          sourceSection: "gtmBrief",
        },
      ],
      kpis: [{ metric: "Evidence gap" }, { metric: "Evidence gap" }],
      crossSectionInsight: [
        {
          tension: GAP,
          sourceSections: ["gtmBrief", "positioningBuyerICP"],
        },
      ],
    },
    options,
  );
}

export function stripPaidMediaPlanFence(text: string): string {
  return text
    .replace(/```paid-media-plan\s*[\s\S]*?```/i, "")
    .replace(/```json\s*[\s\S]*?```/i, "")
    .trim();
}

// ---------------------------------------------------------------------------
// Deterministic strip floor — the composer goes under the SAME strips as the
// sections (LOCK §7E: "No Opus anti-fab oracle — owner killed it"). This is a
// thin admission that the deck is schema-validated + cross-section-coherent;
// the full quote-at-URL / exemplar-motif / numeric-coherence strips live in
// verification/ and run over the committed deck in the run-section commit spine.
// This module owns the COMPOSE call; the strips run downstream on its output.
// ---------------------------------------------------------------------------
export interface ComposerStripVerdict {
  admitted: boolean;
  reasons: string[];
}

export function composerStripFloor(deck: PaidMediaPlanBody | null): ComposerStripVerdict {
  if (deck === null) {
    return { admitted: false, reasons: ["deck_body_missing"] };
  }
  const reasons: string[] = [];
  if (deck.anglesToTest.length < 2) {
    reasons.push("angles_below_floor");
  }
  if (deck.competitorReviewInsights.length !== 3) {
    reasons.push("competitor_review_insights_not_exactly_3");
  }
  if (deck.kpis.length < 2) {
    reasons.push("kpis_below_floor");
  }
  return { admitted: reasons.length === 0, reasons };
}