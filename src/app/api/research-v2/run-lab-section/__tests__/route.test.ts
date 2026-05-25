import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

interface SeededSectionRunRow {
  section_id: PositioningSectionId;
  section_run_id: string;
  ordinal: number;
  reused: boolean;
}

interface SeededRows {
  parent_audit_run_id: string;
  section_run_ids: SeededSectionRunRow[];
}

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const seedOrchestration = vi.fn();
  const corpusToResearchInput = vi.fn();
  const runLabSectionJob = vi.fn();
  // `after()` callbacks scheduled by the route — captured so tests can prove
  // the job is deferred until *after* the 202 ACK (and drain them explicitly).
  const afterCallbacks: Array<() => unknown> = [];
  const after = vi.fn((cb: () => unknown) => {
    afterCallbacks.push(cb);
  });
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
  const sessionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sessionQuery.select.mockReturnValue(sessionQuery);
  sessionQuery.eq.mockReturnValue(sessionQuery);
  const from = vi.fn(() => sessionQuery);
  const createAdminClient = vi.fn(() => ({ from }));

  return {
    auth,
    seedOrchestration,
    corpusToResearchInput,
    runLabSectionJob,
    after,
    afterCallbacks,
    store,
    createSupabaseRunStore,
    sessionQuery,
    from,
    createAdminClient,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('next/server', async () => {
  const actual =
    await vi.importActual<typeof import('next/server')>('next/server');
  return {
    ...actual,
    after: (cb: () => unknown) => routeMocks.after(cb),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/research-v2/orchestrate-db', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/orchestrate-db')
  >('@/lib/research-v2/orchestrate-db');
  return {
    ...actual,
    seedOrchestration: (...args: unknown[]) =>
      routeMocks.seedOrchestration(...args),
  };
});

vi.mock('@/lib/research-v2/corpus-to-research-input', () => ({
  corpusToResearchInput: (...args: unknown[]) =>
    routeMocks.corpusToResearchInput(...args),
}));

vi.mock('@/lib/research-v2/supabase-run-store', () => ({
  createSupabaseRunStore: (input: unknown) =>
    routeMocks.createSupabaseRunStore(input),
}));

vi.mock('@/lib/research-v2/lab-section-job', () => ({
  runLabSectionJob: (input: unknown) => routeMocks.runLabSectionJob(input),
}));

const { LAB_SECTION_ROUTE_TIMEOUT_MS, POST, maxDuration, runtime } =
  await import('../route');

async function drainAfter(): Promise<void> {
  const callbacks = routeMocks.afterCallbacks.splice(0);
  for (const cb of callbacks) {
    await cb();
  }
}

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function makeAbortableRequest(body: unknown, signal: AbortSignal): Request {
  return new Request('http://localhost/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
    signal,
  });
}

function defaultSeededRows(): SeededRows {
  return {
    parent_audit_run_id: PARENT_ID,
    section_run_ids: POSITIONING_SECTION_IDS.map((zone, i) => ({
      section_id: zone,
      section_run_id: `22222222-2222-4222-8222-${(i + 1).toString().padStart(12, '0')}`,
      ordinal: i + 1,
      reused: false,
    })),
  };
}

function mockOwnedSession(): void {
  routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      user_id: 'user_1',
      run_id: VALID_RUN_ID,
      research_results: {
        deepResearchProgram: {
          status: 'complete',
          data: { corpus: { researchSummary: 'Fellow automates meetings.' } },
        },
      },
      onboarding_data: { companyName: 'Fellow' },
      metadata: null,
    },
    error: null,
  });
}

describe('POST /api/research-v2/run-lab-section', () => {
  beforeEach((): void => {
    vi.clearAllMocks();
    routeMocks.afterCallbacks.length = 0;
    routeMocks.sessionQuery.select.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.sessionQuery.eq.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.seedOrchestration.mockResolvedValue(defaultSeededRows());
    routeMocks.corpusToResearchInput.mockReturnValue({
      runId: VALID_RUN_ID,
      fixtureId: 'brand_fellow',
    });
    routeMocks.store.createRun.mockResolvedValue({});
    routeMocks.runLabSectionJob.mockResolvedValue(undefined);
  });

  it('ACKs 202 and seeds synchronously, then runs the section job in after()', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'positioningBuyerICP',
      }),
    );

    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      run_id: VALID_RUN_ID,
      section_id: 'positioningBuyerICP',
    });

    // Setup that makes the 202 meaningful happens synchronously, before the ACK.
    expect(routeMocks.seedOrchestration).toHaveBeenCalledWith({
      userId: 'user_1',
      runId: VALID_RUN_ID,
      zones: POSITIONING_SECTION_IDS,
    });
    expect(routeMocks.corpusToResearchInput).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      deepResearchProgramData: {
        corpus: { researchSummary: 'Fellow automates meetings.' },
      },
      onboardingData: { companyName: 'Fellow' },
    });
    expect(routeMocks.createSupabaseRunStore).toHaveBeenCalledWith(
      expect.objectContaining({
        parentAuditRunId: PARENT_ID,
        sectionRunIdByZone: Object.fromEntries(
          defaultSeededRows().section_run_ids.map((row) => [
            row.section_id,
            row.section_run_id,
          ]),
        ),
        researchInput: {
          runId: VALID_RUN_ID,
          fixtureId: 'brand_fellow',
        },
      }),
    );
    expect(routeMocks.store.createRun).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      fixtureId: 'brand_fellow',
    });

    // The heavy job is DEFERRED to after() — not awaited before the ACK.
    expect(routeMocks.after).toHaveBeenCalledTimes(1);
    expect(routeMocks.runLabSectionJob).not.toHaveBeenCalled();

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      sectionId: 'positioningBuyerICP',
      signal: expect.any(AbortSignal),
      store: routeMocks.store,
    });
  });

  it('uses a bounded Node route lifecycle longer than the first-step watchdog', (): void => {
    expect(runtime).toBe('nodejs');
    expect(maxDuration * 1000).toBeGreaterThan(LAB_SECTION_ROUTE_TIMEOUT_MS);
    expect(LAB_SECTION_ROUTE_TIMEOUT_MS).toBeGreaterThan(120_000);
  });

  it('runs the deferred job decoupled from the kickoff connection (no abort when the kickoff drops)', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession();
    const controller = new AbortController();
    let observedSignal: AbortSignal | undefined;
    routeMocks.runLabSectionJob.mockImplementation(
      async (input: { signal?: AbortSignal }): Promise<void> => {
        observedSignal = input.signal;
      },
    );

    const response = await POST(
      makeAbortableRequest(
        {
          run_id: VALID_RUN_ID,
          section_id: 'positioningBuyerICP',
        },
        controller.signal,
      ),
    );

    expect(response.status).toBe(202);

    // The kickoff connection drops right after the ACK — orchestrate's kickoff
    // fetch times out, or the manual console-loop tab closes. The deferred job
    // MUST survive this and run to completion on its own timeout.
    controller.abort(new Error('kickoff disconnected'));

    await drainAfter();

    expect(routeMocks.runLabSectionJob).toHaveBeenCalledTimes(1);
    expect(observedSignal).toBeInstanceOf(AbortSignal);
    expect(observedSignal).not.toBe(controller.signal);
    expect(observedSignal?.aborted).toBe(false);
  });

  it('returns 400 for an unsupported lab section id', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });

    const response = await POST(
      makeRequest({
        run_id: VALID_RUN_ID,
        section_id: 'unknownSection',
      }),
    );

    expect(response.status).toBe(400);
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
  });
});
