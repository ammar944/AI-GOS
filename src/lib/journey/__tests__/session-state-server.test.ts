import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock @clerk/nextjs/server so createAdminClient can be imported
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

// Mock createAdminClient
const mockUpsert = vi.fn();
const mockSelect = vi.fn();
const mockSingle = vi.fn();
const mockEq = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      single: mockSingle,
      upsert: mockUpsert,
    })),
  })),
}));

describe('persistResearchToSupabase', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns { ok: true } on successful write', async () => {
    mockUpsert.mockResolvedValue({ error: null });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-1', { industryMarket: { status: 'complete' } });

    expect(result.ok).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('returns { ok: false, error } when Supabase returns an error', async () => {
    mockUpsert.mockResolvedValue({ error: { message: 'connection refused', code: '08006' } });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-2', { industryMarket: { status: 'complete' } });

    expect(result.ok).toBe(false);
    expect(result.error).toContain('connection refused');
  });

  it('retries once on a transient Supabase error before returning failure', async () => {
    // First call fails, second succeeds
    mockUpsert
      .mockResolvedValueOnce({ error: { message: 'timeout', code: '57014' } })
      .mockResolvedValueOnce({ error: null });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-3', { industryMarket: {} });

    expect(result.ok).toBe(true);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });

  it('returns { ok: false } after 2 failed attempts', async () => {
    mockUpsert
      .mockResolvedValueOnce({ error: { message: 'timeout', code: '57014' } })
      .mockResolvedValueOnce({ error: { message: 'timeout again', code: '57014' } });

    const { persistResearchToSupabase } = await import('../session-state.server');
    const result = await persistResearchToSupabase('user-4', { industryMarket: {} });

    expect(result.ok).toBe(false);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
  });
});
