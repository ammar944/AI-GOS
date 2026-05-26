import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";

const sourceSectionValues = [
  "positioningMarketCategory",
  "positioningBuyerICP",
  "positioningCompetitorLandscape",
  "positioningVoiceOfCustomer",
  "positioningDemandIntent",
  "positioningOfferDiagnostic",
  "gtmBrief",
] as const;

const creativeTypeValues = [
  "unique-selling-point",
  "problem-solution-transformation",
  "objection-handling",
  "founder-talking-head",
  "product-demo",
] as const;

const funnelTypeValues = [
  "direct-to-calendar",
  "booking-page",
  "free-audit-landing-page",
  "advanced-vsl-website",
] as const;

const channelVerdictValues = ["keep", "fix", "cut", "start"] as const;

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

const campaignOverviewSchema = z
  .object({
    prose: z.string().min(1),
    monthlyBudget: z.string().min(1),
    totalMonths: z.number(),
    phaseCount: z.number(),
    dailySpend: z.string().min(1),
    primaryKpi: z.string().min(1),
    platform: z.string().min(1),
  })
  .strict();

const campaignPhaseSchema = z
  .object({
    phaseName: z.string().min(1),
    monthsLabel: z.string().min(1),
    monthlyBudget: z.string().min(1),
    bullets: z.array(z.string().min(1)),
  })
  .strict();

const audienceSchema = sourcedItemSchema
  .extend({
    slot: z.string().min(1),
    archetype: z.string().min(1),
    dailyBudget: z.string().min(1),
    detail: z.string().min(1),
  })
  .strict();

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

export const paidMediaPlanBodySchema = z
  .object({
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
