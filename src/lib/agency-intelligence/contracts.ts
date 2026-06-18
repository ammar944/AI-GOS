// Agency Intelligence Console — runtime contracts.
// Zod schemas mirroring supabase/migrations/20260618_agency_intelligence.sql and the
// SaaSLaunch corpus file shape. No `any`, explicit return types, named exports only.
//
// These schemas validate data crossing the app <-> Supabase <-> corpus boundary. They are
// NOT passed to Anthropic structured output, so Zod numeric refinements (.min/.max/.int)
// are safe here.

import { z } from 'zod';

// ---------------------------------------------------------------------------
// Evidence — every insight claim cites resolvable row/source locators.
// ---------------------------------------------------------------------------

export const EvidenceKind = z.enum([
  'landing_event',
  'landing_rejection',
  'corpus_client',
  'corpus_call',
  'corpus_action',
  'corpus_promise',
  'corpus_gap',
  'site_registry',
  'fathom_transcript',
  'fathom_signal',
  'corpus_risk_signal',
  'corpus_delivery',
]);
export type EvidenceKind = z.infer<typeof EvidenceKind>;

/** A pointer at a live Supabase row (table + uuid id). */
export const DbRowLocator = z.object({
  type: z.literal('db_row'),
  table: z.string().min(1),
  id: z.string().uuid(),
  column: z.string().min(1).optional(),
});
export type DbRowLocator = z.infer<typeof DbRowLocator>;

/**
 * A pointer at a live Supabase row keyed by a non-UUID natural key
 * (e.g. `sl_fathom_transcripts.recording_id`, where `DbRowLocator`'s
 * uuid `id` cannot apply).
 */
export const DbKeyLocator = z.object({
  type: z.literal('db_key'),
  table: z.string().min(1),
  key_column: z.string().min(1),
  key_value: z.string().min(1),
  column: z.string().min(1).optional(),
});
export type DbKeyLocator = z.infer<typeof DbKeyLocator>;

/** A pointer at a corpus file on disk + optional JSON pointer into it. */
export const CorpusFileLocator = z.object({
  type: z.literal('corpus_file'),
  path: z.string().min(1),
  pointer: z.string().min(1).optional(),
});
export type CorpusFileLocator = z.infer<typeof CorpusFileLocator>;

export const Locator = z.union([DbRowLocator, DbKeyLocator, CorpusFileLocator]);
export type Locator = z.infer<typeof Locator>;

export const Evidence = z.object({
  kind: EvidenceKind,
  locator: Locator,
  summary: z.string().min(1),
  observed_at: z.string().min(1).optional(),
});
export type Evidence = z.infer<typeof Evidence>;

// ---------------------------------------------------------------------------
// Corpus index + snapshot (sl_corpus_snapshots, corpus/index.json)
// ---------------------------------------------------------------------------

export const CorpusClientSummary = z.object({
  slug: z.string().min(1),
  client: z.string().optional(),
  risk_tier: z.string().optional(),
  churn_score: z.number().int().nullable().optional(),
  gap_score: z.number().int().nullable().optional(),
  sources_total: z.number().int().nullable().optional(),
  source_counts: z.record(z.string(), z.number().int()).optional(),
});
export type CorpusClientSummary = z.infer<typeof CorpusClientSummary>;

export const CorpusIndex = z.object({
  clients: z.array(CorpusClientSummary),
});
export type CorpusIndex = z.infer<typeof CorpusIndex>;

export const CorpusSnapshot = z.object({
  refresh_run_id: z.string().uuid(),
  manifest_hash: z.string().min(1),
  client_count: z.number().int().min(0),
  index_json: CorpusIndex,
  captured_at: z.string().min(1),
});
export type CorpusSnapshot = z.infer<typeof CorpusSnapshot>;

// ---------------------------------------------------------------------------
// Per-client corpus snapshot (sl_corpus_client_snapshots, corpus/clients/*.json)
// ---------------------------------------------------------------------------

export const CorpusClientSnapshot = z.object({
  refresh_run_id: z.string().uuid(),
  snapshot_id: z.string().uuid(),
  client_slug: z.string().min(1),
  client_display_name: z.string().nullable().optional(),
  client_json: z.record(z.string(), z.unknown()),
  risk_tier: z.string().nullable().optional(),
  churn_score: z.number().int().nullable().optional(),
  gap_score: z.number().int().nullable().optional(),
  sources_total: z.number().int().nullable().optional(),
  source_counts: z.record(z.string(), z.number().int()).default({}),
  actions_count: z.number().int().min(0).default(0),
  promises_count: z.number().int().min(0).default(0),
  gaps_count: z.number().int().min(0).default(0),
  fathom_meetings_count: z.number().int().min(0).default(0),
  captured_at: z.string().min(1),
});
export type CorpusClientSnapshot = z.infer<typeof CorpusClientSnapshot>;

// ---------------------------------------------------------------------------
// Current per-client corpus state (sl_corpus_clients_current)
// ---------------------------------------------------------------------------

export const CorpusClientCurrent = z.object({
  client_slug: z.string().min(1),
  client_display_name: z.string().nullable().optional(),
  latest_refresh_run_id: z.string().uuid().nullable().optional(),
  latest_snapshot_id: z.string().uuid().nullable().optional(),
  manifest_hash: z.string().min(1),
  risk_tier: z.string().nullable().optional(),
  churn_score: z.number().int().nullable().optional(),
  gap_score: z.number().int().nullable().optional(),
  sources_total: z.number().int().nullable().optional(),
  source_counts: z.record(z.string(), z.number().int()).default({}),
  actions_count: z.number().int().min(0).default(0),
  promises_count: z.number().int().min(0).default(0),
  gaps_count: z.number().int().min(0).default(0),
  fathom_meetings_count: z.number().int().min(0).default(0),
  client_json: z.record(z.string(), z.unknown()),
  captured_at: z.string().min(1),
  updated_at: z.string().min(1),
});
export type CorpusClientCurrent = z.infer<typeof CorpusClientCurrent>;

// ---------------------------------------------------------------------------
// Refresh run (sl_refresh_runs)
// ---------------------------------------------------------------------------

export const RefreshRunKind = z.enum(['corpus_sync', 'corpus_rebuild']);
export type RefreshRunKind = z.infer<typeof RefreshRunKind>;

export const RefreshRunStatus = z.enum(['running', 'succeeded', 'failed']);
export type RefreshRunStatus = z.infer<typeof RefreshRunStatus>;

export const RefreshRun = z.object({
  id: z.string().uuid().optional(),
  run_kind: RefreshRunKind,
  status: RefreshRunStatus,
  dry_run: z.boolean().default(false),
  manifest_hash: z.string().min(1),
  client_count: z.number().int().min(0),
  started_at: z.string().min(1),
  finished_at: z.string().nullable().optional(),
  error_message: z.string().nullable().optional(),
  source_metadata: z.record(z.string(), z.unknown()).default({}),
});
export type RefreshRun = z.infer<typeof RefreshRun>;

// ---------------------------------------------------------------------------
// Insight (sl_insights)
// ---------------------------------------------------------------------------

export const InsightKind = z.enum(['client_health']);
export type InsightKind = z.infer<typeof InsightKind>;

export const Severity = z.enum(['info', 'warning', 'critical']);
export type Severity = z.infer<typeof Severity>;

export const AgencyInsight = z.object({
  id: z.string().uuid().optional(),
  client_slug: z.string().min(1),
  insight_kind: InsightKind,
  severity: Severity,
  headline: z.string().min(1),
  body: z.string().min(1),
  evidence: z.array(Evidence).min(1),
  refresh_run_id: z.string().uuid().nullable().optional(),
  source_metadata: z.record(z.string(), z.unknown()).default({}),
  generated_at: z.string().min(1),
});
export type AgencyInsight = z.infer<typeof AgencyInsight>;

// ---------------------------------------------------------------------------
// Fathom transcripts + signals (sl_fathom_transcripts, sl_fathom_signals)
// ---------------------------------------------------------------------------

export const FathomSignalType = z.enum([
  'churn_escalation',
  'going_dark',
  'payment_risk',
  'verbal_promise',
  'upsell_intent',
]);
export type FathomSignalType = z.infer<typeof FathomSignalType>;

export const FathomSignalSeverity = z.enum(['low', 'medium', 'high']);
export type FathomSignalSeverity = z.infer<typeof FathomSignalSeverity>;

export const FathomCallType = z.enum([
  'sales',
  'cs_checkin',
  'onboarding',
  'other',
  'unknown',
]);
export type FathomCallType = z.infer<typeof FathomCallType>;

export const FathomTranscriptRow = z.object({
  recording_id: z.string().min(1),
  client_slug: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  meeting_title: z.string().nullable().optional(),
  call_type: FathomCallType.default('unknown'),
  call_date: z.string().min(1),
  transcript: z.array(z.record(z.string(), z.unknown())).default([]),
  summary: z.string().nullable().optional(),
  action_items: z.array(z.record(z.string(), z.unknown())).default([]),
  share_url: z.string().nullable().optional(),
  call_url: z.string().nullable().optional(),
  transcript_turns: z.number().int().min(0).default(0),
  raw_sha256: z.string().min(1),
  source_metadata: z.record(z.string(), z.unknown()).default({}),
  ingested_at: z.string().min(1).optional(),
  updated_at: z.string().min(1).optional(),
});
export type FathomTranscriptRow = z.infer<typeof FathomTranscriptRow>;

export const FathomSignalRow = z.object({
  id: z.string().uuid().optional(),
  client_slug: z.string().min(1),
  recording_id: z.string().min(1),
  signal_type: FathomSignalType,
  severity: FathomSignalSeverity,
  quote: z.string().min(12).max(1200),
  quote_sha256: z.string().min(1),
  speaker: z.string().nullable().optional(),
  call_date: z.string().min(1),
  extracted_at: z.string().min(1).optional(),
  source_metadata: z.record(z.string(), z.unknown()).default({}),
});
export type FathomSignalRow = z.infer<typeof FathomSignalRow>;

// ---------------------------------------------------------------------------
// Parsed corpus client file helpers (subset of corpus/clients/*.json shape).
// Kept narrow — only the fields the deterministic insight reads.
// ---------------------------------------------------------------------------

export const CorpusClientFile = z.object({
  client: z.string(),
  actions: z.array(z.record(z.string(), z.unknown())).default([]),
  promises: z.array(z.record(z.string(), z.unknown())).default([]),
  gaps: z.array(z.record(z.string(), z.unknown())).default([]),
  fathom_meetings: z.array(z.record(z.string(), z.unknown())).default([]),
  calls: z.array(z.record(z.string(), z.unknown())).default([]),
  risk: z
    .object({
      tier: z.string().optional(),
      churn_score: z.number().int().nullable().optional(),
      gap_score: z.number().int().nullable().optional(),
    })
    .passthrough()
    .optional(),
  provenance: z.record(z.string(), z.unknown()).optional(),
});
export type CorpusClientFile = z.infer<typeof CorpusClientFile>;

/** Build a CorpusFileLocator for a client file + optional JSON pointer. */
export function corpusFileLocator(
  path: string,
  pointer?: string
): CorpusFileLocator {
  return { type: 'corpus_file', path, pointer };
}

/** Build a DbRowLocator for a Supabase row. */
export function dbRowLocator(
  table: string,
  id: string,
  column?: string
): DbRowLocator {
  return { type: 'db_row', table, id, column };
}

/** Build a DbKeyLocator for a Supabase row keyed by a non-UUID natural key. */
export function dbKeyLocator(
  table: string,
  keyColumn: string,
  keyValue: string,
  column?: string
): DbKeyLocator {
  return {
    type: 'db_key',
    table,
    key_column: keyColumn,
    key_value: keyValue,
    column,
  };
}

/** Parse a corpus client file JSON into the narrow typed subset used by insights. */
export function parseCorpusClientFile(raw: unknown): CorpusClientFile {
  return CorpusClientFile.parse(raw);
}