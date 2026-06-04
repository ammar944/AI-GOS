import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
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

export const keywordSignalSchema = z
  .object({
    keyword: z.string().min(1),
    monthlyVolume: z.string().min(1),
    monthlyVolumeValue: z.number().finite().nonnegative().optional(),
    cpc: z.string().min(1).optional(),
    cpcValue: z.number().finite().nonnegative().optional(),
    difficulty: z.number().finite().nonnegative().optional(),
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
    exampleCompany: z.string().min(1).optional(),
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
    strategicInsight: strategicInsightSchema,
    orderedMoves: z.array(orderedStrategicMoveSchema),
    provesWrongIf: provesWrongIfSchema,
    keywordDemand: z
      .object({ prose: z.string().min(1), keywords: z.array(keywordSignalSchema) })
      .strict(),
    questionMining: z
      .object({ prose: z.string().min(1), questions: z.array(buyerQuestionSchema) })
      .strict(),
    contentGaps: z
      .object({ prose: z.string().min(1), gaps: z.array(contentGapSchema) })
      .strict(),
    intentSignals: z
      .object({ prose: z.string().min(1), items: z.array(intentSignalSchema) })
      .strict(),
    venueMap: z
      .object({ prose: z.string().min(1), venues: z.array(demandVenueSchema) })
      .strict(),
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
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

export type DemandIntentBody = z.infer<typeof demandIntentBodySchema>;
export type DemandIntentSectionOutput = z.infer<
  typeof demandIntentSectionOutputSchema
>;
export type DemandIntentArtifact = ArtifactEnvelope & {
  body: DemandIntentBody;
};

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

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

/**
 * Section-scoped provenance guard for keyword volume/CPC honesty. The
 * keyword_volume tool (SpyFu) returns a ToolGap when it is unavailable
 * (e.g. rate-limited), but the model must still avoid fabricated keyword
 * economics. This guard is row-scoped: a keyword row that claims SpyFu or
 * SearchAPI Trends provenance must match a keyword returned by that tool.
 * Numeric volume/CPC/difficulty siblings require SpyFu because Trends only
 * provides relative interest. Rows with no matching tool data must be explicit
 * data gaps, not model estimates or unlabeled numbers.
 */
export function checkDemandIntentKeywordProvenance({
  artifact,
  keywordTrendKeywords = [],
  keywordVolumeKeywords = [],
}: {
  artifact: ArtifactEnvelope;
  keywordTrendKeywords?: readonly string[];
  keywordVolumeKeywords?: readonly string[];
}): ValidationResult {
  const errors: string[] = [];
  const keywordVolumeEvidence = buildKeywordEvidenceSet(keywordVolumeKeywords);
  const keywordTrendEvidence = buildKeywordEvidenceSet(keywordTrendKeywords);

  const parsed = artifactEnvelopeSchema
    .extend({ body: demandIntentBodySchema })
    .parse(artifact);

  const spyFuClaimPattern = /spyfu[\s-]*estimat/i;
  const trendClaimPattern = /(?:searchapi\s+google\s+trends|google\s+trends|relative\s+interest)/i;
  const modelEstimatePattern = /model\s+estimate/i;

  parsed.body.keywordDemand.keywords.forEach((keyword, index) => {
    const normalizedKeyword = normalizeKeywordForEvidence(keyword.keyword);
    const hasSpyFuEvidence = keywordVolumeEvidence.has(normalizedKeyword);
    const hasTrendEvidence = keywordTrendEvidence.has(normalizedKeyword);
    const claimsSpyFu =
      spyFuClaimPattern.test(keyword.monthlyVolume) ||
      (keyword.cpc !== undefined && spyFuClaimPattern.test(keyword.cpc)) ||
      /spyfu/i.test(keyword.sourceTitle) ||
      /spyfu/i.test(keyword.sourceUrl);
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

    if (claimsSpyFu && !hasSpyFuEvidence) {
      errors.push(
        `body.keywordDemand.keywords[${index}]: claims SpyFu provenance for "${keyword.keyword}" but keyword_volume did not return that keyword — use keyword_trends for SearchAPI Google Trends fallback or restate as a data gap; never claim "SpyFu-estimated".`,
      );
    }

    if (claimsTrend && !hasTrendEvidence) {
      errors.push(
        `body.keywordDemand.keywords[${index}]: claims SearchAPI Google Trends provenance for "${keyword.keyword}" but keyword_trends did not return that keyword — restate as a data gap or remove the Trends provenance.`,
      );
    }

    if (hasSpyFuOnlyNumericFields && !hasSpyFuEvidence) {
      errors.push(
        `body.keywordDemand.keywords[${index}]: includes numeric keyword economics for "${keyword.keyword}" without matching keyword_volume data — omit monthlyVolumeValue/cpcValue/difficulty unless SpyFu returned that keyword.`,
      );
    }

    if (hasNonGapCpc && !hasSpyFuEvidence) {
      errors.push(
        `body.keywordDemand.keywords[${index}]: includes CPC for "${keyword.keyword}" without matching keyword_volume data — SearchAPI Trends does not provide CPC; omit cpc or restate it as a data gap.`,
      );
    }

    if (claimsModelEstimate) {
      errors.push(
        `body.keywordDemand.keywords[${index}]: uses model-estimated keyword economics; call keyword_volume or keyword_trends, or restate this row as a data gap.`,
      );
    }

    if (
      !hasSpyFuEvidence &&
      !hasTrendEvidence &&
      !isExplicitDataGap(keyword.monthlyVolume)
    ) {
      errors.push(
        `body.keywordDemand.keywords[${index}]: monthlyVolume for "${keyword.keyword}" is not backed by keyword_volume, keyword_trends, or an explicit data gap.`,
      );
    }
  });

  return { ok: errors.length === 0, errors };
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
  if (keywordCount < 10) {
    errors.push(`body.keywordDemand.keywords: have ${keywordCount}, need >=10.`);
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

  const questions = parsedArtifact.body.questionMining.questions;
  if (questions.length < 10) {
    errors.push(`body.questionMining.questions: have ${questions.length}, need >=10.`);
  }
  const questionSurfaceCount = uniqueCount(
    questions.map((question) => question.surface),
  );
  if (questionSurfaceCount < 2) {
    errors.push(
      `body.questionMining.questions: need >=2 surface types, have ${questionSurfaceCount}.`,
    );
  }

  const gapCount = parsedArtifact.body.contentGaps.gaps.length;
  if (gapCount < 3) {
    errors.push(`body.contentGaps.gaps: have ${gapCount}, need >=3.`);
  }

  const intentSignals = parsedArtifact.body.intentSignals.items;
  if (intentSignals.length < 5) {
    errors.push(`body.intentSignals.items: have ${intentSignals.length}, need >=5.`);
  }
  const signalTypeCount = uniqueCount(
    intentSignals.map((signal) => signal.signalType),
  );
  if (signalTypeCount < 2) {
    errors.push(
      `body.intentSignals.items: need >=2 signalTypes, have ${signalTypeCount}.`,
    );
  }

  const venues = parsedArtifact.body.venueMap.venues;
  if (venues.length < 4) {
    errors.push(`body.venueMap.venues: have ${venues.length}, need >=4.`);
  }
  const venueTypeCount = uniqueCount(venues.map((venue) => venue.venueType));
  if (venueTypeCount < 2) {
    errors.push(
      `body.venueMap.venues: need >=2 venueTypes, have ${venueTypeCount}.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
