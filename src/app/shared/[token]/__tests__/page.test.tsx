import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getSharedSessionByToken: vi.fn(),
  createAdminClient: vi.fn(() => ({})),
  notFound: vi.fn(() => {
    throw new Error('NEXT_NOT_FOUND');
  }),
}));

vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
}));

vi.mock('@/lib/research-v2/shared-session-read', () => ({
  getSharedSessionByToken: mocks.getSharedSessionByToken,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: mocks.createAdminClient,
}));

// The view is a heavy client component; the page contract under test is the
// read + notFound guard, not the render tree.
vi.mock('@/components/shared/shared-session-view', () => ({
  SharedSessionView: (): null => null,
}));

const { default: SharedSessionPage } = await import('../page');

function renderPage(token: string): Promise<unknown> {
  return SharedSessionPage({ params: Promise.resolve({ token }) });
}

describe('SharedSessionPage — public read guard', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('calls notFound (does not propagate) when the session read throws a transient error', async (): Promise<void> => {
    mocks.getSharedSessionByToken.mockRejectedValue(new Error('connection reset'));

    await expect(renderPage('tok_1')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it('calls notFound when no session matches the token', async (): Promise<void> => {
    mocks.getSharedSessionByToken.mockResolvedValue(null);

    await expect(renderPage('missing')).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });

  it('renders the view when a session exists', async (): Promise<void> => {
    mocks.getSharedSessionByToken.mockResolvedValue({
      id: 's1',
      share_token: 'tok_1',
      title: 'Acme Audit',
      research_snapshot: null,
      media_plan_snapshot: null,
      created_at: '2026-06-01T00:00:00.000Z',
    });

    const result = await renderPage('tok_1');

    expect(mocks.notFound).not.toHaveBeenCalled();
    expect(result).toBeTruthy();
  });
});
