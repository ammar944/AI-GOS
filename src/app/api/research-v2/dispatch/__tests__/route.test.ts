import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  requireApiUser: vi.fn(),
  dispatchJourneyResearchForUser: vi.fn(),
  createAdminClient: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/auth/app-access', () => ({
  requireApiUser: () => routeMocks.requireApiUser(),
  jsonError: (message: string, status: number) =>
    Response.json({ error: message }, { status }),
}));

vi.mock('@/lib/journey/server/dispatch-research', () => ({
  dispatchJourneyResearchForUser: (...args: unknown[]) =>
    routeMocks.dispatchJourneyResearchForUser(...args),
  SECTION_TO_TOOL: {
    deepResearchProgram: 'runDeepResearchProgram',
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: (...args: unknown[]) =>
    routeMocks.createAdminClient(...args),
}));

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/research-v2/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
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

describe('POST /api/research-v2/dispatch', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ userId: 'user_1' });
    routeMocks.requireApiUser.mockResolvedValue(mockApiUser());
  });

  it('rejects legacy positioning section dispatches before worker dispatch', async () => {
    const response = await POST(
      makeRequest({
        runId: '00000000-0000-4000-8000-0000000000aa',
        sectionId: 'positioningMarketCategory',
        context: 'legacy section run',
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe('Unknown sectionId: positioningMarketCategory');
    expect(body.sectionIds).toEqual(['deepResearchProgram']);
    expect(routeMocks.createAdminClient).not.toHaveBeenCalled();
    expect(routeMocks.dispatchJourneyResearchForUser).not.toHaveBeenCalled();
  });
});
