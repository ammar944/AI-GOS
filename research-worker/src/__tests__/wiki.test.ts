import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WikiEntry } from '../wiki';

/**
 * Regression test for the wiki double-encoding bug (commit e2a23c34).
 *
 * `writeWikiEntries` was passing `JSON.stringify(entries)` to a Supabase RPC
 * whose `p_entries` parameter is `jsonb`. The client already JSON-encodes the
 * payload, so the server saw a jsonb *string scalar* like `'"[{...}]"'`
 * instead of a jsonb array, and every runner's wiki batch was stored as one
 * unreadable string — silently corrupting the context shared between runners.
 *
 * This test locks in the fix: the third argument passed to the RPC MUST be a
 * native array of objects, never a string.
 */

const mockRpc = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    rpc: mockRpc,
  })),
}));

function makeEntries(): WikiEntry[] {
  return [
    {
      topic: 'identity_category',
      content: 'SaaS — B2B marketing automation',
      source_runner: 'identityResolution',
      provenance: 'ai_synthesis',
      confidence: 80,
    },
    {
      topic: 'competitor_name',
      content: 'HubSpot',
      source_runner: 'competitorIntel',
      provenance: 'tool_output',
      confidence: 85,
      source_url: 'https://hubspot.com',
    },
    {
      topic: 'pain_point',
      content: 'Marketers cannot tie campaign spend to pipeline outcomes',
      source_runner: 'industryResearch',
      provenance: 'web_search',
      confidence: 75,
    },
  ];
}

describe('writeWikiEntries — jsonb payload shape (regression: double-encoding)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    mockRpc.mockResolvedValue({ error: null });
  });

  it('calls append_research_wiki_entries with a native array, NOT a JSON string', async () => {
    const { writeWikiEntries } = await import('../wiki');
    const entries = makeEntries();

    await writeWikiEntries('user-1', 'run-123', entries);

    expect(mockRpc).toHaveBeenCalledTimes(1);
    const [rpcName, payload] = mockRpc.mock.calls[0];

    expect(rpcName).toBe('append_research_wiki_entries');
    expect(payload).toMatchObject({
      p_user_id: 'user-1',
      p_run_id: 'run-123',
    });

    // --- Core regression assertions ----------------------------------------
    // If anyone re-introduces JSON.stringify(entries), p_entries becomes a
    // string and every one of these assertions fails.
    expect(typeof payload.p_entries).not.toBe('string');
    expect(Array.isArray(payload.p_entries)).toBe(true);
    expect(payload.p_entries).toHaveLength(entries.length);

    // First element must be a plain object with the entry shape,
    // not a string that happens to look like JSON.
    const first = payload.p_entries[0];
    expect(typeof first).toBe('object');
    expect(first).not.toBeNull();
    expect(first.topic).toBe('identity_category');
    expect(first.source_runner).toBe('identityResolution');
    expect(first.confidence).toBe(80);

    // Payload must round-trip to the same structural value the caller gave us
    // (no extra encoding layer sneaked in).
    expect(payload.p_entries).toEqual(entries);
  });

  it('skips the RPC entirely when entries is empty', async () => {
    const { writeWikiEntries } = await import('../wiki');

    await writeWikiEntries('user-1', 'run-123', []);

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('throws when the RPC returns an error', async () => {
    mockRpc.mockResolvedValueOnce({ error: { message: 'boom' } });
    const { writeWikiEntries } = await import('../wiki');

    await expect(
      writeWikiEntries('user-1', 'run-123', makeEntries()),
    ).rejects.toThrow(/Wiki write failed: boom/);
  });

  it('proves the regression assertion is strict (stringified payload would fail)', async () => {
    // Simulate the bug by manually calling the RPC with a stringified payload
    // and run the same structural checks. They MUST fail — otherwise the
    // happy-path assertions above would be meaningless.
    const entries = makeEntries();
    await mockRpc('append_research_wiki_entries', {
      p_user_id: 'user-1',
      p_run_id: 'run-123',
      p_entries: JSON.stringify(entries), // <-- the bug shape
    });

    const [, payload] = mockRpc.mock.calls[0];

    // These are the exact assertions the happy-path test relies on.
    // If they pass under a stringified payload, the happy-path test is broken.
    expect(typeof payload.p_entries).toBe('string');
    expect(Array.isArray(payload.p_entries)).toBe(false);
  });
});
