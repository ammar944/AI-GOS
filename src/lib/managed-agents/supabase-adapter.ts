// Concrete Supabase-backed implementation of the WebhookSupabase contract.
//
// Lives outside webhook-handler.ts so the handler can be tested with an
// in-memory fake (see __tests__/webhook-handler.test.ts).

import type { SupabaseClient } from '@supabase/supabase-js';

import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

import type {
  CommitArtifactSectionInput,
  WebhookEventRow,
  WebhookSupabase,
} from './webhook-handler';

const POSITIONING_SECTION_ID_VALUES: ReadonlySet<string> = new Set([
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
]);

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
          sectionType: 'positioningMarketCategory' as PositioningSectionId,
          expectedRevision: 0,
          error: error.message,
        };
      }
      if (!data) return null;

      const row = data as { artifact_id: string; zone: string };
      if (!POSITIONING_SECTION_ID_VALUES.has(row.zone)) {
        return {
          artifactId: row.artifact_id,
          sectionType: 'positioningMarketCategory' as PositioningSectionId,
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
          sectionType: row.zone as PositioningSectionId,
          expectedRevision: 0,
          error: sectionError.message,
        };
      }
      const expectedRevision = (sectionData as { revision?: number } | null)?.revision ?? 0;
      return {
        artifactId: row.artifact_id,
        sectionType: row.zone as PositioningSectionId,
        expectedRevision,
      };
    },

    async markSectionError(input) {
      const { error } = await supabase
        .from('research_section_runs')
        .update({
          status: 'error',
          error: input.error,
          completed_at: new Date().toISOString(),
        })
        .eq('id', input.sectionRunId);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    },
  };
}
