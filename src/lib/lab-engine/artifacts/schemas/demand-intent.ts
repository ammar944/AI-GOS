import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  evidenceBlockGapSchema,
  keyFindingsSchema,
  orderedStrategicMoveSchema,
  provesWrongIfSchema,
  strategicInsightSchema,
  validateOrderedStrategicMovesMinimums,
  validateProvesWrongIfMinimums,
  validateStrategicInsightMinimums,
} from "./strategic-insight";

const intentTypes = [
  "informational",
  "commercial",
  "transactional",
  "navigational",
] as const;
const questionSurfaces = [
  "paa",
  "reddit",
  "quora",
  "community",
  "forum",
  "support-thread",
] as const;
const frequencies = ["recurring", "occasional"] as const;
const signalTypes = [
  "job-posting",
  "rfp",
  "news-trigger",
  "funding",
  "leadership-change",
] as const;
const venueTypes = ["event", "community", "newsletter", "podcast", "slack"] as const;
const blockGapFieldSchema = evidenceBlockGapSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

export const keywordSignalSchema = z
  .object({
    keyword: z.string().min(1),
    monthlyVolume: z.string().min(1),
    monthlyVolumeValue: z.number().finite().nonnegative().nullable().transform((value) => value ?? undefined).optional(),
    cpc: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
    cpcValue: z.number().finite().nonnegative().nullable().transform((value) => value ?? undefined).optional(),
    difficulty: z.number().finite().nonnegative().nullable().transform((value) => value ?? undefined).optional(),
    intentType: z.enum(intentTypes),
    top3RankingDomains: z.array(z.string().min(1)),
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().min(1),
    dateObserved: z.string().min(1),
  })
  .strict();

const buyerQuestionSchema = z
  .object({
    question: z.string().min(1),
    surface: z.enum(questionSurfaces),
    sourceUrl: z.string().min(1),
    frequency: z.enum(frequencies),
  })
  .strict();

const contentGapSchema = z
  .object({
    topic: z.string().min(1),
    evidenceOfDemand: z.string().min(1),
    weakCompetitorAnswerEvidence: z.string().min(1),
    opportunity: z.string().min(1),
  })
  .strict();

const intentSignalSchema = z
  .object({
    signalType: z.enum(signalTypes),
    description: z.string().min(1),
    sourceUrl: z.string().min(1),
    exampleCompany: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
  })
  .strict();

const demandVenueSchema = z
  .object({
    name: z.string().min(1),
    venueType: z.enum(venueTypes),
    audienceSize: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

export const demandIntentBodySchema = z
  .object({
    keyFindings: keyFindingsSchema.nullable().transform((value) => value ?? undefined).optional(),
    strategicInsight: strategicInsightSchema,
    orderedMoves: z.array(orderedStrategicMoveSchema),
    provesWrongIf: provesWrongIfSchema,
    keywordDemand: z
      .object({
        prose: z.string().min(1),
        keywords: z.array(keywordSignalSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    questionMining: z
      .object({
        prose: z.string().min(1),
        questions: z.array(buyerQuestionSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    contentGaps: z
      .object({
        prose: z.string().min(1),
        gaps: z.array(contentGapSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    intentSignals: z
      .object({
        prose: z.string().min(1),
        items: z.array(intentSignalSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
    venueMap: z
      .object({
        prose: z.string().min(1),
        venues: z.array(demandVenueSchema),
        blockGap: blockGapFieldSchema,
      })
      .strict(),
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
  })
  .strict();

export const demandIntentSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: demandIntentBodySchema,
  })
  .strict();

export type DemandIntentBlockGap = z.infer<typeof evidenceBlockGapSchema>;
export type DemandIntentBody = z.infer<typeof demandIntentBodySchema>;
export type DemandIntentSectionOutput = z.infer<
  typeof demandIntentSectionOutputSchema
>;
export type DemandIntentArtifact = ArtifactEnvelope & {
  body: DemandIntentBody;
};

function normalizeKeywordForEvidence(value: string): string {
  return value.trim().toLowerCase();
}

function buildKeywordEvidenceSet(values: readonly string[] | undefined): ReadonlySet<string> {
  return new Set((values ?? []).map(normalizeKeywordForEvidence));
}

function isExplicitDataGap(value: string | undefined): boolean {
  if (value === undefined) {
    return true;
  }

  return /(?:data\s+gap|unavailable|no\s+row|no\s+usable|rate[-\s]*limit|returned\s+nothing)/iu.test(
    value,
  );
}

function hasBlockGap(block: { blockGap?: unknown }): boolean {
  return block.blockGap !== undefined;
}

// Explicit data-gap marker used when softening SpyFu-claiming rows under a
// keyword_volume ToolGap. Matches isExplicitDataGap (so the re-run provenance
// check is clean) and does NOT match the minimums' "not disclosed" rejection.
export const DEMAND_INTENT_SPYFU_TOOLGAP_VOLUME =
  "data gap: keyword_volume (SpyFu) unavailable for this run";

// Neutral replacements for SpyFu-claiming source fields under the ToolGap
// soften. Must NOT contain "spyfu" (the re-run provenance check would re-flag
// the row as a SpyFu claim) and must NOT read as internal tool diagnostics in
// client-facing fields — they name the missing market evidence instead.
export const DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_TITLE =
  "No public volume source for this keyword";
export const DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_URL =
  "no public volume source";

const spyFuClaimPattern = /spyfu[\s-]*estimat/i;
const spyFuSourcePattern = /spyfu/i;
const trendClaimPattern =
  /(?:searchapi\s+google\s+trends|google\s+trends|relative\s+interest)/i;
const modelEstimatePattern = /model\s+estimate/i;

/**
 * Section-scoped provenance guard for keyword volume/CPC honesty. The
 * keyword_volume tool (SpyFu) returns a ToolGap when it is unavailable
 * (e.g. rate-limited), but the model must still avoid fabricated keyword
 * economics. This guard is row-scoped: a keyword row that claims SpyFu or
 * SearchAPI Trends provenance must match a keyword returned by that tool.
 * Numeric volume/CPC/difficulty siblings require SpyFu because Trends only
 * provides relative interest. Rows with no matching tool data must be explicit
 * data gaps, not model estimates or unlabeled numbers.
 *
 * `spyFuToolGap` flags that keyword_volume itself returned a ToolGap (no
 * keywords). When true, SpyFu-absence failures are reported as SOFTENABLE
 * (the row is downgraded to an explicit data gap by
 * softenDemandIntentForSpyFuToolGap) instead of hard errors — but a genuine
 * fabrication (model estimate, or a Trends claim with no Trends evidence) stays
 * a hard error, so we never let invented economics through.
 */
export function checkDemandIntentKeywordProvenance({
  artifact,
  keywordTrendKeywords = [],
  keywordVolumeKeywords = [],
  spyFuToolGap = false,
}: {
  artifact: ArtifactEnvelope;
  keywordTrendKeywords?: readonly string[];
  keywordVolumeKeywords?: readonly string[];
  spyFuToolGap?: boolean;
}): ValidationResult & { softenableRowIndexes: number[] } {
  const errors: string[] = [];
  const softenableRowIndexes: number[] = [];
  const keywordVolumeEvidence = buildKeywordEvidenceSet(keywordVolumeKeywords);
  const keywordTrendEvidence = buildKeywordEvidenceSet(keywordTrendKeywords);

  const parsed = artifactEnvelopeSchema
    .extend({ body: demandIntentBodySchema })
    .parse(artifact);

  parsed.body.keywordDemand.keywords.forEach((keyword, index) => {
    const normalizedKeyword = normalizeKeywordForEvidence(keyword.keyword);
    const hasSpyFuEvidence = keywordVolumeEvidence.has(normalizedKeyword);
    const hasTrendEvidence = keywordTrendEvidence.has(normalizedKeyword);
    const claimsSpyFu =
      spyFuClaimPattern.test(keyword.monthlyVolume) ||
      (keyword.cpc !== undefined && spyFuClaimPattern.test(keyword.cpc)) ||
      spyFuSourcePattern.test(keyword.sourceTitle) ||
      spyFuSourcePattern.test(keyword.sourceUrl);
    const claimsTrend =
      trendClaimPattern.test(keyword.monthlyVolume) ||
      trendClaimPattern.test(keyword.sourceTitle) ||
      trendClaimPattern.test(keyword.sourceUrl);
    const claimsModelEstimate =
      modelEstimatePattern.test(keyword.monthlyVolume) ||
      (keyword.cpc !== undefined && modelEstimatePattern.test(keyword.cpc));
    const hasSpyFuOnlyNumericFields =
      keyword.monthlyVolumeValue !== undefined ||
      keyword.cpcValue !== undefined ||
      keyword.difficulty !== undefined;
    const hasNonGapCpc = keyword.cpc !== undefined && !isExplicitDataGap(keyword.cpc);

    // A failure is SpyFu-absence (softenable under a ToolGap) only when the row
    // lacks SpyFu evidence AND lacks Trend evidence AND is not a fabrication.
    let rowHasSpyFuAbsenceFailure = false;

    if (claimsSpyFu && !hasSpyFuEvidence) {
      rowHasSpyFuAbsenceFailure = true;
      if (!spyFuToolGap) {
        errors.push(
          `body.keywordDemand.keywords[${index}]: claims SpyFu provenance for "${keyword.keyword}" but keyword_volume did not return that keyword — use keyword_trends for SearchAPI Google Trends fallback or restate as a data gap; never claim "SpyFu-estimated".`,
        );
      }
    }

    if (claimsTrend && !hasTrendEvidence) {
      // A Trends claim with no Trends evidence is a fabrication, not a SpyFu
      // ToolGap — keep the hard rejection regardless of spyFuToolGap.
      errors.push(
        `body.keywordDemand.keywords[${index}]: claims SearchAPI Google Trends provenance for "${keyword.keyword}" but keyword_trends did not return that keyword — restate as a data gap or remove the Trends provenance.`,
      );
    }

    if (hasSpyFuOnlyNumericFields && !hasSpyFuEvidence) {
      rowHasSpyFuAbsenceFailure = true;
      if (!spyFuToolGap) {
        errors.push(
          `body.keywordDemand.keywords[${index}]: includes numeric keyword economics for "${keyword.keyword}" without matching keyword_volume data — omit monthlyVolumeValue/cpcValue/difficulty unless SpyFu returned that keyword.`,
        );
      }
    }

    if (hasNonGapCpc && !hasSpyFuEvidence) {
      rowHasSpyFuAbsenceFailure = true;
      if (!spyFuToolGap) {
        errors.push(
          `body.keywordDemand.keywords[${index}]: includes CPC for "${keyword.keyword}" without matching keyword_volume data — SearchAPI Trends does not provide CPC; omit cpc or restate it as a data gap.`,
        );
      }
    }

    if (claimsModelEstimate) {
      // Always a fabrication — never softenable.
      errors.push(
        `body.keywordDemand.keywords[${index}]: uses model-estimated keyword economics; call keyword_volume or keyword_trends, or restate this row as a data gap.`,
      );
    }

    if (
      !hasSpyFuEvidence &&
      !hasTrendEvidence &&
      !isExplicitDataGap(keyword.monthlyVolume)
    ) {
      rowHasSpyFuAbsenceFailure = true;
      if (!spyFuToolGap) {
        errors.push(
          `body.keywordDemand.keywords[${index}]: monthlyVolume for "${keyword.keyword}" is not backed by keyword_volume, keyword_trends, or an explicit data gap.`,
        );
      }
    }

    // Under a ToolGap, mark this row for softening only when its sole defect is
    // SpyFu-absence (no Trend evidence to keep it, no fabrication forcing a hard
    // error). Rows already backed by Trends, or already explicit data gaps, are
    // left untouched.
    if (
      spyFuToolGap &&
      rowHasSpyFuAbsenceFailure &&
      !hasTrendEvidence &&
      !claimsModelEstimate &&
      !(claimsTrend && !hasTrendEvidence)
    ) {
      softenableRowIndexes.push(index);
    }
  });

  return { ok: errors.length === 0, errors, softenableRowIndexes };
}

/**
 * Downgrade the SpyFu-claiming keyword rows to explicit data gaps when
 * keyword_volume returned a ToolGap. Strips SpyFu-only numeric fields and CPC,
 * relabels monthlyVolume + provenance to an explicit data gap, so the artifact
 * commits honestly (needs_review) instead of nulling and stalling the run.
 * Trends-backed and already-data-gap rows are preserved. Returns the patched
 * artifact body; the caller re-validates provenance + minimums before commit.
 */
export function softenDemandIntentForSpyFuToolGap({
  artifact,
  softenableRowIndexes,
}: {
  artifact: ArtifactEnvelope & { body: DemandIntentBody };
  softenableRowIndexes: readonly number[];
}): ArtifactEnvelope & { body: DemandIntentBody } {
  const parsed = artifactEnvelopeSchema
    .extend({ body: demandIntentBodySchema })
    .parse(artifact);
  const toSoften = new Set(softenableRowIndexes);

  const keywords = parsed.body.keywordDemand.keywords.map((keyword, index) => {
    if (!toSoften.has(index)) {
      return keyword;
    }

    const {
      monthlyVolumeValue: _monthlyVolumeValue,
      cpcValue: _cpcValue,
      difficulty: _difficulty,
      cpc: _cpc,
      ...rest
    } = keyword;

    return {
      ...rest,
      monthlyVolume: DEMAND_INTENT_SPYFU_TOOLGAP_VOLUME,
      // Real non-SpyFu source fields are kept as-is. Only SpyFu-claiming
      // values are replaced — and never with an internal tool diagnostic
      // string (see the replacement constants' contract above).
      sourceTitle: spyFuSourcePattern.test(keyword.sourceTitle)
        ? DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_TITLE
        : keyword.sourceTitle,
      sourceUrl: spyFuSourcePattern.test(keyword.sourceUrl)
        ? DEMAND_INTENT_SPYFU_TOOLGAP_SOURCE_URL
        : keyword.sourceUrl,
    };
  });

  return {
    ...parsed,
    body: {
      ...parsed.body,
      keywordDemand: {
        ...parsed.body.keywordDemand,
        keywords,
      },
    },
  };
}

export function validateDemandIntentMinimums(
  artifact: ArtifactEnvelope & { body: DemandIntentBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: demandIntentBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  validateStrategicInsightMinimums(
    errors,
    "body.strategicInsight",
    parsedArtifact.body.strategicInsight,
    {
      comparisonTexts: [parsedArtifact.verdict, parsedArtifact.statusSummary],
    },
  );
  validateOrderedStrategicMovesMinimums(
    errors,
    "body.orderedMoves",
    parsedArtifact.body.orderedMoves,
  );
  validateProvesWrongIfMinimums(
    errors,
    "body.provesWrongIf",
    parsedArtifact.body.provesWrongIf,
  );

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }

  const keywordCount = parsedArtifact.body.keywordDemand.keywords.length;
  if (keywordCount < 5 && !hasBlockGap(parsedArtifact.body.keywordDemand)) {
    errors.push(
      `body.keywordDemand.keywords: have ${keywordCount}, need >=5 or body.keywordDemand.blockGap for the remaining demand evidence.`,
    );
  }

  // Every keyword row must carry a falsifiable signal. Scoped to monthlyVolume
  // ONLY (not the whole body) so a legitimately-undisclosed non-signal field
  // elsewhere does not false-fail. The keyword_volume tool (SpyFu) supplies a
  // real number; "not disclosed" here is a refusal, not a signal.
  parsedArtifact.body.keywordDemand.keywords.forEach((keyword, index) => {
    if (/not disclosed/i.test(keyword.monthlyVolume)) {
      errors.push(
        `body.keywordDemand.keywords[${index}].monthlyVolume: "not disclosed" is not an acceptable signal — use the keyword_volume tool for a SpyFu-estimated number.`,
      );
    }
  });

  // Array blocks carry an optional blockGap escape: keep every real row that was
  // actually fetched, then explain the shortfall instead of padding to a quota.
  const questionMining = parsedArtifact.body.questionMining;
  const questions = questionMining.questions;
  if (questions.length < 10 && !hasBlockGap(questionMining)) {
    errors.push(
      `body.questionMining.questions: have ${questions.length}, need >=10 or body.questionMining.blockGap. Never invent questions; explain what was tried in the blockGap.`,
    );
    // Surface diversity is prompt-side guidance, never a validator floor:
    // run 314d5f02 proved the >=2-surface quota was only ever satisfied by
    // inventing Quora/forum rows — honest single-surface mining must pass.
  }

  const gapCount = parsedArtifact.body.contentGaps.gaps.length;
  if (gapCount < 3 && !hasBlockGap(parsedArtifact.body.contentGaps)) {
    errors.push(
      `body.contentGaps.gaps: have ${gapCount}, need >=3 or body.contentGaps.blockGap.`,
    );
  }

  const intentSignalsBlock = parsedArtifact.body.intentSignals;
  const intentSignals = intentSignalsBlock.items;
  if (intentSignals.length < 5 && !hasBlockGap(intentSignalsBlock)) {
    errors.push(
      `body.intentSignals.items: have ${intentSignals.length}, need >=5 or body.intentSignals.blockGap. Never invent signals; explain what was tried in the blockGap.`,
    );
    // signalType diversity is prompt-side guidance only (same fabrication
    // forcer as the question-surface quota — see above).
  }

  const venueMapBlock = parsedArtifact.body.venueMap;
  const venues = venueMapBlock.venues;
  if (venues.length < 4 && !hasBlockGap(venueMapBlock)) {
    errors.push(
      `body.venueMap.venues: have ${venues.length}, need >=4 or body.venueMap.blockGap. Never invent venues; explain what was tried in the blockGap.`,
    );
    // venueType diversity is prompt-side guidance only (same fabrication
    // forcer class — a quota satisfied by invented newsletters is worse
    // than four real communities).
  }

  return { ok: errors.length === 0, errors };
}
