import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';

import { getSharedSessionByToken } from '../shared-session-read';

function fakeSupabase(result: { data: unknown; error: unknown }): {
  supabase: SupabaseClient;
  from: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
} {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eq = vi.fn();
  const query = { select: vi.fn(), eq, maybeSingle };
  query.select.mockReturnValue(query);
  eq.mockReturnValue(query);
  const from = vi.fn(() => query);
  return { supabase: { from } as unknown as SupabaseClient, from, eq };
}

describe('getSharedSessionByToken', (): void => {
  it('throws when the lookup errors (transient DB failure is not swallowed)', async (): Promise<void> => {
    const { supabase } = fakeSupabase({ data: null, error: { message: 'connection reset' } });

    await expect(
      getSharedSessionByToken({ supabase, token: 'tok_abc' }),
    ).rejects.toThrow(/connection reset/);
    await expect(
      getSharedSessionByToken({ supabase, token: 'tok_abc' }),
    ).rejects.toThrow(/tok_abc/);
  });

  it('returns null when no row matches the token', async (): Promise<void> => {
    const { supabase } = fakeSupabase({ data: null, error: null });

    await expect(
      getSharedSessionByToken({ supabase, token: 'missing' }),
    ).resolves.toBeNull();
  });

  it('returns the read model row when one exists, queried by share_token', async (): Promise<void> => {
    const row = {
      id: 's1',
      share_token: 'tok_abc',
      title: 'Acme Audit',
      research_snapshot: { schemaVersion: 'research-v3' },
      media_plan_snapshot: null,
      created_at: '2026-06-01T00:00:00.000Z',
    };
    const { supabase, from, eq } = fakeSupabase({ data: row, error: null });

    await expect(
      getSharedSessionByToken({ supabase, token: 'tok_abc' }),
    ).resolves.toEqual(row);
    expect(from).toHaveBeenCalledWith('shared_sessions');
    expect(eq).toHaveBeenCalledWith('share_token', 'tok_abc');
  });
});
