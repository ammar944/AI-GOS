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

type SectionRow = { zone: string; status: string; data?: unknown };

// Column-faithful like PostgREST: only selected columns come back. A route
// that forgets `data` in its select sees every VoC as quote-less here — the
// healthy-VoC tests below would then dispatch a phantom rescue and fail.
function fakeSupabase(
  rows: SectionRow[] | null,
  errorMessage?: string,
  // Per-zone research_section_runs attempt counts. Each rescue mints a fresh
  // run row, so a never-rescued zone has 1 and an already-rescued zone has >=2.
  // Defaults to 1 per known zone (the seed row) so the attempt cap is inert
  // for every test that does not exercise it.
  runCountByZone: Partial<Record<string, number>> = {},
) {
  const sectionsSelect = vi.fn((columns: string) => ({
    eq: vi.fn().mockResolvedValue(
      errorMessage === undefined
        ? {
            data:
              rows === null
                ? null
                : rows.map((row) =>
                    columns.includes('data')
                      ? row
                      : { zone: row.zone, status: row.status },
                  ),
            error: null,
          }
        : { data: null, error: { message: errorMessage } },
    ),
  }));
  // research_section_runs attempt-count lookup: one { zone } row per attempt.
  const sectionRunRows =
    rows === null
      ? []
      : rows.flatMap((row) =>
          Array.from(
            { length: runCountByZone[row.zone] ?? 1 },
            () => ({ zone: row.zone }),
          ),
        );
  const sectionRunsSelect = vi.fn(() => ({
    eq: vi.fn().mockResolvedValue({ data: sectionRunRows, error: null }),
  }));
  // research_artifacts rollup lookup (reached only when a rescue's own
  // onJobComplete is invoked): resolves "no rollup row" so the paid-media
  // check early-returns without dispatching.
  interface ArtifactsChain {
    eq: () => ArtifactsChain;
    maybeSingle: () => Promise<{ data: null; error: null }>;
  }
  const artifactsChain: ArtifactsChain = {
    eq: () => artifactsChain,
    maybeSingle: async () => ({ data: null, error: null }),
  };
  const from = vi.fn((table: string) =>
    table === 'research_artifacts'
      ? { select: vi.fn().mockReturnValue(artifactsChain) }
      : table === 'research_section_runs'
        ? { select: sectionRunsSelect }
        : { select: sectionsSelect },
  );
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

const HEALTHY_VOC_DATA = {
  sectionTitle: 'positioningVoiceOfCustomer',
  body: {
    painLanguage: {
      quotes: [
        {
          sourceUrl: 'https://g2.com/reviews/1',
          verbatimText: 'Saves hours every week',
        },
      ],
    },
    successLanguage: { quotes: [] },
  },
};

const STARVED_VOC_DATA = {
  sectionTitle: 'positioningVoiceOfCustomer',
  body: {
    painLanguage: { quotes: [] },
    successLanguage: { quotes: [] },
  },
};

function rows(
  statusByZone: Partial<Record<string, string>>,
  dataByZone: Partial<Record<string, unknown>> = {},
): SectionRow[] {
  return CORE.map((zone) => ({
    zone,
    status: statusByZone[zone] ?? 'complete',
    data:
      dataByZone[zone] ??
      (zone === 'positioningVoiceOfCustomer'
        ? HEALTHY_VOC_DATA
        : { sectionTitle: zone, body: {} }),
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
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(rows({ positioningBuyerICP: 'error' })),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(1);
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
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(fakeSupabase(rows({}))) as Parameters<
        typeof dispatchAutoRerunForErroredSections
      >[0],
    );

    expect(rescues).toBe(0);
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

  it('rescues a starved-complete VoC (zero real buyer quotes) exactly once', async () => {
    const consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows({}, { positioningVoiceOfCustomer: STARVED_VOC_DATA }),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(1);
    expect(orchestrateDbMocks.resetSectionRunForRerun).toHaveBeenCalledTimes(1);
    expect(orchestrateDbMocks.resetSectionRunForRerun).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: 'positioningVoiceOfCustomer' }),
    );
    expect(dispatchMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(1);
    const call = dispatchMocks.scheduleLabSectionJob.mock.calls[0]?.[0] as {
      sectionId: string;
    };
    expect(call.sectionId).toBe('positioningVoiceOfCustomer');
    expect(consoleInfoSpy).toHaveBeenCalledWith(
      '[run-lab-section] starved-VoC auto-rescue dispatching',
      { runId: 'run-1', sectionId: 'positioningVoiceOfCustomer' },
    );

    consoleInfoSpy.mockRestore();
  });

  it('does not rescue a complete VoC that carries at least one real buyer quote', async () => {
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows({}, { positioningVoiceOfCustomer: HEALTHY_VOC_DATA }),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(0);
    expect(orchestrateDbMocks.resetSectionRunForRerun).not.toHaveBeenCalled();
    expect(dispatchMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('treats quote records without usable verbatimText as starved (shared real-quote rule)', async () => {
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows(
            {},
            {
              positioningVoiceOfCustomer: {
                sectionTitle: 'positioningVoiceOfCustomer',
                body: {
                  painLanguage: {
                    quotes: [
                      {
                        sourceUrl: 'https://g2.com/reviews/9',
                        verbatimText: null,
                      },
                    ],
                  },
                  successLanguage: { quotes: [{ verbatimText: '   ' }] },
                },
              },
            },
          ),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(1);
    expect(orchestrateDbMocks.resetSectionRunForRerun).toHaveBeenCalledWith(
      expect.objectContaining({ sectionId: 'positioningVoiceOfCustomer' }),
    );
  });

  it('holds the starved-VoC rescue until the wave has drained', async () => {
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows(
            { positioningDemandIntent: 'running' },
            { positioningVoiceOfCustomer: STARVED_VOC_DATA },
          ),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(0);
    expect(orchestrateDbMocks.resetSectionRunForRerun).not.toHaveBeenCalled();
    expect(dispatchMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('rescues errored sections and a starved VoC together in one pass', async () => {
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows(
            { positioningBuyerICP: 'error' },
            { positioningVoiceOfCustomer: STARVED_VOC_DATA },
          ),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(2);
    expect(dispatchMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(2);
    const sectionIds = dispatchMocks.scheduleLabSectionJob.mock.calls.map(
      (call) => (call[0] as { sectionId: string }).sectionId,
    );
    expect(sectionIds).toEqual(
      expect.arrayContaining([
        'positioningBuyerICP',
        'positioningVoiceOfCustomer',
      ]),
    );
  });

  it("the rescue's onJobComplete carries only the paid-media check (no recursive rescue)", async () => {
    await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows({}, { positioningVoiceOfCustomer: STARVED_VOC_DATA }),
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(dispatchMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(1);
    const call = dispatchMocks.scheduleLabSectionJob.mock.calls[0]?.[0] as {
      onJobComplete?: (context: unknown) => Promise<void>;
    };
    expect(call.onJobComplete).toBeTypeOf('function');

    // The rescued VoC commits starved AGAIN: invoking its hook must neither
    // reset nor redispatch anything (the fake rollup is incomplete, so the
    // paid-media check inside the hook early-returns too).
    await call.onJobComplete?.({
      claim: {
        status: 'claimed',
        runId: 'run-1',
        sectionId: 'positioningVoiceOfCustomer',
        sectionRunId: 'fresh-run',
      },
      seeded: { parent_audit_run_id: 'parent-1', section_run_ids: [] },
    });

    expect(orchestrateDbMocks.resetSectionRunForRerun).toHaveBeenCalledTimes(1);
    expect(dispatchMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(1);
  });

  it('rescues an errored zone at most once per run (errors twice -> one rescue)', async () => {
    // First drained wave: the zone errored with only its seed run row (1
    // attempt) -> rescued exactly once.
    const first = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(rows({ positioningOfferDiagnostic: 'error' }), undefined, {
          positioningOfferDiagnostic: 1,
        }),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(first).toBe(1);
    expect(dispatchMocks.scheduleLabSectionJob).toHaveBeenCalledTimes(1);

    dispatchMocks.scheduleLabSectionJob.mockClear();
    orchestrateDbMocks.resetSectionRunForRerun.mockClear();

    // The rescue mints a second run row and errors AGAIN (deterministic
    // editorial-floor failure). A later drained wave re-invokes this pass, but
    // the zone now has 2 attempt rows -> no second rescue, the run settles.
    const second = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(rows({ positioningOfferDiagnostic: 'error' }), undefined, {
          positioningOfferDiagnostic: 2,
        }),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(second).toBe(0);
    expect(orchestrateDbMocks.resetSectionRunForRerun).not.toHaveBeenCalled();
    expect(dispatchMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('caps a starved VoC to a single rescue across drained waves', async () => {
    const consoleInfoSpy = vi
      .spyOn(console, 'info')
      .mockImplementation(() => undefined);

    // VoC committed starved again after its one rescue (2 run rows): the
    // deterministic quote-floor failure must not loop for the whole run.
    const rescues = await dispatchAutoRerunForErroredSections(
      baseInput(
        fakeSupabase(
          rows({}, { positioningVoiceOfCustomer: STARVED_VOC_DATA }),
          undefined,
          { positioningVoiceOfCustomer: 2 },
        ),
      ) as Parameters<typeof dispatchAutoRerunForErroredSections>[0],
    );

    expect(rescues).toBe(0);
    expect(orchestrateDbMocks.resetSectionRunForRerun).not.toHaveBeenCalled();
    expect(dispatchMocks.scheduleLabSectionJob).not.toHaveBeenCalled();

    consoleInfoSpy.mockRestore();
  });

  it('throws when the attempt-count lookup fails', async () => {
    // research_section_runs returns an error; the rest of the fake is healthy.
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'research_section_runs'
          ? {
              select: vi.fn(() => ({
                eq: vi
                  .fn()
                  .mockResolvedValue({ data: null, error: { message: 'boom' } }),
              })),
            }
          : {
              select: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: rows({ positioningBuyerICP: 'error' }),
                  error: null,
                }),
              })),
            },
      ),
    } as never;

    await expect(
      dispatchAutoRerunForErroredSections(
        baseInput(supabase) as Parameters<
          typeof dispatchAutoRerunForErroredSections
        >[0],
      ),
    ).rejects.toThrow('auto-rerun attempt-count lookup failed');
  });
});
