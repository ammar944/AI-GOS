import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    maybeSingle: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.order.mockReturnValue(query);
  query.limit.mockReturnValue(query);

  const insertQuery = {
    select: vi.fn(),
    single: vi.fn(),
  };
  insertQuery.select.mockReturnValue(insertQuery);

  const table = {
    select: query.select,
    eq: query.eq,
    order: query.order,
    limit: query.limit,
    maybeSingle: query.maybeSingle,
    upsert: vi.fn(),
    insert: vi.fn(),
  };

  const from = vi.fn(() => table);
  const createAdminClient = vi.fn(() => ({ from }));
  const auth = vi.fn();

  return {
    auth,
    createAdminClient,
    from,
    query,
    insertQuery,
    table,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: routeMocks.createAdminClient,
}));

const { GET, PATCH, POST } = await import('../session/route');

function makeTextMessage(id: string, text: string): UIMessage {
  return {
    id,
    role: 'user',
    parts: [{ type: 'text', text }],
  };
}

function makePatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/journey/session', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Journey session workspace messages', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ userId: 'user-1' });
    routeMocks.query.select.mockReturnValue(routeMocks.query);
    routeMocks.query.eq.mockReturnValue(routeMocks.query);
    routeMocks.query.order.mockReturnValue(routeMocks.query);
    routeMocks.query.limit.mockReturnValue(routeMocks.query);
    routeMocks.table.upsert.mockResolvedValue({ error: null });
    routeMocks.table.insert.mockReturnValue(routeMocks.insertQuery);
    routeMocks.insertQuery.select.mockReturnValue(routeMocks.insertQuery);
  });

  it('returns section-scoped workspace messages for a requested run', async () => {
    const industryMessage = makeTextMessage('industry-1', 'Review market');
    const competitorMessage = makeTextMessage('competitors-1', 'Review competitors');
    routeMocks.query.maybeSingle.mockResolvedValue({
      data: {
        id: 'session-1',
        profile_id: 'profile-1',
        metadata: { activeJourneyRunId: 'run-1' },
        research_results: null,
        job_status: null,
        messages: {
          schemaVersion: 1,
          workspace: {
            industryMarket: [industryMessage],
            competitors: [competitorMessage],
          },
        },
        updated_at: '2026-05-07T00:00:00.000Z',
        run_id: 'run-1',
        created_at: '2026-05-07T00:00:00.000Z',
      },
      error: null,
    });

    const response = await GET(
      new Request(
        'http://localhost/api/journey/session?runId=run-1&section=industryMarket',
      ),
    );

    expect(response.status).toBe(200);
    const json = await response.json();
    expect(json.workspaceMessages).toEqual([industryMessage]);
    expect(routeMocks.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(routeMocks.query.eq).toHaveBeenCalledWith('run_id', 'run-1');
  });

  it('rejects workspace message persistence without an active run id', async () => {
    const response = await PATCH(
      makePatchRequest({
        workspaceMessages: {
          section: 'industryMarket',
          messages: [makeTextMessage('message-1', 'Review market')],
        },
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('activeRunId');
    expect(routeMocks.table.upsert).not.toHaveBeenCalled();
  });

  it('rejects invalid workspace sections', async () => {
    const response = await PATCH(
      makePatchRequest({
        activeRunId: 'run-1',
        workspaceMessages: {
          section: 'not-a-section',
          messages: [makeTextMessage('message-1', 'Review market')],
        },
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Invalid workspace section');
    expect(routeMocks.table.upsert).not.toHaveBeenCalled();
  });

  it('merges section messages and preserves other sections when persisting', async () => {
    const competitorMessage = makeTextMessage('competitors-1', 'Review competitors');
    const industryMessage = makeTextMessage('industry-1', 'Review market');
    routeMocks.query.maybeSingle.mockResolvedValue({
      data: {
        messages: {
          schemaVersion: 1,
          workspace: {
            competitors: [competitorMessage],
          },
        },
      },
      error: null,
    });

    const response = await PATCH(
      makePatchRequest({
        activeRunId: 'run-1',
        workspaceMessages: {
          section: 'industryMarket',
          messages: [industryMessage],
        },
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(routeMocks.query.eq).toHaveBeenCalledWith('run_id', 'run-1');
    expect(routeMocks.table.upsert).toHaveBeenCalledWith(
      {
        user_id: 'user-1',
        run_id: 'run-1',
        messages: {
          schemaVersion: 1,
          workspace: {
            competitors: [competitorMessage],
            industryMarket: [industryMessage],
          },
        },
        updated_at: expect.any(String),
      },
      { onConflict: 'user_id,run_id' },
    );
  });

  it('rejects malformed workspace messages', async () => {
    const response = await PATCH(
      makePatchRequest({
        activeRunId: 'run-1',
        workspaceMessages: {
          section: 'industryMarket',
          messages: [{ id: 'message-1', role: 'user' }],
        },
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('Invalid workspace message payload');
    expect(routeMocks.table.upsert).not.toHaveBeenCalled();
  });
});

describe('Journey session creation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ userId: 'user-1' });
    routeMocks.query.select.mockReturnValue(routeMocks.query);
    routeMocks.query.eq.mockReturnValue(routeMocks.query);
    routeMocks.query.maybeSingle.mockReset();
    routeMocks.table.insert.mockReturnValue(routeMocks.insertQuery);
    routeMocks.insertQuery.select.mockReturnValue(routeMocks.insertQuery);
  });

  it('stamps profile_id after validating the profile belongs to the current user', async () => {
    routeMocks.query.maybeSingle.mockResolvedValueOnce({
      data: { id: 'profile-1' },
      error: null,
    });
    routeMocks.insertQuery.single.mockResolvedValue({
      data: { id: 'session-1', run_id: 'run-new' },
      error: null,
    });

    const response = await POST(
      new Request('http://localhost/api/journey/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: 'profile-1' }),
      }),
    );

    expect(response.status).toBe(201);
    expect(routeMocks.from).toHaveBeenCalledWith('business_profiles');
    expect(routeMocks.query.eq).toHaveBeenCalledWith('id', 'profile-1');
    expect(routeMocks.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(routeMocks.table.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        run_id: expect.any(String),
        profile_id: 'profile-1',
      }),
    );

    const json = await response.json();
    expect(json).toMatchObject({
      runId: 'run-new',
      sessionId: 'session-1',
      profileId: 'profile-1',
    });
  });

  it('rejects unowned profiles before creating a session', async () => {
    routeMocks.query.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await POST(
      new Request('http://localhost/api/journey/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: 'profile-other' }),
      }),
    );

    expect(response.status).toBe(404);
    expect(routeMocks.table.insert).not.toHaveBeenCalled();
  });
});
