import { z } from 'zod';

import {
  SourceSchema,
  type ValidationResult,
  hasText,
  pushMissingText,
  validateUrl,
} from './_shared';

/**
 * Next.js-side mirror of the worker OfferPerformanceArtifactSchema. Source of
 * truth lives in
 * research-worker/src/agents/subagents/schemas/offer-performance-diagnostic.ts.
 */

const REPORTED_BY_VALUES = ['company-own', 'external-source'] as const;
const CONFIDENCE_VALUES = ['high', 'medium', 'low'] as const;
const CHANNEL_WORKED_VALUES = ['yes', 'partial', 'no', 'unknown'] as const;
const RETENTION_SIGNAL_TYPES = [
  'activation',
  'retention',
  'first-value-moment',
] as const;
const SEVERITY_VALUES = ['high', 'medium', 'low'] as const;

export const FitProofPointSchema = z.object({
  metric: z.string(),
  value: z.string(),
  reportedBy: z.enum(REPORTED_BY_VALUES),
  confidence: z.enum(CONFIDENCE_VALUES),
  sourceUrl: z.string(),
});

export const FunnelBreakSchema = z.object({
  stageName: z.string(),
  metric: z.string(),
  magnitude: z.string(),
  hypothesis: z.string(),
  sourceUrl: z.string(),
});

export const ChannelEvidenceSchema = z.object({
  channelName: z.string(),
  hasWorked: z.enum(CHANNEL_WORKED_VALUES),
  quantifiedEvidence: z.string(),
  sourceUrl: z.string(),
});

export const RetentionSignalSchema = z.object({
  signalType: z.enum(RETENTION_SIGNAL_TYPES),
  metric: z.string(),
  value: z.string(),
  sourceUrl: z.string(),
});

export const RedFlagSchema = z.object({
  claimedMotion: z.string(),
  actualEvidence: z.string(),
  contradiction: z.string(),
  severity: z.enum(SEVERITY_VALUES),
});

export const OfferMarketFitSchema = z.object({
  prose: z.string(),
  proofPoints: FitProofPointSchema.array(),
});

export const FunnelDiagnosisSchema = z.object({
  prose: z.string(),
  breaks: FunnelBreakSchema.array(),
});

export const ChannelTruthSchema = z.object({
  prose: z.string(),
  channels: ChannelEvidenceSchema.array(),
});

export const RetentionHealthSchema = z.object({
  prose: z.string(),
  signals: RetentionSignalSchema.array(),
});

export const RedFlagsSchema = z.object({
  prose: z.string(),
  items: RedFlagSchema.array(),
});

export const OfferPerformanceArtifactSchema = z
  .object({
    sectionTitle: z.string(),
    verdict: z.string(),
    statusSummary: z.string(),
    confidence: z.number(),
    sources: SourceSchema.array(),
    offerMarketFit: OfferMarketFitSchema,
    funnelDiagnosis: FunnelDiagnosisSchema,
    channelTruth: ChannelTruthSchema,
    retentionHealth: RetentionHealthSchema,
    redFlags: RedFlagsSchema,
  })
  .describe('Complete Section 06 Offer & Performance Diagnostic Artifact.');

export type OfferPerformanceArtifact = z.infer<typeof OfferPerformanceArtifactSchema>;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueNormalizedCount(values: readonly string[]): number {
  return new Set(values.map(normalizeKey)).size;
}

function validateRequiredFields(
  artifact: OfferPerformanceArtifact,
  errors: string[],
): void {
  pushMissingText(errors, 'sectionTitle', artifact.sectionTitle);
  pushMissingText(errors, 'verdict', artifact.verdict);
  pushMissingText(errors, 'statusSummary', artifact.statusSummary);
  if (typeof artifact.confidence !== 'number' || Number.isNaN(artifact.confidence)) {
    errors.push('confidence: required numeric field missing.');
  }

  pushMissingText(errors, 'offerMarketFit.prose', artifact.offerMarketFit.prose);
  pushMissingText(errors, 'funnelDiagnosis.prose', artifact.funnelDiagnosis.prose);
  pushMissingText(errors, 'channelTruth.prose', artifact.channelTruth.prose);
  pushMissingText(errors, 'retentionHealth.prose', artifact.retentionHealth.prose);
  pushMissingText(errors, 'redFlags.prose', artifact.redFlags.prose);

  artifact.sources.forEach((source, index) => {
    pushMissingText(errors, `sources[${index}].title`, source.title);
    pushMissingText(errors, `sources[${index}].url`, source.url);
    if (hasText(source.url)) {
      validateUrl(errors, `sources[${index}].url`, source.url);
    }
  });

  artifact.offerMarketFit.proofPoints.forEach((p, index) => {
    pushMissingText(errors, `offerMarketFit.proofPoints[${index}].metric`, p.metric);
    pushMissingText(errors, `offerMarketFit.proofPoints[${index}].value`, p.value);
    pushMissingText(errors, `offerMarketFit.proofPoints[${index}].sourceUrl`, p.sourceUrl);
    if (hasText(p.sourceUrl)) {
      validateUrl(errors, `offerMarketFit.proofPoints[${index}].sourceUrl`, p.sourceUrl);
    }
  });

  artifact.funnelDiagnosis.breaks.forEach((b, index) => {
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].stageName`, b.stageName);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].metric`, b.metric);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].magnitude`, b.magnitude);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].hypothesis`, b.hypothesis);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].sourceUrl`, b.sourceUrl);
    if (hasText(b.sourceUrl)) {
      validateUrl(errors, `funnelDiagnosis.breaks[${index}].sourceUrl`, b.sourceUrl);
    }
  });

  artifact.channelTruth.channels.forEach((c, index) => {
    pushMissingText(errors, `channelTruth.channels[${index}].channelName`, c.channelName);
    pushMissingText(
      errors,
      `channelTruth.channels[${index}].quantifiedEvidence`,
      c.quantifiedEvidence,
    );
    pushMissingText(errors, `channelTruth.channels[${index}].sourceUrl`, c.sourceUrl);
    if (hasText(c.sourceUrl)) {
      validateUrl(errors, `channelTruth.channels[${index}].sourceUrl`, c.sourceUrl);
    }
  });

  artifact.retentionHealth.signals.forEach((s, index) => {
    pushMissingText(errors, `retentionHealth.signals[${index}].metric`, s.metric);
    pushMissingText(errors, `retentionHealth.signals[${index}].value`, s.value);
    pushMissingText(errors, `retentionHealth.signals[${index}].sourceUrl`, s.sourceUrl);
    if (hasText(s.sourceUrl)) {
      validateUrl(errors, `retentionHealth.signals[${index}].sourceUrl`, s.sourceUrl);
    }
  });

  artifact.redFlags.items.forEach((item, index) => {
    pushMissingText(errors, `redFlags.items[${index}].claimedMotion`, item.claimedMotion);
    pushMissingText(errors, `redFlags.items[${index}].actualEvidence`, item.actualEvidence);
    pushMissingText(errors, `redFlags.items[${index}].contradiction`, item.contradiction);
  });
}

export function validateOfferPerformanceMinimums(
  artifact: OfferPerformanceArtifact,
): ValidationResult {
  const errors: string[] = [];

  validateRequiredFields(artifact, errors);

  if (artifact.confidence < 0 || artifact.confidence > 10) {
    errors.push(`confidence: expected 0-10, got ${artifact.confidence}.`);
  }

  if (artifact.sources.length < 5) {
    errors.push(`sources: have ${artifact.sources.length}, need >=5 Section-level sources.`);
  }

  if (artifact.offerMarketFit.proofPoints.length < 3) {
    errors.push(
      `offerMarketFit.proofPoints: have ${artifact.offerMarketFit.proofPoints.length}, need >=3 proof points.`,
    );
  }

  if (artifact.funnelDiagnosis.breaks.length < 2) {
    errors.push(
      `funnelDiagnosis.breaks: have ${artifact.funnelDiagnosis.breaks.length}, need >=2 funnel breaks.`,
    );
  }

  if (artifact.channelTruth.channels.length < 3) {
    errors.push(
      `channelTruth.channels: have ${artifact.channelTruth.channels.length}, need >=3 channels.`,
    );
  }
  const distinctChannelCount = uniqueNormalizedCount(
    artifact.channelTruth.channels.map((c) => c.channelName),
  );
  if (distinctChannelCount < 3) {
    errors.push(
      `channelTruth.channels: need >=3 distinct channels, have ${distinctChannelCount}.`,
    );
  }

  if (artifact.retentionHealth.signals.length < 3) {
    errors.push(
      `retentionHealth.signals: have ${artifact.retentionHealth.signals.length}, need >=3 retention signals.`,
    );
  }
  const retentionSignalTypeCount = uniqueNormalizedCount(
    artifact.retentionHealth.signals.map((s) => s.signalType),
  );
  if (retentionSignalTypeCount < 2) {
    errors.push(
      `retentionHealth.signals: need >=2 signalTypes, have ${retentionSignalTypeCount}.`,
    );
  }

  if (artifact.redFlags.items.length < 3) {
    errors.push(
      `redFlags.items: have ${artifact.redFlags.items.length}, need >=3 red flags.`,
    );
  }

  return { ok: errors.length === 0, errors };
}
