import { z } from "zod";

import {
  artifactEnvelopeSchema,
  type ArtifactEnvelope,
} from "../artifact-envelope";
import type { ValidationResult } from "./market-category";
import {
  bindingConstraintSchema,
  orderedStrategicMoveSchema,
  provesWrongIfSchema,
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

const fitProofPointSchema = z
  .object({
    metric: z.string().min(1),
    value: z.string().min(1),
    reportedBy: z.enum(reportedByValues),
    confidence: z.enum(confidenceValues),
    sourceUrl: z.string().min(1),
  })
  .strict();

const funnelBreakSchema = z
  .object({
    stageName: z.string().min(1),
    metric: z.string().min(1),
    magnitude: z.string().min(1),
    hypothesis: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const channelEvidenceSchema = z
  .object({
    channelName: z.string().min(1),
    hasWorked: z.enum(channelWorkedValues),
    quantifiedEvidence: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const retentionSignalSchema = z
  .object({
    signalType: z.enum(retentionSignalTypes),
    metric: z.string().min(1),
    value: z.string().min(1),
    sourceUrl: z.string().min(1),
  })
  .strict();

const redFlagSchema = z
  .object({
    claimedMotion: z.string().min(1),
    actualEvidence: z.string().min(1),
    contradiction: z.string().min(1),
    severity: z.enum(severityValues),
  })
  .strict();

export const offerDiagnosticBodySchema = z
  .object({
    strategicInsight: strategicInsightSchema,
    orderedMoves: z.array(orderedStrategicMoveSchema),
    provesWrongIf: provesWrongIfSchema,
    singleBindingConstraint: bindingConstraintSchema,
    offerMarketFit: z
      .object({
        prose: z.string().min(1),
        proofPoints: z.array(fitProofPointSchema),
      })
      .strict(),
    funnelDiagnosis: z
      .object({ prose: z.string().min(1), breaks: z.array(funnelBreakSchema) })
      .strict(),
    channelTruth: z
      .object({ prose: z.string().min(1), channels: z.array(channelEvidenceSchema) })
      .strict(),
    retentionHealth: z
      .object({ prose: z.string().min(1), signals: z.array(retentionSignalSchema) })
      .strict(),
    redFlags: z
      .object({ prose: z.string().min(1), items: z.array(redFlagSchema) })
      .strict(),
  })
  .strict();

const modelSourceSchema = z
  .object({
    title: z.string().min(1),
    url: z.string().url(),
    publisher: z.string().min(1).optional(),
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
  if (proofCount < 3) {
    errors.push(`body.offerMarketFit.proofPoints: have ${proofCount}, need >=3.`);
  }

  const breakCount = parsedArtifact.body.funnelDiagnosis.breaks.length;
  if (breakCount < 2) {
    errors.push(`body.funnelDiagnosis.breaks: have ${breakCount}, need >=2.`);
  }

  const channels = parsedArtifact.body.channelTruth.channels;
  if (channels.length < 3) {
    errors.push(`body.channelTruth.channels: have ${channels.length}, need >=3.`);
  }
  const channelNameCount = uniqueCount(
    channels.map((channel) => channel.channelName),
  );
  if (channelNameCount < 3) {
    errors.push(
      `body.channelTruth.channels: need >=3 distinct channel names, have ${channelNameCount}.`,
    );
  }

  const retentionSignals = parsedArtifact.body.retentionHealth.signals;
  if (retentionSignals.length < 3) {
    errors.push(
      `body.retentionHealth.signals: have ${retentionSignals.length}, need >=3.`,
    );
  }
  const retentionTypeCount = uniqueCount(
    retentionSignals.map((signal) => signal.signalType),
  );
  if (retentionTypeCount < 2) {
    errors.push(
      `body.retentionHealth.signals: need >=2 signalTypes, have ${retentionTypeCount}.`,
    );
  }

  const redFlagCount = parsedArtifact.body.redFlags.items.length;
  if (redFlagCount < 3) {
    errors.push(`body.redFlags.items: have ${redFlagCount}, need >=3.`);
  }

  return { ok: errors.length === 0, errors };
}
