// Concrete Supabase-backed implementation of the WebhookSupabase contract.

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  ALL_POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import type { CommitArtifactSectionInput } from '@/lib/research-v2/commit-patch';

const POSITIONING_SECTION_ID_VALUES: ReadonlySet<string> = new Set(
  ALL_POSITIONING_SECTION_IDS,
);

export interface WebhookSupabase {
  /** Insert (with conflict-do-nothing) a row into managed_agents_webhook_events. */
  insertWebhookEvent(row: WebhookEventRow): Promise<{ inserted: boolean; error?: string }>;
  /** Count rows matching (section_run_id, event_type). */
  countWebhookEvents(input: {
    sectionRunId: string;
    eventType: string;
  }): Promise<{ count: number; error?: string }>;
  /** Call commit_artifact_section RPC. */
  commitArtifactSection(input: CommitArtifactSectionInput): Promise<{
    ok: boolean;
    conflict: boolean;
    revision: number;
    error?: string;
  }>;
  /** Look up the (artifact_id, section_type, expectedRevision) for a section_run_id. */
  loadSectionRunContext(sectionRunId: string): Promise<{
    artifactId: string;
    sectionType: AllPositioningSectionId;
    expectedRevision: number;
    error?: string;
  } | null>;
  /** Update research_section_runs.status when we force-error a section. */
  markSectionError(input: {
    sectionRunId: string;
    error: Record<string, unknown>;
  }): Promise<{ ok: boolean; error?: string }>;
}

export interface WebhookEventRow {
  event_id: string;
  session_id: string;
  session_thread_id: string | null;
  artifact_id: string | null;
  section_run_id: string | null;
  section_type: AllPositioningSectionId | null;
  event_type: string;
  created_at: string;
  verified_at: string;
  payload: Record<string, unknown>;
}

export function createSupabaseWebhookAdapter(
  supabase: SupabaseClient,
): WebhookSupabase {
  return {
    async insertWebhookEvent(row: WebhookEventRow) {
      const { error } = await supabase
        .from('managed_agents_webhook_events')
        .insert(row);
      if (!error) return { inserted: true };
      const message = error.message ?? '';
      // Postgres unique-violation code 23505 — fires when event_id already
      // exists (R1 dedupe). We treat that as "already processed".
      if (
        error.code === '23505' ||
        /duplicate key value/i.test(message) ||
        /already exists/i.test(message)
      ) {
        return { inserted: false };
      }
      return { inserted: false, error: message };
    },

    async countWebhookEvents(input) {
      const { count, error } = await supabase
        .from('managed_agents_webhook_events')
        .select('event_id', { count: 'exact', head: true })
        .eq('section_run_id', input.sectionRunId)
        .eq('event_type', input.eventType);
      if (error) return { count: 0, error: error.message };
      return { count: count ?? 0 };
    },

    async commitArtifactSection(input: CommitArtifactSectionInput) {
      const { data, error } = await supabase.rpc('commit_artifact_section', {
        p_artifact_id: input.artifactId,
        p_zone: input.zone,
        p_section_run_id: input.sectionRunId,
        p_expected_revision: input.expectedRevision,
        p_patch: input.patch,
      });
      if (error) {
        return { ok: false, conflict: false, revision: -1, error: error.message };
      }
      const row = Array.isArray(data) ? data[0] : data;
      if (!row || typeof row !== 'object') {
        return {
          ok: false,
          conflict: false,
          revision: -1,
          error: 'commit_artifact_section returned no row',
        };
      }
      const record = row as { ok: boolean; conflict: boolean; revision: number };
      return {
        ok: record.ok === true,
        conflict: record.conflict === true,
        revision: typeof record.revision === 'number' ? record.revision : -1,
      };
    },

    async loadSectionRunContext(sectionRunId: string) {
      const { data, error } = await supabase
        .from('research_section_runs')
        .select('artifact_id, zone')
        .eq('id', sectionRunId)
        .maybeSingle();
      if (error) {
        return {
          artifactId: '',
          sectionType: 'positioningMarketCategory',
          expectedRevision: 0,
          error: error.message,
        };
      }
      if (!data) return null;

      const row = data as { artifact_id: string; zone: string };
      if (!POSITIONING_SECTION_ID_VALUES.has(row.zone)) {
        return {
          artifactId: row.artifact_id,
          sectionType: 'positioningMarketCategory',
          expectedRevision: 0,
          error: `section_run ${sectionRunId} has unsupported zone ${row.zone}`,
        };
      }

      // The expected revision is the current revision on the
      // research_artifact_sections row (set by seed_orchestration to 0 when
      // queued). commit_artifact_section uses compare-and-swap on that
      // revision.
      const { data: sectionData, error: sectionError } = await supabase
        .from('research_artifact_sections')
        .select('revision')
        .eq('artifact_id', row.artifact_id)
        .eq('zone', row.zone)
        .maybeSingle();
      if (sectionError) {
        return {
          artifactId: row.artifact_id,
          sectionType: row.zone as AllPositioningSectionId,
          expectedRevision: 0,
          error: sectionError.message,
        };
      }
      const expectedRevision = (sectionData as { revision?: number } | null)?.revision ?? 0;
      return {
        artifactId: row.artifact_id,
        sectionType: row.zone as AllPositioningSectionId,
        expectedRevision,
      };
    },

    async markSectionError(input) {
      // Guard: never downgrade a row commit_artifact_section already set to
      // 'complete'. A late/duplicate runner failure that loses the CAS race
      // must not clobber the committed section. When the row is already
      // complete the WHERE matches zero rows and Supabase returns error:null,
      // so we still return { ok: true } and the caller does not throw.
      const { error } = await supabase
        .from('research_section_runs')
        .update({
          status: 'error',
          error: input.error,
          completed_at: new Date().toISOString(),
        })
        .eq('id', input.sectionRunId)
        .neq('status', 'complete');
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  };
}
