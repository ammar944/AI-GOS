import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import {
  categoryPowerBetSchema,
  strategicInsightSchema,
  validateStrategicInsightMinimums,
  validateStrategicText,
} from "./strategic-insight";

const marketSizeSignalTypes = [
  "public-data",
  "funding-flow",
  "hiring-velocity",
  "search-trend",
  "analyst-report",
] as const;

const trajectories = ["expanding", "stable", "contracting", "unclear"] as const;

const structuralForceTypes = [
  "regulation",
  "platform-shift",
  "buyer-behavior",
] as const;

const maturityStages = [
  "emerging",
  "growing",
  "consolidating",
  "commoditizing",
] as const;

const maturitySignalTypes = [
  "player-count",
  "buyer-education",
  "feature-parity",
  "price-pressure",
  "platform-bundling",
] as const;

const methodologies = ["top-down", "bottom-up"] as const;
const bottomUpTamInputTypes = [
  "keyword-volume",
  "commercial-intent-share",
  "conversion-rate",
  "acv",
] as const;
const bottomUpTamInputStatuses = ["sourced", "evidence-gap"] as const;
const structuralForceImpacts = ["high", "medium", "low"] as const;
const structuralForceDirections = [
  "accelerating",
  "decelerating",
  "neutral",
] as const;
const validUrlPattern = /^https?:\/\/\S+\.\S+/;

export const adjacentCategorySchema = z
  .object({
    name: z.string().min(1),
    whyBuyersConfuseIt: z.string().min(1),
    disambiguatingSignal: z.string().min(1),
    sourceTitle: z.string().min(1).optional(),
    sourceUrl: z.string().min(1).optional(),
  })
  .strict();

export const marketSizeSignalSchema = z
  .object({
    signalType: z.enum(marketSizeSignalTypes),
    name: z.string().min(1),
    evidence: z.string().min(1),
    trajectory: z.enum(trajectories),
    methodology: z.enum(methodologies),
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().min(1),
    dateObserved: z.string().min(1),
  })
  .strict();

export const bottomUpTamInputSchema = z
  .object({
    inputType: z.enum(bottomUpTamInputTypes),
    label: z.string().min(1),
    value: z.string().min(1),
    status: z.enum(bottomUpTamInputStatuses),
    sourceTitle: z.string().min(1),
    sourceUrl: z.string().min(1).optional(),
    dateObserved: z.string().min(1),
  })
  .strict();

export const bottomUpTamSchema = z
  .object({
    recipeName: z.literal("keyword-demand-reachable-revenue"),
    formula: z.string().min(1),
    reachableRevenueEstimate: z.string().min(1),
    inputs: z.array(bottomUpTamInputSchema),
    caveats: z.array(z.string().min(1)),
  })
  .strict();

export const structuralForceSchema = z
  .object({
    forceType: z.enum(structuralForceTypes),
    name: z.string().min(1),
    evidence: z.string().min(1),
    implication: z.string().min(1),
    impact: z.enum(structuralForceImpacts),
    direction: z.enum(structuralForceDirections),
    sourceTitle: z.string().min(1).optional(),
    sourceUrl: z.string().min(1).optional(),
  })
  .strict();

export const maturitySignalSchema = z
  .object({
    signalType: z.enum(maturitySignalTypes),
    evidence: z.string().min(1),
    implication: z.string().min(1),
    sourceUrl: z.string().min(1).optional(),
  })
  .strict();

export const maturityClassificationSchema = z
  .object({
    stage: z.enum(maturityStages),
    evidenceSummary: z.string().min(1),
    supportingSignals: z.array(maturitySignalSchema),
  })
  .strict();

export const categoryDefinitionSchema = z
  .object({
    prose: z.string().min(1),
    adjacentCategories: z.array(adjacentCategorySchema),
  })
  .strict();

export const marketSizeSchema = z
  .object({
    prose: z.string().min(1),
    signals: z.array(marketSizeSignalSchema),
    bottomUpTam: bottomUpTamSchema,
  })
  .strict();

export const structuralForcesSchema = z
  .object({
    prose: z.string().min(1),
    forces: z.array(structuralForceSchema),
  })
  .strict();

export const categoryMaturitySchema = z
  .object({
    prose: z.string().min(1),
    classification: maturityClassificationSchema,
  })
  .strict();

export const marketCategoryBodySchema = z
  .object({
    strategicInsight: strategicInsightSchema,
    categoryPowerBet: categoryPowerBetSchema,
    categoryDefinition: categoryDefinitionSchema,
    marketSize: marketSizeSchema,
    structuralForces: structuralForcesSchema,
    categoryMaturity: categoryMaturitySchema,
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
  })
  .strict();

export const marketCategorySectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: marketCategoryBodySchema,
  })
  .strict();

export type MarketCategoryBody = z.infer<typeof marketCategoryBodySchema>;
export type MarketCategorySectionOutput = z.infer<
  typeof marketCategorySectionOutputSchema
>;
export type MarketCategoryArtifact = ArtifactEnvelope & {
  body: MarketCategoryBody;
};

export interface ValidationResult {
  ok: boolean;
  errors: string[];
}

function hasText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
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
  pushMissingText(errors, "sectionTitle", artifact.sectionTitle);
  pushMissingText(errors, "verdict", artifact.verdict);
  pushMissingText(errors, "statusSummary", artifact.statusSummary);
  pushMissingText(
    errors,
    "body.categoryDefinition.prose",
    artifact.body.categoryDefinition.prose,
  );
  pushMissingText(errors, "body.marketSize.prose", artifact.body.marketSize.prose);
  pushMissingText(
    errors,
    "body.structuralForces.prose",
    artifact.body.structuralForces.prose,
  );
  pushMissingText(
    errors,
    "body.categoryMaturity.prose",
    artifact.body.categoryMaturity.prose,
  );
  pushMissingText(
    errors,
    "body.categoryMaturity.classification.evidenceSummary",
    artifact.body.categoryMaturity.classification.evidenceSummary,
  );

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);

    if (!validUrlPattern.test(source.url)) {
      errors.push(`sources[${index}] (${source.title}): url is not a valid URL.`);
    }
  });

  artifact.body.categoryDefinition.adjacentCategories.forEach(
    (category, index) => {
      pushMissingText(
        errors,
        `body.categoryDefinition.adjacentCategories[${index}].name`,
        category.name,
      );
      pushMissingText(
        errors,
        `body.categoryDefinition.adjacentCategories[${index}].whyBuyersConfuseIt`,
        category.whyBuyersConfuseIt,
      );
      pushMissingText(
        errors,
        `body.categoryDefinition.adjacentCategories[${index}].disambiguatingSignal`,
        category.disambiguatingSignal,
      );

      if (category.sourceUrl !== undefined && !validUrlPattern.test(category.sourceUrl)) {
        errors.push(
          `body.categoryDefinition.adjacentCategories[${index}] (${category.name}): sourceUrl is not a valid URL.`,
        );
      }
    },
  );

  artifact.body.marketSize.signals.forEach((signal, index) => {
    pushMissingText(errors, `body.marketSize.signals[${index}].name`, signal.name);
    pushMissingText(
      errors,
      `body.marketSize.signals[${index}].evidence`,
      signal.evidence,
    );
    pushMissingText(
      errors,
      `body.marketSize.signals[${index}].sourceTitle`,
      signal.sourceTitle,
    );
    pushMissingText(
      errors,
      `body.marketSize.signals[${index}].sourceUrl`,
      signal.sourceUrl,
    );
    pushMissingText(
      errors,
      `body.marketSize.signals[${index}].dateObserved`,
      signal.dateObserved,
    );

    if (!validUrlPattern.test(signal.sourceUrl)) {
      errors.push(
        `body.marketSize.signals[${index}] (${signal.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  pushMissingText(
    errors,
    "body.marketSize.bottomUpTam.formula",
    artifact.body.marketSize.bottomUpTam.formula,
  );
  pushMissingText(
    errors,
    "body.marketSize.bottomUpTam.reachableRevenueEstimate",
    artifact.body.marketSize.bottomUpTam.reachableRevenueEstimate,
  );
  artifact.body.marketSize.bottomUpTam.inputs.forEach((input, index) => {
    pushMissingText(
      errors,
      `body.marketSize.bottomUpTam.inputs[${index}].label`,
      input.label,
    );
    pushMissingText(
      errors,
      `body.marketSize.bottomUpTam.inputs[${index}].value`,
      input.value,
    );
    pushMissingText(
      errors,
      `body.marketSize.bottomUpTam.inputs[${index}].sourceTitle`,
      input.sourceTitle,
    );
    pushMissingText(
      errors,
      `body.marketSize.bottomUpTam.inputs[${index}].dateObserved`,
      input.dateObserved,
    );

    if (input.status === "sourced") {
      pushMissingText(
        errors,
        `body.marketSize.bottomUpTam.inputs[${index}].sourceUrl`,
        input.sourceUrl,
      );

      if (input.sourceUrl !== undefined && !validUrlPattern.test(input.sourceUrl)) {
        errors.push(
          `body.marketSize.bottomUpTam.inputs[${index}] (${input.label}): sourceUrl is not a valid URL.`,
        );
      }
    } else if (!/evidence\s+gap/i.test(input.value)) {
      errors.push(
        `body.marketSize.bottomUpTam.inputs[${index}] (${input.label}): evidence-gap inputs must name the evidence gap in value.`,
      );
    }
  });

  artifact.body.structuralForces.forces.forEach((force, index) => {
    pushMissingText(
      errors,
      `body.structuralForces.forces[${index}].name`,
      force.name,
    );
    pushMissingText(
      errors,
      `body.structuralForces.forces[${index}].evidence`,
      force.evidence,
    );
    pushMissingText(
      errors,
      `body.structuralForces.forces[${index}].implication`,
      force.implication,
    );

    if (force.sourceUrl !== undefined && !validUrlPattern.test(force.sourceUrl)) {
      errors.push(
        `body.structuralForces.forces[${index}] (${force.name}): sourceUrl is not a valid URL.`,
      );
    }
  });

  artifact.body.categoryMaturity.classification.supportingSignals.forEach(
    (signal, index) => {
      pushMissingText(
        errors,
        `body.categoryMaturity.classification.supportingSignals[${index}].evidence`,
        signal.evidence,
      );
      pushMissingText(
        errors,
        `body.categoryMaturity.classification.supportingSignals[${index}].implication`,
        signal.implication,
      );

      if (signal.sourceUrl !== undefined && !validUrlPattern.test(signal.sourceUrl)) {
        errors.push(
          `body.categoryMaturity.classification.supportingSignals[${index}]: sourceUrl is not a valid URL.`,
        );
      }
    },
  );
}

export function validateMarketCategoryMinimums(
  artifact: ArtifactEnvelope & { body: MarketCategoryBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: marketCategoryBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  validateRequiredFields(parsedArtifact, errors);
  validateStrategicInsightMinimums(
    errors,
    "body.strategicInsight",
    parsedArtifact.body.strategicInsight,
    {
      comparisonTexts: [parsedArtifact.verdict, parsedArtifact.statusSummary],
    },
  );
  validateStrategicText(
    errors,
    "body.categoryPowerBet.bet",
    parsedArtifact.body.categoryPowerBet.bet,
  );
  validateStrategicText(
    errors,
    "body.categoryPowerBet.whyNow",
    parsedArtifact.body.categoryPowerBet.whyNow,
  );
  validateStrategicText(
    errors,
    "body.categoryPowerBet.riskAccepted",
    parsedArtifact.body.categoryPowerBet.riskAccepted,
  );

  if (parsedArtifact.sources.length < 3) {
    errors.push(
      `sources: have ${parsedArtifact.sources.length}, need >=3 Section-level sources.`,
    );
  }

  const adjacentCount =
    parsedArtifact.body.categoryDefinition.adjacentCategories.length;
  if (adjacentCount < 2) {
    errors.push(
      `body.categoryDefinition.adjacentCategories: have ${adjacentCount}, need >=2 categories buyers confuse this with.`,
    );
  }

  const marketSignalCount = parsedArtifact.body.marketSize.signals.length;
  if (marketSignalCount < 3) {
    errors.push(
      `body.marketSize.signals: have ${marketSignalCount}, need >=3 public trajectory signals.`,
    );
  }

  const marketSignalTypeValues = parsedArtifact.body.marketSize.signals.map(
    (signal) => signal.signalType,
  );
  for (const duplicate of findDuplicates(marketSignalTypeValues)) {
    errors.push(`body.marketSize.signals: duplicate signalType ${duplicate}.`);
  }

  const methodologyValues = parsedArtifact.body.marketSize.signals.map(
    (signal) => signal.methodology,
  );
  const hasTopDown = methodologyValues.includes("top-down");
  const hasBottomUp = methodologyValues.includes("bottom-up");
  if (!hasTopDown || !hasBottomUp) {
    errors.push(
      `body.marketSize.signals: triangulation required - need at least one top-down and one bottom-up methodology signal (have top-down=${hasTopDown}, bottom-up=${hasBottomUp}).`,
    );
  }

  const bottomUpInputTypes = parsedArtifact.body.marketSize.bottomUpTam.inputs.map(
    (input) => input.inputType,
  );
  const missingBottomUpInputTypes = bottomUpTamInputTypes.filter(
    (inputType) => !bottomUpInputTypes.includes(inputType),
  );
  if (missingBottomUpInputTypes.length > 0) {
    errors.push(
      `body.marketSize.bottomUpTam.inputs: missing input types ${missingBottomUpInputTypes.join(", ")}.`,
    );
  }
  for (const duplicate of findDuplicates(bottomUpInputTypes)) {
    errors.push(`body.marketSize.bottomUpTam.inputs: duplicate inputType ${duplicate}.`);
  }
  const hasBottomUpEvidenceGap =
    parsedArtifact.body.marketSize.bottomUpTam.inputs.some(
      (input) => input.status === "evidence-gap",
    );
  if (
    hasBottomUpEvidenceGap &&
    !/evidence\s+gap/i.test(
      parsedArtifact.body.marketSize.bottomUpTam.reachableRevenueEstimate,
    )
  ) {
    errors.push(
      "body.marketSize.bottomUpTam.reachableRevenueEstimate: must state an evidence gap when any recipe input is an evidence gap.",
    );
  }
  if (parsedArtifact.body.marketSize.bottomUpTam.caveats.length < 1) {
    errors.push("body.marketSize.bottomUpTam.caveats: have 0, need >=1 caveat.");
  }

  const forceCount = parsedArtifact.body.structuralForces.forces.length;
  if (forceCount < 3) {
    errors.push(
      `body.structuralForces.forces: have ${forceCount}, need >=3 forces covering regulation, platform-shift, and buyer-behavior.`,
    );
  }

  const observedForceTypes = parsedArtifact.body.structuralForces.forces.map(
    (force) => force.forceType,
  );
  const missingForceTypes = structuralForceTypes.filter(
    (forceType) => !observedForceTypes.includes(forceType),
  );
  if (missingForceTypes.length > 0) {
    errors.push(
      `body.structuralForces.forces: missing force types ${missingForceTypes.join(", ")}.`,
    );
  }
  for (const duplicate of findDuplicates(observedForceTypes)) {
    errors.push(`body.structuralForces.forces: duplicate forceType ${duplicate}.`);
  }

  const maturitySignalCount =
    parsedArtifact.body.categoryMaturity.classification.supportingSignals.length;
  if (maturitySignalCount < 2) {
    errors.push(
      `body.categoryMaturity.classification.supportingSignals: have ${maturitySignalCount}, need >=2 maturity signals.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
