import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const createAdminClient = vi.fn(() => ({ marker: 'admin-client' }));
  const createV3SharedSession = vi.fn();

  return {
    auth,
    createAdminClient,
    createV3SharedSession,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

vi.mock('@/lib/research-v2/share-snapshot', async () => {
  const actual = await vi.importActual<typeof import('@/lib/research-v2/share-snapshot')>(
    '@/lib/research-v2/share-snapshot',
  );
  return {
    ...actual,
    createV3SharedSession: routeMocks.createV3SharedSession,
  };
});

const { POST } = await import('../route');

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/share', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/share', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ userId: 'user_123' });
    routeMocks.createV3SharedSession.mockResolvedValue({
      shareUrl: '/shared/share_token_123',
      shareToken: 'share_token_123',
    });
  });

  it('requires an authenticated user', async (): Promise<void> => {
    routeMocks.auth.mockResolvedValue({ userId: null });

    const response = await POST(makeRequest({ sessionId: 'run_123' }));

    expect(response.status).toBe(401);
    expect(routeMocks.createV3SharedSession).not.toHaveBeenCalled();
  });

  it('rejects missing session ids', async (): Promise<void> => {
    const response = await POST(makeRequest({ title: 'Missing session' }));

    expect(response.status).toBe(400);
    expect(routeMocks.createV3SharedSession).not.toHaveBeenCalled();
  });

  it('creates v3 shared sessions through the normalized snapshot builder', async (): Promise<void> => {
    const response = await POST(
      makeRequest({ sessionId: 'run_123', title: 'Shared title' }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      shareUrl: '/shared/share_token_123',
      shareToken: 'share_token_123',
    });
    expect(routeMocks.createAdminClient).toHaveBeenCalledTimes(1);
    expect(routeMocks.createV3SharedSession).toHaveBeenCalledWith({
      supabase: { marker: 'admin-client' },
      userId: 'user_123',
      runId: 'run_123',
      title: 'Shared title',
      appUrl: '',
    });
  });
});
