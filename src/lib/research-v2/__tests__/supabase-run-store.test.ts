import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { persistenceGateEvalCases } from '@/lib/lab-engine/fixtures/persistence-gate-evals';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { activityEventSchema } from '@/lib/lab-engine/events/activity-event';
import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

import {
  createSupabaseRunStore,
  SupabaseRunStoreCommitConflictError,
  SupabaseRunStoreError,
} from '../supabase-run-store';

const parentAuditRunId = '11111111-1111-4111-8111-111111111111';
const sectionRunIdByZone = Object.fromEntries(
  POSITIONING_SECTION_IDS.map((sectionId, index) => [
    sectionId,
    `22222222-2222-4222-8222-${(index + 1).toString().padStart(12, '0')}`,
  ]),
) as Record<(typeof POSITIONING_SECTION_IDS)[number], string>;

interface FakeSupabaseOptions {
  completeSectionZones?: readonly PositioningSectionId[];
  commitResult?: {
    ok: boolean;
    conflict: boolean;
    revision: number;
  };
  commitError?: string;
  markSectionErrorChanged?: boolean;
}

function createSelectQuery(table: string, options: FakeSupabaseOptions) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockResolvedValue({
    data:
      table === 'research_artifact_sections'
        ? (options.completeSectionZones ?? ['positioningMarketCategory']).map(
            (zone) => ({ zone }),
          )
        : [],
    error: null,
  });
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

function createFakeSupabase(options: FakeSupabaseOptions = {}) {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const updateSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: options.markSectionErrorChanged === false ? null : { id: 'updated-section-run' },
    error: null,
  });
  const updateSelect = vi.fn().mockReturnValue({
    maybeSingle: updateSelectMaybeSingle,
  });
  const updateNeq = vi.fn().mockReturnValue({
    select: updateSelect,
  });
  // .eq(...) must be BOTH awaitable (markSectionRunning, telemetry, parent
  // rollup call .eq without .neq) AND expose a chainable .neq (markSectionError
  // adds the `.neq('status', 'complete')` guard).
  const updateEq = vi
    .fn()
    .mockReturnValue(
      Object.assign(Promise.resolve({ error: null }), { neq: updateNeq }),
    );
  const update = vi.fn();
  const selectQueries: Array<{ table: string; query: ReturnType<typeof createSelectQuery> }> = [];
  const from = vi.fn((table: string) => {
    const query = createSelectQuery(table, options);
    selectQueries.push({ table, query });
    return {
      ...query,
      update: (patch: Record<string, unknown>) => {
        updates.push({ table, patch });
        update(patch);
        return { eq: updateEq };
      },
    };
  });
  const rpc = vi.fn((functionName: string, params: Record<string, unknown>) => {
    if (functionName === 'commit_artifact_section') {
      if (options.commitError !== undefined) {
        return Promise.resolve({
          data: null,
          error: { message: options.commitError },
        });
      }
      return Promise.resolve({
        data: options.commitResult ?? { ok: true, conflict: false, revision: 1 },
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
    updateNeq,
    updateSelect,
    updateSelectMaybeSingle,
    selectQueries,
    updates,
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
    expect(fakeSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'running',
        started_at: '2026-05-25T12:00:00.000Z',
        telemetry: expect.objectContaining({
          executionMode: 'lab',
          phase: 'Reading sources',
          provider: expect.any(String),
          model: expect.any(String),
          runtimeTimings: {
            sectionStartedAt: '2026-05-25T12:00:00.000Z',
          },
        }),
      }),
    );

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
    expect(fakeSupabase.update).toHaveBeenCalledWith(
      expect.objectContaining({
        error: null,
        telemetry: expect.objectContaining({
          executionMode: 'lab',
          phase: 'Committed',
          latestActivity: 'Market & Category Intelligence committed',
          runtimeTimings: expect.objectContaining({
            sectionStartedAt: '2026-05-25T12:00:00.000Z',
            commitCompleteAt: '2026-05-25T12:00:00.000Z',
            terminalStatusWrittenAt: '2026-05-25T12:00:00.000Z',
          }),
        }),
      }),
    );
  });

  it('rolls the parent artifact complete when the sixth positioning section commits', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      completeSectionZones: POSITIONING_SECTION_IDS,
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );

    const parentUpdates = fakeSupabase.updates.filter(
      (updateCall) => updateCall.table === 'research_artifacts',
    );
    expect(parentUpdates).toHaveLength(1);
    expect(parentUpdates[0]?.patch).toEqual({
      status: 'complete',
      children_total: 6,
      children_complete: 6,
      updated_at: '2026-05-25T12:00:00.000Z',
    });
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('id', parentAuditRunId);
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

  it('clears a stale section error on a later successful artifact commit', async (): Promise<void> => {
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
      'positioningMarketCategory',
      'sources: have 3, need >=5.',
    );
    expect(failed.sections.positioningMarketCategory?.error).toBe(
      'sources: have 3, need >=5.',
    );

    const saved = await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );
    const committedRunUpdate = fakeSupabase.updates.find((update) => {
      const telemetry = update.patch.telemetry as { phase?: unknown } | undefined;
      return (
        update.table === 'research_section_runs' && telemetry?.phase === 'Committed'
      );
    });

    expect(saved.sections.positioningMarketCategory?.status).toBe('completed');
    expect(saved.sections.positioningMarketCategory?.error).toBeNull();
    expect(committedRunUpdate?.patch).toEqual(
      expect.objectContaining({ error: null }),
    );
  });

  it('does not write failure telemetry or local failed state when the complete-row guard no-ops', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({ markSectionErrorChanged: false });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    const saved = await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );
    expect(saved.sections.positioningMarketCategory?.status).toBe('completed');

    const afterLateFailure = await store.markSectionFailed(
      saaslaunchResearchInput.runId,
      'positioningMarketCategory',
      'late duplicate runner failure',
    );

    expect(fakeSupabase.updateNeq).toHaveBeenCalledWith('status', 'complete');
    expect(fakeSupabase.updateSelect).toHaveBeenCalledWith('id');
    expect(afterLateFailure.sections.positioningMarketCategory?.status).toBe('completed');
    expect(afterLateFailure.sections.positioningMarketCategory?.error).toBeNull();
    expect(
      fakeSupabase.updates.filter((update) => {
        const telemetry = update.patch.telemetry as { phase?: unknown } | undefined;
        return (
          update.table === 'research_section_runs' &&
          telemetry?.phase === 'Needs review'
        );
      }),
    ).toHaveLength(0);
  });

  it('throws a typed commit-conflict error carrying the committed revision when a sibling already advanced the revision', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      commitResult: { ok: false, conflict: true, revision: 1 },
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    const error = await store
      .saveArtifact(saaslaunchResearchInput.runId, marketCategoryFixtureArtifact)
      .then(
        () => null,
        (err: unknown) => err,
      );

    expect(error).toBeInstanceOf(SupabaseRunStoreCommitConflictError);
    const conflictError = error as SupabaseRunStoreCommitConflictError;
    expect(conflictError.conflict).toBe(true);
    expect(conflictError.committedRevision).toBe(1);
  });

  it('throws the generic store error (not the conflict subclass) on a real RPC failure', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({ commitError: 'rpc boom' });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    const error = await store
      .saveArtifact(saaslaunchResearchInput.runId, marketCategoryFixtureArtifact)
      .then(
        () => null,
        (err: unknown) => err,
      );

    expect(error).toBeInstanceOf(SupabaseRunStoreError);
    expect(error).not.toBeInstanceOf(SupabaseRunStoreCommitConflictError);
    expect((error as SupabaseRunStoreError).message).toMatch(/rpc boom/u);
  });

  it('rejects artifacts that fail section minimums before committing to Supabase', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    const shortArtifact = {
      ...marketCategoryFixtureArtifact,
      body: {
        ...marketCategoryFixtureArtifact.body,
        marketSize: {
          ...marketCategoryFixtureArtifact.body.marketSize,
          signals: [],
        },
      },
    };

    await expect(
      store.saveArtifact(saaslaunchResearchInput.runId, shortArtifact),
    ).rejects.toThrow(/body\.marketSize\.signals/u);

    expect(fakeSupabase.rpc).not.toHaveBeenCalledWith(
      'commit_artifact_section',
      expect.anything(),
    );
  });

  for (const evalCase of persistenceGateEvalCases) {
    it(`${evalCase.name} before committing to Supabase`, async (): Promise<void> => {
      const fakeSupabase = createFakeSupabase();
      const store = createSupabaseRunStore({
        supabase: fakeSupabase.supabase,
        parentAuditRunId,
        sectionRunIdByZone,
        researchInput: saaslaunchResearchInput,
        now: () => new Date('2026-05-25T12:00:00.000Z'),
      });

      await expect(
        store.saveArtifact(saaslaunchResearchInput.runId, evalCase.artifact),
      ).rejects.toThrow(evalCase.expectedError);

      expect(fakeSupabase.from).not.toHaveBeenCalled();
      expect(fakeSupabase.rpc).not.toHaveBeenCalled();
    });
  }
});
