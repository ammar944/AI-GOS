import { z } from 'zod';

import {
  SourceSchema,
  type ValidationResult,
  hasText,
  pushMissingText,
  uniqueCount,
  validateUrl,
} from './_shared';

/**
 * Next.js-side mirror of the worker CompetitorLandscapeArtifactSchema. Source
 * of truth lives in
 * research-worker/src/agents/subagents/schemas/competitor-landscape.ts.
 */

const COMPETITOR_TYPES = ['direct', 'indirect', 'status-quo', 'diy'] as const;
const AD_PLATFORM_VALUES = ['google', 'meta', 'linkedin'] as const;

export const CompetitorSchema = z.object({
  name: z.string(),
  url: z.string(),
  competitorType: z.enum(COMPETITOR_TYPES),
  oneLinePositioning: z.string(),
  verbatimHeroCopy: z.string(),
  pricingPosition: z.string(),
  sourceUrl: z.string(),
});

export const CompetitorPositionSchema = z.object({
  competitor: z.string(),
  position: z.string(),
});

export const PositioningAxisSchema = z.object({
  axisName: z.string(),
  ourPosition: z.string(),
  competitorPositions: CompetitorPositionSchema.array(),
  evidenceUrl: z.string(),
});

export const PricingDataPointSchema = z.object({
  competitor: z.string(),
  tierName: z.string(),
  monthlyPrice: z.string(),
  packagingPattern: z.string(),
  gatedSignals: z.string(),
  sourceUrl: z.string(),
});

export const ShareOfVoiceSliceSchema = z.object({
  surface: z.string(),
  winner: z.string(),
  evidence: z.string(),
  sourceUrl: z.string(),
});

export const CompetitorWeaknessSchema = z.object({
  competitor: z.string(),
  verbatimQuote: z.string(),
  source: z.string(),
  sourceUrl: z.string(),
  whyItMatters: z.string(),
});

export const NarrativeArcSchema = z.object({
  competitor: z.string(),
  villain: z.string(),
  hero: z.string(),
  transformationClaim: z.string(),
  sourceUrl: z.string(),
});

export const CompetitorSetSchema = z.object({
  prose: z.string(),
  competitors: CompetitorSchema.array(),
});

export const PositioningTaxonomySchema = z.object({
  prose: z.string(),
  axes: PositioningAxisSchema.array(),
});

export const PricingRealitySchema = z.object({
  prose: z.string(),
  dataPoints: PricingDataPointSchema.array(),
});

export const ShareOfVoiceSchema = z.object({
  prose: z.string(),
  slices: ShareOfVoiceSliceSchema.array(),
});

export const PublicWeaknessesSchema = z.object({
  prose: z.string(),
  items: CompetitorWeaknessSchema.array(),
});

export const NarrativeArcsSchema = z.object({
  prose: z.string(),
  arcs: NarrativeArcSchema.array(),
});

export const AdPresenceSignalSchema = z.object({
  competitor: z.string(),
  platforms: z.enum(AD_PLATFORM_VALUES).array(),
  estSpend: z.string(),
  evidence: z.string(),
  sourceUrl: z.string(),
});

export const AdPresenceSchema = z.object({
  prose: z.string(),
  signals: AdPresenceSignalSchema.array(),
});

export const AdEvidencePlatformCountsSchema = z.object({
  google: z.number(),
  meta: z.number(),
  linkedin: z.number(),
});

export const AdEvidenceCreativeSchema = z.object({
  id: z.string(),
  platform: z.enum(AD_PLATFORM_VALUES),
  advertiserName: z.string(),
  headline: z.string().nullable(),
  body: z.string().nullable(),
  landingUrl: z.string().nullable(),
  creativeUrl: z.string().nullable(),
  imageUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  detailsUrl: z.string().nullable(),
  sourceUrl: z.string(),
  firstSeen: z.string().nullable(),
  lastSeen: z.string().nullable(),
  format: z.string(),
  isActive: z.boolean(),
});

export const AdEvidenceLibraryLinksSchema = z.object({
  google: z.string().optional(),
  meta: z.string().optional(),
  linkedin: z.string().optional(),
});

export const AdEvidenceRawSourceSampleSchema = z.object({
  id: z.string(),
  platform: z.enum(AD_PLATFORM_VALUES),
  advertiserName: z.string().nullable(),
  headline: z.string().nullable(),
  body: z.string().nullable(),
  imageUrl: z.string().nullable(),
  videoUrl: z.string().nullable(),
  detailsUrl: z.string().nullable(),
  sourceUrl: z.string(),
  format: z.string().nullable(),
  dataGap: z.string().nullable(),
});

export const AdEvidenceDataGapSchema = z.object({
  platform: z.enum(AD_PLATFORM_VALUES).optional(),
  reason: z.string(),
});

export const AdEvidenceSourceErrorSchema = z.object({
  platform: z.enum(AD_PLATFORM_VALUES),
  message: z.string(),
});

export const AdEvidenceGroupSchema = z.object({
  advertiserName: z.string(),
  domain: z.string().nullable(),
  platforms: z.enum(AD_PLATFORM_VALUES).array(),
  rawCounts: AdEvidencePlatformCountsSchema,
  displayableCounts: AdEvidencePlatformCountsSchema,
  displayableTotal: z.number(),
  returnedCreativeCount: z.number(),
  creatives: AdEvidenceCreativeSchema.array(),
  libraryLinks: AdEvidenceLibraryLinksSchema,
  rawSourceSamples: AdEvidenceRawSourceSampleSchema.array(),
  dataGaps: AdEvidenceDataGapSchema.array(),
  sourceErrors: AdEvidenceSourceErrorSchema.array(),
  observedAt: z.string(),
});

export const AdEvidenceSchema = z.object({
  prose: z.string(),
  advertiserGroups: AdEvidenceGroupSchema.array(),
});

export const CompetitorLandscapeArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    competitorSet: CompetitorSetSchema,
    positioningTaxonomy: PositioningTaxonomySchema,
    pricingReality: PricingRealitySchema,
    shareOfVoice: ShareOfVoiceSchema,
    publicWeaknesses: PublicWeaknessesSchema,
    narrativeArcs: NarrativeArcsSchema,
    adPresence: AdPresenceSchema,
    adEvidence: AdEvidenceSchema,
  })
  .describe('Complete Section 03 Competitor Landscape & Positioning Artifact.');

export type CompetitorLandscapeArtifact = z.infer<
  typeof CompetitorLandscapeArtifactSchema
>;

function validateRequiredFields(
  artifact: CompetitorLandscapeArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  pushMissingText(errors, 'competitorSet.prose', artifact.competitorSet.prose);
  pushMissingText(errors, 'positioningTaxonomy.prose', artifact.positioningTaxonomy.prose);
  pushMissingText(errors, 'pricingReality.prose', artifact.pricingReality.prose);
  pushMissingText(errors, 'shareOfVoice.prose', artifact.shareOfVoice.prose);
  pushMissingText(errors, 'publicWeaknesses.prose', artifact.publicWeaknesses.prose);
  pushMissingText(errors, 'narrativeArcs.prose', artifact.narrativeArcs.prose);
  pushMissingText(errors, 'adPresence.prose', artifact.adPresence.prose);

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url)) {
      validateUrl(errors, `sources[${index}] (${source.title})`, source.url);
    }
  });

  artifact.competitorSet.competitors.forEach((c, index) => {
    pushMissingText(errors, `competitors[${index}].name`, c.name);
    pushMissingText(errors, `competitors[${index}].url`, c.url);
    pushMissingText(errors, `competitors[${index}].oneLinePositioning`, c.oneLinePositioning);
    pushMissingText(errors, `competitors[${index}].verbatimHeroCopy`, c.verbatimHeroCopy);
    pushMissingText(errors, `competitors[${index}].pricingPosition`, c.pricingPosition);
    pushMissingText(errors, `competitors[${index}].sourceUrl`, c.sourceUrl);
    if (hasText(c.url)) {
      validateUrl(errors, `competitors[${index}] (${c.name}).url`, c.url);
    }
    if (hasText(c.sourceUrl)) {
      validateUrl(errors, `competitors[${index}] (${c.name}).sourceUrl`, c.sourceUrl);
    }
  });

  artifact.positioningTaxonomy.axes.forEach((axis, index) => {
    pushMissingText(errors, `positioningTaxonomy.axes[${index}].axisName`, axis.axisName);
    pushMissingText(errors, `positioningTaxonomy.axes[${index}].ourPosition`, axis.ourPosition);
    pushMissingText(errors, `positioningTaxonomy.axes[${index}].evidenceUrl`, axis.evidenceUrl);
    if (hasText(axis.evidenceUrl)) {
      validateUrl(
        errors,
        `positioningTaxonomy.axes[${index}].evidenceUrl`,
        axis.evidenceUrl,
      );
    }
    axis.competitorPositions.forEach((position, positionIndex) => {
      pushMissingText(
        errors,
        `positioningTaxonomy.axes[${index}].competitorPositions[${positionIndex}].competitor`,
        position.competitor,
      );
      pushMissingText(
        errors,
        `positioningTaxonomy.axes[${index}].competitorPositions[${positionIndex}].position`,
        position.position,
      );
    });
  });

  artifact.pricingReality.dataPoints.forEach((p, index) => {
    pushMissingText(errors, `pricingReality.dataPoints[${index}].competitor`, p.competitor);
    pushMissingText(errors, `pricingReality.dataPoints[${index}].tierName`, p.tierName);
    pushMissingText(errors, `pricingReality.dataPoints[${index}].monthlyPrice`, p.monthlyPrice);
    pushMissingText(
      errors,
      `pricingReality.dataPoints[${index}].packagingPattern`,
      p.packagingPattern,
    );
    pushMissingText(errors, `pricingReality.dataPoints[${index}].gatedSignals`, p.gatedSignals);
    pushMissingText(errors, `pricingReality.dataPoints[${index}].sourceUrl`, p.sourceUrl);
    if (hasText(p.sourceUrl)) {
      validateUrl(errors, `pricingReality.dataPoints[${index}].sourceUrl`, p.sourceUrl);
    }
  });

  artifact.shareOfVoice.slices.forEach((slice, index) => {
    pushMissingText(errors, `shareOfVoice.slices[${index}].surface`, slice.surface);
    pushMissingText(errors, `shareOfVoice.slices[${index}].winner`, slice.winner);
    pushMissingText(errors, `shareOfVoice.slices[${index}].evidence`, slice.evidence);
    pushMissingText(errors, `shareOfVoice.slices[${index}].sourceUrl`, slice.sourceUrl);
    if (hasText(slice.sourceUrl)) {
      validateUrl(errors, `shareOfVoice.slices[${index}].sourceUrl`, slice.sourceUrl);
    }
  });

  artifact.publicWeaknesses.items.forEach((item, index) => {
    pushMissingText(errors, `publicWeaknesses.items[${index}].competitor`, item.competitor);
    pushMissingText(errors, `publicWeaknesses.items[${index}].verbatimQuote`, item.verbatimQuote);
    pushMissingText(errors, `publicWeaknesses.items[${index}].source`, item.source);
    pushMissingText(errors, `publicWeaknesses.items[${index}].sourceUrl`, item.sourceUrl);
    pushMissingText(errors, `publicWeaknesses.items[${index}].whyItMatters`, item.whyItMatters);
    if (hasText(item.sourceUrl)) {
      validateUrl(errors, `publicWeaknesses.items[${index}].sourceUrl`, item.sourceUrl);
    }
  });

  artifact.narrativeArcs.arcs.forEach((arc, index) => {
    pushMissingText(errors, `narrativeArcs.arcs[${index}].competitor`, arc.competitor);
    pushMissingText(errors, `narrativeArcs.arcs[${index}].villain`, arc.villain);
    pushMissingText(errors, `narrativeArcs.arcs[${index}].hero`, arc.hero);
    pushMissingText(
      errors,
      `narrativeArcs.arcs[${index}].transformationClaim`,
      arc.transformationClaim,
    );
    pushMissingText(errors, `narrativeArcs.arcs[${index}].sourceUrl`, arc.sourceUrl);
    if (hasText(arc.sourceUrl)) {
      validateUrl(errors, `narrativeArcs.arcs[${index}].sourceUrl`, arc.sourceUrl);
    }
  });

  artifact.adPresence.signals.forEach((signal, index) => {
    pushMissingText(errors, `adPresence.signals[${index}].competitor`, signal.competitor);
    pushMissingText(errors, `adPresence.signals[${index}].estSpend`, signal.estSpend);
    pushMissingText(errors, `adPresence.signals[${index}].evidence`, signal.evidence);
    pushMissingText(errors, `adPresence.signals[${index}].sourceUrl`, signal.sourceUrl);
    if (hasText(signal.sourceUrl)) {
      validateUrl(errors, `adPresence.signals[${index}].sourceUrl`, signal.sourceUrl);
    }
  });
}

export function validateCompetitorLandscapeMinimums(
  artifact: CompetitorLandscapeArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  if (artifact.sources.length < 5) {
    errors.push(`sources: have ${artifact.sources.length}, need >=5 Section-level sources.`);
  }

  if (artifact.competitorSet.competitors.length < 5) {
    errors.push(
      `competitorSet.competitors: have ${artifact.competitorSet.competitors.length}, need >=5 competitors across direct, indirect, status-quo, and diy.`,
    );
  }

  const observedTypes = artifact.competitorSet.competitors.map((c) => c.competitorType);
  const missingTypes = COMPETITOR_TYPES.filter((t) => !observedTypes.includes(t));
  if (missingTypes.length > 0) {
    errors.push(
      `competitorSet.competitors: missing competitor types ${missingTypes.join(', ')}.`,
    );
  }

  if (artifact.positioningTaxonomy.axes.length < 3) {
    errors.push(
      `positioningTaxonomy.axes: have ${artifact.positioningTaxonomy.axes.length}, need >=3 axes.`,
    );
  }

  if (artifact.pricingReality.dataPoints.length < 3) {
    errors.push(
      `pricingReality.dataPoints: have ${artifact.pricingReality.dataPoints.length}, need >=3 pricing data points.`,
    );
  }
  const distinctPricingCompetitors = uniqueCount(
    artifact.pricingReality.dataPoints.map((p) => p.competitor),
  );
  if (distinctPricingCompetitors < 3) {
    errors.push(
      `pricingReality.dataPoints: need pricing evidence for >=3 distinct competitors, have ${distinctPricingCompetitors}.`,
    );
  }

  if (artifact.shareOfVoice.slices.length < 3) {
    errors.push(
      `shareOfVoice.slices: have ${artifact.shareOfVoice.slices.length}, need >=3 surfaces.`,
    );
  }

  if (artifact.publicWeaknesses.items.length < 4) {
    errors.push(
      `publicWeaknesses.items: have ${artifact.publicWeaknesses.items.length}, need >=4 verbatim weaknesses.`,
    );
  }
  const weaknessCompetitorCount = uniqueCount(
    artifact.publicWeaknesses.items.map((i) => i.competitor),
  );
  if (weaknessCompetitorCount < 2) {
    errors.push(
      `publicWeaknesses.items: need weaknesses across >=2 competitors, have ${weaknessCompetitorCount}.`,
    );
  }

  if (artifact.narrativeArcs.arcs.length < 3) {
    errors.push(
      `narrativeArcs.arcs: have ${artifact.narrativeArcs.arcs.length}, need >=3 arcs.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
