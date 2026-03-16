// Required Supabase column (add via migration if not present):
// ALTER TABLE journey_sessions ADD COLUMN IF NOT EXISTS job_status JSONB DEFAULT '{}';

import { createClient } from '@supabase/supabase-js';
import type { RunnerTelemetry } from './telemetry';

const ACTIVE_RUN_ID_KEY = 'activeJourneyRunId';

function getClient() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required');
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
    return true;
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

export interface JobStatusUpdate {
  at: string;
  id: string;
  message: string;
  phase: 'runner' | 'tool' | 'analysis' | 'output' | 'error';
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

function mergeJobUpdates(
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

  return [...deduped.values()].sort((left, right) =>
    left.at.localeCompare(right.at),
  );
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
