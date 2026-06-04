import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  validateProvesWrongIfMinimums,
  validateStrategicText,
} from "./strategic-insight";

const sourceSectionValues = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "gtmBrief",
] as const;

export const creativeTypeValues = [
  "unique-selling-point",
  "problem-solution-transformation",
  "objection-handling",
  "founder-talking-head",
  "product-demo",
] as const;

function slugifyCreativeType(value: unknown): string {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, "-")
    .replace(/[^a-z-]/g, "");
}

/**
 * Snap an arbitrary (possibly out-of-enum) creative-type value onto a valid
 * `creativeTypeValues` member. Tiered: exact membership → slug-normalized match
 * → keyword heuristic → `product-demo` fallback. Always returns a valid member.
 */
export function snapCreativeType(
  value: unknown,
): (typeof creativeTypeValues)[number] {
  if (
    typeof value === "string" &&
    (creativeTypeValues as readonly string[]).includes(value)
  ) {
    return value as (typeof creativeTypeValues)[number];
  }

  const slug = slugifyCreativeType(value);

  const slugMatch = creativeTypeValues.find(
    (enumValue) => slugifyCreativeType(enumValue) === slug,
  );
  if (slugMatch) {
    return slugMatch;
  }

  if (slug.includes("usp") || slug.includes("selling")) {
    return "unique-selling-point";
  }
  if (
    slug.includes("problem") ||
    slug.includes("transformation") ||
    slug.includes("pas")
  ) {
    return "problem-solution-transformation";
  }
  if (slug.includes("objection")) {
    return "objection-handling";
  }
  if (slug.includes("founder") || slug.includes("talking")) {
    return "founder-talking-head";
  }
  if (slug.includes("demo") || slug.includes("product")) {
    return "product-demo";
  }

  return "product-demo";
}

/**
 * Snap each entry of an `angleTypesInMix` array onto a valid creative-type
 * member. Non-array input is returned unchanged so downstream validation still
 * sees (and rejects) a malformed shape.
 */
export function snapAngleTypesInMix(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return value as string[];
  }

  return value.map((entry) => snapCreativeType(entry));
}

const funnelTypeValues = [
  "direct-to-calendar",
  "booking-page",
  "free-audit-landing-page",
  "advanced-vsl-website",
] as const;

const channelVerdictValues = ["keep", "fix", "cut", "start"] as const;

export const paidMediaMoneyProvenanceValues = [
  "user-supplied",
  "tool-measured",
  "source-reported",
  "model-estimated",
  "unknown",
] as const;

const paidMediaMoneyProvenanceSchema = z.enum(paidMediaMoneyProvenanceValues);
const paidMediaNumericMoneySchema = z.number().finite().nonnegative().optional();
type PaidMediaMoneyProvenance =
  (typeof paidMediaMoneyProvenanceValues)[number];

function rejectUnknownProvenanceNumericMoney(
  ctx: z.RefinementCtx,
  value: number | undefined,
  provenance: PaidMediaMoneyProvenance,
  path: "monthlyBudgetValue" | "dailySpendValue" | "dailyBudgetValue",
): void {
  if (value === undefined || provenance !== "unknown") {
    return;
  }

  ctx.addIssue({
    code: z.ZodIssueCode.custom,
    path: [path],
    message: "Numeric money sibling must be omitted when provenance is unknown.",
  });
}

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
  })
  .strict();

const sourcedItemSchema = z
  .object({
    sourceSection: z.enum(sourceSectionValues),
    sourceUrl: z.string().url(),
  })
  .strict();

const sourceRefsSchema = z.array(sourcedItemSchema).min(2);

const strategicThesisSchema = z
  .object({
    thesis: z.string().min(1),
    segment: z.string().min(1),
    awareness: z.string().min(1),
    force: z.string().min(1),
    defensibleDifferentiator: z.string().min(1),
    sourceSections: sourceRefsSchema,
  })
  .strict();

const contradictionReconciliationSchema = z
  .object({
    contradiction: z.string().min(1),
    resolution: z.string().min(1),
    tradeOffAccepted: z.string().min(1),
    sourceSections: sourceRefsSchema,
  })
  .strict();

const provesWrongIfSchema = z
  .object({
    metric: z.string().min(1),
    threshold: z.string().min(1),
    window: z.string().min(1),
  })
  .strict();

const campaignOverviewSchema = z
  .object({
    prose: z.string().min(1),
    monthlyBudget: z.string().min(1),
    monthlyBudgetValue: paidMediaNumericMoneySchema,
    monthlyBudgetProvenance: paidMediaMoneyProvenanceSchema,
    totalMonths: z.number(),
    phaseCount: z.number(),
    dailySpend: z.string().min(1),
    dailySpendValue: paidMediaNumericMoneySchema,
    dailySpendProvenance: paidMediaMoneyProvenanceSchema,
    primaryKpi: z.string().min(1),
    platform: z.string().min(1),
  })
  .strict()
  .superRefine((value, ctx): void => {
    rejectUnknownProvenanceNumericMoney(
      ctx,
      value.monthlyBudgetValue,
      value.monthlyBudgetProvenance,
      "monthlyBudgetValue",
    );
    rejectUnknownProvenanceNumericMoney(
      ctx,
      value.dailySpendValue,
      value.dailySpendProvenance,
      "dailySpendValue",
    );
  });

const campaignPhaseSchema = z
  .object({
    phaseName: z.string().min(1),
    monthsLabel: z.string().min(1),
    monthlyBudget: z.string().min(1),
    monthlyBudgetValue: paidMediaNumericMoneySchema,
    monthlyBudgetProvenance: paidMediaMoneyProvenanceSchema,
    bullets: z.array(z.string().min(1)),
  })
  .strict()
  .superRefine((value, ctx): void => {
    rejectUnknownProvenanceNumericMoney(
      ctx,
      value.monthlyBudgetValue,
      value.monthlyBudgetProvenance,
      "monthlyBudgetValue",
    );
  });

const audienceSchema = sourcedItemSchema
  .extend({
    slot: z.string().min(1),
    archetype: z.string().min(1),
    dailyBudget: z.string().min(1),
    dailyBudgetValue: paidMediaNumericMoneySchema,
    dailyBudgetProvenance: paidMediaMoneyProvenanceSchema,
    detail: z.string().min(1),
  })
  .strict()
  .superRefine((value, ctx): void => {
    rejectUnknownProvenanceNumericMoney(
      ctx,
      value.dailyBudgetValue,
      value.dailyBudgetProvenance,
      "dailyBudgetValue",
    );
  });

const creativeStrategySchema = z
  .object({
    prose: z.string().min(1),
    staticCount: z.number(),
    videoCount: z.number(),
    totalPerAudience: z.number(),
    angleTypesInMix: z.array(z.enum(creativeTypeValues)),
  })
  .strict();

const adAngleSchema = sourcedItemSchema
  .extend({
    angleName: z.string().min(1),
    primaryText: z.string().min(1),
    supportingLine: z.string().min(1),
    insight: z.string().min(1),
  })
  .strict();

const filledCreativeSchema = sourcedItemSchema
  .extend({
    creativeType: z.enum(creativeTypeValues),
    uspSentence: z.string().min(1).optional(),
    problem: z.string().min(1).optional(),
    solution: z.string().min(1).optional(),
    transformation: z.string().min(1).optional(),
    objection: z.string().min(1).optional(),
    objectionAnswer: z.string().min(1).optional(),
    founderScriptBeat: z.string().min(1).optional(),
  })
  .strict();

const reviewInsightSchema = sourcedItemSchema
  .extend({
    competitor: z.string().min(1),
    verbatimComplaint: z.string().min(1),
    adLeverage: z.string().min(1),
  })
  .strict();

const competitorMarketingSchema = sourcedItemSchema
  .extend({
    competitor: z.string().min(1),
    messaging: z.string().min(1),
    adPlatforms: z.array(z.string().min(1)),
    estSpend: z.string().min(1),
    estSpendProvenance: paidMediaMoneyProvenanceSchema,
    icpTargeted: z.string().min(1),
    anglesTested: z.string().min(1),
    positioningClaim: z.string().min(1),
    offer: z.string().min(1),
  })
  .strict();

const funnelRecommendationSchema = z
  .object({
    funnelType: z.enum(funnelTypeValues),
    recommendation: z.string().min(1),
    optInToBookedCall: z.string().min(1),
    sourceSection: z.enum(sourceSectionValues),
  })
  .strict();

const salesAssetSchema = z
  .object({
    label: z.string().min(1),
    url: z.string().url(),
    assetType: z.enum(["sop-doc", "loom"]),
  })
  .strict();

const channelSuggestionSchema = z
  .object({
    channel: z.string().min(1),
    observation: z.string().min(1),
    recommendation: z.string().min(1),
    verdict: z.enum(channelVerdictValues),
    sourceSection: z.enum(sourceSectionValues),
  })
  .strict();

const kpiSchema = z
  .object({
    metric: z.string().min(1),
    role: z.string().min(1),
    definition: z.string().min(1),
  })
  .strict();

const orderedMoveSchema = sourcedItemSchema
  .extend({
    rank: z.number(),
    move: z.string().min(1),
    dependsOn: z.array(z.number()),
    learningPriority: z.string().min(1),
    rationale: z.string().min(1),
    thesisTrace: z.string().min(1),
    provesWrongIf: provesWrongIfSchema,
  })
  .strict();

export const paidMediaPlanBodySchema = z
  .object({
    strategicThesis: strategicThesisSchema,
    contradictionReconciliation: contradictionReconciliationSchema,
    campaignOverview: campaignOverviewSchema,
    campaignPhases: z
      .object({ prose: z.string().min(1), phases: z.array(campaignPhaseSchema) })
      .strict(),
    audienceTypes: z
      .object({ prose: z.string().min(1), audiences: z.array(audienceSchema) })
      .strict(),
    creativeStrategy: creativeStrategySchema,
    anglesToTest: z
      .object({ prose: z.string().min(1), angles: z.array(adAngleSchema) })
      .strict(),
    creativeFramework: z
      .object({ prose: z.string().min(1), creatives: z.array(filledCreativeSchema) })
      .strict(),
    competitorReviewInsights: z
      .object({ prose: z.string().min(1), insights: z.array(reviewInsightSchema) })
      .strict(),
    competitorMarketingInsights: z
      .object({ prose: z.string().min(1), competitors: z.array(competitorMarketingSchema) })
      .strict(),
    funnelIdeation: z
      .object({ prose: z.string().min(1), recommendations: z.array(funnelRecommendationSchema) })
      .strict(),
    salesProcess: z
      .object({ prose: z.string().min(1), assets: z.array(salesAssetSchema) })
      .strict(),
    channelSuggestions: z
      .object({ prose: z.string().min(1), suggestions: z.array(channelSuggestionSchema) })
      .strict(),
    kpis: z
      .object({
        prose: z.string().min(1),
        gtmMotion: z.enum(["SLG", "PLG"]),
        kpis: z.array(kpiSchema),
      })
      .strict(),
    orderedMoves: z
      .object({
        prose: z.string().min(1),
        moves: z.array(orderedMoveSchema),
      })
      .strict(),
  })
  .strict();

export const paidMediaPlanSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: paidMediaPlanBodySchema,
  })
  .strict();

export type PaidMediaPlanBody = z.infer<typeof paidMediaPlanBodySchema>;
export type PaidMediaPlanSectionOutput = z.infer<
  typeof paidMediaPlanSectionOutputSchema
>;
export type PaidMediaPlanArtifact = ArtifactEnvelope & {
  body: PaidMediaPlanBody;
};

function countNonGtmGrounded<T extends { sourceSection: string }>(
  items: readonly T[],
): number {
  return items.filter((item) => item.sourceSection !== "gtmBrief").length;
}

function validateSourceRefs(
  errors: string[],
  path: string,
  refs: readonly { sourceSection: string }[],
): void {
  const distinctNonGtmSections = new Set(
    refs
      .filter((ref) => ref.sourceSection !== "gtmBrief")
      .map((ref) => ref.sourceSection),
  );
  if (distinctNonGtmSections.size < 2) {
    errors.push(`${path}: need >=2 distinct non-gtmBrief source refs.`);
  }
}

function validateThesis(errors: string[], body: PaidMediaPlanBody): void {
  validateStrategicText(errors, "body.strategicThesis.thesis", body.strategicThesis.thesis);
  validateStrategicText(errors, "body.strategicThesis.force", body.strategicThesis.force);
  validateStrategicText(
    errors,
    "body.strategicThesis.defensibleDifferentiator",
    body.strategicThesis.defensibleDifferentiator,
  );
  validateSourceRefs(
    errors,
    "body.strategicThesis.sourceSections",
    body.strategicThesis.sourceSections,
  );
  validateStrategicText(
    errors,
    "body.contradictionReconciliation.contradiction",
    body.contradictionReconciliation.contradiction,
  );
  validateStrategicText(
    errors,
    "body.contradictionReconciliation.resolution",
    body.contradictionReconciliation.resolution,
  );
  validateStrategicText(
    errors,
    "body.contradictionReconciliation.tradeOffAccepted",
    body.contradictionReconciliation.tradeOffAccepted,
  );
  validateSourceRefs(
    errors,
    "body.contradictionReconciliation.sourceSections",
    body.contradictionReconciliation.sourceSections,
  );
}

function validateOrderedMoves(
  errors: string[],
  body: PaidMediaPlanBody,
): void {
  const moves = body.orderedMoves.moves;
  if (moves.length < 3) {
    errors.push("body.orderedMoves.moves: need >=3 sequenced moves.");
  }

  const ranks = moves.map((move) => move.rank);
  const uniqueRanks = new Set(ranks);
  if (uniqueRanks.size !== ranks.length) {
    errors.push("body.orderedMoves.moves.rank: ranks must be unique.");
  }
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const ranksAreConsecutive = sortedRanks.every(
    (rank, index) => rank === index + 1,
  );
  if (!ranksAreConsecutive) {
    errors.push("body.orderedMoves.moves.rank: ranks must be consecutive starting at 1.");
  }

  for (let index = 0; index < moves.length; index += 1) {
    const move = moves[index];
    const path = `body.orderedMoves.moves[${index}]`;
    const priorRanks = new Set(ranks.filter((rank) => rank < move.rank));
    if (!Number.isInteger(move.rank) || move.rank < 1) {
      errors.push(`${path}.rank: must be a positive integer.`);
    }
    validateStrategicText(errors, `${path}.move`, move.move);
    validateStrategicText(errors, `${path}.learningPriority`, move.learningPriority);
    validateStrategicText(errors, `${path}.rationale`, move.rationale);
    validateStrategicText(errors, `${path}.thesisTrace`, move.thesisTrace);
    validateProvesWrongIfMinimums(
      errors,
      `${path}.provesWrongIf`,
      move.provesWrongIf,
    );
    const invalidDeps = move.dependsOn.filter(
      (rank) => !Number.isInteger(rank) || !priorRanks.has(rank),
    );
    if (invalidDeps.length > 0) {
      errors.push(`${path}.dependsOn: dependencies must point to earlier ranks.`);
    }
    if (move.rank === 1 && move.dependsOn.length > 0) {
      errors.push(`${path}.dependsOn: first move must not depend on another move.`);
    }
    if (move.rank > 1 && move.dependsOn.length === 0) {
      errors.push(`${path}.dependsOn: later moves need at least one dependency.`);
    }
  }
}

export function validatePaidMediaPlanMinimums(
  artifact: ArtifactEnvelope & { body: PaidMediaPlanBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: paidMediaPlanBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }
  validateThesis(errors, parsedArtifact.body);
  validateOrderedMoves(errors, parsedArtifact.body);

  if (parsedArtifact.body.anglesToTest.angles.length < 4) {
    errors.push("body.anglesToTest.angles: need >=4.");
  }
  if (parsedArtifact.body.creativeFramework.creatives.length < 3) {
    errors.push("body.creativeFramework.creatives: need >=3.");
  }
  if (parsedArtifact.body.competitorReviewInsights.insights.length < 2) {
    errors.push("body.competitorReviewInsights.insights: need >=2.");
  }
  if (parsedArtifact.body.competitorMarketingInsights.competitors.length < 2) {
    errors.push("body.competitorMarketingInsights.competitors: need >=2.");
  }
  if (parsedArtifact.body.funnelIdeation.recommendations.length < 1) {
    errors.push("body.funnelIdeation.recommendations: need >=1.");
  }
  if (parsedArtifact.body.channelSuggestions.suggestions.length < 2) {
    errors.push("body.channelSuggestions.suggestions: need >=2.");
  }

  const audienceCount = parsedArtifact.body.audienceTypes.audiences.length;
  if (![2, 3].includes(audienceCount)) {
    errors.push(`body.audienceTypes.audiences: have ${audienceCount}, need 2 or 3.`);
  }

  const synthesizedGroundingCount =
    countNonGtmGrounded(parsedArtifact.body.anglesToTest.angles) +
    countNonGtmGrounded(parsedArtifact.body.creativeFramework.creatives) +
    countNonGtmGrounded(parsedArtifact.body.competitorReviewInsights.insights) +
    countNonGtmGrounded(parsedArtifact.body.competitorMarketingInsights.competitors) +
    parsedArtifact.body.funnelIdeation.recommendations.filter(
      (item) => item.sourceSection !== "gtmBrief",
    ).length +
    parsedArtifact.body.channelSuggestions.suggestions.filter(
      (item) => item.sourceSection !== "gtmBrief",
    ).length;

  if (synthesizedGroundingCount < 14) {
    errors.push("synthesized items: need section-grounded sourceSection values.");
  }

  return { ok: errors.length === 0, errors };
}
