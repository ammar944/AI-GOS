import { z } from 'zod';

import {
  SourceSchema,
  VALID_URL_PATTERN,
  type ValidationResult,
  findDuplicates,
  hasText,
  pushMissingText,
} from './_shared';

/**
 * Next.js-side mirror of the worker MarketCategoryArtifactSchema. The worker
 * source of truth is at research-worker/src/agents/subagents/schemas/
 * market-category.ts. This mirror exists because the Next.js process cannot
 * import from research-worker/ — schema evolution must update both files.
 */

const MARKET_SIZE_SIGNAL_TYPES = [
  'public-data',
  'funding-flow',
  'hiring-velocity',
  'search-trend',
  'analyst-report',
] as const;

const TRAJECTORIES = [
  'expanding',
  'stable',
  'contracting',
  'unclear',
] as const;

const STRUCTURAL_FORCE_TYPES = [
  'regulation',
  'platform-shift',
  'buyer-behavior',
] as const;

const MATURITY_STAGES = [
  'emerging',
  'growing',
  'consolidating',
  'commoditizing',
] as const;

const MATURITY_SIGNAL_TYPES = [
  'player-count',
  'buyer-education',
  'feature-parity',
  'price-pressure',
  'platform-bundling',
] as const;

const METHODOLOGIES = ['top-down', 'bottom-up'] as const;

const STRUCTURAL_FORCE_IMPACTS = ['high', 'medium', 'low'] as const;

const STRUCTURAL_FORCE_DIRECTIONS = [
  'accelerating',
  'decelerating',
  'neutral',
] as const;

export const AdjacentCategorySchema = z
  .object({
    name: z.string(),
    whyBuyersConfuseIt: z.string(),
    disambiguatingSignal: z.string(),
    sourceTitle: z.string().optional(),
    sourceUrl: z.string().optional(),
  })
  .describe('Adjacent category buyers confuse with the company category.');

export const MarketSizeSignalSchema = z
  .object({
    signalType: z.enum(MARKET_SIZE_SIGNAL_TYPES),
    name: z.string(),
    evidence: z.string(),
    trajectory: z.enum(TRAJECTORIES),
    methodology: z.enum(METHODOLOGIES),
    sourceTitle: z.string(),
    sourceUrl: z.string(),
    dateObserved: z.string(),
  })
  .describe('Market size or trajectory signal from public evidence.');

export const StructuralForceSchema = z
  .object({
    forceType: z.enum(STRUCTURAL_FORCE_TYPES),
    name: z.string(),
    evidence: z.string(),
    implication: z.string(),
    impact: z.enum(STRUCTURAL_FORCE_IMPACTS),
    direction: z.enum(STRUCTURAL_FORCE_DIRECTIONS),
    sourceTitle: z.string().optional(),
    sourceUrl: z.string().optional(),
  })
  .describe('Regulation, platform, or buyer-behavior force moving the market.');

export const MaturitySignalSchema = z
  .object({
    signalType: z.enum(MATURITY_SIGNAL_TYPES),
    evidence: z.string(),
    implication: z.string(),
    sourceUrl: z.string().optional(),
  })
  .describe('Evidence signal supporting the single maturity classification.');

export const MaturityClassificationSchema = z
  .object({
    stage: z.enum(MATURITY_STAGES),
    evidenceSummary: z.string(),
    supportingSignals: MaturitySignalSchema.array(),
  })
  .describe('One category maturity classification, not an array.');

export const CategoryDefinitionSchema = z.object({
  prose: z.string(),
  adjacentCategories: AdjacentCategorySchema.array(),
});

export const MarketSizeSchema = z.object({
  prose: z.string(),
  signals: MarketSizeSignalSchema.array(),
});

export const StructuralForcesSchema = z.object({
  prose: z.string(),
  forces: StructuralForceSchema.array(),
});

export const CategoryMaturitySchema = z.object({
  prose: z.string(),
  classification: MaturityClassificationSchema,
});

export const MarketCategoryArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    categoryDefinition: CategoryDefinitionSchema,
    marketSize: MarketSizeSchema,
    structuralForces: StructuralForcesSchema,
    categoryMaturity: CategoryMaturitySchema,
  })
  .describe('Complete Section 01 Market & Category Intelligence Artifact.');

export type MarketCategoryArtifact = z.infer<typeof MarketCategoryArtifactSchema>;

function validateRequiredFields(
  artifact: MarketCategoryArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  pushMissingText(errors, 'categoryDefinition.prose', artifact.categoryDefinition.prose);
  pushMissingText(errors, 'marketSize.prose', artifact.marketSize.prose);
  pushMissingText(errors, 'structuralForces.prose', artifact.structuralForces.prose);
  pushMissingText(errors, 'categoryMaturity.prose', artifact.categoryMaturity.prose);
  pushMissingText(
    errors,
    'categoryMaturity.classification.evidenceSummary',
    artifact.categoryMaturity.classification.evidenceSummary,
  );

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url) && !VALID_URL_PATTERN.test(source.url)) {
      errors.push(`sources[${index}] (${source.title}): url is not a valid URL.`);
    }
  });

  artifact.categoryDefinition.adjacentCategories.forEach((category, index) => {
    pushMissingText(errors, `adjacentCategories[${index}].name`, category.name);
    pushMissingText(
      errors,
      `adjacentCategories[${index}].whyBuyersConfuseIt`,
      category.whyBuyersConfuseIt,
    );
    pushMissingText(
      errors,
      `adjacentCategories[${index}].disambiguatingSignal`,
      category.disambiguatingSignal,
    );
    if (category.sourceUrl && !VALID_URL_PATTERN.test(category.sourceUrl)) {
      errors.push(
        `adjacentCategories[${index}] (${category.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  artifact.marketSize.signals.forEach((signal, index) => {
    pushMissingText(errors, `marketSize.signals[${index}].name`, signal.name);
    pushMissingText(errors, `marketSize.signals[${index}].evidence`, signal.evidence);
    pushMissingText(errors, `marketSize.signals[${index}].sourceTitle`, signal.sourceTitle);
    pushMissingText(errors, `marketSize.signals[${index}].sourceUrl`, signal.sourceUrl);
    pushMissingText(
      errors,
      `marketSize.signals[${index}].dateObserved`,
      signal.dateObserved,
    );
    if (hasText(signal.sourceUrl) && !VALID_URL_PATTERN.test(signal.sourceUrl)) {
      errors.push(
        `marketSize.signals[${index}] (${signal.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  artifact.structuralForces.forces.forEach((force, index) => {
    pushMissingText(errors, `structuralForces.forces[${index}].name`, force.name);
    pushMissingText(errors, `structuralForces.forces[${index}].evidence`, force.evidence);
    pushMissingText(
      errors,
      `structuralForces.forces[${index}].implication`,
      force.implication,
    );
    if (force.sourceUrl && !VALID_URL_PATTERN.test(force.sourceUrl)) {
      errors.push(
        `structuralForces.forces[${index}] (${force.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  artifact.categoryMaturity.classification.supportingSignals.forEach((signal, index) => {
    pushMissingText(
      errors,
      `categoryMaturity.classification.supportingSignals[${index}].evidence`,
      signal.evidence,
    );
    pushMissingText(
      errors,
      `categoryMaturity.classification.supportingSignals[${index}].implication`,
      signal.implication,
    );
    if (signal.sourceUrl && !VALID_URL_PATTERN.test(signal.sourceUrl)) {
      errors.push(
        `categoryMaturity.classification.supportingSignals[${index}]: sourceUrl is not a valid URL.`,
      );
    }
  });
}

export function validateMarketCategoryMinimums(
  artifact: MarketCategoryArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  if (artifact.sources.length < 3) {
    errors.push(`sources: have ${artifact.sources.length}, need >=3 Section-level sources.`);
  }

  if (artifact.categoryDefinition.adjacentCategories.length < 2) {
    errors.push(
      `adjacentCategories: have ${artifact.categoryDefinition.adjacentCategories.length}, need >=2 categories buyers confuse this with.`,
    );
  }

  if (artifact.marketSize.signals.length < 3) {
    errors.push(
      `marketSize.signals: have ${artifact.marketSize.signals.length}, need >=3 public trajectory signals.`,
    );
  }

  const marketSignalTypes = artifact.marketSize.signals.map((s) => s.signalType);
  for (const duplicate of findDuplicates(marketSignalTypes)) {
    errors.push(`marketSize.signals: duplicate signalType ${duplicate}.`);
  }

  const methodologies = artifact.marketSize.signals.map((s) => s.methodology);
  const hasTopDown = methodologies.includes('top-down');
  const hasBottomUp = methodologies.includes('bottom-up');
  if (!hasTopDown || !hasBottomUp) {
    errors.push(
      `marketSize.signals: triangulation required — need at least one top-down and one bottom-up methodology signal (have top-down=${hasTopDown}, bottom-up=${hasBottomUp}).`,
    );
  }

  if (artifact.structuralForces.forces.length < 3) {
    errors.push(
      `structuralForces: have ${artifact.structuralForces.forces.length}, need >=3 forces covering regulation, platform-shift, and buyer-behavior.`,
    );
  }

  const observedForceTypes = artifact.structuralForces.forces.map((f) => f.forceType);
  const missingForceTypes = STRUCTURAL_FORCE_TYPES.filter(
    (t) => !observedForceTypes.includes(t),
  );
  if (missingForceTypes.length > 0) {
    errors.push(`structuralForces: missing force types ${missingForceTypes.join(', ')}.`);
  }
  for (const duplicate of findDuplicates(observedForceTypes)) {
    errors.push(`structuralForces: duplicate forceType ${duplicate}.`);
  }

  if (artifact.categoryMaturity.classification.supportingSignals.length < 2) {
    errors.push(
      `categoryMaturity.classification.supportingSignals: have ${artifact.categoryMaturity.classification.supportingSignals.length}, need >=2 maturity signals.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
