import { z } from 'zod';

import {
  SourceSchema,
  type ValidationResult,
  hasText,
  pushMissingText,
  validateUrl,
} from './_shared';

/**
 * Next.js-side mirror of the worker PaidMediaPlanArtifactSchema. Source of
 * truth lives in research-worker/src/agents/subagents/schemas/paid-media-plan.ts.
 *
 * The lab-engine runtime persists paid-media artifacts as envelopes with
 * domain fields under body. This managed-agents mirror keeps the six-section
 * managed shape: shared metadata plus named sub-sections at the top level.
 */

const SOURCE_SECTION_VALUES = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
  'gtmBrief',
] as const;

const CREATIVE_TYPE_VALUES = [
  'unique-selling-point',
  'problem-solution-transformation',
  'objection-handling',
  'founder-talking-head',
  'product-demo',
] as const;

const FUNNEL_TYPE_VALUES = [
  'direct-to-calendar',
  'booking-page',
  'free-audit-landing-page',
  'advanced-vsl-website',
] as const;

const CHANNEL_VERDICT_VALUES = ['keep', 'fix', 'cut', 'start'] as const;
const GTM_MOTION_VALUES = ['SLG', 'PLG'] as const;
const SALES_ASSET_TYPE_VALUES = ['sop-doc', 'loom'] as const;

const SourcedItemSchema = z.object({
  sourceSection: z.enum(SOURCE_SECTION_VALUES),
  sourceUrl: z.string(),
});

export const CampaignOverviewSchema = z.object({
  prose: z.string(),
  monthlyBudget: z.string(),
  totalMonths: z.number(),
  phaseCount: z.number(),
  dailySpend: z.string(),
  primaryKpi: z.string(),
  platform: z.string(),
});

export const CampaignPhaseSchema = z.object({
  phaseName: z.string(),
  monthsLabel: z.string(),
  monthlyBudget: z.string(),
  bullets: z.string().array(),
});

export const CampaignPhasesSchema = z.object({
  prose: z.string(),
  phases: CampaignPhaseSchema.array(),
});

export const AudienceSchema = SourcedItemSchema.extend({
  slot: z.string(),
  archetype: z.string(),
  dailyBudget: z.string(),
  detail: z.string(),
});

export const AudienceTypesSchema = z.object({
  prose: z.string(),
  audiences: AudienceSchema.array(),
});

export const CreativeStrategySchema = z.object({
  prose: z.string(),
  staticCount: z.number(),
  videoCount: z.number(),
  totalPerAudience: z.number(),
  angleTypesInMix: z.enum(CREATIVE_TYPE_VALUES).array(),
});

export const AdAngleSchema = SourcedItemSchema.extend({
  angleName: z.string(),
  primaryText: z.string(),
  supportingLine: z.string(),
  insight: z.string(),
});

export const AnglesToTestSchema = z.object({
  prose: z.string(),
  angles: AdAngleSchema.array(),
});

export const FilledCreativeSchema = SourcedItemSchema.extend({
  creativeType: z.enum(CREATIVE_TYPE_VALUES),
  uspSentence: z.string().optional(),
  problem: z.string().optional(),
  solution: z.string().optional(),
  transformation: z.string().optional(),
  objection: z.string().optional(),
  objectionAnswer: z.string().optional(),
  founderScriptBeat: z.string().optional(),
});

export const CreativeFrameworkSchema = z.object({
  prose: z.string(),
  creatives: FilledCreativeSchema.array(),
});

export const ReviewInsightSchema = SourcedItemSchema.extend({
  competitor: z.string(),
  verbatimComplaint: z.string(),
  adLeverage: z.string(),
});

export const CompetitorReviewInsightsSchema = z.object({
  prose: z.string(),
  insights: ReviewInsightSchema.array(),
});

export const CompetitorMarketingSchema = SourcedItemSchema.extend({
  competitor: z.string(),
  messaging: z.string(),
  adPlatforms: z.string().array(),
  estSpend: z.string(),
  icpTargeted: z.string(),
  anglesTested: z.string(),
  positioningClaim: z.string(),
  offer: z.string(),
});

export const CompetitorMarketingInsightsSchema = z.object({
  prose: z.string(),
  competitors: CompetitorMarketingSchema.array(),
});

export const FunnelRecommendationSchema = z.object({
  funnelType: z.enum(FUNNEL_TYPE_VALUES),
  recommendation: z.string(),
  optInToBookedCall: z.string(),
  sourceSection: z.enum(SOURCE_SECTION_VALUES),
});

export const FunnelIdeationSchema = z.object({
  prose: z.string(),
  recommendations: FunnelRecommendationSchema.array(),
});

export const SalesAssetSchema = z.object({
  label: z.string(),
  url: z.string(),
  assetType: z.enum(SALES_ASSET_TYPE_VALUES),
});

export const SalesProcessSchema = z.object({
  prose: z.string(),
  assets: SalesAssetSchema.array(),
});

export const ChannelSuggestionSchema = z.object({
  channel: z.string(),
  observation: z.string(),
  recommendation: z.string(),
  verdict: z.enum(CHANNEL_VERDICT_VALUES),
  sourceSection: z.enum(SOURCE_SECTION_VALUES),
});

export const ChannelSuggestionsSchema = z.object({
  prose: z.string(),
  suggestions: ChannelSuggestionSchema.array(),
});

export const KpiSchema = z.object({
  metric: z.string(),
  role: z.string(),
  definition: z.string(),
});

export const KpisSchema = z.object({
  prose: z.string(),
  gtmMotion: z.enum(GTM_MOTION_VALUES),
  kpis: KpiSchema.array(),
});

export const PaidMediaPlanArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    campaignOverview: CampaignOverviewSchema,
    campaignPhases: CampaignPhasesSchema,
    audienceTypes: AudienceTypesSchema,
    creativeStrategy: CreativeStrategySchema,
    anglesToTest: AnglesToTestSchema,
    creativeFramework: CreativeFrameworkSchema,
    competitorReviewInsights: CompetitorReviewInsightsSchema,
    competitorMarketingInsights: CompetitorMarketingInsightsSchema,
    funnelIdeation: FunnelIdeationSchema,
    salesProcess: SalesProcessSchema,
    channelSuggestions: ChannelSuggestionsSchema,
    kpis: KpisSchema,
  })
  .describe('Complete Section 07 Paid Media Plan Artifact.');

export type PaidMediaPlanArtifact = z.infer<typeof PaidMediaPlanArtifactSchema>;

type SourcedItem = { sourceSection: string; sourceUrl: string };
type SectionGroundedItem = { sourceSection: string };

function countNonGtmGrounded<T extends SectionGroundedItem>(
  items: readonly T[],
): number {
  return items.filter((item) => item.sourceSection !== 'gtmBrief').length;
}

function validateSourcedItem(
  errors: string[],
  path: string,
  item: SourcedItem,
): void {
  pushMissingText(errors, `${path}.sourceSection`, item.sourceSection);
  pushMissingText(errors, `${path}.sourceUrl`, item.sourceUrl);
  if (hasText(item.sourceUrl)) {
    validateUrl(errors, `${path}.sourceUrl`, item.sourceUrl);
  }
}

function validateRequiredFields(
  artifact: PaidMediaPlanArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url)) {
      validateUrl(errors, `sources[${index}].url`, source.url);
    }
  });

  pushMissingText(errors, 'campaignOverview.prose', artifact.campaignOverview.prose);
  pushMissingText(errors, 'campaignOverview.monthlyBudget', artifact.campaignOverview.monthlyBudget);
  pushMissingText(errors, 'campaignOverview.dailySpend', artifact.campaignOverview.dailySpend);
  pushMissingText(errors, 'campaignOverview.primaryKpi', artifact.campaignOverview.primaryKpi);
  pushMissingText(errors, 'campaignOverview.platform', artifact.campaignOverview.platform);
  pushMissingText(errors, 'campaignPhases.prose', artifact.campaignPhases.prose);
  pushMissingText(errors, 'audienceTypes.prose', artifact.audienceTypes.prose);
  pushMissingText(errors, 'creativeStrategy.prose', artifact.creativeStrategy.prose);
  pushMissingText(errors, 'anglesToTest.prose', artifact.anglesToTest.prose);
  pushMissingText(errors, 'creativeFramework.prose', artifact.creativeFramework.prose);
  pushMissingText(
    errors,
    'competitorReviewInsights.prose',
    artifact.competitorReviewInsights.prose,
  );
  pushMissingText(
    errors,
    'competitorMarketingInsights.prose',
    artifact.competitorMarketingInsights.prose,
  );
  pushMissingText(errors, 'funnelIdeation.prose', artifact.funnelIdeation.prose);
  pushMissingText(errors, 'salesProcess.prose', artifact.salesProcess.prose);
  pushMissingText(errors, 'channelSuggestions.prose', artifact.channelSuggestions.prose);
  pushMissingText(errors, 'kpis.prose', artifact.kpis.prose);

  artifact.campaignPhases.phases.forEach((phase, index) => {
    pushMissingText(errors, `campaignPhases.phases[${index}].phaseName`, phase.phaseName);
    pushMissingText(errors, `campaignPhases.phases[${index}].monthsLabel`, phase.monthsLabel);
    pushMissingText(errors, `campaignPhases.phases[${index}].monthlyBudget`, phase.monthlyBudget);
    phase.bullets.forEach((bullet, bulletIndex) =>
      pushMissingText(
        errors,
        `campaignPhases.phases[${index}].bullets[${bulletIndex}]`,
        bullet,
      ),
    );
  });

  artifact.audienceTypes.audiences.forEach((audience, index) => {
    validateSourcedItem(errors, `audienceTypes.audiences[${index}]`, audience);
    pushMissingText(errors, `audienceTypes.audiences[${index}].slot`, audience.slot);
    pushMissingText(errors, `audienceTypes.audiences[${index}].archetype`, audience.archetype);
    pushMissingText(errors, `audienceTypes.audiences[${index}].dailyBudget`, audience.dailyBudget);
    pushMissingText(errors, `audienceTypes.audiences[${index}].detail`, audience.detail);
  });

  artifact.anglesToTest.angles.forEach((angle, index) => {
    validateSourcedItem(errors, `anglesToTest.angles[${index}]`, angle);
    pushMissingText(errors, `anglesToTest.angles[${index}].angleName`, angle.angleName);
    pushMissingText(errors, `anglesToTest.angles[${index}].primaryText`, angle.primaryText);
    pushMissingText(errors, `anglesToTest.angles[${index}].supportingLine`, angle.supportingLine);
    pushMissingText(errors, `anglesToTest.angles[${index}].insight`, angle.insight);
  });

  artifact.creativeFramework.creatives.forEach((creative, index) => {
    validateSourcedItem(errors, `creativeFramework.creatives[${index}]`, creative);
  });

  artifact.competitorReviewInsights.insights.forEach((insight, index) => {
    validateSourcedItem(errors, `competitorReviewInsights.insights[${index}]`, insight);
    pushMissingText(
      errors,
      `competitorReviewInsights.insights[${index}].competitor`,
      insight.competitor,
    );
    pushMissingText(
      errors,
      `competitorReviewInsights.insights[${index}].verbatimComplaint`,
      insight.verbatimComplaint,
    );
    pushMissingText(
      errors,
      `competitorReviewInsights.insights[${index}].adLeverage`,
      insight.adLeverage,
    );
  });

  artifact.competitorMarketingInsights.competitors.forEach((competitor, index) => {
    validateSourcedItem(errors, `competitorMarketingInsights.competitors[${index}]`, competitor);
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].competitor`,
      competitor.competitor,
    );
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].messaging`,
      competitor.messaging,
    );
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].estSpend`,
      competitor.estSpend,
    );
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].icpTargeted`,
      competitor.icpTargeted,
    );
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].anglesTested`,
      competitor.anglesTested,
    );
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].positioningClaim`,
      competitor.positioningClaim,
    );
    pushMissingText(
      errors,
      `competitorMarketingInsights.competitors[${index}].offer`,
      competitor.offer,
    );
  });

  artifact.funnelIdeation.recommendations.forEach((recommendation, index) => {
    pushMissingText(
      errors,
      `funnelIdeation.recommendations[${index}].recommendation`,
      recommendation.recommendation,
    );
    pushMissingText(
      errors,
      `funnelIdeation.recommendations[${index}].optInToBookedCall`,
      recommendation.optInToBookedCall,
    );
    pushMissingText(
      errors,
      `funnelIdeation.recommendations[${index}].sourceSection`,
      recommendation.sourceSection,
    );
  });

  artifact.salesProcess.assets.forEach((asset, index) => {
    pushMissingText(errors, `salesProcess.assets[${index}].label`, asset.label);
    pushMissingText(errors, `salesProcess.assets[${index}].url`, asset.url);
    if (hasText(asset.url)) {
      validateUrl(errors, `salesProcess.assets[${index}].url`, asset.url);
    }
  });

  artifact.channelSuggestions.suggestions.forEach((suggestion, index) => {
    pushMissingText(
      errors,
      `channelSuggestions.suggestions[${index}].channel`,
      suggestion.channel,
    );
    pushMissingText(
      errors,
      `channelSuggestions.suggestions[${index}].observation`,
      suggestion.observation,
    );
    pushMissingText(
      errors,
      `channelSuggestions.suggestions[${index}].recommendation`,
      suggestion.recommendation,
    );
    pushMissingText(
      errors,
      `channelSuggestions.suggestions[${index}].sourceSection`,
      suggestion.sourceSection,
    );
  });

  artifact.kpis.kpis.forEach((kpi, index) => {
    pushMissingText(errors, `kpis.kpis[${index}].metric`, kpi.metric);
    pushMissingText(errors, `kpis.kpis[${index}].role`, kpi.role);
    pushMissingText(errors, `kpis.kpis[${index}].definition`, kpi.definition);
  });
}

export function validatePaidMediaPlanMinimums(
  artifact: PaidMediaPlanArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  if (artifact.sources.length < 5) {
    errors.push(`sources: have ${artifact.sources.length}, need >=5.`);
  }
  if (artifact.anglesToTest.angles.length < 4) {
    errors.push('anglesToTest.angles: need >=4.');
  }
  if (artifact.creativeFramework.creatives.length < 3) {
    errors.push('creativeFramework.creatives: need >=3.');
  }
  if (artifact.competitorReviewInsights.insights.length < 2) {
    errors.push('competitorReviewInsights.insights: need >=2.');
  }
  if (artifact.competitorMarketingInsights.competitors.length < 2) {
    errors.push('competitorMarketingInsights.competitors: need >=2.');
  }
  if (artifact.funnelIdeation.recommendations.length < 1) {
    errors.push('funnelIdeation.recommendations: need >=1.');
  }
  if (artifact.channelSuggestions.suggestions.length < 2) {
    errors.push('channelSuggestions.suggestions: need >=2.');
  }

  const audienceCount = artifact.audienceTypes.audiences.length;
  if (![2, 3].includes(audienceCount)) {
    errors.push(`audienceTypes.audiences: have ${audienceCount}, need 2 or 3.`);
  }

  const synthesizedGroundingCount =
    countNonGtmGrounded(artifact.anglesToTest.angles) +
    countNonGtmGrounded(artifact.creativeFramework.creatives) +
    countNonGtmGrounded(artifact.competitorReviewInsights.insights) +
    countNonGtmGrounded(artifact.competitorMarketingInsights.competitors) +
    countNonGtmGrounded(artifact.funnelIdeation.recommendations) +
    countNonGtmGrounded(artifact.channelSuggestions.suggestions);

  if (synthesizedGroundingCount < 14) {
    errors.push('synthesized items: need section-grounded sourceSection values.');
  }

  return { ok: errors.length === 0, errors };
}
