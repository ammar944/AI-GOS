import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createClient } from '@supabase/supabase-js';
import { mergeJobUpdates, type JobStatusUpdate } from '../supabase';

const mockMaybeSingle = vi.fn();
const mockRpc = vi.fn();
const mockQuery = {
  select: vi.fn(),
  eq: vi.fn(),
  order: vi.fn(),
  limit: vi.fn(),
  maybeSingle: mockMaybeSingle,
};
mockQuery.select.mockReturnValue(mockQuery);
mockQuery.eq.mockReturnValue(mockQuery);
mockQuery.order.mockReturnValue(mockQuery);
mockQuery.limit.mockReturnValue(mockQuery);
const mockSelect = mockQuery.select;
const mockEq = mockQuery.eq;
const mockFrom = vi.fn(() => ({
  select: mockQuery.select,
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: mockFrom,
    rpc: mockRpc,
  })),
}));

describe('worker supabase writers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
    mockMaybeSingle.mockResolvedValue({
      data: {
        metadata: {
          activeJourneyRunId: 'run-123',
        },
      },
      error: null,
    });
    mockRpc.mockResolvedValue({ error: null });
  });

  it('writes research results through atomic rpc helpers', async () => {
    const { writeResearchResult } = await import('../supabase');

    await writeResearchResult('user-1', 'competitorIntel', {
      runId: 'run-123',
      status: 'complete',
      section: 'competitorIntel',
      data: { competitors: [] },
      durationMs: 123,
      telemetry: {
        model: 'claude-sonnet-4-6',
        usage: {
          inputTokens: 100,
          outputTokens: 25,
          totalTokens: 125,
        },
        estimatedCostUsd: 0.0012,
      },
    });

    expect(mockRpc).toHaveBeenCalledWith('merge_journey_session_research_result', {
      p_result: {
        runId: 'run-123',
        status: 'complete',
        section: 'competitorIntel',
        data: { competitors: [] },
        durationMs: 123,
        telemetry: {
          model: 'claude-sonnet-4-6',
          usage: {
            inputTokens: 100,
            outputTokens: 25,
            totalTokens: 125,
          },
          estimatedCostUsd: 0.0012,
        },
      },
      p_section: 'competitorIntel',
      p_run_id: 'run-123',
      p_user_id: 'user-1',
    });
  });

  it('skips research result writes that are missing a run id', async () => {
    const { writeResearchResult } = await import('../supabase');

    await writeResearchResult('user-1', 'competitorIntel', {
      status: 'complete',
      section: 'competitorIntel',
      data: { competitors: [] },
      durationMs: 123,
    });

    expect(mockRpc).not.toHaveBeenCalled();
  });

  it('writes job status through atomic rpc helpers', async () => {
    const { writeJobStatus } = await import('../supabase');

    await writeJobStatus('user-1', 'job-1', {
      runId: 'run-123',
      status: 'running',
      tool: 'researchCompetitors',
      startedAt: '2026-03-10T12:00:00.000Z',
      updates: [
        {
          at: '2026-03-10T12:00:00.000Z',
          id: 'update-1',
          message: 'worker accepted job',
          phase: 'runner',
        },
      ],
    });

    expect(mockRpc).toHaveBeenCalledWith('merge_journey_session_job_status', {
      p_job_id: 'job-1',
      p_run_id: 'run-123',
      p_row: {
        runId: 'run-123',
        status: 'running',
        tool: 'researchCompetitors',
        startedAt: '2026-03-10T12:00:00.000Z',
        updates: [
          {
            at: '2026-03-10T12:00:00.000Z',
            id: 'update-1',
            message: 'worker accepted job',
            phase: 'runner',
          },
        ],
      },
      p_user_id: 'user-1',
    });
  });

  it('uses NEXT_PUBLIC_SUPABASE_URL when worker SUPABASE_URL is not set', async () => {
    delete process.env.SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://public-url.supabase.co';
    const { writeJobStatus } = await import('../supabase');

    await writeJobStatus('user-1', 'job-1', {
      runId: 'run-123',
      status: 'running',
      tool: 'runDeepResearchProgram',
      startedAt: '2026-05-07T09:00:00.000Z',
    });

    expect(createClient).toHaveBeenCalledWith(
      'https://public-url.supabase.co',
      'test-key',
      { auth: { persistSession: false } },
    );
  });
});

describe('mergeJobUpdates', () => {
  function makeUpdate(index: number, timestamp?: string): JobStatusUpdate {
    return {
      at: timestamp ?? `2026-03-10T12:00:${String(index).padStart(2, '0')}.000Z`,
      id: `update-${index}`,
      message: `message ${index}`,
      phase: 'tool',
    };
  }

  it('returns undefined when both existing and incoming are empty', () => {
    expect(mergeJobUpdates(undefined, undefined)).toBeUndefined();
    expect(mergeJobUpdates([], [])).toBeUndefined();
  });

  it('merges and deduplicates updates by id', () => {
    const existing = [makeUpdate(1), makeUpdate(2)];
    const incoming = [makeUpdate(2), makeUpdate(3)];
    const result = mergeJobUpdates(existing, incoming);
    expect(result).toHaveLength(3);
    expect(result?.map((u) => u.id)).toEqual(['update-1', 'update-2', 'update-3']);
  });

  it('sorts merged updates by timestamp', () => {
    const existing = [makeUpdate(3, '2026-03-10T12:00:30.000Z')];
    const incoming = [makeUpdate(1, '2026-03-10T12:00:10.000Z')];
    const result = mergeJobUpdates(existing, incoming);
    expect(result?.map((u) => u.id)).toEqual(['update-1', 'update-3']);
  });

  it('caps updates at 50, keeping the newest', () => {
    const updates: JobStatusUpdate[] = [];
    for (let i = 0; i < 60; i++) {
      updates.push(makeUpdate(i, `2026-03-10T12:${String(i).padStart(2, '0')}:00.000Z`));
    }
    const result = mergeJobUpdates(updates, undefined);
    expect(result).toHaveLength(50);
    // Should keep updates 10-59 (newest 50), drop 0-9 (oldest 10)
    expect(result?.[0].id).toBe('update-10');
    expect(result?.[49].id).toBe('update-59');
  });

  it('caps at 50 after merging existing + incoming', () => {
    const existing: JobStatusUpdate[] = [];
    for (let i = 0; i < 30; i++) {
      existing.push(makeUpdate(i, `2026-03-10T12:${String(i).padStart(2, '0')}:00.000Z`));
    }
    const incoming: JobStatusUpdate[] = [];
    for (let i = 30; i < 55; i++) {
      incoming.push(makeUpdate(i, `2026-03-10T12:${String(i).padStart(2, '0')}:00.000Z`));
    }
    const result = mergeJobUpdates(existing, incoming);
    expect(result).toHaveLength(50);
    expect(result?.[0].id).toBe('update-5');
    expect(result?.[49].id).toBe('update-54');
  });

  it('preserves meta field through merge', () => {
    const existing: JobStatusUpdate[] = [
      {
        ...makeUpdate(1),
        meta: { url: 'https://example.com', toolName: 'firecrawl' },
      },
    ];
    const result = mergeJobUpdates(existing, undefined);
    expect(result?.[0].meta?.url).toBe('https://example.com');
    expect(result?.[0].meta?.toolName).toBe('firecrawl');
  });

  it('preserves typed artifact progress events through merge', () => {
    const existing: JobStatusUpdate[] = [
      {
        at: '2026-05-07T09:00:00.000Z',
        id: 'artifact-delta-1',
        message: '## Deep Research\n\nAirtable is positioned as an app platform.',
        phase: 'artifact',
        meta: {
          eventType: 'artifact-delta',
          section: 'deepResearchProgram',
          title: 'Airtable GTM Research',
        },
      },
    ];

    const result = mergeJobUpdates(existing, undefined);

    expect(result?.[0]).toMatchObject({
      phase: 'artifact',
      meta: {
        eventType: 'artifact-delta',
        section: 'deepResearchProgram',
        title: 'Airtable GTM Research',
      },
    });
  });
});
