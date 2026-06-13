import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { StrategyBriefArtifact } from '@/lib/research-v2/strategy-brief/schema';

const RUN_ID = '00000000-0000-4000-8000-0000000000aa';
const PARENT_ID = '11111111-1111-4111-8111-111111111111';

const routeMocks = vi.hoisted(() => ({
  commitChatPatchAuto: vi.fn(),
}));

vi.mock('server-only', () => ({}));

vi.mock('@/lib/research-v2/chat-write-through', () => ({
  commitChatPatchAuto: (...args: unknown[]) =>
    routeMocks.commitChatPatchAuto(...args),
}));

const { applyOrchestratorSideEffect } = await import('../route');

interface QueryMock {
  select: ReturnType<typeof vi.fn>;
  eq: ReturnType<typeof vi.fn>;
  maybeSingle: ReturnType<typeof vi.fn>;
}

interface SupabaseMock {
  from: (table: string) => unknown;
  rpc: (
    fn: string,
    args: Record<string, unknown>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
}

function makeQuery(response: unknown): QueryMock {
  const query = {} as QueryMock;
  query.select = vi.fn(() => query);
  query.eq = vi.fn(() => query);
  query.maybeSingle = vi.fn().mockResolvedValue(response);
  return query;
}

function makeSupabase(opts: {
  artifactResponse?: unknown;
  sectionResponse?: unknown;
} = {}): SupabaseMock {
  const artifactQuery = makeQuery(
    opts.artifactResponse ?? { data: { id: PARENT_ID }, error: null },
  );
  const sectionQuery = makeQuery(
    opts.sectionResponse ?? { data: { data: validStrategyBrief() }, error: null },
  );

  return {
    from: vi.fn((table: string) => {
      if (table === 'research_artifacts') return artifactQuery;
      if (table === 'research_artifact_sections') return sectionQuery;
      throw new Error(`Unexpected table ${table}`);
    }),
    rpc: async () => ({ data: null, error: null }),
  };
}

function validStrategyBrief(): StrategyBriefArtifact {
  return {
    sectionTitle: 'Offer & Angle Brief',
    verdict: 'Lead with meeting accountability.',
    statusSummary: 'The brief is ready for media planning.',
    confidence: 0.82,
    sources: [{ title: 'Fellow', url: 'https://fellow.app' }],
    body: {
      positioning: {
        oneLiner: 'Fellow keeps revenue meetings accountable.',
        valueProp: 'Turn meeting chaos into accountable execution.',
        mechanism: 'Shared agendas, notes, and follow-up ownership.',
      },
      angles: [
        {
          name: 'The dropped handoff',
          vignette: 'I left the meeting without a clear owner.',
          coreEmotion: 'frustration',
          adFrame: 'Open on the missed follow-up.',
          rank: 1,
          sourceEvidence: ['positioningVoiceOfCustomer'],
        },
      ],
      lexicon: {
        approved: ['accountability'],
        banned: [{ term: 'AI meeting copilot', reason: 'Too generic.' }],
      },
      funnelStance: 'Demand capture first.',
      gaps: [],
      changelog: [
        {
          revision: 1,
          summary: 'Initial brief.',
          rationale: 'Six committed sections were available.',
          at: '2026-06-13T00:00:00.000Z',
        },
      ],
    },
  };
}

function sideEffectContext(supabase: SupabaseMock = makeSupabase()): {
  userId: string;
  runId: string;
  supabase: SupabaseMock;
  researchResults: Record<string, unknown>;
  requestUrl: string;
  cookieHeader: string;
} {
  return {
    userId: 'user_1',
    runId: RUN_ID,
    supabase,
    researchResults: {},
    requestUrl: 'http://localhost/api/research-v2/chat',
    cookieHeader: 'session=abc',
  };
}

describe('applyOrchestratorSideEffect strategy brief branches', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.commitChatPatchAuto.mockResolvedValue({
      ok: true,
      conflict: false,
      normalized_revision: 2,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('dispatches draft_strategy_brief to the internal strategy-brief route', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 202,
        statusText: 'Accepted',
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const outcome = await applyOrchestratorSideEffect(
      {
        intent: 'draft_strategy_brief',
        payload: { refinement: 'tighten angle ranking' },
      },
      sideEffectContext(),
    );

    expect(outcome).toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost/api/research-v2/strategy-brief');
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      Cookie: 'session=abc',
    });
    expect(JSON.parse(String(init.body))).toEqual({
      runId: RUN_ID,
      refinement: 'tighten angle ranking',
    });
  });

  it('patches and commits a valid revise_strategy_brief payload', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-06-13T12:00:00.000Z'));
    const supabase = makeSupabase();

    const outcome = await applyOrchestratorSideEffect(
      {
        intent: 'revise_strategy_brief',
        payload: {
          patches: [
            {
              path: 'positioning.oneLiner',
              value: 'Fellow turns revenue meetings into owned execution.',
            },
          ],
          changelogSummary: 'Tightened the one-liner.',
          rationale: 'Operator requested sharper revenue language.',
        },
      },
      sideEffectContext(supabase),
    );

    expect(outcome).toEqual({ ok: true });
    expect(routeMocks.commitChatPatchAuto).toHaveBeenCalledTimes(1);
    expect(routeMocks.commitChatPatchAuto).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({
        userId: 'user_1',
        runId: RUN_ID,
        zone: 'strategyBrief',
        patchedSection: expect.objectContaining({
          data: expect.objectContaining({
            body: expect.objectContaining({
              positioning: expect.objectContaining({
                oneLiner:
                  'Fellow turns revenue meetings into owned execution.',
              }),
              changelog: expect.arrayContaining([
                expect.objectContaining({
                  revision: 2,
                  summary: 'Tightened the one-liner.',
                  rationale: 'Operator requested sharper revenue language.',
                  at: '2026-06-13T12:00:00.000Z',
                }),
              ]),
            }),
          }),
        }),
      }),
    );
  });

  it('does not commit when no strategy brief is present', async () => {
    const supabase = makeSupabase({
      sectionResponse: { data: null, error: null },
    });

    const outcome = await applyOrchestratorSideEffect(
      {
        intent: 'revise_strategy_brief',
        payload: {
          patches: [
            {
              path: 'positioning.oneLiner',
              value: 'Sharper line.',
            },
          ],
          changelogSummary: 'Tightened one-liner.',
          rationale: 'Operator correction.',
        },
      },
      sideEffectContext(supabase),
    );

    expect(outcome).toEqual({
      ok: false,
      reason: 'no committed strategy brief to revise',
    });
    expect(routeMocks.commitChatPatchAuto).not.toHaveBeenCalled();
  });
});
