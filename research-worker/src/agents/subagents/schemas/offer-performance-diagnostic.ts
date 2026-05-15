import { z } from 'zod';

import { SourceSchema } from './_shared';

/**
 * Bespoke Section 06 Artifact schema for ADR-0002.
 *
 * Offer & Performance Diagnostic captures public/self-reported offer,
 * funnel, channel, retention, and contradiction evidence. Cardinality,
 * range, URL, and cross-card coverage checks live in
 * validateOfferPerformanceMinimums because provider structured-output
 * schemas reject Zod cardinality constraints.
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

const VALID_URL_PATTERN = /^https?:\/\/\S+\.\S+/;

export const FitProofPointSchema = z
  .object({
    metric: z.string().describe('Reported offer-market-fit metric or public proof point.'),
    value: z
      .string()
      .describe('Metric value from source text; use not disclosed when unavailable.'),
    reportedBy: z
      .enum(REPORTED_BY_VALUES)
      .describe('Whether the proof point is company-owned or external-source evidence.'),
    confidence: z
      .enum(CONFIDENCE_VALUES)
      .describe('Confidence in the proof point based on directness of source evidence.'),
    sourceUrl: z.string().describe('Source URL supporting the proof point.'),
  })
  .describe('Offer-market-fit proof point from public or company-reported evidence.');

export const FunnelBreakSchema = z
  .object({
    stageName: z.string().describe('Named funnel stage where conversion may break.'),
    metric: z.string().describe('Metric relevant to the funnel stage.'),
    magnitude: z
      .string()
      .describe('Observed or reported magnitude; use not disclosed when unavailable.'),
    hypothesis: z.string().describe('Evidence-grounded hypothesis for the break.'),
    sourceUrl: z.string().describe('Source URL supporting the funnel diagnosis.'),
  })
  .describe('Potential funnel break tied to reported or missing performance data.');

export const ChannelEvidenceSchema = z
  .object({
    channelName: z.string().describe('Named acquisition, activation, or retention channel.'),
    hasWorked: z
      .enum(CHANNEL_WORKED_VALUES)
      .describe('Whether public evidence suggests the channel worked.'),
    quantifiedEvidence: z
      .string()
      .describe('Quantified channel evidence or not disclosed when unavailable.'),
    sourceUrl: z.string().describe('Source URL supporting the channel evidence.'),
  })
  .describe('Channel truth card with quantified evidence or explicit absence of data.');

export const RetentionSignalSchema = z
  .object({
    signalType: z
      .enum(RETENTION_SIGNAL_TYPES)
      .describe('Activation, retention, or first-value-moment signal type.'),
    metric: z.string().describe('Metric name for the retention or activation signal.'),
    value: z
      .string()
      .describe('Reported metric value or not disclosed when unavailable.'),
    sourceUrl: z.string().describe('Source URL supporting the signal.'),
  })
  .describe('Retention, activation, or first-value signal.');

export const RedFlagSchema = z
  .object({
    claimedMotion: z.string().describe('Claimed GTM, offer, funnel, or retention motion.'),
    actualEvidence: z.string().describe('Observed evidence or missing disclosed metric.'),
    contradiction: z.string().describe('Specific contradiction between claim and evidence.'),
    severity: z.enum(SEVERITY_VALUES).describe('Severity of the contradiction.'),
  })
  .describe('Claimed-vs-actual contradiction in public performance evidence.');

export const OfferMarketFitSchema = z
  .object({
    prose: z.string().describe('Narrative offer-market-fit synthesis.'),
    proofPoints: FitProofPointSchema.array().describe(
      'Offer-market-fit proof points from public or company-reported metrics.',
    ),
  })
  .describe('Sub-section for offer-market-fit proof.');

export const FunnelDiagnosisSchema = z
  .object({
    prose: z.string().describe('Narrative funnel-diagnosis synthesis.'),
    breaks: FunnelBreakSchema.array().describe(
      'Funnel breaks with stage, metric, magnitude, hypothesis, and source.',
    ),
  })
  .describe('Sub-section for funnel diagnosis.');

export const ChannelTruthSchema = z
  .object({
    prose: z.string().describe('Narrative channel-truth synthesis.'),
    channels: ChannelEvidenceSchema.array().describe(
      'Channels with quantified evidence or explicit not disclosed values.',
    ),
  })
  .describe('Sub-section for channel truth.');

export const RetentionHealthSchema = z
  .object({
    prose: z.string().describe('Narrative retention and activation health synthesis.'),
    signals: RetentionSignalSchema.array().describe(
      'Activation, retention, and first-value signals.',
    ),
  })
  .describe('Sub-section for retention and activation health.');

export const RedFlagsSchema = z
  .object({
    prose: z.string().describe('Narrative synthesis of claimed-vs-actual red flags.'),
    items: RedFlagSchema.array().describe(
      'Specific claimed-vs-actual contradictions.',
    ),
  })
  .describe('Sub-section for red flags in the company evidence.');

export const OfferPerformanceArtifactSchema = z
  .object({
    sectionTitle: z.string().describe('Section title, normally Offer & Performance Diagnostic.'),
    verdict: z.string().describe('One-line judgment for Section 06 offer and performance.'),
    statusSummary: z
      .string()
      .describe('Two to four sentence opening summary for the Section.'),
    confidence: z
      .number()
      .describe('0-10 confidence score; range is enforced by runner validation.'),
    sources: SourceSchema.array().describe(
      'Best public sources supporting the Section-level offer and performance judgment.',
    ),
    offerMarketFit: OfferMarketFitSchema.describe(
      'Offer-market fit evidence from public or company-reported metrics.',
    ),
    funnelDiagnosis: FunnelDiagnosisSchema.describe(
      'Funnel diagnosis against reported or missing CAC, LTV, cycle, MRR, and conversion data.',
    ),
    channelTruth: ChannelTruthSchema.describe(
      'What has and has not worked by channel with quantified evidence or not disclosed values.',
    ),
    retentionHealth: RetentionHealthSchema.describe(
      'Retention, activation, and first-value health signals.',
    ),
    redFlags: RedFlagsSchema.describe(
      'Contradictions between claimed motion and actual disclosed evidence.',
    ),
  })
  .describe('Complete Section 06 Offer & Performance Diagnostic Artifact.');

export type OfferPerformanceArtifact = z.infer<
  typeof OfferPerformanceArtifactSchema
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

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function uniqueCount(values: readonly string[]): number {
  return new Set(values.map(normalizeKey)).size;
}

function validateUrl(errors: string[], path: string, url: string): void {
  if (!VALID_URL_PATTERN.test(url)) {
    errors.push(`${path}: url is not a valid URL.`);
  }
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
    if (hasText(source.url)) validateUrl(errors, `sources[${index}].url`, source.url);
  });

  artifact.offerMarketFit.proofPoints.forEach((point, index) => {
    pushMissingText(errors, `offerMarketFit.proofPoints[${index}].metric`, point.metric);
    pushMissingText(errors, `offerMarketFit.proofPoints[${index}].value`, point.value);
    pushMissingText(errors, `offerMarketFit.proofPoints[${index}].sourceUrl`, point.sourceUrl);
    if (hasText(point.sourceUrl)) {
      validateUrl(errors, `offerMarketFit.proofPoints[${index}].sourceUrl`, point.sourceUrl);
    }
  });

  artifact.funnelDiagnosis.breaks.forEach((item, index) => {
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].stageName`, item.stageName);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].metric`, item.metric);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].magnitude`, item.magnitude);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].hypothesis`, item.hypothesis);
    pushMissingText(errors, `funnelDiagnosis.breaks[${index}].sourceUrl`, item.sourceUrl);
    if (hasText(item.sourceUrl)) {
      validateUrl(errors, `funnelDiagnosis.breaks[${index}].sourceUrl`, item.sourceUrl);
    }
  });

  artifact.channelTruth.channels.forEach((channel, index) => {
    pushMissingText(errors, `channelTruth.channels[${index}].channelName`, channel.channelName);
    pushMissingText(
      errors,
      `channelTruth.channels[${index}].quantifiedEvidence`,
      channel.quantifiedEvidence,
    );
    pushMissingText(errors, `channelTruth.channels[${index}].sourceUrl`, channel.sourceUrl);
    if (hasText(channel.sourceUrl)) {
      validateUrl(errors, `channelTruth.channels[${index}].sourceUrl`, channel.sourceUrl);
    }
  });

  artifact.retentionHealth.signals.forEach((signal, index) => {
    pushMissingText(errors, `retentionHealth.signals[${index}].metric`, signal.metric);
    pushMissingText(errors, `retentionHealth.signals[${index}].value`, signal.value);
    pushMissingText(errors, `retentionHealth.signals[${index}].sourceUrl`, signal.sourceUrl);
    if (hasText(signal.sourceUrl)) {
      validateUrl(errors, `retentionHealth.signals[${index}].sourceUrl`, signal.sourceUrl);
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

  const sourceCount = artifact.sources.length;
  if (sourceCount < 5) {
    errors.push(`sources: have ${sourceCount}, need >=5 Section-level sources.`);
  }

  const proofPointCount = artifact.offerMarketFit.proofPoints.length;
  if (proofPointCount < 3) {
    errors.push(
      `offerMarketFit.proofPoints: have ${proofPointCount}, need >=3 proof points.`,
    );
  }

  const funnelBreakCount = artifact.funnelDiagnosis.breaks.length;
  if (funnelBreakCount < 2) {
    errors.push(`funnelDiagnosis.breaks: have ${funnelBreakCount}, need >=2 funnel breaks.`);
  }

  const channelCount = artifact.channelTruth.channels.length;
  if (channelCount < 3) {
    errors.push(`channelTruth.channels: have ${channelCount}, need >=3 channels.`);
  }
  const distinctChannelCount = uniqueCount(
    artifact.channelTruth.channels.map((channel) => channel.channelName),
  );
  if (distinctChannelCount < 3) {
    errors.push(
      `channelTruth.channels: need >=3 distinct channels, have ${distinctChannelCount}.`,
    );
  }

  const retentionSignalCount = artifact.retentionHealth.signals.length;
  if (retentionSignalCount < 3) {
    errors.push(
      `retentionHealth.signals: have ${retentionSignalCount}, need >=3 retention signals.`,
    );
  }
  const retentionSignalTypeCount = uniqueCount(
    artifact.retentionHealth.signals.map((signal) => signal.signalType),
  );
  if (retentionSignalTypeCount < 2) {
    errors.push(
      `retentionHealth.signals: need >=2 signalTypes, have ${retentionSignalTypeCount}.`,
    );
  }

  const redFlagCount = artifact.redFlags.items.length;
  if (redFlagCount < 3) {
    errors.push(`redFlags.items: have ${redFlagCount}, need >=3 red flags.`);
  }

  return { ok: errors.length === 0, errors };
}
