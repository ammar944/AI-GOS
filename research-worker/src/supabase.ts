// Required Supabase column (add via migration if not present):
// ALTER TABLE journey_sessions ADD COLUMN IF NOT EXISTS job_status JSONB DEFAULT '{}';

import { createClient } from '@supabase/supabase-js';

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
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}

async function writeResearchResultInner(
  userId: string,
  section: string,
  result: ResearchResult,
): Promise<void> {
  const supabase = getClient();

  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id, research_results')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !session) {
    throw new Error(
      `Could not find session for user ${userId}: ${fetchError?.message ?? 'no session returned'}`,
    );
  }

  const existing = (session.research_results as Record<string, unknown>) ?? {};
  const updated = { ...existing, [section]: result };

  const { error: updateError } = await supabase
    .from('journey_sessions')
    .update({ research_results: updated })
    .eq('id', session.id);

  if (updateError) {
    throw new Error(`Failed to write ${section} result: ${updateError.message}`);
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

export interface JobStatusRow {
  status: JobStatus;
  tool: string;
  startedAt: string;
  completedAt?: string;
  lastHeartbeat?: string;
  error?: string;
}

async function writeJobStatusInner(
  userId: string,
  jobId: string,
  row: JobStatusRow,
): Promise<void> {
  const supabase = getClient();

  const { data: session, error: fetchError } = await supabase
    .from('journey_sessions')
    .select('id, job_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (fetchError || !session) {
    throw new Error(
      `writeJobStatus: no session for user ${userId}: ${fetchError?.message ?? 'no session returned'}`,
    );
  }

  const existing = (session.job_status as Record<string, unknown>) ?? {};
  const updated = { ...existing, [jobId]: row };

  const { error: updateError } = await supabase
    .from('journey_sessions')
    .update({ job_status: updated })
    .eq('id', session.id);

  if (updateError) {
    throw new Error(`writeJobStatus failed for job ${jobId}: ${updateError.message}`);
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
