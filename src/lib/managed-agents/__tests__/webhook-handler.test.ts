import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ManagedAgentsClient } from '../client';
import { signManagedAgentsPayload } from '../signature';
import {
  type CommitArtifactSectionInput,
  type WebhookEventRow,
  type WebhookSupabase,
  buildCommitPatch,
  handleManagedAgentsWebhook,
} from '../webhook-handler';

const SECRET = 'whsec_test';

function makeFakeSupabase(
  overrides: Partial<WebhookSupabase> = {},
): WebhookSupabase & {
  inserted: WebhookEventRow[];
  commits: CommitArtifactSectionInput[];
  errors: Array<{ sectionRunId: string; error: Record<string, unknown> }>;
  rejectionCount: number;
  presetRejectionCount?: number;
} {
  const inserted: WebhookEventRow[] = [];
  const commits: CommitArtifactSectionInput[] = [];
  const errors: Array<{ sectionRunId: string; error: Record<string, unknown> }> = [];
  let rejectionCount = 0;
  const seenEventIds = new Set<string>();

  return {
    inserted,
    commits,
    errors,
    get rejectionCount() {
      return rejectionCount;
    },
    async insertWebhookEvent(row) {
      if (seenEventIds.has(row.event_id)) return { inserted: false };
      seenEventIds.add(row.event_id);
      inserted.push(row);
      if (row.event_type === 'save_section_artifact_rejected') {
        rejectionCount += 1;
      }
      return { inserted: true };
    },
    async countWebhookEvents() {
      return { count: this.presetRejectionCount ?? rejectionCount };
    },
    async commitArtifactSection(input) {
      commits.push(input);
      return { ok: true, conflict: false, revision: input.expectedRevision + 1 };
    },
    async loadSectionRunContext() {
      return {
        artifactId: 'artifact-1',
        sectionType: 'positioningMarketCategory',
        expectedRevision: 0,
      };
    },
    async markSectionError(input) {
      errors.push(input);
      return { ok: true };
    },
    ...overrides,
  };
}

function makeClientStub(eventByPath: Record<string, unknown>) {
  const sentEvents: Array<{ sessionId: string; events: unknown[] }> = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();

    if (init?.method === 'POST') {
      const body = init.body ? JSON.parse(init.body as string) : {};
      const match = url.match(/\/sessions\/([^/]+)\/events$/);
      if (match) {
        sentEvents.push({ sessionId: match[1], events: body.events ?? [] });
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
    }

    const resource = eventByPath[url];
    if (resource) {
      return new Response(JSON.stringify(resource), { status: 200 });
    }
    return new Response('not found', { status: 404 });
  });
  const client = new ManagedAgentsClient({
    apiKey: 'test-key',
    fetchImpl: fetchImpl as unknown as typeof fetch,
  });
  return { client, sentEvents, fetchImpl };
}

function signedRequest(envelope: Record<string, unknown>): {
  rawBody: string;
  signatureHeader: string;
  timestamp: number;
} {
  const rawBody = JSON.stringify(envelope);
  const timestamp = Math.floor(Date.now() / 1000);
  const signatureHeader = signManagedAgentsPayload(rawBody, SECRET, timestamp);
  return { rawBody, signatureHeader, timestamp };
}

const VALID_ARTIFACT = {
  sectionTitle: 'Market & Category Intelligence',
  verdict: 'Category is expanding.',
  statusSummary:
    'Triangulated public-data, hiring, and funding signals support a durable category.',
  confidence: 7,
  sources: [
    { title: 'G2', url: 'https://www.g2.com/c/m' },
    { title: 'LinkedIn', url: 'https://linkedin.com/jobs' },
    { title: 'Crunchbase', url: 'https://crunchbase.com' },
  ],
  categoryDefinition: {
    prose: 'Meeting workflow.',
    adjacentCategories: [
      {
        name: 'AI assistants',
        whyBuyersConfuseIt: 'Both touch notes.',
        disambiguatingSignal: 'Workflow vs capture.',
      },
      {
        name: 'PM tools',
        whyBuyersConfuseIt: 'Tasks overlap.',
        disambiguatingSignal: 'Meetings vs tasks.',
      },
    ],
  },
  marketSize: {
    prose: 'Triangulation supports durable spend.',
    signals: [
      {
        signalType: 'public-data',
        name: 'G2 category presence',
        evidence: 'Active.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'G2',
        sourceUrl: 'https://g2.com/c/m',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'hiring-velocity',
        name: 'RevOps hiring',
        evidence: 'Roles mention meeting rhythm.',
        trajectory: 'stable',
        methodology: 'bottom-up',
        sourceTitle: 'LinkedIn',
        sourceUrl: 'https://linkedin.com/jobs',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'funding-flow',
        name: 'Collaboration funding',
        evidence: 'New entrants raising.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'Crunchbase',
        sourceUrl: 'https://crunchbase.com',
        dateObserved: '2026-05-15',
      },
    ],
  },
  structuralForces: {
    prose: 'AI shift + governance + buyer behavior.',
    forces: [
      {
        forceType: 'regulation',
        name: 'Record-keeping',
        evidence: 'New guidance.',
        implication: 'Trust matters.',
        impact: 'medium',
        direction: 'accelerating',
      },
      {
        forceType: 'platform-shift',
        name: 'AI in meetings',
        evidence: 'Native MSFT integrations.',
        implication: 'Diff moves up-stack.',
        impact: 'high',
        direction: 'accelerating',
      },
      {
        forceType: 'buyer-behavior',
        name: 'Consolidation',
        evidence: 'Buyers stacking.',
        implication: 'Bundles win.',
        impact: 'high',
        direction: 'accelerating',
      },
    ],
  },
  categoryMaturity: {
    prose: 'Growing.',
    classification: {
      stage: 'growing',
      evidenceSummary: 'Vendor density rising.',
      supportingSignals: [
        {
          signalType: 'player-count',
          evidence: 'Many vendors on G2.',
          implication: 'Recognized category.',
        },
        {
          signalType: 'buyer-education',
          evidence: 'Comparison content dominates SERPs.',
          implication: 'Buyers still learning.',
        },
      ],
    },
  },
};

describe('handleManagedAgentsWebhook', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it('returns 401 on missing signature (R6)', async () => {
    const supabase = makeFakeSupabase();
    const { client } = makeClientStub({});
    const result = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET },
      { rawBody: '{}', signatureHeader: null },
    );
    expect(result.status).toBe(401);
  });

  it('returns 401 on forged signature (R6)', async () => {
    const supabase = makeFakeSupabase();
    const { client } = makeClientStub({});
    const result = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET },
      { rawBody: '{"event_id":"evt"}', signatureHeader: 't=1,v1=00' },
    );
    expect(result.status).toBe(401);
  });

  it('returns 200 with processed:false on duplicate event id (R1)', async () => {
    const supabase = makeFakeSupabase();
    const { client } = makeClientStub({});
    const envelope = {
      event_id: 'evt_dup',
      type: 'agent.message',
      created_at: '2026-05-19T00:00:00Z',
      data: { type: 'event', id: 'msg_1', session_id: 'sess_1' },
    };
    const { rawBody, signatureHeader } = signedRequest(envelope);

    const first = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET },
      { rawBody, signatureHeader },
    );
    const second = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET },
      { rawBody, signatureHeader },
    );
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    if (second.status === 200) {
      expect(second.body.processed).toBe(false);
      expect(second.body.reason).toBe('duplicate');
    }
    expect(supabase.inserted.length).toBe(1);
  });

  it('verifies signature first, THEN fetches the full event (R3, R6)', async () => {
    const supabase = makeFakeSupabase();
    const fullEvent = {
      id: 'tool_use_1',
      type: 'agent.custom_tool_use',
      name: 'save_market_category_artifact',
      session_id: 'sess_1',
      session_thread_id: 'thread_a',
      created_at: '2026-05-19T00:00:00Z',
      input: { artifact: VALID_ARTIFACT, section_run_id: 'run_1' },
    };
    const { client, fetchImpl, sentEvents } = makeClientStub({
      'https://api.anthropic.com/v1/sessions/sess_1/events/tool_use_1': fullEvent,
    });

    const envelope = {
      event_id: 'evt_tool_1',
      type: 'agent.custom_tool_use.created',
      created_at: '2026-05-19T00:00:00Z',
      data: {
        type: 'agent.custom_tool_use',
        id: 'tool_use_1',
        session_id: 'sess_1',
      },
    };
    const { rawBody, signatureHeader } = signedRequest(envelope);

    const result = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET },
      { rawBody, signatureHeader },
    );
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.processed).toBe(true);
    }

    // R3: fetch happened after signature verification (only one GET in the fetch log).
    const getCalls = fetchImpl.mock.calls.filter(
      (call) => call[1] === undefined || (call[1] as RequestInit).method === 'GET',
    );
    expect(getCalls.length).toBeGreaterThanOrEqual(1);
    expect(getCalls[0][0]).toContain('/sessions/sess_1/events/tool_use_1');

    expect(supabase.commits.length).toBe(1);
    expect(supabase.commits[0].zone).toBe('positioningMarketCategory');
    expect(supabase.commits[0].sectionRunId).toBe('run_1');

    expect(sentEvents.length).toBe(1);
    const reply = sentEvents[0].events[0] as Record<string, unknown>;
    expect(reply.type).toBe('user.custom_tool_result');
    expect(reply.custom_tool_use_id).toBe('tool_use_1');
    expect(reply.session_thread_id).toBe('thread_a');
    const replyText = JSON.parse((reply.content as Array<{ text: string }>)[0].text);
    expect(replyText.ok).toBe(true);
  });

  it('echoes session_thread_id on every custom-tool result', async () => {
    const supabase = makeFakeSupabase();
    const fullEvent = {
      id: 'tool_use_2',
      type: 'agent.custom_tool_use',
      name: 'save_market_category_artifact',
      session_id: 'sess_2',
      session_thread_id: 'thread_xyz',
      created_at: '2026-05-19T00:00:00Z',
      input: { artifact: VALID_ARTIFACT, section_run_id: 'run_2' },
    };
    const { client, sentEvents } = makeClientStub({
      'https://api.anthropic.com/v1/sessions/sess_2/events/tool_use_2': fullEvent,
    });
    const envelope = {
      event_id: 'evt_tool_2',
      type: 'agent.custom_tool_use',
      created_at: '2026-05-19T00:00:00Z',
      data: {
        type: 'agent.custom_tool_use',
        id: 'tool_use_2',
        session_id: 'sess_2',
      },
    };
    const { rawBody, signatureHeader } = signedRequest(envelope);
    await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET },
      { rawBody, signatureHeader },
    );
    expect(sentEvents.length).toBe(1);
    const reply = sentEvents[0].events[0] as Record<string, unknown>;
    expect(reply.session_thread_id).toBe('thread_xyz');
  });

  it('returns repair_feedback when the artifact fails validation (R5 attempt 1)', async () => {
    const supabase = makeFakeSupabase();
    const fullEvent = {
      id: 'tool_use_3',
      type: 'agent.custom_tool_use',
      name: 'save_market_category_artifact',
      session_id: 'sess_3',
      session_thread_id: 'thread_a',
      created_at: '2026-05-19T00:00:00Z',
      input: { artifact: { sectionTitle: 'X' }, section_run_id: 'run_3' },
    };
    const { client, sentEvents } = makeClientStub({
      'https://api.anthropic.com/v1/sessions/sess_3/events/tool_use_3': fullEvent,
    });
    const envelope = {
      event_id: 'evt_tool_3',
      type: 'agent.custom_tool_use',
      created_at: '2026-05-19T00:00:00Z',
      data: { type: 'agent.custom_tool_use', id: 'tool_use_3', session_id: 'sess_3' },
    };
    const { rawBody, signatureHeader } = signedRequest(envelope);
    const result = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET, maxCustomToolRetries: 3 },
      { rawBody, signatureHeader },
    );
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.reason).toBe('repair_requested');
    }
    expect(sentEvents.length).toBe(1);
    const reply = JSON.parse(
      ((sentEvents[0].events[0] as Record<string, unknown>).content as Array<{ text: string }>)[0]
        .text,
    );
    expect(reply.ok).toBe(false);
    expect(reply.repair_feedback).toMatch(/Schema validation failed|minimum/);
  });

  it('force-errors and posts user.interrupt at the retry ceiling (R5)', async () => {
    const supabase = makeFakeSupabase();
    // Preset 2 prior rejections so this rejection is attempt #3 = ceiling.
    supabase.presetRejectionCount = 2;

    const fullEvent = {
      id: 'tool_use_4',
      type: 'agent.custom_tool_use',
      name: 'save_market_category_artifact',
      session_id: 'sess_4',
      session_thread_id: 'thread_a',
      created_at: '2026-05-19T00:00:00Z',
      input: { artifact: { sectionTitle: 'X' }, section_run_id: 'run_4' },
    };
    const { client, sentEvents } = makeClientStub({
      'https://api.anthropic.com/v1/sessions/sess_4/events/tool_use_4': fullEvent,
    });
    const envelope = {
      event_id: 'evt_tool_4',
      type: 'agent.custom_tool_use',
      created_at: '2026-05-19T00:00:00Z',
      data: { type: 'agent.custom_tool_use', id: 'tool_use_4', session_id: 'sess_4' },
    };
    const { rawBody, signatureHeader } = signedRequest(envelope);
    const result = await handleManagedAgentsWebhook(
      { client, supabase, webhookSecret: SECRET, maxCustomToolRetries: 3 },
      { rawBody, signatureHeader },
    );
    expect(result.status).toBe(200);
    if (result.status === 200) {
      expect(result.body.reason).toBe('retry_ceiling_reached');
    }
    expect(supabase.errors.length).toBe(1);
    expect(supabase.errors[0].sectionRunId).toBe('run_4');
    // Should have sent a user.interrupt event.
    expect(sentEvents.length).toBe(1);
    const interrupt = sentEvents[0].events[0] as Record<string, unknown>;
    expect(interrupt.type).toBe('user.interrupt');
    expect(interrupt.session_thread_id).toBe('thread_a');
  });
});

describe('buildCommitPatch', () => {
  it('projects the artifact into a commit_artifact_section patch shape', () => {
    const patch = buildCommitPatch(
      'positioningMarketCategory',
      VALID_ARTIFACT,
    );
    expect(patch.status).toBe('complete');
    expect(patch.title).toBe('Market & Category Intelligence');
    expect(patch.markdown).toContain('Verdict');
    expect(patch.markdown).toContain(VALID_ARTIFACT.statusSummary);
    expect(patch.data).toBe(VALID_ARTIFACT);
    expect(patch.sources).toEqual(VALID_ARTIFACT.sources);
  });
});
