import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

const VALID_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const requireApiUser = vi.fn();
  const seedOrchestration = vi.fn();
  const freezeReviewedBriefSnapshot = vi.fn();
  const buildJourneyResearchDispatchContext = vi.fn();
  const corpusToResearchInput = vi.fn();
  const runSection = vi.fn();
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
    requireApiUser,
    seedOrchestration,
    freezeReviewedBriefSnapshot,
    buildJourneyResearchDispatchContext,
    corpusToResearchInput,
    runSection,
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

vi.mock('@/lib/auth/app-access', () => ({
  requireApiUser: () => routeMocks.requireApiUser(),
  jsonError: (message: string, status: number) =>
    Response.json({ error: message }, { status }),
}));

vi.mock('@/lib/research-v2/orchestrate-db', async () => {
  const actual = await vi.importActual<
    typeof import('@/lib/research-v2/orchestrate-db')
  >('@/lib/research-v2/orchestrate-db');
  return {
    ...actual,
    seedOrchestration: (...args: unknown[]) =>
      routeMocks.seedOrchestration(...args),
    freezeReviewedBriefSnapshot: (...args: unknown[]) =>
      routeMocks.freezeReviewedBriefSnapshot(...args),
  };
});

vi.mock('@/lib/journey/server/dispatch-research', () => ({
  buildJourneyResearchDispatchContext: (...args: unknown[]) =>
    routeMocks.buildJourneyResearchDispatchContext(...args),
}));

vi.mock('@/lib/research-v2/corpus-to-research-input', () => ({
  corpusToResearchInput: (...args: unknown[]) =>
    routeMocks.corpusToResearchInput(...args),
}));

vi.mock('@/lib/research-v2/supabase-run-store', () => ({
  createSupabaseRunStore: (input: unknown) =>
    routeMocks.createSupabaseRunStore(input),
}));

vi.mock('@/lib/lab-engine/agents/run-section', () => ({
  runSection: (...args: unknown[]) => routeMocks.runSection(...args),
}));

const { POST } = await import('../route');

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/api/research-v2/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function mockOwnedSession({
  ownerId,
  runId = VALID_RUN_ID,
  corpusStatus = 'complete',
  deepResearchProgramData = { corpus: { researchSummary: 'summary' } },
}: {
  ownerId: string;
  runId?: string;
  corpusStatus?: string | null;
  deepResearchProgramData?: Record<string, unknown>;
}) {
  routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
    data: {
      id: VALID_SESSION_ID,
      user_id: ownerId,
      run_id: runId,
      research_results: corpusStatus
        ? {
            deepResearchProgram: {
              status: corpusStatus,
              data: deepResearchProgramData,
            },
          }
        : null,
      onboarding_data: { companyName: 'Fellow' },
      metadata: {
        researchV2OnboardingReview: {
          source: 'onboarding_v2_review',
          fieldCount: 47,
        },
      },
    },
    error: null,
  });
}

function defaultSeededRows() {
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

function mockApiUser(actorUserId = 'user_1') {
  return {
    actorUserId,
    role: 'internal',
    accountStatus: 'active',
    effectiveUserId: actorUserId,
    effectiveProfileId: null,
    primaryProfileId: null,
    clientLockedAt: null,
    impersonation: null,
  };
}

describe('POST /api/research-v2/orchestrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    delete process.env.RAILWAY_WORKER_URL;
    delete process.env.RAILWAY_API_KEY;
    delete process.env.LAB_ENGINE_LIVE_TOOLS;
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 202 })),
    );
    routeMocks.requireApiUser.mockResolvedValue(mockApiUser());
    routeMocks.sessionQuery.select.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.sessionQuery.eq.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.seedOrchestration.mockResolvedValue(defaultSeededRows());
    routeMocks.freezeReviewedBriefSnapshot.mockResolvedValue('frozen');
    routeMocks.buildJourneyResearchDispatchContext.mockResolvedValue('');
    routeMocks.corpusToResearchInput.mockReturnValue({
      runId: VALID_RUN_ID,
      fixtureId: 'brand_fellow',
    });
    routeMocks.store.createRun.mockResolvedValue({});
    routeMocks.store.readRun.mockResolvedValue({});
    routeMocks.store.appendEvent.mockResolvedValue({});
    routeMocks.store.saveArtifact.mockResolvedValue({});
    routeMocks.store.markSectionRunning.mockResolvedValue({});
    routeMocks.store.markSectionFailed.mockResolvedValue({});
    routeMocks.runSection.mockResolvedValue({});
  });

  it('returns 401 when there is no Clerk user', async () => {
    routeMocks.auth.mockResolvedValue({ userId: null });
    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(response.status).toBe(401);
  });

  it('does not mask Clerk auth failures as 401 responses', async () => {
    routeMocks.auth.mockRejectedValue(new Error('Clerk session store failed'));

    await expect(
      POST(
        makeRequest({
          journey_session_id: VALID_SESSION_ID,
          run_id: VALID_RUN_ID,
        }),
      ),
    ).rejects.toThrow('Clerk session store failed');
  });

  it('returns 400 for malformed JSON', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const response = await POST(makeRequest('not-json'));
    expect(response.status).toBe(400);
  });

  it('returns 400 when the body fails Zod validation', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const response = await POST(
      makeRequest({ journey_session_id: 'not-a-uuid' }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_body');
  });

  it('rejects legacy worker execution modes', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
        executionMode: 'deep',
      }),
    );
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toBe('invalid_body');
    expect(routeMocks.seedOrchestration).not.toHaveBeenCalled();
  });

  it('returns 404 when the session does not belong to the user', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(response.status).toBe(404);
  });

  it('returns 409 when the deepResearchProgram corpus is missing', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1', corpusStatus: null });
    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error).toBe('corpus_not_ready');
  });

  it('returns 409 when the corpus has not reached status=complete yet', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1', corpusStatus: 'running' });
    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(response.status).toBe(409);
  });

  it('returns 200 with parent + 6 section run ids on success', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.parent_audit_run_id).toBe(PARENT_ID);
    expect(body.section_run_ids).toHaveLength(6);
    expect(
      body.section_run_ids.map((r: { section_id: string }) => r.section_id),
    ).toEqual([...POSITIONING_SECTION_IDS]);
  });

  it('dispatches lab section jobs by default', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    const fetchCalls = fetchMock.mock.calls as [string, RequestInit][];
    expect(fetchCalls.map(([url]) => url)).toEqual(
      POSITIONING_SECTION_IDS.map(
        () => 'http://localhost/api/research-v2/run-lab-section',
      ),
    );
    expect(
      fetchCalls.map(([, init]) => {
        const parsedBody = JSON.parse(String(init.body)) as {
          section_id: string;
        };
        return parsedBody.section_id;
      }),
    ).toEqual([...POSITIONING_SECTION_IDS]);
  });

  it('passes the canonical six POSITIONING_SECTION_IDS to seed_orchestration', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(routeMocks.seedOrchestration).toHaveBeenCalledTimes(1);
    const [arg] = routeMocks.seedOrchestration.mock.calls[0];
    expect((arg as { userId: string }).userId).toBe('user_1');
    expect((arg as { runId: string }).runId).toBe(VALID_RUN_ID);
    expect((arg as { zones: readonly string[] }).zones).toEqual(
      POSITIONING_SECTION_IDS,
    );
  });

  it('freezes the reviewed GTM Brief snapshot and does not build shared context', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );

    expect(routeMocks.freezeReviewedBriefSnapshot).toHaveBeenCalledWith({
      parentAuditRunId: PARENT_ID,
      gtmBriefSnapshot: { companyName: 'Fellow' },
      gtmBriefReview: {
        source: 'onboarding_v2_review',
        fieldCount: 47,
      },
    });
    expect(
      routeMocks.buildJourneyResearchDispatchContext,
    ).not.toHaveBeenCalled();
  });

  it('is idempotent: a second call with the same body returns the same ids', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    const seeded = defaultSeededRows();
    routeMocks.seedOrchestration.mockResolvedValue(seeded);

    const r1 = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    const r2 = await POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
      }),
    );
    expect(r1.status).toBe(200);
    expect(r2.status).toBe(200);
    const b1 = await r1.json();
    const b2 = await r2.json();
    expect(b1).toEqual(b2);
  });

  it('dispatches each lab section through the internal route without running sections inline', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const deepResearchProgramData = {
      corpus: {
        researchSummary: 'Fellow automates meeting workflows.',
      },
    };
    mockOwnedSession({ ownerId: 'user_1', deepResearchProgramData });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest(
        {
          journey_session_id: VALID_SESSION_ID,
          run_id: VALID_RUN_ID,
          executionMode: 'lab',
        },
        { Cookie: '__session=abc' },
      ),
    );

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(routeMocks.corpusToResearchInput).not.toHaveBeenCalled();
    expect(routeMocks.createSupabaseRunStore).not.toHaveBeenCalled();
    expect(routeMocks.store.createRun).not.toHaveBeenCalled();
    expect(routeMocks.runSection).not.toHaveBeenCalled();

    const fetchCalls = fetchMock.mock.calls as [string, RequestInit][];
    expect(fetchCalls.map(([url]) => url)).toEqual(
      POSITIONING_SECTION_IDS.map(
        () => 'http://localhost/api/research-v2/run-lab-section',
      ),
    );
    expect(
      fetchCalls.map(([, init]) => {
        const parsedBody = JSON.parse(String(init.body)) as {
          section_id: string;
        };
        return parsedBody.section_id;
      }),
    ).toEqual([...POSITIONING_SECTION_IDS]);
    for (const [, init] of fetchCalls) {
      const parsedBody = JSON.parse(String(init.body)) as { run_id: string };
      expect(parsedBody.run_id).toBe(VALID_RUN_ID);
      expect(init.headers).toMatchObject({
        'Content-Type': 'application/json',
        Cookie: '__session=abc',
      });
    }
  });

  it('awaits all six lab kickoffs before responding (survives the serverless freeze)', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });

    // Deferred fetch: each kickoff hangs until released. Proves orchestrate
    // keeps the invocation alive until the kickoffs are delivered, instead of
    // fire-and-forgetting them (which dies when Vercel freezes the function
    // after the response, leaving every section stuck at queued).
    const releases: Array<() => void> = [];
    const fetchMock = vi.fn(
      () =>
        new Promise<Response>((resolve) => {
          releases.push(() => resolve(new Response('', { status: 202 })));
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const postPromise = POST(
      makeRequest({
        journey_session_id: VALID_SESSION_ID,
        run_id: VALID_RUN_ID,
        executionMode: 'lab',
      }),
    );
    let responded = false;
    void postPromise.then(() => {
      responded = true;
    });

    await new Promise((resolve) => setTimeout(resolve, 10));

    // All six dispatched, but the handler is still awaiting them.
    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(responded).toBe(false);

    releases.forEach((release) => release());
    const response = await postPromise;

    expect(responded).toBe(true);
    expect(response.status).toBe(200);
  });
});
