// Phase 2 of the orchestrator + artifact UI cycle.
//
// Supabase helpers that bridge `runPositioningAuditOrchestrator` (pure
// orchestration loop) to the actual research_artifact_* tables. Kept
// separate from supabase.ts to avoid bloating the existing module and
// to make Phase 2 deps swappable in unit tests.

import { getClient } from '../supabase';
import type { SectionPhaseUpdate } from '../runners/section-phase';

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

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

export interface SectionContextPackInputs {
  gtmBriefSnapshot: Record<string, unknown>;
  gtmBriefReview: Record<string, unknown> | null;
  corpus: unknown;
}

export async function loadSectionContextPackInputs(
  parentAuditRunId: string,
): Promise<SectionContextPackInputs> {
  const supabase = getClient();
  const { data: parent, error: parentError } = await supabase
    .from('research_artifacts')
    .select('user_id, run_id, thesis')
    .eq('id', parentAuditRunId)
    .maybeSingle();

  if (parentError) {
    throw new Error(
      `[orchestrator] loadSectionContextPackInputs parent failed: ${parentError.message}`,
    );
  }
  if (!parent) {
    throw new Error(
      `[orchestrator] loadSectionContextPackInputs parent ${parentAuditRunId} not found`,
    );
  }

  const userId = parent.user_id as string;
  const runId = parent.run_id as string;
  const { data: session, error: sessionError } = await supabase
    .from('journey_sessions')
    .select('research_results,onboarding_data,metadata')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (sessionError) {
    throw new Error(
      `[orchestrator] loadSectionContextPackInputs session failed: ${sessionError.message}`,
    );
  }

  const thesis = asRecord(parent.thesis) ?? {};
  const gtmBriefSnapshot =
    asRecord(thesis.gtmBriefSnapshot) ??
    asRecord(session?.onboarding_data) ??
    {};
  const metadata = asRecord(session?.metadata);
  const gtmBriefReview =
    asRecord(thesis.gtmBriefReview) ??
    asRecord(metadata?.researchV2OnboardingReview);
  const researchResults = asRecord(session?.research_results);
  const deepResearch = asRecord(researchResults?.deepResearchProgram);

  return {
    gtmBriefSnapshot,
    gtmBriefReview,
    corpus: deepResearch?.data ?? researchResults ?? {},
  };
}

export async function updateSectionRunPhase(
  sectionRunId: string,
  update: SectionPhaseUpdate,
): Promise<void> {
  const supabase = getClient();
  const { data, error: readError } = await supabase
    .from('research_section_runs')
    .select('telemetry, started_at')
    .eq('id', sectionRunId)
    .maybeSingle();

  if (readError) {
    throw new Error(
      `[orchestrator] updateSectionRunPhase read failed: ${readError.message}`,
    );
  }

  const now = new Date();
  const startedAt =
    typeof data?.started_at === 'string'
      ? Date.parse(data.started_at)
      : now.getTime();
  const currentTelemetry = asRecord(data?.telemetry) ?? {};
  const nextTelemetry: Record<string, unknown> = {
    ...currentTelemetry,
    ...update,
    phaseStartedAt: update.phaseStartedAt ?? now.toISOString(),
    elapsedMs: update.elapsedMs ?? Math.max(0, now.getTime() - startedAt),
  };

  const { error: updateError } = await supabase
    .from('research_section_runs')
    .update({ telemetry: nextTelemetry })
    .eq('id', sectionRunId);

  if (updateError) {
    throw new Error(
      `[orchestrator] updateSectionRunPhase update failed: ${updateError.message}`,
    );
  }
}
