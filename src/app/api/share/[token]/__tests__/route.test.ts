import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const createAdminClient = vi.fn();
  const createAnonClient = vi.fn(() => {
    throw new Error('anon client must not be used for shared session reads');
  });
  const maybeSingle = vi.fn();
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    maybeSingle,
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  createAdminClient.mockReturnValue({ from: vi.fn(() => query) });

  return {
    createAdminClient,
    createAnonClient,
    maybeSingle,
    query,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/supabase/client', () => ({
  createClient: routeMocks.createAnonClient,
}));

const { GET } = await import('../route');

describe('GET /api/share/[token]', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    routeMocks.query.select.mockReturnValue(routeMocks.query);
    routeMocks.query.eq.mockReturnValue(routeMocks.query);
    routeMocks.maybeSingle.mockResolvedValue({
      data: {
        id: 'share-1',
        share_token: 'share_token_123',
        title: 'Shared title',
        research_snapshot: { schemaVersion: 'research-v3', sections: [] },
        media_plan_snapshot: null,
        created_at: '2026-06-03T00:00:00.000Z',
      },
      error: null,
    });
  });

  it('reads shared sessions through the server admin client', async (): Promise<void> => {
    const response = await GET(new Request('http://localhost/api/share/share_token_123'), {
      params: Promise.resolve({ token: 'share_token_123' }),
    });

    expect(response.status).toBe(200);
    expect(routeMocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(routeMocks.createAnonClient).not.toHaveBeenCalled();
    expect(routeMocks.query.eq).toHaveBeenCalledWith(
      'share_token',
      'share_token_123',
    );
  });

  it('returns 404 for missing share tokens', async (): Promise<void> => {
    routeMocks.maybeSingle.mockResolvedValue({ data: null, error: null });

    const response = await GET(new Request('http://localhost/api/share/missing'), {
      params: Promise.resolve({ token: 'missing' }),
    });

    expect(response.status).toBe(404);
  });

  it('returns 500 when the server-side lookup fails', async (): Promise<void> => {
    routeMocks.maybeSingle.mockResolvedValue({
      data: null,
      error: { message: 'permission denied for table shared_sessions' },
    });

    const response = await GET(new Request('http://localhost/api/share/failing'), {
      params: Promise.resolve({ token: 'failing' }),
    });

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to fetch shared session',
    });
  });
});
