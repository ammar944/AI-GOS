import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CROSS_SECTION_REASONING_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';
const SECTION_RUN_ID = '22222222-2222-4222-8222-000000000004';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const seedOrchestration = vi.fn();
  const resetSectionRunForRerun = vi.fn();
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
    in: vi.fn(),
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
    resetSectionRunForRerun,
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
    resetSectionRunForRerun: (...args: unknown[]) =>
      routeMocks.resetSectionRunForRerun(...args),
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
        status: 'queued',
      },
    ],
  });
}

function committedPositioningRows(): Array<{
  zone: PositioningSectionId;
  data: { sectionTitle: string };
}> {
  return POSITIONING_SECTION_IDS.map((zone) => ({
    zone,
    data: { sectionTitle: zone },
  }));
}

function committedRowsWithCrossSectionReasoning(): Array<{
  zone: PositioningSectionId | typeof CROSS_SECTION_REASONING_SECTION_ID;
  data: { sectionTitle: string };
}> {
  return [
    ...committedPositioningRows(),
    {
      zone: CROSS_SECTION_REASONING_SECTION_ID,
      data: { sectionTitle: 'Cross-Section Reasoning' },
    },
  ];
}

function validResearchInput(): Record<string, unknown> {
  return {
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
  };
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
    routeMocks.sectionQuery.in.mockResolvedValue({
      data: committedRowsWithCrossSectionReasoning(),
      error: null,
    });
    routeMocks.sectionQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    mockSeeded();
    routeMocks.resetSectionRunForRerun.mockResolvedValue({
      sectionRunId: SECTION_RUN_ID,
      previousSectionRunId: null,
      previousStatus: null,
    });
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
          status: 'queued',
        },
      ],
      claim: {
        status: 'claimed',
        runId: RUN_ID,
        sectionId: 'positioningVoiceOfCustomer',
        sectionRunId: SECTION_RUN_ID,
        previousStatus: 'queued',
      },
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

  it('resets the section row before scheduling a one-section lab rerun', async () => {
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
    expect(routeMocks.resetSectionRunForRerun).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: 'user_1',
      runId: RUN_ID,
      sectionId: 'positioningVoiceOfCustomer',
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
    expect(
      routeMocks.scheduleLabSectionJob.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      routeMocks.resetSectionRunForRerun.mock.invocationCallOrder[0] ?? 0,
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
    expect(routeMocks.resetSectionRunForRerun).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: 'user_1',
      runId: RUN_ID,
      sectionId: 'positioningVoiceOfCustomer',
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

  it('reruns cross-section reasoning by loading six committed artifacts before reset and schedule', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.corpusToResearchInput.mockReturnValue(validResearchInput());
    const fetchMock = vi.fn().mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({
        runId: RUN_ID,
        zone: CROSS_SECTION_REASONING_SECTION_ID,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.executionMode).toBe('lab');
    expect(routeMocks.sectionQuery.in).toHaveBeenCalledWith(
      'zone',
      [...POSITIONING_SECTION_IDS],
    );
    expect(routeMocks.resetSectionRunForRerun).toHaveBeenCalledWith({
      supabase: expect.any(Object),
      userId: 'user_1',
      runId: RUN_ID,
      sectionId: CROSS_SECTION_REASONING_SECTION_ID,
    });
    expect(routeMocks.scheduleLabSectionJob).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user_1',
        runId: RUN_ID,
        sectionId: CROSS_SECTION_REASONING_SECTION_ID,
        zones: [CROSS_SECTION_REASONING_SECTION_ID],
        researchInput: expect.objectContaining({
          committedPositioningArtifacts: Object.fromEntries(
            committedPositioningRows().map((row) => [row.zone, row.data]),
          ),
        }),
      }),
    );
    const scheduleInput = routeMocks.scheduleLabSectionJob.mock
      .calls[0]?.[0] as { researchInput?: Record<string, unknown> } | undefined;
    expect(scheduleInput?.researchInput?.crossSectionReasoningArtifact).toBe(
      undefined,
    );
    expect(
      routeMocks.scheduleLabSectionJob.mock.invocationCallOrder[0],
    ).toBeGreaterThan(
      routeMocks.resetSectionRunForRerun.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('blocks synthesis reruns until cross-section reasoning is committed', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.corpusToResearchInput.mockReturnValue(validResearchInput());
    routeMocks.sectionQuery.in.mockResolvedValue({
      data: committedPositioningRows(),
      error: null,
    });

    const response = await POST(
      makeRequest({
        runId: RUN_ID,
        zone: POSITIONING_SYNTHESIS_SECTION_ID,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body).toMatchObject({
      error: 'cross_section_reasoning_not_ready',
      missing_sections: [CROSS_SECTION_REASONING_SECTION_ID],
    });
    expect(routeMocks.resetSectionRunForRerun).not.toHaveBeenCalled();
    expect(routeMocks.scheduleLabSectionJob).not.toHaveBeenCalled();
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
