import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { marketCategoryFixtureArtifact } from '@/lib/lab-engine/fixtures/market-category-artifact';
import { persistenceGateEvalCases } from '@/lib/lab-engine/fixtures/persistence-gate-evals';
import { positioningSynthesisFixtureArtifact } from '@/lib/lab-engine/fixtures/positioning-synthesis-artifact';
import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';
import { activityEventSchema } from '@/lib/lab-engine/events/activity-event';
import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

const profilePersistenceMocks = vi.hoisted(() => ({
  persistAuditProfileBestEffort: vi.fn(),
}));
const reviewMocks = vi.hoisted(() => ({
  reviewAndUpgradeSection: vi.fn(),
}));
const shareSnapshotMocks = vi.hoisted(() => ({
  refreshV3SharedSessionSnapshotsBestEffort: vi.fn(),
}));

vi.mock(
  '@/lib/profiles/section-profile-persistence',
  async (importOriginal) => {
    const actual = await importOriginal<
      typeof import('@/lib/profiles/section-profile-persistence')
    >();

    return {
      ...actual,
      persistAuditProfileBestEffort:
        profilePersistenceMocks.persistAuditProfileBestEffort,
    };
  },
);

vi.mock('@/lib/lab-engine/agents/review/agentic-section-review', () => ({
  reviewAndUpgradeSection: reviewMocks.reviewAndUpgradeSection,
}));

vi.mock('@/lib/research-v2/share-snapshot', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/research-v2/share-snapshot')
  >();

  return {
    ...actual,
    refreshV3SharedSessionSnapshotsBestEffort:
      shareSnapshotMocks.refreshV3SharedSessionSnapshotsBestEffort,
  };
});

import {
  createSupabaseRunStore,
  SupabaseRunStoreCommitConflictError,
  SupabaseRunStoreError,
} from '../supabase-run-store';

const userId = 'user_123';
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
  profileClaimResults?: readonly boolean[];
  profileId?: string | null;
  parentStatus?: string | null;
  synthesisSectionRow?: {
    verification_tier: unknown;
    verification_flag: unknown;
  } | null;
  existingBusinessProfileInsights?: Record<string, unknown>;
}

function createSelectQuery(table: string, options: FakeSupabaseOptions) {
  const resolveRows = (): { data: unknown; error: null } => {
    if (table === 'research_artifact_sections') {
      return {
        data: (options.completeSectionZones ?? ['positioningMarketCategory']).map(
          (zone, index) => ({
            id: `section-${zone}`,
            zone,
            section_run_id:
              sectionRunIdByZone[zone] ?? `section-run-${index + 1}`,
            status: 'complete',
            title: zone,
            data: marketCategoryFixtureArtifact,
            verification_tier: 'verified',
            verification_flag: null,
            counts_toward_rollup: true,
            updated_at: '2026-05-25T12:00:00.000Z',
          }),
        ),
        error: null,
      };
    }

    if (table === 'research_section_runs') {
      return {
        data: (options.completeSectionZones ?? ['positioningMarketCategory']).map(
          (zone, index) => ({
            id: sectionRunIdByZone[zone] ?? `section-run-${index + 1}`,
            zone,
            status: 'complete',
            started_at: '2026-05-25T11:55:00.000Z',
            completed_at: '2026-05-25T12:00:00.000Z',
            aborted_at: null,
            error: null,
            telemetry: {},
          }),
        ),
        error: null,
      };
    }

    return { data: [], error: null };
  };
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
    order: vi.fn(),
    then: vi.fn(
      (
        resolve: (value: { data: unknown; error: null }) => unknown,
        reject?: (reason: unknown) => unknown,
      ) => Promise.resolve(resolveRows()).then(resolve, reject),
    ),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.limit.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.in.mockResolvedValue({
    data:
      table === 'research_artifact_sections'
        ? (options.completeSectionZones ?? ['positioningMarketCategory']).map(
            (zone) => ({ zone }),
          )
        : [],
    error: null,
  });
  if (table === 'research_section_runs') {
    query.maybeSingle.mockResolvedValue({
      data: {
        artifact_id: parentAuditRunId,
        zone: 'positioningMarketCategory',
      },
      error: null,
    });
  } else if (table === 'journey_sessions') {
    query.maybeSingle.mockResolvedValue({
      data: { profile_id: options.profileId ?? null },
      error: null,
    });
  } else if (table === 'research_artifact_sections') {
    query.maybeSingle.mockResolvedValue({
      data: options.synthesisSectionRow ?? null,
      error: null,
    });
  } else if (table === 'business_profiles') {
    query.maybeSingle.mockResolvedValue({
      data: { ai_insights: options.existingBusinessProfileInsights ?? {} },
      error: null,
    });
  } else if (table === 'research_artifacts') {
    query.maybeSingle.mockResolvedValue({
      data: {
        id: parentAuditRunId,
        run_id: saaslaunchResearchInput.runId,
        revision: 0,
        children_complete: 6,
        children_total: 6,
        profile_persisted_at: null,
        created_at: '2026-05-25T11:55:00.000Z',
        updated_at: '2026-05-25T12:00:00.000Z',
        ...(options.parentStatus === undefined
          ? { status: 'running' }
          : { status: options.parentStatus }),
      },
      error: null,
    });
  } else {
    query.maybeSingle.mockResolvedValue({
      data: { revision: 0 },
      error: null,
    });
  }
  return query;
}

function createFakeSupabase(options: FakeSupabaseOptions = {}) {
  const updates: Array<{ table: string; patch: Record<string, unknown> }> = [];
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const upserts: Array<{
    table: string;
    row: Record<string, unknown>;
    options?: Record<string, unknown>;
  }> = [];
  let profileClaimIndex = 0;
  const readProfileClaim = (): boolean => {
    const sequenceValue =
      options.profileClaimResults?.[profileClaimIndex];
    profileClaimIndex += 1;
    return sequenceValue ?? false;
  };
  const updateSelectMaybeSingle = vi.fn().mockResolvedValue({
    data: options.markSectionErrorChanged === false ? null : { id: 'updated-section-run' },
    error: null,
  });
  const updateSelect = vi.fn(() => ({
    data: readProfileClaim() ? [{ id: parentAuditRunId }] : [],
    error: null,
    maybeSingle: updateSelectMaybeSingle,
  }));
  // .neq(...) must be BOTH awaitable (markSectionError's research_artifact_sections
  // cascade ends at .neq and is awaited directly) AND chainable to .select (the
  // research_section_runs guard adds .select('id').maybeSingle()).
  const updateNeq = vi.fn().mockReturnValue(
    Object.assign(Promise.resolve({ error: null }), { select: updateSelect }),
  );
  // .eq(...) must be BOTH awaitable (markSectionRunning, telemetry, parent
  // rollup call .eq without .neq) AND expose a chainable .neq (markSectionError
  // adds the `.neq('status', 'complete')` guard).
  const updateIs = vi.fn().mockReturnValue({ select: updateSelect });
  const updateEq = vi.fn();
  updateEq.mockReturnValue(
    Object.assign(Promise.resolve({ error: null }), {
      eq: updateEq,
      is: updateIs,
      neq: updateNeq,
      select: updateSelect,
    }),
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
      insert: (row: Record<string, unknown>) => {
        inserts.push({ table, row });
        return Promise.resolve({ data: row, error: null });
      },
      upsert: (
        row: Record<string, unknown>,
        upsertOptions?: Record<string, unknown>,
      ) => {
        upserts.push({ table, row, options: upsertOptions });
        return Promise.resolve({ data: row, error: null });
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
    updateIs,
    updateSelect,
    updateSelectMaybeSingle,
    selectQueries,
    updates,
    inserts,
    upserts,
  };
}

describe('createSupabaseRunStore', (): void => {
  beforeEach((): void => {
    profilePersistenceMocks.persistAuditProfileBestEffort.mockReset();
    profilePersistenceMocks.persistAuditProfileBestEffort.mockResolvedValue('profile-123');
    reviewMocks.reviewAndUpgradeSection.mockReset();
    reviewMocks.reviewAndUpgradeSection.mockResolvedValue({
      upgradedMarkdown: 'Reviewed market category markdown.',
      tier: 'verified',
      tierRationale: 'Review found support for the client-facing claims.',
      removedItems: [],
      clientQuestions: [],
    });
    shareSnapshotMocks.refreshV3SharedSessionSnapshotsBestEffort.mockReset();
    shareSnapshotMocks.refreshV3SharedSessionSnapshotsBestEffort.mockResolvedValue(0);
  });

  it('keeps the lab RunRecord contract while writing events, status, and artifacts to Supabase', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
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
          data: expect.objectContaining({
            ...marketCategoryFixtureArtifact,
            review: expect.objectContaining({
              upgradedMarkdown: 'Reviewed market category markdown.',
              tier: 'verified',
            }),
          }),
          markdown: 'Reviewed market category markdown.',
          claims: [],
          sources: marketCategoryFixtureArtifact.sources,
        }),
      }),
    );
    expect(reviewMocks.reviewAndUpgradeSection).toHaveBeenCalledWith(
      expect.objectContaining({
        artifact: marketCategoryFixtureArtifact,
        researchInput: saaslaunchResearchInput,
        sectionId: 'positioningMarketCategory',
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
    expect(profilePersistenceMocks.persistAuditProfileBestEffort).not.toHaveBeenCalled();
  });

  it('claims and records profile persistence after the DB rollup completes the parent', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      profileClaimResults: [true],
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
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
      profile_persisted_at: '2026-05-25T12:00:00.000Z',
    });
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('id', parentAuditRunId);
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('status', 'complete');
    expect(fakeSupabase.updateIs).toHaveBeenCalledWith(
      'profile_persisted_at',
      null,
    );
    expect(fakeSupabase.updateSelect).toHaveBeenCalledWith('id');
    expect(profilePersistenceMocks.persistAuditProfileBestEffort).toHaveBeenCalledTimes(1);
    expect(profilePersistenceMocks.persistAuditProfileBestEffort).toHaveBeenCalledWith({
      supabase: fakeSupabase.supabase,
      userId,
      runId: saaslaunchResearchInput.runId,
      researchInput: saaslaunchResearchInput,
      parentAuditRunId,
    });
    expect(fakeSupabase.inserts).toEqual([
      {
        table: 'research_section_events',
        row: {
          section_run_id: null,
          artifact_id: parentAuditRunId,
          zone: null,
          event_type: 'profile_persisted',
          message: 'business profile persisted',
          payload: {
            profile_id: 'profile-123',
            run_id: saaslaunchResearchInput.runId,
          },
        },
      },
    ]);
  });

  it('persists the additive live quality gate report after the parent completes', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      completeSectionZones: POSITIONING_SECTION_IDS,
      profileClaimResults: [true],
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );

    expect(fakeSupabase.upserts).toEqual([
      {
        table: 'research_quality_gate_results',
        row: expect.objectContaining({
          run_id: saaslaunchResearchInput.runId,
          artifact_id: parentAuditRunId,
          gate_version: 'research-quality-gates-v1',
          result: expect.objectContaining({
            runId: saaslaunchResearchInput.runId,
            gates: expect.objectContaining({
              projectionTrust: expect.any(Object),
              projectionSync: expect.any(Object),
            }),
          }),
          report_markdown: expect.stringContaining('Projection trust'),
          computed_at: '2026-05-25T12:00:00.000Z',
        }),
        options: { onConflict: 'run_id,gate_version' },
      },
    ]);
  });

  it('persists advisory verification tier metadata while leaving section status complete', async (): Promise<void> => {
    reviewMocks.reviewAndUpgradeSection.mockResolvedValueOnce({
      upgradedMarkdown: 'Needs review markdown.',
      tier: 'needs_review',
      tierRationale: 'Reviewer downgraded one unsupported load-bearing claim.',
      removedItems: ['Unsupported TAM precision'],
      clientQuestions: ['Can you provide sourced TAM assumptions?'],
    });
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    const needsReviewArtifact = {
      ...marketCategoryFixtureArtifact,
      verification: {
        verifiedCount: 2,
        unsupportedCount: 1,
        claims: [],
      },
    };

    const saved = await store.saveArtifact(
      saaslaunchResearchInput.runId,
      needsReviewArtifact,
    );

    expect(saved.sections.positioningMarketCategory?.status).toBe('completed');
    expect(fakeSupabase.rpc).toHaveBeenCalledWith(
      'commit_artifact_section',
      expect.objectContaining({
        p_patch: expect.objectContaining({
          status: 'complete',
          verificationTier: 'needs_review',
          verificationFlag: expect.objectContaining({
            tier: 'needs_review',
            verifiedCount: 2,
            unsupportedCount: 1,
            confidence: 2 / 3,
            needsReviewThreshold: 0.75,
            insufficientThreshold: 0.5,
          }),
          markdown: 'Needs review markdown.',
          data: expect.objectContaining({
            review: expect.objectContaining({
              removedItems: ['Unsupported TAM precision'],
              clientQuestions: ['Can you provide sourced TAM assumptions?'],
            }),
          }),
        }),
      }),
    );
  });

  it('patches synthesis profile state with the committed section row tier and flag', async (): Promise<void> => {
    const needsReviewFlag = {
      tier: 'needs_review',
      verifiedCount: 7,
      unsupportedCount: 2,
      totalClaims: 9,
      confidence: 7 / 9,
      needsReviewThreshold: 0.75,
      insufficientThreshold: 0.5,
      evidenceGap: false,
    };
    const fakeSupabase = createFakeSupabase({
      profileId: 'profile-123',
      synthesisSectionRow: {
        verification_tier: 'needs_review',
        verification_flag: needsReviewFlag,
      },
      existingBusinessProfileInsights: {
        positioningMarketCategory: { verificationTier: 'verified' },
      },
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone: {
        ...sectionRunIdByZone,
        [POSITIONING_SYNTHESIS_SECTION_ID]:
          '22222222-2222-4222-8222-000000000099',
      },
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      positioningSynthesisFixtureArtifact,
    );

    const synthesisTierQuery = fakeSupabase.selectQueries.find(
      (entry) =>
        entry.table === 'research_artifact_sections' &&
        entry.query.select.mock.calls.some(
          (call) => call[0] === 'verification_tier, verification_flag',
        ),
    );
    expect(synthesisTierQuery?.query.select).toHaveBeenCalledWith(
      'verification_tier, verification_flag',
    );
    expect(synthesisTierQuery?.query.eq).toHaveBeenCalledWith(
      'artifact_id',
      parentAuditRunId,
    );
    expect(synthesisTierQuery?.query.eq).toHaveBeenCalledWith(
      'zone',
      POSITIONING_SYNTHESIS_SECTION_ID,
    );

    const profileUpdate = fakeSupabase.updates.find(
      (update) =>
        update.table === 'business_profiles' &&
        Object.prototype.hasOwnProperty.call(update.patch, 'ai_insights'),
    );
    expect(profileUpdate?.patch.ai_insights).toEqual(
      expect.objectContaining({
        positioningMarketCategory: { verificationTier: 'verified' },
        positioningSynthesis: expect.objectContaining({
          verificationTier: 'needs_review',
          verificationFlag: needsReviewFlag,
        }),
      }),
    );
    expect(profileUpdate?.patch.positioning_strategy).toEqual(
      expect.objectContaining({
        verificationTier: 'needs_review',
        verificationFlag: needsReviewFlag,
      }),
    );
  });

  it('commits the original artifact when the agentic review hook fails', async (): Promise<void> => {
    reviewMocks.reviewAndUpgradeSection.mockRejectedValueOnce(
      new Error('review transport failed'),
    );
    const warn = vi.spyOn(console, 'warn').mockImplementation((): void => {});
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );

    expect(fakeSupabase.rpc).toHaveBeenCalledWith(
      'commit_artifact_section',
      expect.objectContaining({
        p_patch: expect.objectContaining({
          data: marketCategoryFixtureArtifact,
        }),
      }),
    );
    expect(warn).toHaveBeenCalledWith(
      '[supabase-run-store] agentic section review failed; committing original artifact:',
      'review transport failed',
    );
    warn.mockRestore();
  });

  it('passes the configured agentic review timeout to the review hook', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      env: { LAB_REVIEW_TIMEOUT_MS: '1234' },
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );

    expect(reviewMocks.reviewAndUpgradeSection).toHaveBeenCalledWith(
      expect.objectContaining({
        timeoutMs: 1234,
      }),
    );
  });

  it('awaits profile persistence before resolving the completing artifact save', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      profileClaimResults: [true],
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    let releasePersist: (() => void) | null = null;
    const persistStarted = new Promise<void>((resolveStarted) => {
      profilePersistenceMocks.persistAuditProfileBestEffort.mockImplementation(
        (): Promise<void> =>
          new Promise<void>((resolvePersist) => {
            releasePersist = resolvePersist;
            resolveStarted();
          }),
      );
    });
    let saveSettled = false;

    const savePromise = store
      .saveArtifact(saaslaunchResearchInput.runId, marketCategoryFixtureArtifact)
      .finally((): void => {
        saveSettled = true;
      });

    await persistStarted;
    expect(saveSettled).toBe(false);

    if (releasePersist === null) {
      throw new Error('persistAuditProfileBestEffort did not expose a resolver');
    }

    (releasePersist as () => void)();
    await savePromise;
    expect(saveSettled).toBe(true);
  });

  it('persists profile only once when concurrent committers race the profile claim', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      profileClaimResults: [true, false],
    });
    const firstStore = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });
    const secondStore = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await Promise.all([
      firstStore.saveArtifact(
        saaslaunchResearchInput.runId,
        marketCategoryFixtureArtifact,
      ),
      secondStore.saveArtifact(
        saaslaunchResearchInput.runId,
        marketCategoryFixtureArtifact,
      ),
    ]);

    expect(fakeSupabase.updateIs).toHaveBeenCalledTimes(2);
    expect(fakeSupabase.updateSelect).toHaveBeenCalledTimes(2);
    expect(profilePersistenceMocks.persistAuditProfileBestEffort).toHaveBeenCalledTimes(1);
  });

  it('patches a linked profile section insight when the parent was already persisted', async (): Promise<void> => {
    const needsReviewFlag = {
      tier: 'needs_review',
      verifiedCount: 5,
      unsupportedCount: 2,
      totalClaims: 7,
      confidence: 5 / 7,
      needsReviewThreshold: 0.75,
      insufficientThreshold: 0.5,
      evidenceGap: false,
    };
    const fakeSupabase = createFakeSupabase({
      profileClaimResults: [false],
      profileId: 'profile-123',
      synthesisSectionRow: {
        verification_tier: 'needs_review',
        verification_flag: needsReviewFlag,
      },
      existingBusinessProfileInsights: {
        positioningDemandIntent: { verificationTier: 'insufficient' },
      },
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );

    expect(profilePersistenceMocks.persistAuditProfileBestEffort).not.toHaveBeenCalled();
    const profileUpdates = fakeSupabase.updates.filter(
      (updateCall) => updateCall.table === 'business_profiles',
    );
    expect(profileUpdates).toHaveLength(1);
    expect(profileUpdates[0]?.patch).toEqual(
      expect.objectContaining({
        ai_insights: expect.objectContaining({
          positioningDemandIntent: { verificationTier: 'insufficient' },
          positioningMarketCategory: expect.objectContaining({
            verdict: marketCategoryFixtureArtifact.verdict,
            verificationTier: 'needs_review',
            verificationFlag: needsReviewFlag,
          }),
        }),
        last_research_at: expect.any(String),
      }),
    );
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('id', 'profile-123');
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith('user_id', userId);
  });

  it('rebuilds completed profile and share projections after a rerun commit', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase({
      parentStatus: 'complete',
      profileClaimResults: [false],
      profileId: 'profile-123',
      existingBusinessProfileInsights: {
        positioningMarketCategory: { verificationTier: 'insufficient' },
      },
    });
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
      parentAuditRunId,
      sectionRunIdByZone,
      researchInput: saaslaunchResearchInput,
      now: () => new Date('2026-05-25T12:00:00.000Z'),
    });

    await store.saveArtifact(
      saaslaunchResearchInput.runId,
      marketCategoryFixtureArtifact,
    );

    expect(profilePersistenceMocks.persistAuditProfileBestEffort).toHaveBeenCalledWith({
      supabase: fakeSupabase.supabase,
      userId,
      runId: saaslaunchResearchInput.runId,
      researchInput: saaslaunchResearchInput,
      parentAuditRunId,
    });
    expect(shareSnapshotMocks.refreshV3SharedSessionSnapshotsBestEffort).toHaveBeenCalledWith({
      supabase: fakeSupabase.supabase,
      userId,
      runId: saaslaunchResearchInput.runId,
    });
    expect(fakeSupabase.updates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          table: 'research_artifacts',
          patch: { profile_persisted_at: '2026-05-25T12:00:00.000Z' },
        }),
      ]),
    );
    expect(
      fakeSupabase.updates.some(
        (updateCall) =>
          updateCall.table === 'business_profiles' &&
          Object.prototype.hasOwnProperty.call(updateCall.patch, 'ai_insights'),
      ),
    ).toBe(false);
  });

  it('marks the failed section run and its projector row as errored, leaving sibling sections untouched', async (): Promise<void> => {
    const fakeSupabase = createFakeSupabase();
    const store = createSupabaseRunStore({
      supabase: fakeSupabase.supabase,
      userId,
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
    // Dual-write: the projector row (research_artifact_sections) is also moved
    // to a terminal error, scoped to this run's section_run_id, so the reader
    // renders a clean failed card instead of a frozen 'running' one.
    expect(
      fakeSupabase.updates.some(
        (entry) =>
          entry.table === 'research_artifact_sections' &&
          entry.patch.status === 'error',
      ),
    ).toBe(true);
    expect(fakeSupabase.updateEq).toHaveBeenCalledWith(
      'section_run_id',
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
      userId,
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
      userId,
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
    // The complete-row guard no-opped the run-row update (changed=false), so the
    // committed projector row must NOT be downgraded to error by a late failure.
    expect(
      fakeSupabase.updates.some(
        (entry) =>
          entry.table === 'research_artifact_sections' &&
          entry.patch.status === 'error',
      ),
    ).toBe(false);
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
      userId,
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
      userId,
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
      userId,
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
        userId,
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
