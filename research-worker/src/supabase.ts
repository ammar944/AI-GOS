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

export interface ResearchResult {
  status: 'complete' | 'error';
  section: string;
  data?: unknown;
  error?: string;
  durationMs: number;
}

/**
 * Write a single research section result to journey_sessions.research_results.
 * Uses JSONB merge so concurrent writes don't overwrite each other.
 */
export async function writeResearchResult(
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
    console.error(`[supabase] Could not find session for user ${userId}:`, fetchError?.message);
    return;
  }

  const existing = (session.research_results as Record<string, unknown>) ?? {};
  const updated = { ...existing, [section]: result };

  const { error: updateError } = await supabase
    .from('journey_sessions')
    .update({ research_results: updated })
    .eq('id', session.id);

  if (updateError) {
    console.error(`[supabase] Failed to write ${section} result:`, updateError.message);
  } else {
    console.log(`[worker] Wrote ${section} result (${result.status}) for user ${userId}`);
  }
}

export type JobStatus = 'running' | 'complete' | 'error';

export interface JobStatusRow {
  status: JobStatus;
  tool: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

/**
 * Write a job status entry into journey_sessions.job_status JSONB column.
 * Called synchronously before the job runs (status: 'running') and again
 * on completion or failure. This anchors every job in Supabase so crashes
 * leave a detectable 'running' record rather than silent data loss.
 */
export async function writeJobStatus(
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
    console.error(`[supabase] writeJobStatus: no session for user ${userId}:`, fetchError?.message);
    return;
  }

  const existing = (session.job_status as Record<string, unknown>) ?? {};
  const updated = { ...existing, [jobId]: row };

  const { error: updateError } = await supabase
    .from('journey_sessions')
    .update({ job_status: updated })
    .eq('id', session.id);

  if (updateError) {
    console.error(`[supabase] writeJobStatus failed for job ${jobId}:`, updateError.message);
  }
}
