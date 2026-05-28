import { beforeEach, describe, expect, it, vi } from 'vitest';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const SECTION_RUN_ID = '22222222-2222-4222-8222-000000000004';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const seedOrchestration = vi.fn();
  const loadOwnedResearchSession = vi.fn();
  const corpusToResearchInput = vi.fn();
  const scheduleLabSectionJob = vi.fn();
  const artifactQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  artifactQuery.select.mockReturnValue(artifactQuery);
  artifactQuery.eq.mockReturnValue(artifactQuery);

  const sectionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sectionQuery.select.mockReturnValue(sectionQuery);
  sectionQuery.eq.mockReturnValue(sectionQuery);

  const from = vi.fn((table: string) => {
    if (table === 'research_artifacts') return artifactQuery;
    if (table === 'research_artifact_sections') return sectionQuery;
    throw new Error(`Unexpected table ${table}`);
  });
  const createAdminClient = vi.fn(() => ({ from }));

  return {
    auth,
    seedOrchestration,
    artifactQuery,
    sectionQuery,
    createAdminClient,
    loadOwnedResearchSession,
    corpusToResearchInput,
    scheduleLabSectionJob,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/research-v2/orchestration-session', () => ({
  loadOwnedResearchSession: (...args: unknown[]) =>
    routeMocks.loadOwnedResearchSession(...args),
  corpusReady: (session: { corpusReady?: boolean }): boolean =>
    session.corpusReady === true,
  getDeepResearchProgramData: (
    session: { deepResearchProgramData?: unknown },
  ): unknown | null => session.deepResearchProgramData ?? null,
}));

vi.mock('@/lib/research-v2/corpus-to-research-input', () => ({
  corpusToResearchInput: (...args: unknown[]) =>
    routeMocks.corpusToResearchInput(...args),
}));

vi.mock('@/lib/research-v2/lab-section-dispatch', () => ({
  scheduleLabSectionJob: (...args: unknown[]) =>
    routeMocks.scheduleLabSectionJob(...args),
}));

vi.mock('@/lib/research-v2/uploaded-document-context.server', () => ({
  loadUploadedDocumentContextsForSession: () => [],
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

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/rerun-section', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function mockSeeded(): void {
  routeMocks.seedOrchestration.mockResolvedValue({
    parent_audit_run_id: PARENT_ID,
    section_run_ids: [
      {
        section_id: 'positioningVoiceOfCustomer',
        section_run_id: SECTION_RUN_ID,
        ordinal: 4,
        reused: false,
      },
    ],
  });
}

describe('POST /api/research-v2/rerun-section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    process.env.RAILWAY_WORKER_URL = 'https://worker.example';
    process.env.RAILWAY_API_KEY = 'worker-key';
    routeMocks.artifactQuery.select.mockReturnValue(routeMocks.artifactQuery);
    routeMocks.artifactQuery.eq.mockReturnValue(routeMocks.artifactQuery);
    routeMocks.artifactQuery.maybeSingle.mockResolvedValue({
      data: { id: PARENT_ID },
      error: null,
    });
    routeMocks.sectionQuery.select.mockReturnValue(routeMocks.sectionQuery);
    routeMocks.sectionQuery.eq.mockReturnValue(routeMocks.sectionQuery);
    routeMocks.sectionQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockSeeded();
    routeMocks.loadOwnedResearchSession.mockResolvedValue({
      corpusReady: true,
      deepResearchProgramData: { corpus: { researchSummary: 'Fellow' } },
      onboarding_data: { companyName: 'Fellow' },
    });
    routeMocks.corpusToResearchInput.mockReturnValue({
      runId: RUN_ID,
      fixtureId: 'brand_fellow',
    });
    routeMocks.scheduleLabSectionJob.mockResolvedValue({
      parent_audit_run_id: PARENT_ID,
      section_run_ids: [
        {
          section_id: 'positioningVoiceOfCustomer',
          section_run_id: SECTION_RUN_ID,
          ordinal: 4,
          reused: false,
        },
      ],
    });
  });

  it('returns 401 when there is no Clerk user', async () => {
    routeMocks.auth.mockResolvedValue({ userId: null });
    const response = await POST(
      makeRequest({ runId: RUN_ID, zone: 'positioningVoiceOfCustomer' }),
    );
    expect(response.status).toBe(401);
  });

  it('rejects non-positioning zones', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const response = await POST(
      makeRequest({ runId: RUN_ID, zone: 'deepResearchProgram' }),
    );
    expect(response.status).toBe(400);
  });

  it('schedules a one-section lab rerun by default', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({ runId: RUN_ID, zone: 'positioningVoiceOfCustomer' }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.executionMode).toBe('lab');
    expect(routeMocks.corpusToResearchInput).toHaveBeenCalledWith({
      runId: RUN_ID,
      deepResearchProgramData: { corpus: { researchSummary: 'Fellow' } },
      onboardingData: { companyName: 'Fellow' },
    });
    expect(routeMocks.scheduleLabSectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        runId: RUN_ID,
        sectionId: 'positioningVoiceOfCustomer',
        zones: ['positioningVoiceOfCustomer'],
        researchInput: {
          runId: RUN_ID,
          fixtureId: 'brand_fellow',
        },
      }),
    );
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('aborts an active section before scheduling the lab rerun', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.sectionQuery.maybeSingle.mockResolvedValue({
      data: {
        section_run_id: SECTION_RUN_ID,
        status: 'running',
      },
      error: null,
    });
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({
        runId: RUN_ID,
        zone: 'positioningVoiceOfCustomer',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.executionMode).toBe('lab');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [abortUrl, abortInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(abortUrl).toBe('https://worker.example/abort');
    expect(JSON.parse(String(abortInit.body))).toEqual({
      sectionRunId: SECTION_RUN_ID,
    });
    expect(routeMocks.scheduleLabSectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        runId: RUN_ID,
        sectionId: 'positioningVoiceOfCustomer',
        zones: ['positioningVoiceOfCustomer'],
        researchInput: {
          runId: RUN_ID,
          fixtureId: 'brand_fellow',
        },
      }),
    );
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
  });

  it('rejects legacy worker execution modes', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });

    const response = await POST(
      makeRequest({
        runId: RUN_ID,
        zone: 'positioningVoiceOfCustomer',
        executionMode: 'deep',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('unsupported_execution_mode');
    expect(routeMocks.createAdminClient).not.toHaveBeenCalled();
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
    expect(routeMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });

  it('rejects lab refinements before abort or reseed side effects', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({
        runId: RUN_ID,
        zone: 'positioningVoiceOfCustomer',
        refinement: 'tighten the buyer language',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('lab_refinement_not_supported');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(routeMocks.createAdminClient).not.toHaveBeenCalled();
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
    expect(routeMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
  });
});
