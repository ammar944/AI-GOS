import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const auth = vi.fn();
  const createAdminClient = vi.fn<() => unknown>(() => ({ marker: 'admin-client' }));
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

const { POST, buildLegacyResearchSnapshot } = await import('../route');
const { ShareSnapshotError } = await import('@/lib/research-v2/share-snapshot');

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

function fakeLegacySupabase(
  session: Record<string, unknown> | null,
  opts: { insertError?: { message: string } | null } = {},
): { supabase: unknown; insert: ReturnType<typeof vi.fn> } {
  const single = vi.fn().mockResolvedValue({
    data: session,
    error: session ? null : { message: 'not found' },
  });
  const insert = vi.fn().mockResolvedValue({ error: opts.insertError ?? null });
  const from = vi.fn((table: string) => {
    if (table === 'journey_sessions') {
      const query = { select: vi.fn(), eq: vi.fn(), single };
      query.select.mockReturnValue(query);
      query.eq.mockReturnValue(query);
      return query;
    }
    if (table === 'shared_sessions') {
      return { insert };
    }
    throw new Error(`Unexpected table ${table}`);
  });
  return { supabase: { from }, insert };
}

const legacyRow = {
  id: 'sess_legacy_1',
  user_id: 'user_123',
  research_document: { industryMarket: [{ id: 'c1' }] },
  research_results: null,
  metadata: { businessName: 'Acme' },
};

describe('POST /api/share — legacy fallback', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ userId: 'user_123' });
  });

  it.each(['v3_artifact_not_found', 'v3_sections_not_found'] as const)(
    'falls through to the legacy snapshot when the v3 builder throws %s',
    async (code): Promise<void> => {
      routeMocks.createV3SharedSession.mockRejectedValue(
        new ShareSnapshotError('no v3 data', code),
      );
      const fake = fakeLegacySupabase(legacyRow);
      routeMocks.createAdminClient.mockReturnValue(fake.supabase);

      const response = await POST(makeRequest({ sessionId: 'run_legacy' }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toMatchObject({ success: true });
      expect(fake.insert).toHaveBeenCalledTimes(1);
    },
  );

  it('returns 404 (no legacy fallback) when the v3 session itself is not found', async (): Promise<void> => {
    routeMocks.createV3SharedSession.mockRejectedValue(
      new ShareSnapshotError('missing session', 'session_not_found'),
    );
    const fake = fakeLegacySupabase(null);
    routeMocks.createAdminClient.mockReturnValue(fake.supabase);

    const response = await POST(makeRequest({ sessionId: 'run_missing' }));

    expect(response.status).toBe(404);
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it('returns 500 for non-eligible ShareSnapshotError codes (e.g. lookup_failed)', async (): Promise<void> => {
    routeMocks.createV3SharedSession.mockRejectedValue(
      new ShareSnapshotError('db down', 'lookup_failed'),
    );
    const fake = fakeLegacySupabase(null);
    routeMocks.createAdminClient.mockReturnValue(fake.supabase);

    const response = await POST(makeRequest({ sessionId: 'run_x' }));

    expect(response.status).toBe(500);
    expect(fake.insert).not.toHaveBeenCalled();
  });

  it('rethrows errors that are not a ShareSnapshotError', async (): Promise<void> => {
    routeMocks.createV3SharedSession.mockRejectedValue(new Error('unexpected boom'));

    await expect(POST(makeRequest({ sessionId: 'run_x' }))).rejects.toThrow(
      'unexpected boom',
    );
  });
});

describe('buildLegacyResearchSnapshot', (): void => {
  it('passes a valid research_document object through unchanged', (): void => {
    const doc = { industryMarket: [{ id: 'c1' }] };
    expect(buildLegacyResearchSnapshot(doc, null)).toBe(doc);
  });

  it('returns null when neither a research_document nor raw results are present', (): void => {
    expect(buildLegacyResearchSnapshot(null, null)).toBeNull();
  });

  it('returns null when raw results contain no complete sections', (): void => {
    const rawResults = { positioningMarketCategory: { status: 'queued' } };
    expect(buildLegacyResearchSnapshot(null, rawResults)).toBeNull();
  });
});
