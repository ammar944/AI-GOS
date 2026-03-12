import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockMaybeSingle = vi.fn();
const mockRpc = vi.fn();
const mockEq = vi.fn(() => ({
  maybeSingle: mockMaybeSingle,
}));
const mockSelect = vi.fn(() => ({
  eq: mockEq,
}));
const mockFrom = vi.fn(() => ({
  select: mockSelect,
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
      p_user_id: 'user-1',
    });
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
});
