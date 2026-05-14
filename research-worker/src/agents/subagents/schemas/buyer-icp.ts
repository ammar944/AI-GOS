import { z } from 'zod';

import { PositioningEnvelopeSchema } from '../envelope-schema';

/**
 * Per-section schema for the Buyer & ICP Validation subagent.
 *
 * Extends PositioningEnvelopeSchema with rich structured fields that
 * scripts/validate.py enforces inside the agent's code_execution loop:
 *
 *   - personas[]                (>=5 named real persons with sourceUrl)
 *   - icpAccountCounts[]        (>=3 typed firmographic cuts)
 *   - awarenessDistribution[]   (all 5 Schwartz levels)
 *   - triggers[]                (>=3 publicly detectable)
 *   - clusters[]                (>=2 communities + >=2 newsletters, flat array)
 *
 * Cardinality minimums are enforced by validate.py, NOT by Zod.
 *
 * Grammar budget: Anthropic's structured-output backend compiles all tool
 * schemas + the Output.object schema into one grammar. With code_execution +
 * web_search + reviews + firecrawl already wired (each adding production
 * rules), this schema is deliberately FLAT and OPTIONAL-FREE:
 *
 *   - icpAccountCounts is an array of typed cuts (vs. multi-optional object)
 *   - clusters is ONE flat array tagged with bucketType (vs. 4 nested arrays)
 *   - awareness drops sharePct (level + evidence carry the meaning)
 *   - clusters drops metricKind (bucketType implies it: communities/newsletters
 *     ⇒ subscribers, conferences ⇒ attendance, podcasts ⇒ listeners)
 *
 * If anthropic still rejects this for grammar size, the next step is to drop
 * keyFindings/evidenceQuotes from the envelope-extension path for BuyerICP.
 */

const CUT_TYPES = [
  'industry',
  'employeeBands',
  'revenueBands',
  'geography',
  'techStack',
] as const;

const AWARENESS_LEVELS = [
  'unaware',
  'problem-aware',
  'solution-aware',
  'product-aware',
  'most-aware',
] as const;

const TRIGGER_WINDOWS = ['immediate', 'weeks', 'quarters'] as const;

const CLUSTER_BUCKETS = ['community', 'newsletter', 'conference', 'podcast'] as const;

const FirmographicCutSchema = z.object({
  cutType: z.enum(CUT_TYPES),
  value: z.string(),
  source: z.string(),
  dateObserved: z.string(),
});

const PersonaSchema = z.object({
  name: z.string(),
  title: z.string(),
  company: z.string(),
  sourceUrl: z.string(),
  role: z.string(),
  evidence: z.string(),
});

const AwarenessLevelSchema = z.object({
  level: z.enum(AWARENESS_LEVELS),
  evidence: z.string(),
});

const TriggerSchema = z.object({
  name: z.string(),
  detectionSignal: z.string(),
  window: z.enum(TRIGGER_WINDOWS),
});

const ClusterEntrySchema = z.object({
  bucketType: z.enum(CLUSTER_BUCKETS),
  name: z.string(),
  metric: z.number(),
  sourceUrl: z.string(),
});

/**
 * BuyerICPSectionSchema = PositioningEnvelopeSchema + rich BuyerICP fields.
 */
export const BuyerICPSectionSchema = PositioningEnvelopeSchema.extend({
  personas: z.array(PersonaSchema),
  icpAccountCounts: z.array(FirmographicCutSchema),
  awarenessDistribution: z.array(AwarenessLevelSchema),
  triggers: z.array(TriggerSchema),
  clusters: z.array(ClusterEntrySchema),
});

export type BuyerICPSection = z.infer<typeof BuyerICPSectionSchema>;
