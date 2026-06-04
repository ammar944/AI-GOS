import { z } from "zod";

export const keyTensionSchema = z
  .object({
    tension: z.string().min(1),
    side: z.string().min(1),
    costOfPosition: z.string().min(1),
  })
  .strict();

export const strategicInsightSchema = z
  .object({
    strategicVerdict: z.string().min(1),
    nonObviousRead: z.string().min(1),
    secondOrderImplication: z.string().min(1),
    keyTension: keyTensionSchema,
  })
  .strict();

export const categoryPowerBetSchema = z
  .object({
    bet: z.string().min(1),
    whyNow: z.string().min(1),
    riskAccepted: z.string().min(1),
  })
  .strict();

export const whereToAttackVsConcedeSchema = z
  .object({
    attack: z.string().min(1),
    concede: z.string().min(1),
    rationale: z.string().min(1),
  })
  .strict();

export const incumbentBlindSpotSchema = z
  .object({
    incumbent: z.string().min(1),
    blindSpot: z.string().min(1),
    whyTheyMissIt: z.string().min(1),
  })
  .strict();

export const fourForcesBalanceVerdictSchema = z
  .object({
    push: z.string().min(1),
    pull: z.string().min(1),
    anxiety: z.string().min(1),
    habit: z.string().min(1),
    balanceVerdict: z.string().min(1),
  })
  .strict();

export const orderedStrategicMoveSchema = z
  .object({
    rank: z.number().int().positive(),
    move: z.string().min(1),
    dependsOn: z.array(z.number().int().positive()),
    rationale: z.string().min(1),
  })
  .strict();

export const provesWrongIfSchema = z
  .object({
    metric: z.string().min(1),
    threshold: z.string().min(1),
    window: z.string().min(1),
  })
  .strict();

export const bindingConstraintSchema = z
  .object({
    constraint: z.string().min(1),
    whyBinding: z.string().min(1),
    unlockCondition: z.string().min(1),
  })
  .strict();

export type StrategicInsight = z.infer<typeof strategicInsightSchema>;
export type OrderedStrategicMove = z.infer<typeof orderedStrategicMoveSchema>;
export type ProvesWrongIf = z.infer<typeof provesWrongIfSchema>;

interface StrategicTextValidationOptions {
  comparisonTexts?: readonly string[];
}

const vacuousTextPattern =
  /\b(?:summary|summarizes|this section|generic strategy|strategic opportunity|improve messaging|better positioning|clearer narrative|drive growth|increase conversion|optimize funnel|win buyers|focus on the (?:right|best|most important)|differentiate (?:itself|the company))\b/i;
const stopWords = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "by",
  "for",
  "from",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "the",
  "to",
  "with",
]);

function isEvidenceGap(value: string): boolean {
  return /^evidence\s+gap:/i.test(value.trim());
}

function normalizeForComparison(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function contentTokens(value: string): string[] {
  return normalizeForComparison(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !stopWords.has(token));
}

function tokenOverlapRatio(a: string, b: string): number {
  const aTokens = new Set(contentTokens(a));
  const bTokens = new Set(contentTokens(b));

  if (aTokens.size === 0 || bTokens.size === 0) {
    return 0;
  }

  let overlap = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      overlap += 1;
    }
  }

  return overlap / Math.min(aTokens.size, bTokens.size);
}

function isNearDuplicateOfComparison(
  value: string,
  comparisonTexts: readonly string[] | undefined,
): boolean {
  const normalizedValue = normalizeForComparison(value);

  return (comparisonTexts ?? []).some((comparisonText) => {
    const normalizedComparison = normalizeForComparison(comparisonText);

    if (
      normalizedValue.length > 0 &&
      (normalizedComparison === normalizedValue ||
        normalizedComparison.includes(normalizedValue) ||
        normalizedValue.includes(normalizedComparison))
    ) {
      return true;
    }

    return tokenOverlapRatio(value, comparisonText) >= 0.82;
  });
}

function isStrategicText(
  value: string,
  options: StrategicTextValidationOptions = {},
): boolean {
  const trimmed = value.trim();

  if (isEvidenceGap(trimmed)) {
    return true;
  }

  return (
    trimmed.length >= 32 &&
    !vacuousTextPattern.test(trimmed) &&
    !isNearDuplicateOfComparison(trimmed, options.comparisonTexts)
  );
}

function isFalsifiabilityText(value: string): boolean {
  const trimmed = value.trim();

  if (isEvidenceGap(trimmed)) {
    return true;
  }

  return (
    trimmed.length >= 2 &&
    !/^(?:unknown|not disclosed|n\/a|none)$/i.test(trimmed)
  );
}

export function validateStrategicText(
  errors: string[],
  path: string,
  value: string,
  options: StrategicTextValidationOptions = {},
): void {
  if (!isStrategicText(value, options)) {
    errors.push(
      `${path}: must be a specific strategic judgment or explicit evidence gap, not a summary/restatement.`,
    );
  }
}

export function validateStrategicInsightMinimums(
  errors: string[],
  path: string,
  insight: StrategicInsight,
  options: StrategicTextValidationOptions = {},
): void {
  const entries = [
    ["strategicVerdict", insight.strategicVerdict],
    ["nonObviousRead", insight.nonObviousRead],
    ["secondOrderImplication", insight.secondOrderImplication],
    ["keyTension.tension", insight.keyTension.tension],
    ["keyTension.side", insight.keyTension.side],
    ["keyTension.costOfPosition", insight.keyTension.costOfPosition],
  ] as const;
  const observed = new Map<string, string>();

  entries.forEach(([key, value]) => {
    const normalized = normalizeForComparison(value);

    if (!isEvidenceGap(value) && observed.has(normalized)) {
      errors.push(
        `${path}.${key}: duplicates ${path}.${observed.get(normalized)}; strategic fields must make distinct judgments.`,
      );
      return;
    }

    observed.set(normalized, key);
  });

  validateStrategicText(
    errors,
    `${path}.strategicVerdict`,
    insight.strategicVerdict,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.nonObviousRead`,
    insight.nonObviousRead,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.secondOrderImplication`,
    insight.secondOrderImplication,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.keyTension.tension`,
    insight.keyTension.tension,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.keyTension.side`,
    insight.keyTension.side,
    options,
  );
  validateStrategicText(
    errors,
    `${path}.keyTension.costOfPosition`,
    insight.keyTension.costOfPosition,
    options,
  );
}

export function validateOrderedStrategicMovesMinimums(
  errors: string[],
  path: string,
  moves: readonly OrderedStrategicMove[],
): void {
  if (moves.length < 2) {
    errors.push(`${path}: have ${moves.length}, need >=2 sequenced moves.`);
  }

  const ranks = moves.map((move) => move.rank);
  const sortedRanks = [...ranks].sort((a, b) => a - b);
  const duplicateRanks = ranks.filter(
    (rank, index) => ranks.indexOf(rank) !== index,
  );

  if (duplicateRanks.length > 0) {
    errors.push(`${path}: duplicate rank values ${Array.from(new Set(duplicateRanks)).join(", ")}.`);
  }
  sortedRanks.forEach((rank, index) => {
    const expectedRank = index + 1;

    if (rank !== expectedRank) {
      errors.push(`${path}: ranks must be consecutive starting at 1.`);
    }
  });

  moves.forEach((move, index) => {
    validateStrategicText(errors, `${path}[${index}].move`, move.move);
    validateStrategicText(errors, `${path}[${index}].rationale`, move.rationale);

    if (move.rank === 1 && move.dependsOn.length > 0) {
      errors.push(`${path}[${index}].dependsOn: first-ranked move must not depend on another move.`);
    }

    const invalidDependencies = move.dependsOn.filter(
      (dependency) => dependency >= move.rank || !ranks.includes(dependency),
    );
    if (invalidDependencies.length > 0) {
      errors.push(
        `${path}[${index}].dependsOn: dependencies must reference lower existing ranks.`,
      );
    }
  });
}

export function validateProvesWrongIfMinimums(
  errors: string[],
  path: string,
  provesWrongIf: ProvesWrongIf,
): void {
  for (const [key, value] of Object.entries(provesWrongIf)) {
    if (!isFalsifiabilityText(value)) {
      errors.push(
        `${path}.${key}: must be a concrete falsifiability ${key} or explicit evidence gap.`,
      );
    }
  }
}
