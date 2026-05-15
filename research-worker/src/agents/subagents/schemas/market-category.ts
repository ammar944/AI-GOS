import { z } from 'zod';

import { SourceSchema } from './_shared';

/**
 * Bespoke Section 01 Artifact schema for ADR-0002.
 *
 * Market & Category Intelligence gathers evidence with research tools, then
 * the runner calls streamObject(MarketCategoryArtifactSchema). Cardinality
 * and confidence range checks live in validateMarketCategoryMinimums because
 * provider structured-output schemas reject Zod cardinality constraints.
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

const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export const AdjacentCategorySchema = z
  .object({
    name: z.string().describe('Adjacent category buyers may confuse with this market.'),
    whyBuyersConfuseIt: z
      .string()
      .describe('Why this adjacent category creates buyer confusion.'),
    disambiguatingSignal: z
      .string()
      .describe('Signal that separates this category from the adjacent category.'),
    sourceTitle: z
      .string()
      .optional()
      .describe('Named source supporting the adjacent-category comparison.'),
    sourceUrl: z
      .string()
      .optional()
      .describe('Public URL supporting the adjacent-category comparison.'),
  })
  .describe('Adjacent category buyers confuse with the company category.');

export const MarketSizeSignalSchema = z
  .object({
    signalType: z
      .enum(MARKET_SIZE_SIGNAL_TYPES)
      .describe('Type of market-size or trajectory signal.'),
    name: z.string().describe('Short name for the market-size signal.'),
    evidence: z
      .string()
      .describe('Public evidence behind the market-size or trajectory signal.'),
    trajectory: z
      .enum(TRAJECTORIES)
      .describe('Directional read implied by this signal.'),
    methodology: z
      .enum(METHODOLOGIES)
      .describe(
        'Analytical posture: top-down (pre-aggregated views like analyst reports or public market data) or bottom-up (raw activity signals like hiring velocity, search trends, or funding flows). At least one of each is required for triangulation.',
      ),
    sourceTitle: z.string().describe('Named source for this signal.'),
    sourceUrl: z.string().describe('Public URL supporting this signal.'),
    dateObserved: z
      .string()
      .describe('YYYY-MM-DD date when the agent observed this signal.'),
  })
  .describe('Market size or trajectory signal from public evidence.');

export const StructuralForceSchema = z
  .object({
    forceType: z
      .enum(STRUCTURAL_FORCE_TYPES)
      .describe('Structural force type moving the market.'),
    name: z.string().describe('Named market force.'),
    evidence: z.string().describe('Evidence that this force is active.'),
    implication: z
      .string()
      .describe('Strategic implication for positioning or GTM execution.'),
    impact: z
      .enum(STRUCTURAL_FORCE_IMPACTS)
      .describe(
        'Strength of impact on the market: high, medium, or low. High means the force materially reshapes positioning or GTM choices in the next 4 quarters.',
      ),
    direction: z
      .enum(STRUCTURAL_FORCE_DIRECTIONS)
      .describe(
        'Whether the force is accelerating category growth, decelerating it, or neutral. Decelerating forces still belong in the analysis — they shape the category as much as growth forces.',
      ),
    sourceTitle: z
      .string()
      .optional()
      .describe('Named source supporting this structural force.'),
    sourceUrl: z
      .string()
      .optional()
      .describe('Public URL supporting this structural force.'),
  })
  .describe('Regulation, platform, or buyer-behavior force moving the market.');

export const MaturitySignalSchema = z
  .object({
    signalType: z
      .enum(MATURITY_SIGNAL_TYPES)
      .describe('Signal used to support the maturity classification.'),
    evidence: z
      .string()
      .describe('Public evidence supporting the maturity signal.'),
    implication: z
      .string()
      .describe('What this signal implies about category maturity.'),
    sourceUrl: z
      .string()
      .optional()
      .describe('Public URL supporting this maturity signal.'),
  })
  .describe('Evidence signal supporting the single maturity classification.');

export const MaturityClassificationSchema = z
  .object({
    stage: z
      .enum(MATURITY_STAGES)
      .describe('Single category maturity classification.'),
    evidenceSummary: z
      .string()
      .describe('Why this maturity stage fits the category evidence.'),
    supportingSignals: MaturitySignalSchema.array().describe(
      'Signals that justify the single maturity classification.',
    ),
  })
  .describe('One category maturity classification, not an array.');

export const CategoryDefinitionSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative category definition and boundary explanation.'),
    adjacentCategories: AdjacentCategorySchema.array().describe(
      'Adjacent categories buyers confuse with this category.',
    ),
  })
  .describe('Sub-section for category definition and adjacent categories.');

export const MarketSizeSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative market size and trajectory interpretation.'),
    signals: MarketSizeSignalSchema.array().describe(
      'Public-data, funding, hiring, and search-trend trajectory signals.',
    ),
  })
  .describe('Sub-section for market size and trajectory signals.');

export const StructuralForcesSchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative explanation of structural forces moving the market.'),
    forces: StructuralForceSchema.array().describe(
      'Regulation, platform, and buyer-behavior forces moving the market.',
    ),
  })
  .describe('Sub-section for structural market forces.');

export const CategoryMaturitySchema = z
  .object({
    prose: z
      .string()
      .describe('Narrative category maturity judgment with evidence caveats.'),
    classification: MaturityClassificationSchema.describe(
      'Single maturity classification object for the category.',
    ),
  })
  .describe('Sub-section for category maturity.');

export const MarketCategoryArtifactSchema = z
  .object({
    sectionTitle: z
      .string()
      .describe('Section title, normally Market & Category Intelligence.'),
    verdict: z
      .string()
      .describe('One-line judgment for Section 01 market and category dynamics.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence opening summary for the Section.'),
    confidence: z
      .number()
      .describe('0-10 confidence score; range is enforced by runner validation.'),
    sources: SourceSchema.array().describe(
      'Best public sources supporting the Section-level judgment.',
    ),
    categoryDefinition: CategoryDefinitionSchema.describe(
      'Category definition and adjacent categories buyers confuse it with.',
    ),
    marketSize: MarketSizeSchema.describe(
      'Market size and trajectory signals from public evidence.',
    ),
    structuralForces: StructuralForcesSchema.describe(
      'Structural forces moving the market.',
    ),
    categoryMaturity: CategoryMaturitySchema.describe(
      'Single category maturity classification with evidence.',
    ),
  })
  .describe('Complete Section 01 Market & Category Intelligence Artifact.');

export type MarketCategoryArtifact = z.infer<typeof MarketCategoryArtifactSchema>;

type ValidationResult = { ok: boolean; errors: string[] };

function hasText(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushMissingText(
  errors: string[],
  path: string,
  value: unknown,
): void {
  if (!hasText(value)) {
    errors.push(`${path}: required field missing.`);
  }
}

function findDuplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {
      duplicates.add(value);
    }
    seen.add(value);
  }
  return Array.from(duplicates);
}

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
    if (!VALID_URL_PATTERN.test(source.url)) {
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
    pushMissingText(
      errors,
      `marketSize.signals[${index}].sourceTitle`,
      signal.sourceTitle,
    );
    pushMissingText(
      errors,
      `marketSize.signals[${index}].sourceUrl`,
      signal.sourceUrl,
    );
    pushMissingText(
      errors,
      `marketSize.signals[${index}].dateObserved`,
      signal.dateObserved,
    );
    if (!VALID_URL_PATTERN.test(signal.sourceUrl)) {
      errors.push(
        `marketSize.signals[${index}] (${signal.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  artifact.structuralForces.forces.forEach((force, index) => {
    pushMissingText(errors, `structuralForces.forces[${index}].name`, force.name);
    pushMissingText(
      errors,
      `structuralForces.forces[${index}].evidence`,
      force.evidence,
    );
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

  artifact.categoryMaturity.classification.supportingSignals.forEach(
    (signal, index) => {
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
    },
  );
}

export function validateMarketCategoryMinimums(
  artifact: MarketCategoryArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  const sourceCount = artifact.sources.length;
  if (sourceCount < 3) {
    errors.push(`sources: have ${sourceCount}, need >=3 Section-level sources.`);
  }

  const adjacentCount = artifact.categoryDefinition.adjacentCategories.length;
  if (adjacentCount < 2) {
    errors.push(
      `adjacentCategories: have ${adjacentCount}, need >=2 categories buyers confuse this with.`,
    );
  }

  const marketSignalCount = artifact.marketSize.signals.length;
  if (marketSignalCount < 3) {
    errors.push(
      `marketSize.signals: have ${marketSignalCount}, need >=3 public trajectory signals.`,
    );
  }

  const marketSignalTypes = artifact.marketSize.signals.map(
    (signal) => signal.signalType,
  );
  for (const duplicate of findDuplicates(marketSignalTypes)) {
    errors.push(`marketSize.signals: duplicate signalType ${duplicate}.`);
  }

  const methodologies = artifact.marketSize.signals.map(
    (signal) => signal.methodology,
  );
  const hasTopDown = methodologies.includes('top-down');
  const hasBottomUp = methodologies.includes('bottom-up');
  if (!hasTopDown || !hasBottomUp) {
    errors.push(
      `marketSize.signals: triangulation required — need at least one top-down and one bottom-up methodology signal (have top-down=${hasTopDown}, bottom-up=${hasBottomUp}).`,
    );
  }

  const forceCount = artifact.structuralForces.forces.length;
  if (forceCount < 3) {
    errors.push(
      `structuralForces: have ${forceCount}, need >=3 forces covering regulation, platform-shift, and buyer-behavior.`,
    );
  }

  const observedForceTypes = artifact.structuralForces.forces.map(
    (force) => force.forceType,
  );
  const missingForceTypes = STRUCTURAL_FORCE_TYPES.filter(
    (forceType) => !observedForceTypes.includes(forceType),
  );
  if (missingForceTypes.length > 0) {
    errors.push(`structuralForces: missing force types ${missingForceTypes.join(', ')}.`);
  }
  for (const duplicate of findDuplicates(observedForceTypes)) {
    errors.push(`structuralForces: duplicate forceType ${duplicate}.`);
  }

  const maturitySignalCount =
    artifact.categoryMaturity.classification.supportingSignals.length;
  if (maturitySignalCount < 2) {
    errors.push(
      `categoryMaturity.classification.supportingSignals: have ${maturitySignalCount}, need >=2 maturity signals.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
