import { z } from 'zod';

import { SourceSchema } from './_shared';

/**
 * Bespoke Section 03 Artifact schema for ADR-0002.
 *
 * Competitor Landscape & Positioning gathers competitive evidence with
 * research tools, then the runner calls
 * streamObject(CompetitorLandscapeArtifactSchema). Cardinality, confidence,
 * and coverage rules live in validateCompetitorLandscapeMinimums because
 * provider structured-output schemas reject Zod cardinality constraints.
 */

const COMPETITOR_TYPES = ['direct', 'indirect', 'status-quo', 'diy'] as const;

const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export const CompetitorSchema = z
  .object({
    name: z.string().describe('Competitor, substitute, status-quo, or DIY option name.'),
    url: z.string().describe('Canonical public URL for the competitor or substitute.'),
    competitorType: z
      .enum(COMPETITOR_TYPES)
      .describe('Competitive bucket: direct, indirect, status-quo, or diy.'),
    oneLinePositioning: z
      .string()
      .describe('One-line positioning summary in buyer-understandable language.'),
    verbatimHeroCopy: z
      .string()
      .describe('Verbatim homepage or campaign copy from the competitor. Preserve wording.'),
    pricingPosition: z
      .string()
      .describe('Pricing posture, packaging, or disclosure status.'),
    sourceUrl: z
      .string()
      .describe('Public source URL supporting the competitor entry.'),
  })
  .describe('One direct, indirect, status-quo, or DIY competitor entry.');

export const CompetitorPositionSchema = z
  .object({
    competitor: z.string().describe('Competitor name on this positioning axis.'),
    position: z
      .string()
      .describe('How the competitor positions itself on this axis.'),
  })
  .describe('Competitor position on one positioning taxonomy axis.');

export const PositioningAxisSchema = z
  .object({
    axisName: z.string().describe('Name of the positioning axis.'),
    ourPosition: z
      .string()
      .describe('How the audited company should be understood on this axis.'),
    competitorPositions: CompetitorPositionSchema.array().describe(
      'Competitor positions on this same axis.',
    ),
    evidenceUrl: z
      .string()
      .describe('Public URL supporting the axis or competitor-position evidence.'),
  })
  .describe('One positioning taxonomy axis across competitors.');

export const PricingDataPointSchema = z
  .object({
    competitor: z.string().describe('Competitor name with pricing evidence.'),
    tierName: z
      .string()
      .describe('Public tier name, package name, or gated pricing label.'),
    monthlyPrice: z
      .string()
      .describe('Monthly price as public text, gated, not disclosed, or source-specific text.'),
    packagingPattern: z
      .string()
      .describe('How the competitor packages the offer, e.g. per-seat, usage, bundle, or sales-led.'),
    gatedSignals: z
      .string()
      .describe('Signals that pricing is gated, enterprise-only, or not publicly disclosed.'),
    sourceUrl: z.string().describe('Public URL supporting the pricing data point.'),
  })
  .describe('Competitor pricing or packaging data point.');

export const ShareOfVoiceSliceSchema = z
  .object({
    surface: z
      .string()
      .describe('Search term, community, publication, review category, or ad surface.'),
    winner: z.string().describe('Competitor or category owner with strongest visible presence.'),
    evidence: z
      .string()
      .describe('Concrete evidence for who owns this surface.'),
    sourceUrl: z
      .string()
      .describe('Public URL supporting the share-of-voice slice.'),
  })
  .describe('One share-of-voice surface and the competitor that owns it.');

export const CompetitorWeaknessSchema = z
  .object({
    competitor: z.string().describe('Competitor the weakness or complaint concerns.'),
    verbatimQuote: z
      .string()
      .describe('Verbatim customer, review, community, or analyst quote. Preserve typos and caps.'),
    source: z.string().describe('Source name or surface for the quote.'),
    sourceUrl: z.string().describe('Public URL supporting the quote.'),
    whyItMatters: z
      .string()
      .describe('Why this weakness changes positioning or messaging strategy.'),
  })
  .describe('Public competitor weakness, complaint, or analyst-mentioned gap.');

export const NarrativeArcSchema = z
  .object({
    competitor: z.string().describe('Competitor whose narrative arc is summarized.'),
    villain: z.string().describe('Problem, enemy, or old way the competitor names.'),
    hero: z.string().describe('Hero mechanism, product, or new way the competitor claims.'),
    transformationClaim: z
      .string()
      .describe('After-state or transformation the competitor promises.'),
    sourceUrl: z
      .string()
      .describe('Public URL supporting the competitor narrative arc.'),
  })
  .describe('Competitor narrative arc: villain, hero, and transformation claim.');

export const CompetitorSetSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative full competitor set across direct, indirect, status-quo, and DIY.'),
    competitors: CompetitorSchema.array().describe(
      'Direct, indirect, status-quo, and DIY competitors or substitutes.',
    ),
  })
  .describe('Sub-section for the full competitor set.');

export const PositioningTaxonomySchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative positioning taxonomy across competitor problem and solution framing.'),
    axes: PositioningAxisSchema.array().describe(
      'Positioning axes showing how competitors frame problem and solution.',
    ),
  })
  .describe('Sub-section for positioning taxonomy.');

export const PricingRealitySchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative pricing reality, including public prices and gated signals.'),
    dataPoints: PricingDataPointSchema.array().describe(
      'Pricing, packaging, and gated-pricing evidence points.',
    ),
  })
  .describe('Sub-section for pricing reality.');

export const ShareOfVoiceSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative share-of-voice map across search, communities, and publications.'),
    slices: ShareOfVoiceSliceSchema.array().describe(
      'Surfaces where a competitor or category owner has visible share of voice.',
    ),
  })
  .describe('Sub-section for share of voice.');

export const PublicWeaknessesSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative public strengths and weaknesses from reviews, complaints, and analysts.'),
    items: CompetitorWeaknessSchema.array().describe(
      'Verbatim weakness, complaint, or analyst-gap evidence.',
    ),
  })
  .describe('Sub-section for public competitor weaknesses.');

export const NarrativeArcsSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative competitor arcs covering villain, hero, and transformation claim.'),
    arcs: NarrativeArcSchema.array().describe(
      'Competitor narrative arcs for the top competitive alternatives.',
    ),
  })
  .describe('Sub-section for competitor narrative arcs.');

export const CompetitorLandscapeArtifactSchema = z
  .object({
    sectionTitle: z
      .string()
      .describe('Section title, normally Competitor Landscape & Positioning.'),
    verdict: z
      .string()
      .describe('One-line judgment for Section 03 competitive positioning.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence opening summary for the Section.'),
    confidence: z
      .number()
      .describe('0-10 confidence score; range is enforced by runner validation.'),
    sources: SourceSchema.array().describe(
      'Best public sources supporting the Section-level competitive judgment.',
    ),
    competitorSet: CompetitorSetSchema.describe(
      'Full competitor set across direct, indirect, status-quo, and DIY.',
    ),
    positioningTaxonomy: PositioningTaxonomySchema.describe(
      'How competitors describe the problem and their solution.',
    ),
    pricingReality: PricingRealitySchema.describe(
      'Public pricing, gated-pricing signals, and packaging patterns.',
    ),
    shareOfVoice: ShareOfVoiceSchema.describe(
      'Share-of-voice map across search terms, communities, and publications.',
    ),
    publicWeaknesses: PublicWeaknessesSchema.describe(
      'Public strengths and weaknesses from reviews, complaints, and analysts.',
    ),
    narrativeArcs: NarrativeArcsSchema.describe(
      'Competitor villain, hero, and transformation-claim narratives.',
    ),
  })
  .describe('Complete Section 03 Competitor Landscape & Positioning Artifact.');

export type CompetitorLandscapeArtifact = z.infer<
  typeof CompetitorLandscapeArtifactSchema
>;

type ValidationResult = { ok: boolean; errors: string[] };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushMissingText(errors: string[], path: string, value: unknown): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values).size;
}

function validateUrl(errors: string[], path: string, url: string): void {
  if (!VALID_URL_PATTERN.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
}

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
  pushMissingText(
    errors,
    'positioningTaxonomy.prose',
    artifact.positioningTaxonomy.prose,
  );
  pushMissingText(errors, 'pricingReality.prose', artifact.pricingReality.prose);
  pushMissingText(errors, 'shareOfVoice.prose', artifact.shareOfVoice.prose);
  pushMissingText(errors, 'publicWeaknesses.prose', artifact.publicWeaknesses.prose);
  pushMissingText(errors, 'narrativeArcs.prose', artifact.narrativeArcs.prose);

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url)) {
      validateUrl(errors, `sources[${index}] (${source.title})`, source.url);
    }
  });

  artifact.competitorSet.competitors.forEach((competitor, index) => {
    pushMissingText(errors, `competitors[${index}].name`, competitor.name);
    pushMissingText(errors, `competitors[${index}].url`, competitor.url);
    pushMissingText(
      errors,
      `competitors[${index}].oneLinePositioning`,
      competitor.oneLinePositioning,
    );
    pushMissingText(
      errors,
      `competitors[${index}].verbatimHeroCopy`,
      competitor.verbatimHeroCopy,
    );
    pushMissingText(
      errors,
      `competitors[${index}].pricingPosition`,
      competitor.pricingPosition,
    );
    pushMissingText(errors, `competitors[${index}].sourceUrl`, competitor.sourceUrl);
    if (hasText(competitor.url)) {
      validateUrl(errors, `competitors[${index}] (${competitor.name}).url`, competitor.url);
    }
    if (hasText(competitor.sourceUrl)) {
      validateUrl(
        errors,
        `competitors[${index}] (${competitor.name}).sourceUrl`,
        competitor.sourceUrl,
      );
    }
  });

  artifact.positioningTaxonomy.axes.forEach((axis, index) => {
    pushMissingText(errors, `positioningTaxonomy.axes[${index}].axisName`, axis.axisName);
    pushMissingText(
      errors,
      `positioningTaxonomy.axes[${index}].ourPosition`,
      axis.ourPosition,
    );
    pushMissingText(
      errors,
      `positioningTaxonomy.axes[${index}].evidenceUrl`,
      axis.evidenceUrl,
    );
    if (hasText(axis.evidenceUrl)) {
      validateUrl(errors, `positioningTaxonomy.axes[${index}].evidenceUrl`, axis.evidenceUrl);
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

  artifact.pricingReality.dataPoints.forEach((point, index) => {
    pushMissingText(errors, `pricingReality.dataPoints[${index}].competitor`, point.competitor);
    pushMissingText(errors, `pricingReality.dataPoints[${index}].tierName`, point.tierName);
    pushMissingText(
      errors,
      `pricingReality.dataPoints[${index}].monthlyPrice`,
      point.monthlyPrice,
    );
    pushMissingText(
      errors,
      `pricingReality.dataPoints[${index}].packagingPattern`,
      point.packagingPattern,
    );
    pushMissingText(
      errors,
      `pricingReality.dataPoints[${index}].gatedSignals`,
      point.gatedSignals,
    );
    pushMissingText(errors, `pricingReality.dataPoints[${index}].sourceUrl`, point.sourceUrl);
    if (hasText(point.sourceUrl)) {
      validateUrl(errors, `pricingReality.dataPoints[${index}].sourceUrl`, point.sourceUrl);
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
    pushMissingText(
      errors,
      `publicWeaknesses.items[${index}].verbatimQuote`,
      item.verbatimQuote,
    );
    pushMissingText(errors, `publicWeaknesses.items[${index}].source`, item.source);
    pushMissingText(errors, `publicWeaknesses.items[${index}].sourceUrl`, item.sourceUrl);
    pushMissingText(
      errors,
      `publicWeaknesses.items[${index}].whyItMatters`,
      item.whyItMatters,
    );
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
}

export function validateCompetitorLandscapeMinimums(
  artifact: CompetitorLandscapeArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  const sourceCount = artifact.sources.length;
  if (sourceCount < 5) {
    errors.push(`sources: have ${sourceCount}, need >=5 Section-level sources.`);
  }

  const competitorCount = artifact.competitorSet.competitors.length;
  if (competitorCount < 5) {
    errors.push(
      `competitorSet.competitors: have ${competitorCount}, need >=5 competitors across direct, indirect, status-quo, and diy.`,
    );
  }

  const observedCompetitorTypes = artifact.competitorSet.competitors.map(
    (competitor) => competitor.competitorType,
  );
  const missingCompetitorTypes = COMPETITOR_TYPES.filter(
    (competitorType) => !observedCompetitorTypes.includes(competitorType),
  );
  if (missingCompetitorTypes.length > 0) {
    errors.push(
      `competitorSet.competitors: missing competitor types ${missingCompetitorTypes.join(', ')}.`,
    );
  }

  const axisCount = artifact.positioningTaxonomy.axes.length;
  if (axisCount < 3) {
    errors.push(`positioningTaxonomy.axes: have ${axisCount}, need >=3 axes.`);
  }

  const pricingPointCount = artifact.pricingReality.dataPoints.length;
  if (pricingPointCount < 3) {
    errors.push(
      `pricingReality.dataPoints: have ${pricingPointCount}, need >=3 pricing data points.`,
    );
  }
  const distinctPricingCompetitors = uniqueCount(
    artifact.pricingReality.dataPoints.map((point) => point.competitor),
  );
  if (distinctPricingCompetitors < 3) {
    errors.push(
      `pricingReality.dataPoints: need pricing evidence for >=3 distinct competitors, have ${distinctPricingCompetitors}.`,
    );
  }

  const shareOfVoiceCount = artifact.shareOfVoice.slices.length;
  if (shareOfVoiceCount < 3) {
    errors.push(`shareOfVoice.slices: have ${shareOfVoiceCount}, need >=3 surfaces.`);
  }

  const weaknessCount = artifact.publicWeaknesses.items.length;
  if (weaknessCount < 4) {
    errors.push(
      `publicWeaknesses.items: have ${weaknessCount}, need >=4 verbatim weaknesses.`,
    );
  }
  const weaknessCompetitorCount = uniqueCount(
    artifact.publicWeaknesses.items.map((item) => item.competitor),
  );
  if (weaknessCompetitorCount < 2) {
    errors.push(
      `publicWeaknesses.items: need weaknesses across >=2 competitors, have ${weaknessCompetitorCount}.`,
    );
  }

  const narrativeArcCount = artifact.narrativeArcs.arcs.length;
  if (narrativeArcCount < 3) {
    errors.push(`narrativeArcs.arcs: have ${narrativeArcCount}, need >=3 arcs.`);
  }

  return { ok: errors.length === 0, errors };
}
