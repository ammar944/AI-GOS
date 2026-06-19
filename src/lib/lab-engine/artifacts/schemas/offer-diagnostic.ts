import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  bindingConstraintSchema,
  blockCoverageSchema,
  evidenceBlockGapFieldSchema,
  evidenceBlockGapSchema,
  evidenceTierSchema,
  keyFindingsSchema,
  orderedStrategicMoveSchema,
  provesWrongIfSchema,
  rowVerificationSchema,
  strategicInsightSchema,
  validateOrderedStrategicMovesMinimums,
  validateProvesWrongIfMinimums,
  validateStrategicInsightMinimums,
  validateStrategicText,
} from "./strategic-insight";

const reportedByValues = ["company-own", "external-source"] as const;
const confidenceValues = ["high", "medium", "low"] as const;
const channelWorkedValues = ["yes", "partial", "no", "unknown"] as const;
const retentionSignalTypes = [
  "activation",
  "retention",
  "first-value-moment",
] as const;
const severityValues = ["high", "medium", "low"] as const;
const blockGapFieldSchema = evidenceBlockGapFieldSchema;

const evidenceTierFieldSchema = evidenceTierSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const rowVerificationFieldSchema = rowVerificationSchema
  .unwrap()
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const blockCoverageFieldSchema = blockCoverageSchema
  .nullable()
  .transform((value) => value ?? undefined)
  .optional();

const fitProofPointSchema = z
  .object({
    metric: z.string().min(1),
    value: z.string().min(1),
    reportedBy: z.enum(reportedByValues),
    confidence: z.enum(confidenceValues),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const funnelBreakSchema = z
  .object({
    stageName: z.string().min(1),
    metric: z.string().min(1),
    magnitude: z.string().min(1),
    hypothesis: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const channelEvidenceSchema = z
  .object({
    channelName: z.string().min(1),
    hasWorked: z.enum(channelWorkedValues),
    quantifiedEvidence: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const retentionSignalSchema = z
  .object({
    signalType: z.enum(retentionSignalTypes),
    metric: z.string().min(1),
    value: z.string().min(1),
    sourceUrl: z.string().min(1),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

const redFlagSchema = z
  .object({
    claimedMotion: z.string().min(1),
    actualEvidence: z.string().min(1),
    contradiction: z.string().min(1),
    severity: z.enum(severityValues),
    evidenceTier: evidenceTierFieldSchema,
    verification: rowVerificationFieldSchema,
  })
  .strict();

export const offerDiagnosticBodySchema = z
  .object({
    keyFindings: keyFindingsSchema.nullable().transform((value) => value ?? undefined).optional(),
    strategicInsight: strategicInsightSchema,
    orderedMoves: z.array(orderedStrategicMoveSchema),
    provesWrongIf: provesWrongIfSchema,
    singleBindingConstraint: bindingConstraintSchema,
    offerMarketFit: z
      .object({
        prose: z.string().min(1),
        proofPoints: z.array(fitProofPointSchema),
        blockGap: blockGapFieldSchema,
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
    funnelDiagnosis: z
      .object({
        prose: z.string().min(1),
        breaks: z.array(funnelBreakSchema),
        blockGap: blockGapFieldSchema,
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
    channelTruth: z
      .object({
        prose: z.string().min(1),
        channels: z.array(channelEvidenceSchema),
        blockGap: blockGapFieldSchema,
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
    retentionHealth: z
      .object({
        prose: z.string().min(1),
        signals: z.array(retentionSignalSchema),
        blockGap: blockGapFieldSchema,
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
    redFlags: z
      .object({
        prose: z.string().min(1),
        items: z.array(redFlagSchema),
        blockGap: blockGapFieldSchema,
        coverage: blockCoverageFieldSchema,
      })
      .strict(),
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).nullable().transform((value) => value ?? undefined).optional(),
  })
  .strict();

export const offerDiagnosticSectionOutputSchema = z
  .object({
    sectionTitle: z.string().min(1),
    verdict: z.string().min(1),
    statusSummary: z.string().min(1),
    confidence: z.number().min(0).max(1),
    sources: z.array(modelSourceSchema).min(1),
    body: offerDiagnosticBodySchema,
  })
  .strict();

export type OfferDiagnosticBody = z.infer<typeof offerDiagnosticBodySchema>;
export type OfferDiagnosticSectionOutput = z.infer<
  typeof offerDiagnosticSectionOutputSchema
>;
export type OfferDiagnosticArtifact = ArtifactEnvelope & {
  body: OfferDiagnosticBody;
};

function uniqueCount(values: readonly string[]): number {
  return new Set(values.map((value) => value.trim().toLowerCase())).size;
}

function hasBlockGap(block: { blockGap?: unknown }): boolean {
  return block.blockGap !== undefined;
}

export function validateOfferDiagnosticMinimums(
  artifact: ArtifactEnvelope & { body: OfferDiagnosticBody },
): ValidationResult {
  const parsedArtifact = artifactEnvelopeSchema
    .extend({ body: offerDiagnosticBodySchema })
    .parse(artifact);
  const errors: string[] = [];

  validateStrategicInsightMinimums(
    errors,
    "body.strategicInsight",
    parsedArtifact.body.strategicInsight,
    {
      comparisonTexts: [parsedArtifact.verdict, parsedArtifact.statusSummary],
    },
  );
  validateOrderedStrategicMovesMinimums(
    errors,
    "body.orderedMoves",
    parsedArtifact.body.orderedMoves,
  );
  validateProvesWrongIfMinimums(
    errors,
    "body.provesWrongIf",
    parsedArtifact.body.provesWrongIf,
  );
  validateStrategicText(
    errors,
    "body.singleBindingConstraint.constraint",
    parsedArtifact.body.singleBindingConstraint.constraint,
  );
  validateStrategicText(
    errors,
    "body.singleBindingConstraint.whyBinding",
    parsedArtifact.body.singleBindingConstraint.whyBinding,
  );
  validateStrategicText(
    errors,
    "body.singleBindingConstraint.unlockCondition",
    parsedArtifact.body.singleBindingConstraint.unlockCondition,
  );

  if (parsedArtifact.sources.length < 5) {
    errors.push(`sources: have ${parsedArtifact.sources.length}, need >=5.`);
  }

  const proofCount = parsedArtifact.body.offerMarketFit.proofPoints.length;
  if (proofCount < 3 && !hasBlockGap(parsedArtifact.body.offerMarketFit)) {
    errors.push(`body.offerMarketFit.proofPoints: have ${proofCount}, need >=3.`);
  }

  const breakCount = parsedArtifact.body.funnelDiagnosis.breaks.length;
  if (breakCount < 2 && !hasBlockGap(parsedArtifact.body.funnelDiagnosis)) {
    errors.push(`body.funnelDiagnosis.breaks: have ${breakCount}, need >=2.`);
  }

  const channels = parsedArtifact.body.channelTruth.channels;
  if (channels.length < 3 && !hasBlockGap(parsedArtifact.body.channelTruth)) {
    errors.push(`body.channelTruth.channels: have ${channels.length}, need >=3.`);
  }
  const channelNameCount = uniqueCount(
    channels.map((channel) => channel.channelName),
  );
  if (channelNameCount < 3 && !hasBlockGap(parsedArtifact.body.channelTruth)) {
    errors.push(
      `body.channelTruth.channels: need >=3 distinct channel names, have ${channelNameCount}.`,
    );
  }

  const retentionSignals = parsedArtifact.body.retentionHealth.signals;
  if (retentionSignals.length < 1 && !hasBlockGap(parsedArtifact.body.retentionHealth)) {
    errors.push(
      `body.retentionHealth.signals: have ${retentionSignals.length}, need >=1 or body.retentionHealth.blockGap.`,
    );
  }

  const redFlagCount = parsedArtifact.body.redFlags.items.length;
  if (redFlagCount < 3 && !hasBlockGap(parsedArtifact.body.redFlags)) {
    errors.push(`body.redFlags.items: have ${redFlagCount}, need >=3.`);
  }

  return { ok: errors.length === 0, errors };
}

// T2b: evidence-gap escape hatch for the OfferDiagnostic strategic-text fields.
// These two suffixes are the ONLY minimums failures we soften — both accept an
// "evidence gap: ..." string (validateStrategicText / isFalsifiabilityText).
// Structural failures (bad ranks/dependencies, too-few proof points) are
// deterministic model bugs a gap string can't fix and are intentionally left to
// hard-fail.
const offerStrategicTextErrorSuffix =
  ": must be a specific strategic judgment or write exactly `evidence gap: <missing signal>`, not a summary/restatement. Do not satisfy \"specific\" with numbers that are not in fetched evidence - unsupported numeric precision is treated as fabrication.";
const offerFalsifiabilityErrorPattern =
  /: must be a concrete falsifiability \w+ or explicit evidence gap\.$/;

// Allowlisted strategic-text paths that validateOfferDiagnosticMinimums checks
// via validateStrategicText / validateProvesWrongIfMinimums. Array elements
// (orderedMoves) are matched by a prefix/suffix below.
const offerStrategicEvidenceGapScalarPaths = new Set([
  "body.strategicInsight.strategicVerdict",
  "body.strategicInsight.nonObviousRead",
  "body.strategicInsight.secondOrderImplication",
  "body.strategicInsight.keyTension.tension",
  "body.strategicInsight.keyTension.side",
  "body.strategicInsight.keyTension.costOfPosition",
  "body.singleBindingConstraint.constraint",
  "body.singleBindingConstraint.whyBinding",
  "body.singleBindingConstraint.unlockCondition",
  "body.provesWrongIf.metric",
  "body.provesWrongIf.threshold",
  "body.provesWrongIf.window",
]);

const offerOrderedMovePathPattern = /^body\.orderedMoves\[\d+\]\.(?:move|rationale)$/;

function isOfferStrategicEvidenceGapPath(path: string): boolean {
  return (
    offerStrategicEvidenceGapScalarPaths.has(path) ||
    offerOrderedMovePathPattern.test(path)
  );
}

/**
 * Parse a failing offer-diagnostic minimums error into the strategic-text path
 * it flags, restricted to the allowlist above. Returns null for any error we do
 * not soften (structural failures, duplicate-field errors, etc.).
 */
export function parseOfferDiagnosticStrategicEvidenceGapPath(
  error: string,
): string | null {
  let path: string | null = null;

  if (error.endsWith(offerStrategicTextErrorSuffix)) {
    path = error.slice(0, -offerStrategicTextErrorSuffix.length);
  } else if (offerFalsifiabilityErrorPattern.test(error)) {
    path = error.replace(offerFalsifiabilityErrorPattern, "");
  }

  if (path === null) {
    return null;
  }

  return isOfferStrategicEvidenceGapPath(path) ? path : null;
}

function offerEvidenceGapValue(path: string): string {
  return `evidence gap: ${path.replace(
    /^body\./,
    "",
  )} could not be upgraded into a source-backed strategic judgment from the fetched offer evidence.`;
}

function setOfferBodyPath(
  body: Record<string, unknown>,
  path: string,
  value: string,
): Record<string, unknown> | null {
  // Strip the leading "body." and tokenize, splitting array indices into their
  // own steps: e.g. "orderedMoves[2].move" -> ["orderedMoves", 2, "move"].
  const segments: (string | number)[] = [];
  for (const token of path.replace(/^body\./, "").split(".")) {
    const arrayMatch = /^([^[]+)\[(\d+)\]$/.exec(token);
    if (arrayMatch) {
      segments.push(arrayMatch[1], Number(arrayMatch[2]));
    } else {
      segments.push(token);
    }
  }

  const root = structuredClone(body);
  let cursor: unknown = root;

  for (let i = 0; i < segments.length - 1; i += 1) {
    const segment = segments[i];
    if (Array.isArray(cursor) && typeof segment === "number") {
      cursor = cursor[segment];
    } else if (
      cursor !== null &&
      typeof cursor === "object" &&
      typeof segment === "string"
    ) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return null;
    }

    if (cursor === undefined || cursor === null) {
      return null;
    }
  }

  const leaf = segments[segments.length - 1];
  if (Array.isArray(cursor) && typeof leaf === "number") {
    cursor[leaf] = value;
  } else if (
    cursor !== null &&
    typeof cursor === "object" &&
    typeof leaf === "string"
  ) {
    (cursor as Record<string, unknown>)[leaf] = value;
  } else {
    return null;
  }

  return root;
}

/**
 * Patch the failing OfferDiagnostic strategic-text paths with explicit
 * evidence-gap strings. Returns null when any flagged error falls outside the
 * softenable allowlist (so the caller hard-fails rather than committing a body
 * with un-softened structural defects). The caller re-validates minimums before
 * committing — this only builds the candidate body.
 */
export function buildOfferDiagnosticEvidenceGapBody({
  body,
  errors,
}: {
  body: Record<string, unknown>;
  errors: readonly string[];
}): Record<string, unknown> | null {
  const paths = errors.map(parseOfferDiagnosticStrategicEvidenceGapPath);
  if (paths.length === 0 || paths.some((path) => path === null)) {
    return null;
  }

  let patched: Record<string, unknown> | null = structuredClone(body);
  for (const path of paths) {
    if (path === null || patched === null) {
      return null;
    }

    patched = setOfferBodyPath(patched, path, offerEvidenceGapValue(path));
  }

  return patched;
}

// T2c: structural count-floor escape hatch. The blocks below carry a row-count
// minimum that a strategic-text gap string cannot satisfy; when the section
// returns too few rows we attach a schema-valid blockGap (summary + counts +
// recovery plan) so the body commits as an honest gap instead of hard-failing.
// Each entry maps a count-floor error to its block field + the floor value.
const offerStructuralFloorMatchers: ReadonlyArray<{
  block: string;
  requiredCount: number;
  noun: string;
  matches: (error: string) => number | null;
}> = [
  {
    block: "offerMarketFit",
    requiredCount: 3,
    noun: "proof points",
    matches: (error) =>
      parseOfferFoundCount(
        error,
        /^body\.offerMarketFit\.proofPoints: have (\d+), need >=3\.$/,
      ),
  },
  {
    block: "funnelDiagnosis",
    requiredCount: 2,
    noun: "funnel breaks",
    matches: (error) =>
      parseOfferFoundCount(
        error,
        /^body\.funnelDiagnosis\.breaks: have (\d+), need >=2\.$/,
      ),
  },
  {
    block: "channelTruth",
    requiredCount: 3,
    noun: "channels",
    matches: (error) =>
      parseOfferFoundCount(
        error,
        /^body\.channelTruth\.channels: have (\d+), need >=3\.$/,
      ) ??
      parseOfferFoundCount(
        error,
        /^body\.channelTruth\.channels: need >=3 distinct channel names, have (\d+)\.$/,
      ),
  },
  {
    block: "retentionHealth",
    requiredCount: 1,
    noun: "retention signals",
    matches: (error) =>
      parseOfferFoundCount(
        error,
        /^body\.retentionHealth\.signals: have (\d+), need >=1 or body\.retentionHealth\.blockGap\.$/,
      ),
  },
  {
    block: "redFlags",
    requiredCount: 3,
    noun: "red flags",
    matches: (error) =>
      parseOfferFoundCount(
        error,
        /^body\.redFlags\.items: have (\d+), need >=3\.$/,
      ),
  },
];

function parseOfferFoundCount(error: string, pattern: RegExp): number | null {
  const match = pattern.exec(error);
  if (match === null) {
    return null;
  }
  const found = Number(match[1]);
  return Number.isInteger(found) ? found : null;
}

/**
 * Patch the failing OfferDiagnostic structural count-floors with schema-valid
 * blockGaps. Existing rows are preserved; only the block's `blockGap` field is
 * set. Returns null when ANY flagged error is not a recognized structural floor
 * (so the caller hard-fails rather than committing un-softened defects). The
 * caller re-validates minimums before committing — this only builds the body.
 */
export function buildOfferDiagnosticBlockGapBody({
  body,
  errors,
}: {
  body: Record<string, unknown>;
  errors: readonly string[];
}): Record<string, unknown> | null {
  if (errors.length === 0) {
    return null;
  }

  // Resolve each error to its block; bail if any error is unrecognized so the
  // caller still hard-fails on genuinely unknown failures.
  const resolved: Array<{ block: string; requiredCount: number; noun: string; foundCount: number }> = [];
  for (const error of errors) {
    let matched = false;
    for (const matcher of offerStructuralFloorMatchers) {
      const foundCount = matcher.matches(error);
      if (foundCount !== null) {
        resolved.push({
          block: matcher.block,
          requiredCount: matcher.requiredCount,
          noun: matcher.noun,
          foundCount,
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      return null;
    }
  }

  const patched = structuredClone(body);
  for (const entry of resolved) {
    const block = patched[entry.block];
    if (block === null || typeof block !== "object" || Array.isArray(block)) {
      return null;
    }
    (block as Record<string, unknown>).blockGap = {
      summary: `Only ${entry.foundCount} of the required ${entry.requiredCount} ${entry.noun} could be sourced from the fetched evidence.`,
      foundCount: entry.foundCount,
      requiredCount: entry.requiredCount,
      sourcingPlan: [
        `Re-run acquisition for ${entry.block} to source ${entry.requiredCount - entry.foundCount} more ${entry.noun} from verified sources.`,
      ],
    };
  }

  return patched;
}
