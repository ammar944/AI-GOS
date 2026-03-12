import { createAdminClient } from '@/lib/supabase/server';
import { normalizeStoredResearchResults } from '@/lib/journey/research-result-contract';

export interface JobStatusRow {
  status: 'running' | 'complete' | 'error';
  tool: string;
  startedAt: string;
  completedAt?: string;
  error?: string;
}

export async function readResearchResult(
  userId: string,
  section: string,
): Promise<unknown | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const results = normalizeStoredResearchResults(
    data.research_results as Record<string, unknown> | null,
    'boundary',
  );
  const result = results?.[section] ?? null;
  if (result && typeof result === 'object' && 'data' in result) {
    return (result as { data?: unknown }).data ?? result;
  }

  return result;
}

export async function readJobStatus(
  userId: string,
  jobId: string,
): Promise<JobStatusRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('job_status')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const statuses = data.job_status as Record<string, JobStatusRow> | null;
  return statuses?.[jobId] ?? null;
}
