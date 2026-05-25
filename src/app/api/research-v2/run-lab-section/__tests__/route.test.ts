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

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/research-v2/orchestrate-db', async () => {
  const actual =
    await vi.importActual<typeof import('@/lib/research-v2/orchestrate-db')>(
      '@/lib/research-v2/orchestrate-db',
    );
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

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/run-lab-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
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

  it('runs exactly one requested lab section with an owned complete corpus', async (): Promise<void> => {
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
    expect(routeMocks.runLabSectionJob).toHaveBeenCalledWith({
      runId: VALID_RUN_ID,
      sectionId: 'positioningBuyerICP',
      store: routeMocks.store,
    });
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
