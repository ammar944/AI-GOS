import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { researchInputSchema } from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import type { SupportedSectionId } from '@/lib/lab-engine/sections/section-registry';
import type {
  SectionRunClaimResult,
  SectionRunClaimStatus,
} from '@/lib/research-v2/section-run-claim';
import type { SeedOrchestrationResult } from '../orchestrate-db';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const USER_ID = 'user_1';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const SECTION_ID = 'positioningBuyerICP' satisfies SupportedSectionId;
const SECTION_RUN_ID = '22222222-2222-4222-8222-000000000002';
const CLAIMED_SECTION_RUN_ID = '33333333-3333-4333-8333-000000000002';

type SeededStatus = 'queued' | 'running' | 'complete' | 'error';

const dispatchMocks = vi.hoisted(() => {
  const seedOrchestration = vi.fn();
  const claimSectionRun = vi.fn();
  const runLabSectionJob = vi.fn();
  const store = {
    createRun: vi.fn(),
    readRun: vi.fn(),
    appendEvent: vi.fn(),
    saveArtifact: vi.fn(),
    markSectionRunning: vi.fn(),
    markSectionFailed: vi.fn(),
  };
  const createSupabaseRunStore = vi.fn((input: unknown) => {
    void input;
    return store;
  });

  return {
    seedOrchestration,
    claimSectionRun,
    runLabSectionJob,
    createSupabaseRunStore,
    store,
  };
});

vi.mock('@/lib/research-v2/orchestrate-db', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/orchestrate-db')
  >('@/lib/research-v2/orchestrate-db');
  return {
    ...actual,
    seedOrchestration: (...args: unknown[]) =>
      dispatchMocks.seedOrchestration(...args),
  };
});

vi.mock('@/lib/research-v2/section-run-claim', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/section-run-claim')
  >('@/lib/research-v2/section-run-claim');
  return {
    ...actual,
    claimSectionRun: (...args: unknown[]) =>
      dispatchMocks.claimSectionRun(...args),
  };
});

vi.mock('@/lib/research-v2/lab-section-job', () => ({
  runLabSectionJob: (input: unknown) => dispatchMocks.runLabSectionJob(input),
}));

vi.mock('@/lib/research-v2/supabase-run-store', () => ({
  createSupabaseRunStore: (input: unknown) =>
    dispatchMocks.createSupabaseRunStore(input),
}));

const { scheduleLabSectionJob } = await import('../lab-section-dispatch');

function seededRows(
  status: SeededStatus = 'queued',
  sectionRunId = SECTION_RUN_ID,
): SeedOrchestrationResult {
  return {
    parent_audit_run_id: PARENT_ID,
    section_run_ids: [
      {
        section_id: SECTION_ID as AllPositioningSectionId,
        section_run_id: sectionRunId,
        ordinal: 2,
        reused: status !== 'queued',
        status,
      },
    ],
  };
}

function validResearchInput(): ResearchInput {
  return researchInputSchema.parse({
    runId: RUN_ID,
    fixtureId: 'brand_fellow',
    company: {
      id: 'company_fellow',
      name: 'Fellow',
      websiteUrl: 'https://fellow.app',
      category: 'Meeting automation',
      description: 'Fellow automates meetings.',
      stage: 'growth',
      targetCustomer: 'RevOps teams',
    },
    onboarding: {
      primaryGoal: 'Improve paid media performance',
      targetSegments: ['RevOps leaders'],
      keyOffers: ['Meeting automation'],
      distributionChannels: ['paid-search'],
      constraints: [],
      notes: 'Reviewed GTM brief',
    },
    corpus: {
      excerpts: [
        {
          id: 'excerpt_1',
          sourceUrl: 'https://fellow.app',
          title: 'Fellow',
          text: 'Fellow automates meeting workflows for revenue teams.',
          observedAt: '2026-05-26T00:00:00.000Z',
          sourceId: 'source_1',
        },
      ],
    },
    sources: [
      {
        id: 'source_1',
        title: 'Fellow',
        url: 'https://fellow.app',
        observedAt: '2026-05-26T00:00:00.000Z',
      },
    ],
    competitorAds: [],
  });
}

function claimResult(
  status: SectionRunClaimStatus,
  sectionRunId = SECTION_RUN_ID,
): SectionRunClaimResult {
  if (status === 'not_found') {
    return {
      status,
      runId: RUN_ID,
      sectionId: SECTION_ID,
    };
  }

  const previousStatusByStatus: Record<
    Exclude<SectionRunClaimStatus, 'not_found'>,
    NonNullable<SectionRunClaimResult['previousStatus']>
  > = {
    claimed: 'queued',
    already_running: 'running',
    already_complete: 'complete',
    already_error: 'error',
  };

  return {
    status,
    runId: RUN_ID,
    sectionId: SECTION_ID,
    sectionRunId,
    previousStatus: previousStatusByStatus[status],
  };
}

function supabaseClient(): SupabaseClient {
  return { rpc: vi.fn() } as unknown as SupabaseClient;
}

async function runScheduled(
  callbacks: Array<() => Promise<void>>,
): Promise<void> {
  for (const callback of callbacks.splice(0)) {
    await callback();
  }
}

describe('scheduleLabSectionJob', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dispatchMocks.seedOrchestration.mockResolvedValue(seededRows());
    dispatchMocks.claimSectionRun.mockResolvedValue(claimResult('claimed'));
    dispatchMocks.store.createRun.mockResolvedValue({});
    dispatchMocks.store.readRun.mockResolvedValue({ input: validResearchInput() });
    dispatchMocks.runLabSectionJob.mockResolvedValue(undefined);
  });

  it('claims a queued section before scheduling exactly one lab job', async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const schedule = vi.fn((task: () => Promise<void>) => {
      callbacks.push(task);
    });

    const result = await scheduleLabSectionJob({
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
      zones: [SECTION_ID],
      researchInput: validResearchInput(),
      supabase: supabaseClient(),
      schedule,
    });

    expect(result.claim.status).toBe('claimed');
    expect(dispatchMocks.seedOrchestration).toHaveBeenCalledWith({
      userId: USER_ID,
      runId: RUN_ID,
      zones: [SECTION_ID],
    });
    expect(dispatchMocks.store.createRun).toHaveBeenCalledTimes(1);
    expect(dispatchMocks.claimSectionRun).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
    });
    expect(
      dispatchMocks.claimSectionRun.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      dispatchMocks.seedOrchestration.mock.invocationCallOrder[0] ?? 0,
    );
    expect(
      dispatchMocks.createSupabaseRunStore.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      dispatchMocks.claimSectionRun.mock.invocationCallOrder[0] ?? 0,
    );
    expect(schedule).toHaveBeenCalledTimes(1);
    expect(dispatchMocks.runLabSectionJob).not.toHaveBeenCalled();

    await runScheduled(callbacks);

    expect(dispatchMocks.runLabSectionJob).toHaveBeenCalledTimes(1);
    expect(dispatchMocks.runLabSectionJob).toHaveBeenCalledWith({
      deadlineAt: expect.any(Number),
      evidencePoolStore: expect.objectContaining({
        readArtifactData: expect.any(Function),
        writeArtifactData: expect.any(Function),
      }),
      parentAuditRunId: PARENT_ID,
      preparedContext: expect.objectContaining({
        sectionId: SECTION_ID,
        researchUseful: true,
      }),
      runId: RUN_ID,
      sectionId: SECTION_ID,
      signal: expect.any(AbortSignal),
      store: dispatchMocks.store,
    });
  });

  it('prepares section context through the run store before the scheduled lab job runs', async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const schedule = vi.fn((task: () => Promise<void>) => {
      callbacks.push(task);
    });

    await scheduleLabSectionJob({
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
      zones: [SECTION_ID],
      researchInput: validResearchInput(),
      supabase: supabaseClient(),
      schedule,
    });

    expect(dispatchMocks.store.readRun).toHaveBeenCalledWith(RUN_ID);
    expect(dispatchMocks.runLabSectionJob).not.toHaveBeenCalled();

    await runScheduled(callbacks);

    expect(dispatchMocks.runLabSectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        preparedContext: expect.objectContaining({
          sectionId: SECTION_ID,
          corpusRows: expect.arrayContaining([
            expect.objectContaining({
              id: 'excerpt_1',
              sourceUrl: 'https://fellow.app',
              scope: 'global',
            }),
          ]),
        }),
      }),
    );
  });

  it('binds the run store to the claimed section_run_id when seed data is stale', async () => {
    const callbacks: Array<() => Promise<void>> = [];
    const schedule = vi.fn((task: () => Promise<void>) => {
      callbacks.push(task);
    });
    dispatchMocks.claimSectionRun.mockResolvedValue(
      claimResult('claimed', CLAIMED_SECTION_RUN_ID),
    );

    await scheduleLabSectionJob({
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
      zones: [SECTION_ID],
      researchInput: validResearchInput(),
      supabase: supabaseClient(),
      schedule,
    });

    expect(dispatchMocks.createSupabaseRunStore).toHaveBeenCalledWith(
      expect.objectContaining({
        sectionRunIdByZone: {
          [SECTION_ID]: CLAIMED_SECTION_RUN_ID,
        },
      }),
    );

    await runScheduled(callbacks);

    expect(dispatchMocks.runLabSectionJob).toHaveBeenCalledTimes(1);
  });

  it.each<SectionRunClaimStatus>([
    'already_running',
    'already_complete',
    'already_error',
  ])('skips scheduling when the claim status is %s', async (status) => {
    const callbacks: Array<() => Promise<void>> = [];
    const schedule = vi.fn((task: () => Promise<void>) => {
      callbacks.push(task);
    });
    dispatchMocks.claimSectionRun.mockResolvedValue(claimResult(status));

    const result = await scheduleLabSectionJob({
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
      zones: [SECTION_ID],
      researchInput: validResearchInput(),
      supabase: supabaseClient(),
      schedule,
    });

    expect(result.claim.status).toBe(status);
    expect(schedule).not.toHaveBeenCalled();
    expect(callbacks).toHaveLength(0);
    expect(dispatchMocks.createSupabaseRunStore).not.toHaveBeenCalled();
    expect(dispatchMocks.store.createRun).not.toHaveBeenCalled();
    expect(dispatchMocks.runLabSectionJob).not.toHaveBeenCalled();
  });

  it('does not create a replacement job for an ordinary errored section row', async () => {
    const schedule = vi.fn();
    dispatchMocks.seedOrchestration.mockResolvedValue(seededRows('error'));
    dispatchMocks.claimSectionRun.mockResolvedValue(claimResult('already_error'));

    const result = await scheduleLabSectionJob({
      userId: USER_ID,
      runId: RUN_ID,
      sectionId: SECTION_ID,
      zones: [SECTION_ID],
      researchInput: validResearchInput(),
      supabase: supabaseClient(),
      schedule,
    });

    expect(result.section_run_ids[0]?.status).toBe('error');
    expect(result.claim.status).toBe('already_error');
    expect(schedule).not.toHaveBeenCalled();
    expect(dispatchMocks.createSupabaseRunStore).not.toHaveBeenCalled();
    expect(dispatchMocks.runLabSectionJob).not.toHaveBeenCalled();
  });

  it('throws a contextual error when the queued section row cannot be found', async () => {
    const schedule = vi.fn();
    dispatchMocks.claimSectionRun.mockResolvedValue(claimResult('not_found'));

    await expect(
      scheduleLabSectionJob({
        userId: USER_ID,
        runId: RUN_ID,
        sectionId: SECTION_ID,
        zones: [SECTION_ID],
        researchInput: validResearchInput(),
        supabase: supabaseClient(),
        schedule,
      }),
    ).rejects.toThrow(
      `claim_section_run returned not_found for userId=${USER_ID} runId=${RUN_ID} sectionId=${SECTION_ID}`,
    );

    expect(schedule).not.toHaveBeenCalled();
    expect(dispatchMocks.createSupabaseRunStore).not.toHaveBeenCalled();
    expect(dispatchMocks.runLabSectionJob).not.toHaveBeenCalled();
  });
});
