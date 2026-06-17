import { describe, expect, it, vi } from 'vitest';

import {
  commitChatPatch,
  extractNormalizedPatch,
} from '../chat-write-through';
import { findInternalVocabularyToken } from '../client-surface-sanitizer';

/**
 * Walks every string leaf of a value and returns the first internal-vocabulary
 * token found, or null when the whole subtree is client-clean. Used to prove
 * the committed payload carries zero deny-list vocabulary after sanitize.
 */
function findInternalTokenDeep(value: unknown): string | null {
  if (typeof value === 'string') {
    return findInternalVocabularyToken(value);
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      const hit = findInternalTokenDeep(item);
      if (hit) return hit;
    }
    return null;
  }
  if (value && typeof value === 'object') {
    for (const v of Object.values(value as Record<string, unknown>)) {
      const hit = findInternalTokenDeep(v);
      if (hit) return hit;
    }
    return null;
  }
  return null;
}

const ARTIFACT_ID = '00000000-0000-4000-8000-000000000123';

function makeRpcMock() {
  const calls: Array<{ fn: string; args: Record<string, unknown> }> = [];
  const queue: Array<{
    matcher: (fn: string) => boolean;
    response: { data: unknown; error: { message: string } | null };
  }> = [];

  const rpc = vi.fn(async (fn: string, args: Record<string, unknown>) => {
    calls.push({ fn, args });
    const matched = queue.find((q) => q.matcher(fn));
    if (!matched) {
      return { data: null, error: { message: `unexpected rpc: ${fn}` } };
    }
    return matched.response;
  });

  return {
    rpc,
    calls,
    when(fn: string, response: { data: unknown; error?: { message: string } | null }) {
      queue.push({
        matcher: (f) => f === fn,
        response: { data: response.data, error: response.error ?? null },
      });
    },
  };
}

describe('extractNormalizedPatch', () => {
  it('reads markdown/title/claims/sources from a wrapper.artifact shape', () => {
    const out = extractNormalizedPatch({
      artifact: {
        markdown: 'hello',
        title: 't',
        claims: [{ id: 'c1' }],
        sources: [{ url: 'https://example.com' }],
      },
    });
    expect(out.markdown).toBe('hello');
    expect(out.title).toBe('t');
    expect(out.claims).toHaveLength(1);
    expect(out.sources).toHaveLength(1);
  });

  it('reads from a flat inner shape when no wrapper is present', () => {
    const out = extractNormalizedPatch({
      markdown: 'flat',
      claims: [],
      sources: [],
    });
    expect(out.markdown).toBe('flat');
    expect(out.claims).toEqual([]);
    expect(out.sources).toEqual([]);
  });

  it('defaults claims/sources to empty arrays when absent', () => {
    const out = extractNormalizedPatch({ markdown: 'x' });
    expect(out.claims).toEqual([]);
    expect(out.sources).toEqual([]);
  });

  it('carries wrapper data as the typed artifact payload', () => {
    const typedArtifact = {
      sectionTitle: 'Buyer ICP',
      statusSummary: 'Specific buyer pattern exists',
    };
    const out = extractNormalizedPatch({
      data: typedArtifact,
      artifact: {
        markdown: 'rendered markdown',
        title: 'Rendered title',
      },
    });
    expect(out.markdown).toBe('rendered markdown');
    expect(out.title).toBe('Rendered title');
    expect(out.data).toBe(typedArtifact);
  });

  it('omits data for markdown-only edits so the database preserves typed payloads', () => {
    const out = extractNormalizedPatch({ markdown: 'tightened copy' });
    expect('data' in out).toBe(false);
  });
});

describe('commitChatPatch', () => {
  it('calls commit_artifact_section first, then mirrors to research_results', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: [{ ok: true, revision: 2, conflict: false }],
    });
    mock.when('merge_journey_session_research_result', { data: null });

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 1,
      patchedSection: { markdown: 'tightened' },
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.normalized_revision).toBe(2);
    }
    expect(mock.calls.map((c) => c.fn)).toEqual([
      'ensure_artifact',
      'commit_artifact_section',
      'merge_journey_session_research_result',
    ]);
  });

  it('passes typed artifact data to commit_artifact_section when present', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: [{ ok: true, revision: 2, conflict: false }],
    });
    mock.when('merge_journey_session_research_result', { data: null });
    const typedArtifact = {
      sectionTitle: 'Buyer ICP',
      statusSummary: 'Specific buyer pattern exists',
    };

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 1,
      patchedSection: {
        data: typedArtifact,
        artifact: { markdown: 'tightened', title: 'Buyer ICP' },
      },
    });

    expect(result.ok).toBe(true);
    const commitCall = mock.calls.find(
      (call) => call.fn === 'commit_artifact_section',
    );
    expect(commitCall?.args.p_patch).toMatchObject({
      data: typedArtifact,
      markdown: 'tightened',
      title: 'Buyer ICP',
    });
  });

  it('scrubs internal-vocabulary leaves from both the normalized patch and the legacy mirror', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: [{ ok: true, revision: 2, conflict: false }],
    });
    mock.when('merge_journey_session_research_result', { data: null });

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 1,
      patchedSection: {
        data: {
          sectionTitle: 'Buyer ICP',
          statusSummary: 'We ran a web_search across the corpus to confirm this.',
        },
        artifact: {
          markdown: 'evidence gap: no public pricing was disclosed.',
          title: 'Buyer ICP',
        },
      },
    });

    expect(result.ok).toBe(true);

    const commitCall = mock.calls.find(
      (call) => call.fn === 'commit_artifact_section',
    );
    const patch = commitCall?.args.p_patch as Record<string, unknown>;
    expect(patch.markdown).not.toMatch(/evidence gap:/i);
    const patchData = patch.data as { statusSummary: string };
    expect(patchData.statusSummary).not.toMatch(/web_search/i);
    expect(patchData.statusSummary).not.toMatch(/\bcorpus\b/i);

    const mirrorCall = mock.calls.find(
      (call) => call.fn === 'merge_journey_session_research_result',
    );
    const mirrored = mirrorCall?.args.p_result as {
      data: { statusSummary: string };
      artifact: { markdown: string };
    };
    expect(mirrored.artifact.markdown).not.toMatch(/evidence gap:/i);
    expect(mirrored.data.statusSummary).not.toMatch(/web_search/i);
    expect(mirrored.data.statusSummary).not.toMatch(/\bcorpus\b/i);
  });

  it('commits via the commit_artifact_section RPC with zero internal-vocabulary leaves, then mirrors the same clean payload', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: [{ ok: true, revision: 4, conflict: false }],
    });
    mock.when('merge_journey_session_research_result', { data: null });

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 1,
      patchedSection: {
        data: {
          sectionTitle: 'Buyer ICP',
          statusSummary:
            'We ran a web_search across the corpus and the verifier flagged an evidence gap.',
        },
        artifact: {
          markdown:
            'evidence gap: the blockGap validator could not corroborate pricing.',
          title: 'Buyer ICP',
        },
      },
    });

    expect(result.ok).toBe(true);

    // (b) the patch applies through the safe write path — the
    // commit_artifact_section RPC — not a raw overwrite.
    const commitCall = mock.calls.find(
      (call) => call.fn === 'commit_artifact_section',
    );
    expect(commitCall).toBeDefined();

    // (a) the COMMITTED payload carries zero internal-vocabulary tokens.
    expect(findInternalTokenDeep(commitCall?.args.p_patch)).toBeNull();

    // The legacy JSONB mirror is sanitized from the same clean copy.
    const mirrorCall = mock.calls.find(
      (call) => call.fn === 'merge_journey_session_research_result',
    );
    expect(findInternalTokenDeep(mirrorCall?.args.p_result)).toBeNull();
  });

  it('returns conflict=true on a stale_revision row from commit_artifact_section', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: [{ ok: false, revision: 3, conflict: true }],
    });

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 0,
      patchedSection: { markdown: 'stale' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflict).toBe(true);
      expect(result.reason).toBe('stale_revision');
    }
    // Legacy mirror MUST NOT fire if the normalized commit failed.
    expect(mock.calls.map((c) => c.fn)).toEqual([
      'ensure_artifact',
      'commit_artifact_section',
    ]);
  });

  it('returns ok=false with the rpc error when commit_artifact_section throws', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: null,
      error: { message: 'lock_not_available' },
    });

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 1,
      patchedSection: { markdown: 'blocked' },
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.conflict).toBe(false);
      expect(result.reason).toMatch(/commit_artifact_section/);
    }
  });

  it('still returns ok=true when only the legacy mirror fails (normalized is source of truth)', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: ARTIFACT_ID });
    mock.when('commit_artifact_section', {
      data: [{ ok: true, revision: 1, conflict: false }],
    });
    mock.when('merge_journey_session_research_result', {
      data: null,
      error: { message: 'mirror_temporarily_down' },
    });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 0,
      patchedSection: { markdown: 'hi' },
    });

    expect(result.ok).toBe(true);
    expect(warnSpy).toHaveBeenCalled();
    warnSpy.mockRestore();
  });

  it('returns ok=false when ensure_artifact does not produce an id', async () => {
    const mock = makeRpcMock();
    mock.when('ensure_artifact', { data: null });
    const result = await commitChatPatch(mock, {
      userId: 'user_1',
      runId: '00000000-0000-4000-8000-000000000aaa',
      zone: 'positioningBuyerICP',
      sectionRunId: '00000000-0000-4000-8000-0000000000bb',
      expectedRevision: 0,
      patchedSection: { markdown: 'hi' },
    });
    expect(result.ok).toBe(false);
  });
});
