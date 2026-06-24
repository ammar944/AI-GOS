/**
 * paid-media-projector — EXTRACT-ONLY 2nd GLM pass for the 13-block paid-media deck.
 *
 * The composer (composer-glm.ts) writes a genuinely billable markdown memo but,
 * on the observed failure mode, FLATLY IGNORES the `emit the ```paid-media-plan
 * JSON block first` instruction — it will not emit large inline structured JSON.
 * This module mirrors the proven section projector (agentic-glm-projector.ts):
 * markdown is INPUT, only JSON is output (no competing prose), so the structural
 * blocker that defeated inline composition does not apply here.
 *
 * The projector emits a roughly-shaped body; the existing tolerant decoder
 * (`normalizePaidMediaPlanBody`, reused — not reimplemented) snaps aliased
 * keys, synthesizes honest gap rows for undershot floors, and clamps overshoots.
 *
 * Pure: takes markdown as an arg, never reads the filesystem. The GLM call is
 * injectable (`generate`) so unit tests run with a hand-crafted projection and
 * no live model.
 */
import { generateText } from "ai";

import { getAgenticGLMModel } from "../ai/models";
import {
  normalizePaidMediaPlanBody,
  type NormalizePaidMediaPlanBodyOptions,
  type PaidMediaPlanBody,
} from "../artifacts/schemas/paid-media-plan";
import {
  parseProjectedJson,
  stripCodeFences,
} from "./agentic-glm-projector";

/**
 * GLM-5.2 is a reasoning model; too few output tokens returns EMPTY content
 * (live-probed at 12000 tokens for a 19.7k-char VoC markdown). The 13-block
 * deck projection is comparably large; match the proven 24000 ceiling.
 */
const PAID_MEDIA_PROJECT_MAX_OUTPUT_TOKENS = 24000;

/** Injectable generate fn — (system, prompt) -> raw model text. */
export type PaidMediaProjectGenerateFn = (
  system: string,
  prompt: string,
) => Promise<string>;

export interface ProjectPaidMediaPlanArgs {
  /** The composer's free-markdown deck memo (the billable readout). */
  deckMarkdown: string;
  env?: Record<string, string | undefined>;
  /** INJECTABLE for tests; default = GLM via getAgenticGLMModel. */
  generate?: PaidMediaProjectGenerateFn;
  /** Threaded through to normalizePaidMediaPlanBody (budget cascade, CAC bridge). */
  normalizeOptions?: NormalizePaidMediaPlanBodyOptions;
}

export interface ProjectPaidMediaPlanResult {
  /** Tolerant-decoded deck (always non-null: honest-gap shell on a miss). */
  deck: PaidMediaPlanBody;
  /** "decoded" = projector JSON normalized cleanly; "honest_gap" = miss. */
  deckSource: "decoded" | "honest_gap";
  /** Raw projector text (for telemetry on a miss). */
  projectionText: string;
}

const EXTRACT_ONLY_RULE = `EXTRACT ONLY. Copy quotes, numbers, and budget figures verbatim from the markdown. Do NOT invent audiences, competitors, angles, KPIs, or budget numbers not present in the markdown. Output ONLY valid JSON, no prose, no code fences.

OMIT a row when the markdown has no real source for it — never fabricate a row to fill a block. Where the markdown genuinely lacks a required block, emit the block's prose as a single honest sentence stating the block had no source evidence in this deck, and set its rows array to [].

Every row that the schema demands a sourceSection for MUST carry a real source section id from: positioningMarketCategory, positioningBuyerICP, positioningCompetitorLandscape, positioningVoiceOfCustomer, positioningDemandIntent, positioningOfferDiagnostic, gtmBrief. If a row has no real source, OMIT that row.`;

const PAID_MEDIA_TARGET_DESCRIPTION = `Target JSON for the Paid Media Plan deck body. Emit EXACTLY these top-level keys (every one is required; do not omit any):

- campaignOverview: { prose: string, platform: string, monthlyBudget: string (e.g. "$12,000/month"), monthlyBudgetValue?: number, monthlyBudgetProvenance: string (one of: user-supplied|tool-measured|source-reported|model-estimated|derived|unknown), dailySpend: string, dailySpendValue?: number, dailySpendProvenance: string, totalMonths: number, phaseCount: number, primaryKpi: string } — the campaign overview block. Copy the budget figures verbatim.
- campaignPhases: [{ phaseName: string, monthsLabel: string (e.g. "Months 1-2"), monthlyBudget: string, monthlyBudgetValue?: number, monthlyBudgetProvenance: string, bullets: string[] (4-5 phase bullets) }] — 1-3 phases.
- audienceTypes: [{ slot: string (e.g. "01"), archetype: string, dailyBudget: string, dailyBudgetValue?: number, dailyBudgetProvenance: string, detail: string, sourceSection: string, grounding: string }] — 1-4 audience archetypes. sourceSection MUST be a real section id (positioningBuyerICP when the audience traces to the ICP section).
- anglesToTest: [{ shortName: string, description: string, angleType: string, sourceSection: string, grounding: string }] — 2-6 evidence-backed creative angles. Each MUST trace to a section that established the angle.
- creativeStrategy: { prose: string } — the creative mix narrative.
- creativeFramework: [{ label: string, angleType: string, hook: string, executesAngle: string, sourceSection: string, grounding: string }] — 3-12 creative slots.
- funnelIdeation: [{ rank: string (e.g. "1 - PRIMARY"), name: string, description: string, whatItProves: string }] — 1-3 funnel paths.
- salesProcess: [{ label: string, assetType: string, url: string, note: string }] — 1-4 supplied sales assets. When the markdown lists none, emit a single gap asset { label: "Sales assets not supplied", assetType: "gap", url: "", note: "Client did not supply sales assets." }.
- competitorMarketingInsights: [{ competitor: string, messaging: string, adPlatforms: string, estSpendProvenance: string, icp: string, angles: string, positioning: string, offer: string, sourceSection: string, grounding: string }] — >=2 competitor teardowns. sourceSection MUST be positioningCompetitorLandscape.
- competitorReviewInsights: [{ complaint: string, howWeLeverage: string, sourceSection: string, grounding: string }] — EXACTLY 3 competitor-review complaints + leverage. sourceSection is typically positioningVoiceOfCustomer or positioningCompetitorLandscape.
- channelSuggestions: [{ channel: string, recommendation: string, verdict: string (one of FIX|REWORK|REVIEW|KEEP|ADD|KILL|SCALE), sourceSection: string }] — 1-6 current-funnel channel suggestions.
- projectedResults: [{ targetIcp: string, kpi: string, kpiCostValue?: number, kpiCostProvenance: string, objective: string, durationLabel: string, phaseMonthlyBudgetValue?: number, phaseMonthlyBudgetProvenance: string, sourceSection: string }] — >=1 SOP projected-results row, one per target ICP x phase. The runner computes the projected count and CAC math; emit the inputs only.
- kpis: [{ metric: string, role: string, definition: string }] — 2-5 KPIs.
- crossSectionInsight: [{ tension: string, sourceSections: string[] (>=2 real section ids), implicationForPlan: string, clientBlindSpot: string, secondOrderRisk: string, contrarianInversion: string }] — 1-3 cross-section tensions that drove the plan.

Do NOT emit evidencePack, evidenceTier, verification, feasibilityAudit, or evidenceBinding — those are deterministically built downstream. Do NOT emit blockGap, coverage, or evidenceVerdict.`;

const PROJECTION_SYSTEM =
  "You are a precise data-projection engine. You convert a paid-media strategist's free-markdown deck memo into a strict typed JSON body by EXTRACTING ONLY what is already present in the markdown. You never invent audiences, competitors, angles, KPIs, or budget numbers. You output a single JSON object and nothing else.";

function buildProjectionPrompt(deckMarkdown: string): string {
  return [
    "Project the PAID-MEDIA DECK MARKDOWN below into the target typed JSON body.",
    "",
    EXTRACT_ONLY_RULE,
    "",
    "=== TARGET JSON SHAPE ===",
    PAID_MEDIA_TARGET_DESCRIPTION,
    "",
    "=== DECK MARKDOWN ===",
    deckMarkdown,
    "",
    "Output the JSON body object now (no surrounding prose, no code fences):",
  ].join("\n");
}

function buildRepairPrompt(
  priorJsonText: string,
  zodError: string,
): string {
  return [
    "Your previous JSON failed schema validation. Fix ONLY the failing fields and re-emit the FULL corrected JSON body.",
    "Do not add invented content while fixing — if a failing field has no real source, omit that row/field.",
    "",
    EXTRACT_ONLY_RULE,
    "",
    "=== TARGET JSON SHAPE ===",
    PAID_MEDIA_TARGET_DESCRIPTION,
    "",
    "=== VALIDATION ERRORS ===",
    zodError,
    "",
    "=== YOUR PREVIOUS JSON ===",
    priorJsonText,
    "",
    "Output the corrected JSON body object now (no surrounding prose, no code fences):",
  ].join("\n");
}

function buildDefaultGenerate(
  env: Record<string, string | undefined>,
): PaidMediaProjectGenerateFn {
  return async (system, prompt) => {
    const result = await generateText({
      model: getAgenticGLMModel(env),
      system,
      prompt,
      maxOutputTokens: PAID_MEDIA_PROJECT_MAX_OUTPUT_TOKENS,
    });
    return result.text;
  };
}

function buildHonestGapDeck(
  options?: NormalizePaidMediaPlanBodyOptions,
): PaidMediaPlanBody {
  const GAP = "Evidence gap: projector could not fill this block from the deck memo.";
  return normalizePaidMediaPlanBody(
    {
      campaignOverview: {
        prose: GAP,
        platform: "Evidence gap: platform not composed.",
        monthlyBudget: "Evidence gap: budget not composed.",
        monthlyBudgetProvenance: "unknown",
        dailySpend: "Evidence gap: daily spend not composed.",
        dailySpendProvenance: "unknown",
        totalMonths: 0,
        phaseCount: 0,
        primaryKpi: "Evidence gap: primary KPI not composed.",
      },
      campaignPhases: [
        { phaseName: GAP, monthsLabel: "Months 1-3" },
      ],
      audienceTypes: [{ archetype: GAP }],
      anglesToTest: [
        { shortName: GAP, description: GAP, angleType: "REVIEW", sourceSection: "unattributed", grounding: "UNVERIFIED" },
        { shortName: GAP, description: GAP, angleType: "REVIEW", sourceSection: "unattributed", grounding: "UNVERIFIED" },
      ],
      creativeStrategy: { prose: GAP },
      creativeFramework: [
        { label: GAP, angleType: "REVIEW", hook: GAP, executesAngle: "Angle 1", sourceSection: "unattributed", grounding: "UNVERIFIED" },
      ],
      funnelIdeation: [
        { rank: "1 - PRIMARY", name: GAP, description: GAP, whatItProves: GAP },
      ],
      salesProcess: [],
      competitorMarketingInsights: [
        { competitor: GAP, messaging: GAP, adPlatforms: "UNVERIFIED", estSpendProvenance: "unknown", icp: GAP, angles: GAP, positioning: GAP, offer: GAP, sourceSection: "positioningCompetitorLandscape", grounding: "UNVERIFIED" },
        { competitor: GAP, messaging: GAP, adPlatforms: "UNVERIFIED", estSpendProvenance: "unknown", icp: GAP, angles: GAP, positioning: GAP, offer: GAP, sourceSection: "positioningCompetitorLandscape", grounding: "UNVERIFIED" },
      ],
      competitorReviewInsights: [
        { complaint: GAP, howWeLeverage: GAP, sourceSection: "positioningVoiceOfCustomer", grounding: "UNVERIFIED" },
        { complaint: GAP, howWeLeverage: GAP, sourceSection: "positioningVoiceOfCustomer", grounding: "UNVERIFIED" },
        { complaint: GAP, howWeLeverage: GAP, sourceSection: "positioningVoiceOfCustomer", grounding: "UNVERIFIED" },
      ],
      channelSuggestions: [
        { channel: GAP, recommendation: GAP, verdict: "REVIEW", sourceSection: "unattributed" },
      ],
      projectedResults: [
        { targetIcp: GAP, kpi: GAP, kpiCostProvenance: "unknown", objective: GAP, durationLabel: "Months 1-3", sourceSection: "gtmBrief" },
      ],
      kpis: [{ metric: GAP, role: "Measurement role", definition: GAP }, { metric: GAP, role: "Measurement role", definition: GAP }],
      crossSectionInsight: [
        { tension: GAP, sourceSections: ["gtmBrief", "positioningBuyerICP"], implicationForPlan: GAP, clientBlindSpot: GAP, secondOrderRisk: GAP, contrarianInversion: GAP },
      ],
    },
    options,
  );
}

/**
 * Project a paid-media deck markdown memo into the typed PaidMediaPlanBody.
 * Extraction only — no invention. One repair round on Zod/parse failure; if
 * still failing, returns a tolerant honest-gap deck (never content-losing null).
 *
 * Output flows through `normalizePaidMediaPlanBody` (the proven tolerant decoder
 * reused from the section path) so the projector only needs a roughly-shaped
 * body — the decoder snaps aliases, synthesizes gap rows, and clamps overshoot.
 */
export async function projectPaidMediaPlan(
  args: ProjectPaidMediaPlanArgs,
): Promise<ProjectPaidMediaPlanResult> {
  const env = args.env ?? process.env;
  const generate = args.generate ?? buildDefaultGenerate(env);

  const firstRaw = await generate(
    PROJECTION_SYSTEM,
    buildProjectionPrompt(args.deckMarkdown),
  );
  const firstParse = parseProjectedJson(firstRaw);

  if (firstParse.ok) {
    try {
      const deck = normalizePaidMediaPlanBody(
        firstParse.value,
        args.normalizeOptions,
      );
      return { deck, deckSource: "decoded", projectionText: firstRaw };
    } catch {
      // fall through to repair
    }
  }

  // ONE repair round.
  const repairPrompt = firstParse.ok
    ? buildRepairPrompt(
        stripCodeFences(firstRaw),
        "normalizePaidMediaPlanBody rejected the projected JSON — fix shape/field errors and re-emit.",
      )
    : buildRepairPrompt(
        firstRaw.slice(0, 8000),
        "Output was not valid JSON. Re-emit a single valid JSON object with no prose or code fences.",
      );
  const repairRaw = await generate(PROJECTION_SYSTEM, repairPrompt);
  const repairParse = parseProjectedJson(repairRaw);

  if (repairParse.ok) {
    try {
      const deck = normalizePaidMediaPlanBody(
        repairParse.value,
        args.normalizeOptions,
      );
      return { deck, deckSource: "decoded", projectionText: repairRaw };
    } catch {
      return {
        deck: buildHonestGapDeck(args.normalizeOptions),
        deckSource: "honest_gap",
        projectionText: repairRaw,
      };
    }
  }

  return {
    deck: buildHonestGapDeck(args.normalizeOptions),
    deckSource: "honest_gap",
    projectionText: repairRaw,
  };
}