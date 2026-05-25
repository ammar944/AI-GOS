import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { activityEventSchema } from '@/lib/lab-engine/events/activity-event';
import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

import { createSupabaseRunStore } from '../supabase-run-store';

const parentAuditRunId = '11111111-1111-4111-8111-111111111111';
const sectionRunIdByZone = Object.fromEntries(
  POSITIONING_SECTION_IDS.map((sectionId, index) => [
    sectionId,
    `22222222-2222-4222-8222-${(index + 1).toString().padStart(12, '0')}`,
  ]),
) as Record<(typeof POSITIONING_SECTION_IDS)[number], string>;

function createSelectQuery(table: string) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.maybeSingle.mockResolvedValue(
    table === 'research_section_runs'
      ? {
          data: {
            artifact_id: parentAuditRunId,
            zone: 'positioningMarketCategory',
          },
          error: null,
        }
      : {
          data: { revision: 0 },
          error: null,
        },
  );
  return query;
}

function createFakeSupabase() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const update = vi.fn(() => ({ eq: updateEq }));
  const selectQueries: Array<{ table: string; query: ReturnType<typeof createSelectQuery> }> = [];
  const from = vi.fn((table: string) => {
    const query = createSelectQuery(table);
    selectQueries.push({ table, query });
    return {
      ...query,
      update,
    };
  });
  const rpc = vi.fn((functionName: string, params: Record<string, unknown>) => {
    if (functionName === 'commit_artifact_section') {
      return Promise.resolve({
        data: { ok: true, conflict: false, revision: 1 },
        error: null,
      });
    }

    if (functionName === 'append_section_event') {
      return Promise.resolve({ data: 'event-id', error: null });
    }

    return Promise.resolve({
      data: null,
      error: { message: `unexpected rpc ${functionName}`, params },
    });
  });

  return {
    supabase: { from, rpc } as unknown as SupabaseClient,
    from,
    rpc,
    update,
    updateEq,
    selectQueries,
  };
}

describe('createSupabaseRunStore', (): void => {
  it('keeps the lab RunRecord contract while writing events, status, and artifacts to Supabase', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    const created = await store.createRun(saaslaunchResearchInput);
    expect(created.input).toEqual(saaslaunchResearchInput);
    expect(created.sections.positioningMarketCategory?.status).toBe('idle');

    const running = await store.markSectionRunning(
      saaslaunchResearchInput.runId,
      'positioningMarketCategory',
    );
    expect(running.sections.positioningMarketCategory?.status).toBe('running');
    expect(fakeSupabase.update).toHaveBeenCalledWith({
      status: 'running',
      started_at: '2026-05-25T12:00:00.000Z',
    });

    const event = activityEventSchema.parse({
      id: 'evt_1',
      runId: saaslaunchResearchInput.runId,
      sectionId: 'positioningMarketCategory',
      type: 'section-started',
      message: 'Market category started',
      createdAt: '2026-05-25T12:00:00.000Z',
      metadata: { sectionTitle: 'Market & Category Intelligence' },
    });
    await store.appendEvent(saaslaunchResearchInput.runId, event);
    expect(fakeSupabase.rpc).toHaveBeenCalledWith('append_section_event', {
      p_section_run_id: sectionRunIdByZone.positioningMarketCategory,
      p_event_type: 'section-started',
      p_message: 'Market category started',
      p_payload: event,
    });

    const saved = await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );
    expect(saved.sections.positioningMarketCategory?.status).toBe('completed');
    expect(fakeSupabase.rpc).toHaveBeenCalledWith(
      'commit_artifact_section',
      expect.objectContaining({
        p_artifact_id: parentAuditRunId,
        p_zone: 'positioningMarketCategory',
        p_section_run_id: sectionRunIdByZone.positioningMarketCategory,
        p_expected_revision: 0,
        p_patch: expect.objectContaining({
          status: 'complete',
          data: marketCategoryFixtureArtifact,
          claims: [],
          sources: marketCategoryFixtureArtifact.sources,
        }),
      }),
    );
  });

  it('marks only the failed section run as errored in Supabase and the local record', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    const failed = await store.markSectionFailed(
      saaslaunchResearchInput.runId,
      'positioningBuyerICP',
      'forced Buyer ICP failure',
    );

    expect(fakeSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'error',
        error: {
          message: 'forced Buyer ICP failure',
          source: 'lab_engine',
          sectionId: 'positioningBuyerICP',
        },
        completed_at: expect.any(String),
      }),
    );
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith(
      'id',
      sectionRunIdByZone.positioningBuyerICP,
    );
    expect(failed.sections.positioningBuyerICP?.status).toBe('failed');
    expect(failed.sections.positioningBuyerICP?.error).toBe(
      'forced Buyer ICP failure',
    );
    expect(failed.sections.positioningMarketCategory?.status).toBe('idle');
  });
});
