import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { ModelMessage } from 'ai';

const RUN_ID = '00000000-0000-4000-8000-0000000000bb';
const PARENT_ID = '22222222-2222-4222-8222-222222222222';
const USER_ID = 'user_snapshot';

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  createAdminClient: vi.fn(),
  createPositioningOrchestratorAgent: vi.fn(),
  // Captures the messages the orchestrator agent is streamed, so the test can
  // assert the system-context snapshot that the route builds.
  capturedMessages: [] as ModelMessage[],
}));

vi.mock('server-only', () => ({}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mocks.auth(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => mocks.createAdminClient(),
}));

vi.mock('@/lib/research-v2/agents/positioning-orchestrator', () => ({
  createPositioningOrchestratorAgent: () =>
    mocks.createPositioningOrchestratorAgent(),
  extractOrchestratorSideEffects: () => [],
}));

const { POST } = await import('../route');

/**
 * Minimal chainable Supabase mock. Each builder method returns the builder so
 * `.select().eq().eq().maybeSingle()` and `.select().eq().eq().in()` both work;
 * the terminal value is resolved via the awaited builder (`then`) for multi-row
 * queries and via `maybeSingle()` for single-row queries. `insert()` resolves
 * immediately. Responses are keyed by a table+terminal label.
 */
function makeSupabase(responses: {
  journeySession?: { data: unknown; error: unknown };
  parentArtifact?: { data: unknown; error: unknown };
  sectionRows?: { data: unknown; error: unknown };
  history?: { data: unknown; error: unknown };
}) {
  function builder(table: string) {
    let terminal: { data: unknown; error: unknown } = {
      data: null,
      error: null,
    };
    if (table === 'journey_sessions') {
      terminal = responses.journeySession ?? { data: null, error: null };
    } else if (table === 'research_artifacts') {
      terminal = responses.parentArtifact ?? { data: null, error: null };
    } else if (table === 'research_artifact_sections') {
      terminal = responses.sectionRows ?? { data: [], error: null };
    } else if (table === 'audit_chat_messages') {
      terminal = responses.history ?? { data: [], error: null };
    }

    const chain: Record<string, unknown> = {};
    chain.select = vi.fn(() => chain);
    chain.eq = vi.fn(() => chain);
    chain.in = vi.fn(() => Promise.resolve(terminal));
    chain.order = vi.fn(() => chain);
    chain.limit = vi.fn(() => Promise.resolve(terminal));
    chain.maybeSingle = vi.fn(() => Promise.resolve(terminal));
    chain.insert = vi.fn(() => Promise.resolve({ error: null }));
    // Allow `await builder` for multi-row queries that end on .in()/.limit().
    chain.then = undefined;
    return chain;
  }

  return { from: vi.fn((table: string) => builder(table)) };
}

function makeFakeAgent() {
  return {
    stream: vi.fn(async (opts: { messages: ModelMessage[] }) => {
      mocks.capturedMessages = opts.messages;
      return {
        toUIMessageStreamResponse: () =>
          new Response('ok', { status: 200 }),
      };
    }),
  };
}

function committedSectionRow(zone: string, title: string, status: string) {
  return {
    zone,
    data: {
      sectionTitle: title,
      statusSummary: status,
      keyFindings: [{ title: `${title} finding A` }],
    },
  };
}

function systemSnapshot(): string {
  // The first system message carries the per-request artifact snapshot.
  const sys = mocks.capturedMessages.find(
    (m): m is ModelMessage & { role: 'system'; content: string } =>
      m.role === 'system' && typeof m.content === 'string',
  );
  return sys?.content ?? '';
}

function userTextFromMessages(): string {
  const lastUser = [...mocks.capturedMessages]
    .reverse()
    .find((m) => m.role === 'user');
  return typeof lastUser?.content === 'string' ? lastUser.content : '';
}

function buildRequest(messages: unknown[]): Request {
  return new Request('http://localhost/api/research-v2/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ runId: RUN_ID, messages }),
  });
}

describe('POST /api/research-v2/chat snapshot + multi-turn', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.capturedMessages = [];
    mocks.auth.mockResolvedValue({ userId: USER_ID });
    mocks.createPositioningOrchestratorAgent.mockReturnValue(makeFakeAgent());
  });

  it('builds the snapshot from committed sections loaded from research_artifact_sections', async () => {
    mocks.createAdminClient.mockReturnValue(
      makeSupabase({
        // legacy JSONB column is empty — the bug scenario
        journeySession: {
          data: { run_id: RUN_ID, research_results: {} },
          error: null,
        },
        parentArtifact: { data: { id: PARENT_ID }, error: null },
        sectionRows: {
          data: [
            committedSectionRow(
              'positioningMarketCategory',
              'Market Category',
              'Category defined.',
            ),
            committedSectionRow(
              'positioningBuyerICP',
              'Buyer & ICP',
              'ICP mapped.',
            ),
          ],
          error: null,
        },
      }),
    );

    const res = await POST(
      buildRequest([
        { id: 'm1', role: 'user', parts: [{ type: 'text', text: 'summarize' }] },
      ]),
    );

    expect(res.status).toBe(200);
    const snapshot = systemSnapshot();
    expect(snapshot).not.toContain('No sections generated yet.');
    expect(snapshot).toContain('Market Category');
    expect(snapshot).toContain('Category defined.');
    expect(snapshot).toContain('Buyer & ICP');
    expect(snapshot).toContain('ICP mapped.');
  });

  it('accepts an assistant message with a non-text part and still extracts user text', async () => {
    mocks.createAdminClient.mockReturnValue(
      makeSupabase({
        journeySession: {
          data: { run_id: RUN_ID, research_results: {} },
          error: null,
        },
        parentArtifact: { data: { id: PARENT_ID }, error: null },
        sectionRows: {
          data: [
            committedSectionRow(
              'positioningMarketCategory',
              'Market Category',
              'Category defined.',
            ),
          ],
          error: null,
        },
      }),
    );

    // Turn 2 shape: useChat resends the prior assistant message, which carries
    // a tool-call part alongside text. Pre-fix this 400'd with
    // "Invalid chat request body".
    const res = await POST(
      buildRequest([
        {
          id: 'm1',
          role: 'user',
          parts: [{ type: 'text', text: 'rerun the market section' }],
        },
        {
          id: 'm2',
          role: 'assistant',
          parts: [
            { type: 'step-start' },
            {
              type: 'tool-rerunSection',
              toolCallId: 'call_1',
              state: 'output-available',
              input: { zone: 'positioningMarketCategory' },
              output: { ok: true },
            },
            { type: 'text', text: 'Rerunning the market section now.' },
          ],
        },
        {
          id: 'm3',
          role: 'user',
          parts: [{ type: 'text', text: 'now tighten the ICP' }],
        },
      ]),
    );

    expect(res.status).toBe(200);
    // The latest user text is what reaches the orchestrator.
    expect(userTextFromMessages()).toBe('now tighten the ICP');
  });
});
