import { beforeEach, describe, expect, it, vi } from 'vitest';

const dispatchMocks = vi.hoisted(() => ({
  scheduleLabSectionJob: vi.fn(),
}));
const orchestrateDbMocks = vi.hoisted(() => ({
  resetSectionRunForRerun: vi.fn(),
}));

vi.mock('@/lib/research-v2/lab-section-dispatch', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/research-v2/lab-section-dispatch')
  >();
  return {
    ...actual,
    scheduleLabSectionJob: dispatchMocks.scheduleLabSectionJob,
  };
});

vi.mock('@/lib/research-v2/orchestrate-db', async (importOriginal) => {
  const actual = await importOriginal<
    typeof import('@/lib/research-v2/orchestrate-db')
  >();
  return {
    ...actual,
    resetSectionRunForRerun: orchestrateDbMocks.resetSectionRunForRerun,
  };
});

import { saaslaunchResearchInput } from '@/lib/lab-engine/fixtures/saaslaunch';

import { dispatchAutoRerunForErroredSections } from '../route';

type SectionRow = { zone: string; status: string };

function fakeSupabase(rows: SectionRow[] | null, errorMessage?: string) {
  const eq = vi.fn().mockResolvedValue(
    errorMessage === undefined
      ? { data: rows, error: null }
      : { data: null, error: { message: errorMessage } },
  );
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  return { from } as never;
}

const CORE = [
  'positioningMarketCategory',
  'positioningBuyerICP',
  'positioningCompetitorLandscape',
  'positioningVoiceOfCustomer',
  'positioningDemandIntent',
  'positioningOfferDiagnostic',
] as const;

function rows(statusByZone: Partial<Record<string, string>>): SectionRow[] {
  return CORE.map((zone) => ({
    zone,
    status: statusByZone[zone] ?? 'complete',
  }));
}

function baseInput(supabase: never) {
  return {
    baseResearchInput: saaslaunchResearchInput,
    parentAuditRunId: 'parent-1',
    runId: 'run-1',
    schedule: (task: () => Promise<void>): void => {
      void task;
    },
    supabase,
    userId: 'user-1',
  };
}

describe('dispatchAutoRerunForErroredSections (ADR-0012)', () => {
  beforeEach(() => {
    dispatchMocks.scheduleLabSectionJob.mockReset();
    dispatchMocks.scheduleLabSectionJob.mockResolvedValue({});
    orchestrateDbMocks.resetSectionRunForRerun.mockReset();
    orchestrateDbMocks.resetSectionRunForRerun.mockResolvedValue({
      sectionRunId: 'fresh-run',
      previousSectionRunId: 'old-run',
      previousStatus: 'error',
    });
  });

  it('reruns each errored core section exactly once when the wave has drained', async () => {
    await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(rows({ positioningBuyerICP: 'error' })),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(orchestrateDbMocks.resetSectionRunForRerun).toHaveBeenCalledTimes(1);
    expect(orchestrateDbMocks.resetSectionRunForRerun).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: 'positioningBuyerICP' }),
    );
    expect(dispatchMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(1);
    const call = dispatchMocks.scheduleLabSectionJob.mock.calls[0]?.[0] as {
      sectionId: string;
      onJobComplete?: unknown;
    };
    expect(call.sectionId).toBe('positioningBuyerICP');
    // The rerun's hook exists (paid-media chain survives a recovered 6/6)…
    expect(call.onJobComplete).toBeTypeOf('function');
  });

  it('does nothing while any core section is still running (wave not drained)', async () => {
    await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows({
            positioningBuyerICP: 'error',
            positioningDemandIntent: 'running',
          }),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(orchestrateDbMocks.resetSectionRunForRerun).not.toHaveBeenCalled();
    expect(dispatchMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('does nothing when the wave drained clean (no errored sections)', async () => {
    await dispatchAutoRerunForErroredSections(
      baseInput(fakeSupabase(rows({}))) as Parameters<
        typeof dispatchAutoRerunForErroredSections
      >[0],
    );

    expect(dispatchMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('throws a descriptive error when the status lookup fails', async () => {
    await expect(
      dispatchAutoRerunForErroredSections(
        baseInput(fakeSupabase(null, 'boom')) as Parameters<
          typeof dispatchAutoRerunForErroredSections
        >[0],
      ),
    ).rejects.toThrow('auto-rerun section status lookup failed');
  });
});
