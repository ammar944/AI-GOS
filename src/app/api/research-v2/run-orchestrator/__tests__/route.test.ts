import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const requireApiUser = vi.fn();
  const generateAgenticGLMOrchestrator = vi.fn();
  const promoteOrchestratorFactsToLedger = vi.fn();
  const persistOrchestratorEnrichment = vi.fn();
  const broadcastSectionPartial = vi.fn();
  const createResearchArtifactsResearchFactStore = vi.fn(
    (_client: unknown, _parentAuditRunId?: string) => ({
      appendFacts: vi.fn(),
      getFacts: vi.fn(),
    }),
  );
  // `after()` callbacks scheduled by the route — captured so tests can prove
  // the work is deferred until *after* the 202 ACK (and drain them explicitly).
  const afterCallbacks: Array<() => unknown> = [];
  const after = vi.fn((cb: () => unknown) => {
    afterCallbacks.push(cb);
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
    generateAgenticGLMOrchestrator,
    promoteOrchestratorFactsToLedger,
    persistOrchestratorEnrichment,
    broadcastSectionPartial,
    createResearchArtifactsResearchFactStore,
    afterCallbacks,
    after,
    sessionQuery,
    from,
    createAdminClient,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('next/server', async () => {
  const actual = await vi.importActual<typeof import('next/server')>(
    'next/server',
  );
  return {
    ...actual,
    after: (cb: () => unknown) => routeMocks.after(cb),
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/auth/app-access', () => ({
  requireApiUser: () => routeMocks.requireApiUser(),
  jsonError: (message: string, status: number) =>
    Response.json({ error: message }, { status }),
}));

vi.mock('@/lib/lab-engine/agents/orchestrator-glm', () => ({
  generateAgenticGLMOrchestrator: (...args: unknown[]) =>
    routeMocks.generateAgenticGLMOrchestrator(...args),
  promoteOrchestratorFactsToLedger: (...args: unknown[]) =>
    routeMocks.promoteOrchestratorFactsToLedger(...args),
}));

vi.mock('@/lib/research-v2/orchestrator-enrichment', () => ({
  persistOrchestratorEnrichment: (...args: unknown[]) =>
    routeMocks.persistOrchestratorEnrichment(...args),
}));

vi.mock('@/lib/research-v2/realtime-broadcast', () => ({
  broadcastSectionPartial: (...args: unknown[]) =>
    routeMocks.broadcastSectionPartial(...args),
}));

vi.mock('@/lib/lab-engine/evidence/research-fact', () => ({
  createResearchArtifactsResearchFactStore: (
    client: unknown,
    parentAuditRunId?: string,
  ) =>
    routeMocks.createResearchArtifactsResearchFactStore(
      client,
      parentAuditRunId,
    ),
}));

const { POST } = await import('../route');

function makeRequest(
  body: unknown,
  headers: Record<string, string> = {},
): Request {
  return new Request('http://localhost/api/research-v2/run-orchestrator', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function mockOwnedSession({
  ownerId,
  runId = VALID_RUN_ID,
}: {
  ownerId: string;
  runId?: string;
}) {
  routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
    data: {
      id: '00000000-0000-4000-8000-000000000001',
      user_id: ownerId,
      run_id: runId,
      research_results: null,
      onboarding_data: { companyName: 'Fellow', websiteUrl: 'https://fellow.app' },
      metadata: null,
    },
    error: null,
  });
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

async function drainAfter(): Promise<void> {
  const callbacks = [...routeMocks.afterCallbacks];
  routeMocks.afterCallbacks.length = 0;
  for (const cb of callbacks) {
    await cb();
  }
}

describe('POST /api/research-v2/run-orchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.unstubAllGlobals();
    routeMocks.afterCallbacks.length = 0;
    routeMocks.requireApiUser.mockResolvedValue(mockApiUser());
    routeMocks.sessionQuery.select.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.sessionQuery.eq.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.generateAgenticGLMOrchestrator.mockResolvedValue({
      gtmFields: null,
      researchDigest: 'digest',
      transcript: [{ step: 0 }],
      steps: [],
      stepCount: 0,
    });
    routeMocks.promoteOrchestratorFactsToLedger.mockResolvedValue(undefined);
    routeMocks.persistOrchestratorEnrichment.mockResolvedValue(undefined);
    routeMocks.broadcastSectionPartial.mockResolvedValue(undefined);
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('', { status: 202 })),
    );
  });

  it('returns 401 when there is no Clerk user', async () => {
    routeMocks.auth.mockResolvedValue({ userId: null });
    const response = await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );
    expect(response.status).toBe(401);
  });

  it('returns 400 when the body fails Zod validation', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    const response = await POST(makeRequest({ run_id: 'not-a-uuid' }));
    expect(response.status).toBe(400);
  });

  it('returns 404 when the session does not belong to the user', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: null,
    });
    const response = await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );
    expect(response.status).toBe(404);
  });

  it('ACKs 202 immediately and defers the orchestrator to after()', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });

    const response = await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );

    expect(response.status).toBe(202);
    // Work is deferred — nothing ran during the request.
    expect(
      routeMocks.generateAgenticGLMOrchestrator,
    ).not.toHaveBeenCalled();
    expect(routeMocks.after).toHaveBeenCalledTimes(1);
  });

  it('runs the orchestrator, promotes facts, then fans out the six sections', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest(
        { run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID },
        { Cookie: '__session=abc' },
      ),
    );
    expect(response.status).toBe(202);

    // No fan-out before the deferred work runs.
    expect(fetchMock).not.toHaveBeenCalled();

    await drainAfter();

    // Orchestrator ran with the session URL + onboarding brief.
    expect(
      routeMocks.generateAgenticGLMOrchestrator,
    ).toHaveBeenCalledTimes(1);
    const orchArg = routeMocks.generateAgenticGLMOrchestrator.mock
      .calls[0][0] as {
      websiteUrl: string;
      onboardingBrief: string;
      signal?: AbortSignal;
    };
    expect(orchArg.websiteUrl).toBe('https://fellow.app');
    expect(JSON.parse(orchArg.onboardingBrief)).toMatchObject({
      companyName: 'Fellow',
    });
    expect(orchArg.signal).toBeInstanceOf(AbortSignal);

    // Facts promoted under the seeded parent.
    expect(
      routeMocks.promoteOrchestratorFactsToLedger,
    ).toHaveBeenCalledTimes(1);
    const promoteCtx = routeMocks.promoteOrchestratorFactsToLedger.mock
      .calls[0][2] as { runId: string; parentAuditRunId: string };
    expect(promoteCtx.runId).toBe(VALID_RUN_ID);
    expect(promoteCtx.parentAuditRunId).toBe(PARENT_ID);

    // Fan-out: six run-lab-section kickoffs, forwarding the cookie.
    const kickoffCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([url]) => url === 'http://localhost/api/research-v2/run-lab-section',
    );
    expect(kickoffCalls).toHaveLength(6);
    expect(
      kickoffCalls.map(([, init]) => {
        const parsed = JSON.parse(String(init.body)) as { section_id: string };
        return parsed.section_id;
      }),
    ).toEqual([...POSITIONING_SECTION_IDS]);
    for (const [, init] of kickoffCalls) {
      expect(init.headers).toMatchObject({ Cookie: '__session=abc' });
    }
  });

  it('persists orchestrator enrichment into the session before fan-out', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    const gtmFields = {
      companyName: 'Fellow',
      category: 'Meeting automation',
      productDescription: 'Fellow automates meetings.',
      targetCustomer: 'RevOps',
      topCompetitors: ['Otter', 'Fathom'],
      marketProblem: 'Meetings lack structure.',
    };
    routeMocks.generateAgenticGLMOrchestrator.mockResolvedValue({
      gtmFields,
      researchDigest: 'digest',
      transcript: [{ step: 0 }],
      steps: [],
      stepCount: 0,
    });

    const response = await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );
    expect(response.status).toBe(202);

    await drainAfter();

    expect(routeMocks.persistOrchestratorEnrichment).toHaveBeenCalledTimes(1);
    const enrichArg = routeMocks.persistOrchestratorEnrichment.mock
      .calls[0][0] as {
      userId: string;
      runId: string;
      gtmFields: typeof gtmFields;
      researchDigest: string;
      onboardingData: Record<string, unknown>;
    };
    expect(enrichArg.userId).toBe('user_1');
    expect(enrichArg.runId).toBe(VALID_RUN_ID);
    expect(enrichArg.gtmFields).toEqual(gtmFields);
    expect(enrichArg.researchDigest).toBe('digest');
    expect(enrichArg.onboardingData).toMatchObject({ companyName: 'Fellow' });
  });

  it('emits an orchestrator progress broadcast via onStepFinish', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    // Drive the onStepFinish hook the route passes into the orchestrator so the
    // progress broadcast fires.
    routeMocks.generateAgenticGLMOrchestrator.mockImplementation(
      async (args: { onStepFinish?: (step: unknown) => void | Promise<void> }) => {
        await args.onStepFinish?.({ stepNumber: 0 });
        await args.onStepFinish?.({ stepNumber: 1 });
        return {
          gtmFields: null,
          researchDigest: 'digest',
          transcript: [],
          steps: [],
          stepCount: 0,
        };
      },
    );

    await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );
    await drainAfter();

    expect(routeMocks.broadcastSectionPartial).toHaveBeenCalled();
    const firstBroadcast = routeMocks.broadcastSectionPartial.mock
      .calls[0][0] as {
      runId: string;
      sectionId: string;
      snapshot: Record<string, unknown>;
    };
    expect(firstBroadcast.runId).toBe(VALID_RUN_ID);
    expect(firstBroadcast.sectionId).toBe('orchestrator');
  });

  it('still emits progress + fans out even if a broadcast throws', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    routeMocks.broadcastSectionPartial.mockRejectedValue(
      new Error('realtime down'),
    );
    routeMocks.generateAgenticGLMOrchestrator.mockImplementation(
      async (args: { onStepFinish?: (step: unknown) => void | Promise<void> }) => {
        await args.onStepFinish?.({ stepNumber: 0 });
        return {
          gtmFields: null,
          researchDigest: 'digest',
          transcript: [],
          steps: [],
          stepCount: 0,
        };
      },
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );
    expect(response.status).toBe(202);

    await drainAfter();

    const kickoffCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([url]) => url === 'http://localhost/api/research-v2/run-lab-section',
    );
    expect(kickoffCalls).toHaveLength(6);
  });

  it('still fans out the sections when the orchestrator throws', async () => {
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    mockOwnedSession({ ownerId: 'user_1' });
    routeMocks.generateAgenticGLMOrchestrator.mockRejectedValue(
      new Error('GLM transport down'),
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response('', { status: 202 }));
    vi.stubGlobal('fetch', fetchMock);

    const response = await POST(
      makeRequest({ run_id: VALID_RUN_ID, parent_audit_run_id: PARENT_ID }),
    );
    expect(response.status).toBe(202);

    await drainAfter();

    // Facts never promoted (orchestrator failed) but sections still fan out so
    // the run is never stuck cold.
    expect(routeMocks.promoteOrchestratorFactsToLedger).not.toHaveBeenCalled();
    const kickoffCalls = (fetchMock.mock.calls as [string, RequestInit][]).filter(
      ([url]) => url === 'http://localhost/api/research-v2/run-lab-section',
    );
    expect(kickoffCalls).toHaveLength(6);
  });
});
