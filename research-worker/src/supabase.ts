// Required Supabase column (add via migration if not present):
// ALTER TABLE journey_sessions ADD COLUMN IF NOT EXISTS job_status JSONB DEFAULT '{}';

import { createClient } from '@supabase/supabase-js';
import type { RunnerTelemetry } from './telemetry';

const ACTIVE_RUN_ID_KEY = 'activeJourneyRunId';

export function getSupabaseUrl(): string | undefined {
  return process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
}

export function getClient() {
  const url = getSupabaseUrl();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error('SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
  }
  return createClient(url, key, {
    auth: { persistSession: false },
  });
}

/**
 * Retry a Supabase operation with exponential backoff (1s, 2s, 4s).
 * The supplied fn must throw on failure — silent returns are not retried.
 */
async function withSupabaseRetry<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < maxRetries) {
        const delayMs = 1000 * Math.pow(2, attempt - 1); // 1s, 2s, 4s
        console.warn(
          `[supabase] ${label} failed (attempt ${attempt}/${maxRetries}), retrying in ${delayMs}ms:`,
          err instanceof Error ? err.message : String(err),
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  const message =
    lastError instanceof Error ? lastError.message : String(lastError);
  throw new Error(`[supabase] ${label} failed after ${maxRetries} attempts: ${message}`);
}

export type ProvenanceSource =
  | 'user_data'
  | 'web_search'
  | 'tool_output'
  | 'template_default'
  | 'ai_synthesis'
  | 'meeting_intel';

export interface FieldProvenance {
  field: string;
  source: ProvenanceSource;
  sourceDetail?: string;
  confidence: number;
}

export interface ResearchResult {
  runId?: string;
  status: 'complete' | 'partial' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
  rawText?: string;
  citations?: Array<{
    number?: number;
    url: string;
    title?: string;
  }>;
  provenance?: {
    status: 'sourced' | 'missing';
    citationCount: number;
  };
  fieldProvenance?: FieldProvenance[];
  validation?: {
    section?: string;
    issues?: Array<{
      code: string;
      message: string;
      path?: string;
    }>;
  };
  telemetry?: RunnerTelemetry;
}

async function isActiveJourneyRun(
  userId: string,
  runId: string | undefined,
): Promise<boolean> {
  if (!runId) {
    return false;
  }

  const supabase = getClient();
  const query = supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('user_id', userId);

  // If we have a runId, filter by it directly
  if (runId) {
    query.eq('run_id', runId);
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to read active journey run for ${userId}: ${error.message}`);
  }

  const currentRunId =
    data?.metadata &&
    typeof data.metadata === 'object' &&
    !Array.isArray(data.metadata) &&
    ACTIVE_RUN_ID_KEY in data.metadata &&
    typeof data.metadata[ACTIVE_RUN_ID_KEY] === 'string'
      ? (data.metadata[ACTIVE_RUN_ID_KEY] as string)
      : null;

  return currentRunId === runId;
}

async function writeResearchResultInner(
  userId: string,
  section: string,
  result: ResearchResult,
): Promise<void> {
  if (!(await isActiveJourneyRun(userId, result.runId))) {
    console.warn('[worker] Skipping stale research result for inactive run:', {
      section,
      runId: result.runId ?? null,
      userId,
    });
    return;
  }

  const supabase = getClient();
  const { error } = await supabase.rpc('merge_journey_session_research_result', {
    p_user_id: userId,
    p_run_id: result.runId ?? '',
    p_section: section,
    p_result: result,
  });

  if (error) {
    throw new Error(`Failed to write ${section} result: ${error.message}`);
  }

  console.log(`[worker] Wrote ${section} result (${result.status}) for user ${userId}`);
}

/**
 * Write a single research section result to journey_sessions.research_results.
 * Uses JSONB merge so concurrent writes don't overwrite each other.
 * Retries up to 3 times with exponential backoff on failure.
 */
export async function writeResearchResult(
  userId: string,
  section: string,
  result: ResearchResult,
): Promise<void> {
  await withSupabaseRetry(
    () => writeResearchResultInner(userId, section, result),
    `writeResearchResult(${section}, user=${userId})`,
  );
}

export type JobStatus = 'running' | 'complete' | 'error';

export interface JobStatusUpdateMeta {
  url?: string;
  screenshotUrl?: string;
  favicon?: string;
  pageTitle?: string;
  dataPoints?: Array<{ label: string; value: string }>;
  toolName?: string;
  resultCount?: number;
}

export interface JobStatusUpdate {
  at: string;
  id: string;
  message: string;
  phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
  meta?: JobStatusUpdateMeta;
}

export interface JobStatusRow {
  runId?: string;
  status: JobStatus;
  tool: string;
  startedAt: string;
  completedAt?: string;
  lastHeartbeat?: string;
  error?: string;
  updates?: JobStatusUpdate[];
  telemetry?: RunnerTelemetry;
}

const MAX_UPDATES_PER_SECTION = 50;

export function mergeJobUpdates(
  existing: JobStatusUpdate[] | undefined,
  incoming: JobStatusUpdate[] | undefined,
): JobStatusUpdate[] | undefined {
  if (!existing?.length && !incoming?.length) {
    return undefined;
  }

  const deduped = new Map<string, JobStatusUpdate>();

  for (const update of existing ?? []) {
    deduped.set(update.id, update);
  }

  for (const update of incoming ?? []) {
    deduped.set(update.id, update);
  }

  const sorted = [...deduped.values()].sort((left, right) =>
    left.at.localeCompare(right.at),
  );

  if (sorted.length <= MAX_UPDATES_PER_SECTION) {
    return sorted;
  }

  // Keep the newest updates, drop oldest
  return sorted.slice(sorted.length - MAX_UPDATES_PER_SECTION);
}

function mergeJobStatusRow(
  existing: JobStatusRow | undefined,
  incoming: JobStatusRow,
): JobStatusRow {
  return {
    ...existing,
    ...incoming,
    updates: mergeJobUpdates(existing?.updates, incoming.updates),
  };
}

async function writeJobStatusInner(
  userId: string,
  jobId: string,
  row: JobStatusRow,
): Promise<void> {
  if (!(await isActiveJourneyRun(userId, row.runId))) {
    console.warn('[worker] Skipping stale job status for inactive run:', {
      jobId,
      runId: row.runId ?? null,
      userId,
    });
    return;
  }

  const supabase = getClient();
  const { error } = await supabase.rpc('merge_journey_session_job_status', {
    p_user_id: userId,
    p_run_id: row.runId ?? '',
    p_job_id: jobId,
    p_row: row,
  });

  if (error) {
    throw new Error(`writeJobStatus failed for job ${jobId}: ${error.message}`);
  }
}

/**
 * Write a job status entry into journey_sessions.job_status JSONB column.
 * Called synchronously before the job runs (status: 'running') and again
 * on completion or failure. This anchors every job in Supabase so crashes
 * leave a detectable 'running' record rather than silent data loss.
 * Retries up to 3 times with exponential backoff on failure.
 */
export async function writeJobStatus(
  userId: string,
  jobId: string,
  row: JobStatusRow,
): Promise<void> {
  await withSupabaseRetry(
    () => writeJobStatusInner(userId, jobId, row),
    `writeJobStatus(job=${jobId}, user=${userId})`,
  );
}

/** Write progressive script pack updates to the script_packs table. */
export async function writeScriptPackUpdate(
  packId: string,
  update: { scripts?: unknown; status?: string; error_message?: string; diversity_score?: number; diversity_flags?: string; script_count?: number },
): Promise<void> {
  await withSupabaseRetry(async () => {
    const client = getClient();
    const { error } = await client
      .from('script_packs')
      .update(update)
      .eq('id', packId);
    if (error) throw error;
  }, `writeScriptPackUpdate(${packId})`);
}

// ---------------------------------------------------------------------------
// Shadow mode writers (Phase 0.2)
//
// RESEARCH_SHADOW_MODE=true enables dual-write: primary output goes to
// journey_sessions.research_results (user-visible), shadow output goes to
// research_results_shadow (never shown to users). Diff pipeline writes to
// research_eval_diffs for regression detection.
// ---------------------------------------------------------------------------

export interface ShadowRunInput {
  userId: string;
  runId: string;
  section: string;
  result: unknown;
  pipelineVersion?: string;
  durationMs?: number;
}

/**
 * Write a shadow-pipeline result. Safe no-op if RESEARCH_SHADOW_MODE is not
 * 'true'. Fire-and-forget at the call site — failures log but don't throw.
 */
export async function writeResearchResultShadow(input: ShadowRunInput): Promise<void> {
  if (process.env.RESEARCH_SHADOW_MODE !== 'true') return;
  const client = getClient();
  const { error } = await client.from('research_results_shadow').upsert(
    {
      user_id: input.userId,
      run_id: input.runId,
      section: input.section,
      result: input.result as Record<string, unknown>,
      pipeline_version: input.pipelineVersion ?? process.env.PIPELINE_VERSION ?? null,
      duration_ms: input.durationMs ?? null,
    },
    { onConflict: 'user_id,run_id,section,pipeline_version' },
  );
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[shadow] writeResearchResultShadow failed (non-fatal):', error.message);
  }
}

export interface EvalDiffInput {
  userId: string;
  runId: string;
  section: string;
  card?: string;
  diffScore?: number;
  fieldRecall?: number;
  citationDelta?: number;
  fabricationDelta?: number;
  phase?: string;
  pipelineVersionPrimary?: string;
  pipelineVersionShadow?: string;
  diffPayload?: unknown;
}

/**
 * Record a structured diff between primary and shadow pipelines. Used by the
 * nightly eval job + ad-hoc regression runs. Fire-and-forget.
 */
export async function writeEvalDiff(input: EvalDiffInput): Promise<void> {
  const client = getClient();
  const { error } = await client.from('research_eval_diffs').insert({
    user_id: input.userId,
    run_id: input.runId,
    section: input.section,
    card: input.card ?? null,
    diff_score: input.diffScore ?? null,
    field_recall: input.fieldRecall ?? null,
    citation_delta: input.citationDelta ?? null,
    fabrication_delta: input.fabricationDelta ?? null,
    phase: input.phase ?? null,
    pipeline_version_primary: input.pipelineVersionPrimary ?? null,
    pipeline_version_shadow: input.pipelineVersionShadow ?? null,
    diff_payload: (input.diffPayload as Record<string, unknown> | undefined) ?? null,
  });
  if (error) {
    // eslint-disable-next-line no-console
    console.warn('[shadow] writeEvalDiff failed (non-fatal):', error.message);
  }
}

// ---------------------------------------------------------------------------
// Telemetry persister (Phase 0.4)
// Registered with the telemetry module via lazy-binding to avoid a circular
// import. Writes are fire-and-forget; failures are logged by the telemetry
// module and never propagate to the caller.
// ---------------------------------------------------------------------------

import { registerTelemetryPersister, type TelemetryEvent } from './telemetry';

async function persistTelemetryEvent(event: TelemetryEvent): Promise<void> {
  const client = getClient();
  const { error } = await client.from('research_telemetry').insert({
    run_id: event.runId,
    user_id: event.userId,
    event: event.event,
    section: event.section,
    card: event.card,
    phase: event.phase,
    duration_ms: event.durationMs,
    model: event.model,
    input_tokens: event.inputTokens,
    output_tokens: event.outputTokens,
    cache_creation_tokens: event.cacheCreationTokens,
    cache_read_tokens: event.cacheReadTokens,
    estimated_cost_usd: event.estimatedCostUsd,
    error_message: event.errorMessage,
    extra: event.extra ?? null,
    event_timestamp: event.timestamp,
  });
  if (error) throw new Error(`research_telemetry insert failed: ${error.message}`);
}

registerTelemetryPersister(persistTelemetryEvent);
