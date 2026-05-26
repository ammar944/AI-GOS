import { z } from 'zod';

import { SourceSchema } from './_shared';

/**
 * Bespoke Section 07 Paid Media Plan schema for ADR-0005.
 *
 * The section is a dependent synthesis pass over the six committed
 * positioning artifacts plus the frozen GTM brief. Cardinality, confidence,
 * URL, and grounding checks live in validatePaidMediaPlanMinimums because
 * provider structured-output schemas reject Zod cardinality constraints.
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
const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

const SourcedItemSchema = z.object({
  sourceSection: z.enum(SOURCE_SECTION_VALUES).describe('Grounding section for this item.'),
  sourceUrl: z.string().describe('Source URL supporting this item.'),
});

export const CampaignOverviewSchema = z.object({
  prose: z.string().describe('Narrative campaign overview.'),
  monthlyBudget: z.string().describe('Recommended monthly budget.'),
  totalMonths: z.number().describe('Total campaign duration in months.'),
  phaseCount: z.number().describe('Number of campaign phases.'),
  dailySpend: z.string().describe('Approximate daily spend.'),
  primaryKpi: z.string().describe('Primary optimization KPI.'),
  platform: z.string().describe('Primary paid-media platform.'),
});

export const CampaignPhaseSchema = z.object({
  phaseName: z.string().describe('Phase name.'),
  monthsLabel: z.string().describe('Human-readable month range.'),
  monthlyBudget: z.string().describe('Monthly budget for this phase.'),
  bullets: z.string().array().describe('Phase execution bullets.'),
});

export const CampaignPhasesSchema = z.object({
  prose: z.string().describe('Narrative campaign phase strategy.'),
  phases: CampaignPhaseSchema.array().describe('Campaign phases.'),
});

export const AudienceSchema = SourcedItemSchema.extend({
  slot: z.string().describe('Audience slot label.'),
  archetype: z.string().describe('Audience archetype.'),
  dailyBudget: z.string().describe('Daily budget allocation.'),
  detail: z.string().describe('Audience targeting detail.'),
});

export const AudienceTypesSchema = z.object({
  prose: z.string().describe('Narrative audience synthesis.'),
  audiences: AudienceSchema.array().describe('Recommended audience slots.'),
});

export const CreativeStrategySchema = z.object({
  prose: z.string().describe('Narrative creative strategy.'),
  staticCount: z.number().describe('Static creative count.'),
  videoCount: z.number().describe('Video creative count.'),
  totalPerAudience: z.number().describe('Total creative count per audience.'),
  angleTypesInMix: z
    .enum(CREATIVE_TYPE_VALUES)
    .array()
    .describe('Creative angle types included in the mix.'),
});

export const AdAngleSchema = SourcedItemSchema.extend({
  angleName: z.string().describe('Angle name.'),
  primaryText: z.string().describe('Primary ad text.'),
  supportingLine: z.string().describe('Supporting copy line.'),
  insight: z.string().describe('Positioning insight behind the angle.'),
});

export const AnglesToTestSchema = z.object({
  prose: z.string().describe('Narrative angle strategy.'),
  angles: AdAngleSchema.array().describe('Ad angles to test.'),
});

export const FilledCreativeSchema = SourcedItemSchema.extend({
  creativeType: z.enum(CREATIVE_TYPE_VALUES).describe('Creative framework type.'),
  uspSentence: z.string().optional().describe('USP sentence, if applicable.'),
  problem: z.string().optional().describe('Problem statement, if applicable.'),
  solution: z.string().optional().describe('Solution statement, if applicable.'),
  transformation: z.string().optional().describe('Transformation statement, if applicable.'),
  objection: z.string().optional().describe('Objection, if applicable.'),
  objectionAnswer: z.string().optional().describe('Objection answer, if applicable.'),
  founderScriptBeat: z.string().optional().describe('Founder script beat, if applicable.'),
});

export const CreativeFrameworkSchema = z.object({
  prose: z.string().describe('Narrative creative framework.'),
  creatives: FilledCreativeSchema.array().describe('Filled creative examples.'),
});

export const ReviewInsightSchema = SourcedItemSchema.extend({
  competitor: z.string().describe('Competitor name.'),
  verbatimComplaint: z.string().describe('Verbatim complaint from reviews or forums.'),
  adLeverage: z.string().describe('How to leverage the complaint in ad copy.'),
});

export const CompetitorReviewInsightsSchema = z.object({
  prose: z.string().describe('Narrative competitor-review synthesis.'),
  insights: ReviewInsightSchema.array().describe('Review insights for ad leverage.'),
});

export const CompetitorMarketingSchema = SourcedItemSchema.extend({
  competitor: z.string().describe('Competitor name.'),
  messaging: z.string().describe('Competitor messaging.'),
  adPlatforms: z.string().array().describe('Observed ad platforms.'),
  estSpend: z.string().describe('Estimated spend or unknown.'),
  icpTargeted: z.string().describe('Observed ICP targeting.'),
  anglesTested: z.string().describe('Observed angles tested.'),
  positioningClaim: z.string().describe('Competitor positioning claim.'),
  offer: z.string().describe('Competitor offer.'),
});

export const CompetitorMarketingInsightsSchema = z.object({
  prose: z.string().describe('Narrative competitor-marketing synthesis.'),
  competitors: CompetitorMarketingSchema.array().describe('Competitor marketing examples.'),
});

export const FunnelRecommendationSchema = z.object({
  funnelType: z.enum(FUNNEL_TYPE_VALUES).describe('Recommended funnel type.'),
  recommendation: z.string().describe('Funnel recommendation.'),
  optInToBookedCall: z.string().describe('How the opt-in moves to a booked call.'),
  sourceSection: z.enum(SOURCE_SECTION_VALUES).describe('Grounding section.'),
});

export const FunnelIdeationSchema = z.object({
  prose: z.string().describe('Narrative funnel strategy.'),
  recommendations: FunnelRecommendationSchema.array().describe('Funnel recommendations.'),
});

export const SalesAssetSchema = z.object({
  label: z.string().describe('Sales-process asset label.'),
  url: z.string().describe('Sales-process asset URL.'),
  assetType: z.enum(SALES_ASSET_TYPE_VALUES).describe('Sales-process asset type.'),
});

export const SalesProcessSchema = z.object({
  prose: z.string().describe('Narrative sales-process support.'),
  assets: SalesAssetSchema.array().describe('Sales-process assets.'),
});

export const ChannelSuggestionSchema = z.object({
  channel: z.string().describe('Channel name.'),
  observation: z.string().describe('Channel observation.'),
  recommendation: z.string().describe('Recommended channel action.'),
  verdict: z.enum(CHANNEL_VERDICT_VALUES).describe('Channel verdict.'),
  sourceSection: z.enum(SOURCE_SECTION_VALUES).describe('Grounding section.'),
});

export const ChannelSuggestionsSchema = z.object({
  prose: z.string().describe('Narrative channel recommendation.'),
  suggestions: ChannelSuggestionSchema.array().describe('Channel suggestions.'),
});

export const KpiSchema = z.object({
  metric: z.string().describe('KPI metric.'),
  role: z.string().describe('KPI role.'),
  definition: z.string().describe('KPI definition.'),
});

export const KpisSchema = z.object({
  prose: z.string().describe('Narrative KPI strategy.'),
  gtmMotion: z.enum(GTM_MOTION_VALUES).describe('SLG or PLG motion.'),
  kpis: KpiSchema.array().describe('Recommended KPIs.'),
});

export const PaidMediaPlanArtifactSchema = z
  .object({
    sectionTitle: z.string().describe('Section title, normally Paid Media Plan.'),
    verdict: z.string().describe('One-line judgment for Section 07 paid-media execution.'),
    statusSummary: z.string().describe('Two to four sentence opening summary.'),
    confidence: z.number().describe('0-10 confidence score; range is runner-validated.'),
    sources: SourceSchema.array().describe('Best public sources supporting the plan.'),
    campaignOverview: CampaignOverviewSchema.describe('Campaign budget and platform overview.'),
    campaignPhases: CampaignPhasesSchema.describe('Two-phase campaign plan.'),
    audienceTypes: AudienceTypesSchema.describe('Two or three audience slots.'),
    creativeStrategy: CreativeStrategySchema.describe('Creative volume and type strategy.'),
    anglesToTest: AnglesToTestSchema.describe('Evidence-grounded angles to test.'),
    creativeFramework: CreativeFrameworkSchema.describe('Filled creative templates.'),
    competitorReviewInsights: CompetitorReviewInsightsSchema.describe(
      'Competitor-review leverage.',
    ),
    competitorMarketingInsights: CompetitorMarketingInsightsSchema.describe(
      'Competitor marketing observations.',
    ),
    funnelIdeation: FunnelIdeationSchema.describe('Recommended conversion funnel.'),
    salesProcess: SalesProcessSchema.describe('Sales-process assets and support.'),
    channelSuggestions: ChannelSuggestionsSchema.describe('Client channel suggestions.'),
    kpis: KpisSchema.describe('Paid-media KPI stack.'),
  })
  .describe('Complete Section 07 Paid Media Plan Artifact.');

export type PaidMediaPlanArtifact = z.infer<typeof PaidMediaPlanArtifactSchema>;

type ValidationResult = { ok: boolean; errors: string[] };
type SourcedItem = { sourceSection: string; sourceUrl: string };
type SectionGroundedItem = { sourceSection: string };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushMissingText(errors: string[], path: string, value: unknown): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

function validateUrl(errors: string[], path: string, url: string): void {
  if (!VALID_URL_PATTERN.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
}

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
