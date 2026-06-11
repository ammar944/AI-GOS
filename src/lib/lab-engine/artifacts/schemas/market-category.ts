import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import {
  categoryPowerBetSchema,
  evidenceBlockGapSchema,
  keyFindingsSchema,
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
const directionalOnlyTamEstimate = "directional only — not computed";

const blockGapFieldSchema = evidenceBlockGapSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

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
  .strict()
  .superRefine((tam, context) => {
    const gapCount = tam.inputs.filter((input) => input.status === "evidence-gap").length;
    const computedRevenue = computeBottomUpTamRevenue(tam.inputs);

    if (
      gapCount >= 2 &&
      tam.reachableRevenueEstimate.trim() !== directionalOnlyTamEstimate
    ) {
      context.addIssue({
        code: "custom",
        message:
          `reachableRevenueEstimate must be exactly "${directionalOnlyTamEstimate}" when at least two TAM inputs are evidence gaps.`,
        path: ["reachableRevenueEstimate"],
      });
      return;
    }

    if (computedRevenue === null) {
      return;
    }

    const statedRevenue = parseMoneyLikeNumber(tam.reachableRevenueEstimate);
    if (statedRevenue === null) {
      context.addIssue({
        code: "custom",
        message:
          "reachableRevenueEstimate must include the computed bottom-up revenue when all TAM inputs are parseable.",
        path: ["reachableRevenueEstimate"],
      });
      return;
    }

    const larger = Math.max(statedRevenue, computedRevenue);
    const smaller = Math.min(statedRevenue, computedRevenue);
    const ratio = smaller === 0 ? Number.POSITIVE_INFINITY : larger / smaller;
    if (ratio > 2) {
      context.addIssue({
        code: "custom",
        message:
          `reachableRevenueEstimate is more than 2x away from the recorded TAM inputs; expected approximately ${formatTamRevenue(computedRevenue)}.`,
        path: ["reachableRevenueEstimate"],
      });
    }
  })
  .transform((tam) => {
    const gapCount = tam.inputs.filter((input) => input.status === "evidence-gap").length;
    const computedRevenue = computeBottomUpTamRevenue(tam.inputs);

    if (gapCount >= 2) {
      return {
        ...tam,
        reachableRevenueEstimate: directionalOnlyTamEstimate,
      };
    }

    if (computedRevenue === null) {
      return tam;
    }

    return {
      ...tam,
      reachableRevenueEstimate: `${formatTamRevenue(computedRevenue)} directional reachable revenue = monthly keyword volume x 12 x commercial-intent share x conversion rate x ACV.`,
    };
  });

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
    blockGap: blockGapFieldSchema,
  })
  .strict();

export const marketSizeSchema = z
  .object({
    prose: z.string().min(1),
    signals: z.array(marketSizeSignalSchema),
    bottomUpTam: bottomUpTamSchema,
    blockGap: blockGapFieldSchema,
  })
  .strict();

export const structuralForcesSchema = z
  .object({
    prose: z.string().min(1),
    forces: z.array(structuralForceSchema),
    blockGap: blockGapFieldSchema,
  })
  .strict();

export const categoryMaturitySchema = z
  .object({
    prose: z.string().min(1),
    classification: maturityClassificationSchema,
    blockGap: blockGapFieldSchema,
  })
  .strict();

export const marketCategoryBodySchema = z
  .object({
    keyFindings: keyFindingsSchema.optional(),
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
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
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

function hasBlockGap(block: { blockGap?: unknown }): boolean {
  return block.blockGap !== undefined;
}

function parseMoneyLikeNumber(value: string): number | null {
  const normalized = value.trim().toLowerCase();
  const match = /(?:\$)?\s*([0-9][0-9,]*(?:\.[0-9]+)?)(?:\s*([kmb])\b)?/.exec(normalized);

  if (match === null) {
    return null;
  }

  const rawNumber = Number(match[1].replace(/,/g, ""));
  if (!Number.isFinite(rawNumber)) {
    return null;
  }

  const multiplier = match[2] === "b"
    ? 1_000_000_000
    : match[2] === "m"
      ? 1_000_000
      : match[2] === "k"
        ? 1_000
        : 1;

  return rawNumber * multiplier;
}

function parsePercentLikeRate(value: string): number | null {
  const percentMatch = /([0-9][0-9,]*(?:\.[0-9]+)?)\s*%/.exec(value);
  if (percentMatch !== null) {
    const percent = Number(percentMatch[1].replace(/,/g, ""));
    return Number.isFinite(percent) ? percent / 100 : null;
  }

  const decimalMatch = /([0-9](?:\.[0-9]+)?)/.exec(value);
  if (decimalMatch === null) {
    return null;
  }

  const decimal = Number(decimalMatch[1]);
  return Number.isFinite(decimal) && decimal <= 1 ? decimal : null;
}

function findTamInputValue(
  inputs: readonly z.infer<typeof bottomUpTamInputSchema>[],
  inputType: (typeof bottomUpTamInputTypes)[number],
): string | null {
  const input = inputs.find((candidate) => candidate.inputType === inputType);
  return input?.status === "sourced" ? input.value : null;
}

function computeBottomUpTamRevenue(
  inputs: readonly z.infer<typeof bottomUpTamInputSchema>[],
): number | null {
  const keywordVolume = parseMoneyLikeNumber(
    findTamInputValue(inputs, "keyword-volume") ?? "",
  );
  const commercialIntentShare = parsePercentLikeRate(
    findTamInputValue(inputs, "commercial-intent-share") ?? "",
  );
  const conversionRate = parsePercentLikeRate(
    findTamInputValue(inputs, "conversion-rate") ?? "",
  );
  const acv = parseMoneyLikeNumber(findTamInputValue(inputs, "acv") ?? "");

  if (
    keywordVolume === null ||
    commercialIntentShare === null ||
    conversionRate === null ||
    acv === null
  ) {
    return null;
  }

  return keywordVolume * 12 * commercialIntentShare * conversionRate * acv;
}

function formatTamRevenue(value: number): string {
  if (value >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2).replace(/\.00$/, "")}B`;
  }
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2).replace(/\.00$/, "")}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1).replace(/\.0$/, "")}K`;
  }

  return `$${Math.round(value).toLocaleString("en-US")}`;
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
  if (adjacentCount < 2 && !hasBlockGap(parsedArtifact.body.categoryDefinition)) {
    errors.push(
      `body.categoryDefinition.adjacentCategories: have ${adjacentCount}, need >=2 categories buyers confuse this with.`,
    );
  }

  const marketSignalCount = parsedArtifact.body.marketSize.signals.length;
  if (marketSignalCount < 2 && !hasBlockGap(parsedArtifact.body.marketSize)) {
    errors.push(
      `body.marketSize.signals: have ${marketSignalCount}, need >=2 public trajectory signals or body.marketSize.blockGap.`,
    );
  }

  const marketSignalTypeValues = parsedArtifact.body.marketSize.signals.map(
    (signal) => signal.signalType,
  );
  for (const duplicate of findDuplicates(marketSignalTypeValues)) {
    errors.push(`body.marketSize.signals: duplicate signalType ${duplicate}.`);
  }

  const marketSizeHasBlockGap = hasBlockGap(parsedArtifact.body.marketSize);
  const bottomUpInputTypes =
    parsedArtifact.body.marketSize.bottomUpTam.inputs.map((input) => input.inputType);
  const missingBottomUpInputTypes = bottomUpTamInputTypes.filter(
    (inputType) => !bottomUpInputTypes.includes(inputType),
  );
  if (!marketSizeHasBlockGap && missingBottomUpInputTypes.length > 0) {
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
  const bottomUpEvidenceGapCount =
    parsedArtifact.body.marketSize.bottomUpTam.inputs.filter(
      (input) => input.status === "evidence-gap",
    ).length;
  const computedBottomUpRevenue = computeBottomUpTamRevenue(
    parsedArtifact.body.marketSize.bottomUpTam.inputs,
  );
  if (
    bottomUpEvidenceGapCount >= 2 &&
    parsedArtifact.body.marketSize.bottomUpTam.reachableRevenueEstimate !==
      directionalOnlyTamEstimate
  ) {
    errors.push(
      `body.marketSize.bottomUpTam.reachableRevenueEstimate: must be exactly "${directionalOnlyTamEstimate}" when at least two recipe inputs are evidence gaps.`,
    );
  }
  if (
    hasBottomUpEvidenceGap &&
    bottomUpEvidenceGapCount < 2 &&
    !/evidence\s+gap/i.test(
      parsedArtifact.body.marketSize.bottomUpTam.reachableRevenueEstimate,
    )
  ) {
    errors.push(
      "body.marketSize.bottomUpTam.reachableRevenueEstimate: must state an evidence gap when any recipe input is an evidence gap.",
    );
  }
  if (computedBottomUpRevenue !== null) {
    const statedRevenue = parseMoneyLikeNumber(
      parsedArtifact.body.marketSize.bottomUpTam.reachableRevenueEstimate,
    );
    if (statedRevenue === null) {
      errors.push(
        "body.marketSize.bottomUpTam.reachableRevenueEstimate: must include the computed bottom-up revenue.",
      );
    } else {
      const larger = Math.max(statedRevenue, computedBottomUpRevenue);
      const smaller = Math.min(statedRevenue, computedBottomUpRevenue);
      const ratio = smaller === 0 ? Number.POSITIVE_INFINITY : larger / smaller;
      if (ratio > 2) {
        errors.push(
          `body.marketSize.bottomUpTam.reachableRevenueEstimate: more than 2x away from recorded inputs; expected approximately ${formatTamRevenue(computedBottomUpRevenue)}.`,
        );
      }
    }
  }
  if (parsedArtifact.body.marketSize.bottomUpTam.caveats.length < 1) {
    errors.push("body.marketSize.bottomUpTam.caveats: have 0, need >=1 caveat.");
  }

  const forceCount = parsedArtifact.body.structuralForces.forces.length;
  if (forceCount < 1 && !hasBlockGap(parsedArtifact.body.structuralForces)) {
    errors.push(
      `body.structuralForces.forces: have ${forceCount}, need >=1 structural force with evidence or body.structuralForces.blockGap.`,
    );
  }

  const observedForceTypes = parsedArtifact.body.structuralForces.forces.map(
    (force) => force.forceType,
  );
  for (const duplicate of findDuplicates(observedForceTypes)) {
    errors.push(`body.structuralForces.forces: duplicate forceType ${duplicate}.`);
  }

  const maturitySignalCount =
    parsedArtifact.body.categoryMaturity.classification.supportingSignals.length;
  if (maturitySignalCount < 2 && !hasBlockGap(parsedArtifact.body.categoryMaturity)) {
    errors.push(
      `body.categoryMaturity.classification.supportingSignals: have ${maturitySignalCount}, need >=2 maturity signals.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
