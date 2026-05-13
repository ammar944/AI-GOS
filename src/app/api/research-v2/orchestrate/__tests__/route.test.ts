import { beforeEach, describe, expect, it, vi } from 'vitest';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';

const VALID_SESSION_ID = '00000000-0000-4000-8000-000000000001';
const VALID_RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const seedOrchestration = vi.fn();
  const sessionQuery = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle: vi.fn(),
  };
  sessionQuery.select.mockReturnValue(sessionQuery);
  sessionQuery.eq.mockReturnValue(sessionQuery);
  const from = vi.fn(() => sessionQuery);
  const createAdminClient = vi.fn(() => ({ from }));

  return { auth, seedOrchestration, sessionQuery, from, createAdminClient };
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

vi.mock('@/lib/journey/server/dispatch-research', () => ({
  buildJourneyResearchDispatchContext: vi.fn().mockResolvedValue(''),
}));

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/orchestrate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function mockOwnedSession({
  ownerId,
  runId = VALID_RUN_ID,
  corpusStatus = 'complete',
}: {
  ownerId: string;
  runId?: string;
  corpusStatus?: string | null;
}) {
  routeMocks.sessionQuery.maybeSingle.mockResolvedValue({
    data: {
      id: VALID_SESSION_ID,
      user_id: ownerId,
      run_id: runId,
      research_results: corpusStatus
        ? { deepResearchProgram: { status: corpusStatus } }
        : null,
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

describe('POST /api/research-v2/orchestrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.sessionQuery.select.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.sessionQuery.eq.mockReturnValue(routeMocks.sessionQuery);
    routeMocks.seedOrchestration.mockResolvedValue(defaultSeededRows());
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
    expect(body.section_run_ids.map((r: { section_id: string }) => r.section_id)).toEqual(
      [...POSITIONING_SECTION_IDS],
    );
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

});
