import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { AuthorizedAppUser } from '@/lib/auth/app-access-guards';

const mockRequireApiUser = vi.fn();
const mockFetchBusinessProfileRowById = vi.fn();

vi.mock('@/lib/auth/app-access', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/auth/app-access')>();
  return {
    ...actual,
    requireApiUser: (...args: unknown[]) => mockRequireApiUser(...args),
    fetchBusinessProfileRowById: (...args: unknown[]) =>
      mockFetchBusinessProfileRowById(...args),
    logAccessAudit: vi.fn(),
  };
});

// Mock updateProfile
const mockUpdateProfile = vi.fn();
vi.mock('@/lib/profiles/business-profiles', () => ({
  updateProfile: (...args: unknown[]) => mockUpdateProfile(...args),
}));

// Import after mocks
const { PATCH } = await import('../[id]/route');

const internalAccess: AuthorizedAppUser = {
  actorUserId: 'user-1',
  role: 'internal',
  accountStatus: 'active',
  effectiveUserId: 'user-1',
  effectiveProfileId: null,
  primaryProfileId: null,
  clientLockedAt: null,
  impersonation: null,
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/profiles/prof-1', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

describe('PATCH /api/profiles/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchBusinessProfileRowById.mockResolvedValue({
      id: 'prof-1',
      user_id: 'user-1',
    });
    mockRequireApiUser.mockResolvedValue(internalAccess);
  });

  it('returns 401 when not authenticated', async () => {
    mockRequireApiUser.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 }),
    );
    const res = await PATCH(makeRequest({ fields: {} }), makeParams('prof-1'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid payload (missing fields key)', async () => {
    const res = await PATCH(makeRequest({ bad: 'data' }), makeParams('prof-1'));
    expect(res.status).toBe(400);
  });

  it('returns 400 when companyName is in fields', async () => {
    const res = await PATCH(
      makeRequest({ fields: { companyName: 'NewName', goals: 'Grow' } }),
      makeParams('prof-1'),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('read-only');
  });

  it('calls updateProfile and returns ok on success', async () => {
    mockUpdateProfile.mockResolvedValue(true);

    const res = await PATCH(
      makeRequest({ fields: { goals: 'Pipeline growth', primaryIcpDescription: 'VP Marketing' } }),
      makeParams('prof-1'),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(mockUpdateProfile).toHaveBeenCalledWith('user-1', 'prof-1', {
      goals: 'Pipeline growth',
      primaryIcpDescription: 'VP Marketing',
    });
  });

  it('returns 404 when updateProfile fails', async () => {
    mockUpdateProfile.mockResolvedValue(false);

    const res = await PATCH(
      makeRequest({ fields: { goals: 'Grow' } }),
      makeParams('prof-1'),
    );
    expect(res.status).toBe(404);
  });
});
