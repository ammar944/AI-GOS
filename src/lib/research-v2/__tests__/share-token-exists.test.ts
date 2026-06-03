import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { shareTokenExists } from '@/lib/research-v2/share-token-exists';

const ENV = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  key: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

describe('shareTokenExists', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ENV.url;
    process.env.SUPABASE_SERVICE_ROLE_KEY = ENV.key;
    vi.restoreAllMocks();
  });

  it('returns true when the token row exists', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({ ok: true, json: async () => [{ share_token: 'abc' }] }),
    );
    expect(await shareTokenExists('abc')).toBe(true);
  });

  it('returns false when no row matches (unknown token)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => [] }));
    expect(await shareTokenExists('does-not-exist')).toBe(false);
  });

  it('fails open (true) on a non-ok REST response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => [] }));
    expect(await shareTokenExists('abc')).toBe(true);
  });

  it('fails open (true) when fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    expect(await shareTokenExists('abc')).toBe(true);
  });

  it('fails open (true) when env is not configured', async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await shareTokenExists('abc')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns true for an empty token without hitting the network', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    expect(await shareTokenExists('')).toBe(true);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
