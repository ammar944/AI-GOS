// Phase 2 of the orchestrator + artifact UI cycle.
//
// Supabase helpers that bridge `runPositioningAuditOrchestrator` (pure
// orchestration loop) to the actual research_artifact_* tables. Kept
// separate from supabase.ts to avoid bloating the existing module and
// to make Phase 2 deps swappable in unit tests.

import { getClient } from '../supabase';

export interface SectionChildRow {
  section_run_id: string;
  zone: string;
  status: string;
}

export async function loadChildrenForParent(
  parentAuditRunId: string,
): Promise<SectionChildRow[]> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('research_section_runs')
    .select('id, zone, status')
    .eq('artifact_id', parentAuditRunId)
    .order('started_at', { ascending: true });

  if (error) {
    throw new Error(
      `[orchestrator] loadChildrenForParent failed: ${error.message}`,
    );
  }
  return (data ?? []).map((row) => ({
    section_run_id: row.id as string,
    zone: row.zone as string,
    status: row.status as string,
  }));
}

export async function markSectionRunStatus(
  sectionRunId: string,
  status: 'running' | 'complete' | 'error' | 'aborted',
  options: {
    error?: { code?: string; message: string } | null;
  } = {},
): Promise<void> {
  const supabase = getClient();
  const patch: Record<string, unknown> = { status };
  if (status === 'running') {
    patch.started_at = new Date().toISOString();
  }
  if (status === 'complete' || status === 'error') {
    patch.completed_at = new Date().toISOString();
  }
  if (status === 'aborted') {
    patch.aborted_at = new Date().toISOString();
  }
  if (options.error !== undefined) {
    patch.error = options.error;
  }

  const { error } = await supabase
    .from('research_section_runs')
    .update(patch)
    .eq('id', sectionRunId);
  if (error) {
    throw new Error(
      `[orchestrator] markSectionRunStatus(${status}) failed: ${error.message}`,
    );
  }
}

export async function rollupParentStatus(
  parentAuditRunId: string,
  status: 'running' | 'complete' | 'partial' | 'error' | 'aborted',
  childrenComplete: number,
): Promise<void> {
  const supabase = getClient();
  const { error } = await supabase
    .from('research_artifacts')
    .update({
      status,
      children_complete: childrenComplete,
      updated_at: new Date().toISOString(),
    })
    .eq('id', parentAuditRunId);
  if (error) {
    throw new Error(
      `[orchestrator] rollupParentStatus(${status}) failed: ${error.message}`,
    );
  }
}

export async function isParentAuditAborted(
  parentAuditRunId: string,
): Promise<boolean> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('research_artifacts')
    .select('status')
    .eq('id', parentAuditRunId)
    .maybeSingle();
  if (error) {
    console.warn(
      `[orchestrator] isParentAuditAborted check failed: ${error.message}`,
    );
    return false;
  }
  return (data?.status as string | undefined) === 'aborted';
}

export async function loadParentRun(
  parentAuditRunId: string,
): Promise<{ user_id: string; run_id: string } | null> {
  const supabase = getClient();
  const { data, error } = await supabase
    .from('research_artifacts')
    .select('user_id, run_id')
    .eq('id', parentAuditRunId)
    .maybeSingle();
  if (error) {
    console.warn(`[orchestrator] loadParentRun failed: ${error.message}`);
    return null;
  }
  if (!data) return null;
  return {
    user_id: data.user_id as string,
    run_id: data.run_id as string,
  };
}
