import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useResearchJobActivity } from '../research-job-activity';

const {
  mockFetch,
  mockQuery,
  mockChannel,
  mockSupabase,
} = vi.hoisted(() => {
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

  const channel = {
    on: vi.fn(),
    subscribe: vi.fn(),
  };

  channel.on.mockReturnValue(channel);

  const supabase = {
    from: vi.fn(() => query),
    channel: vi.fn(() => channel),
    removeChannel: vi.fn(),
  };

  return {
    mockFetch: vi.fn(),
    mockQuery: query,
    mockChannel: channel,
    mockSupabase: supabase,
  };
});

vi.mock('@/lib/supabase/hooks', () => ({
  useSupabaseClient: () => mockSupabase,
}));

vi.stubGlobal('fetch', mockFetch);

describe('useResearchJobActivity', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    mockQuery.maybeSingle.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    });

    mockChannel.subscribe.mockImplementation(
      (callback?: (status: string) => void) => {
        callback?.('SUBSCRIBED');
        return mockChannel;
      },
    );

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        metadata: {
          activeJourneyRunId: 'run-123',
        },
        jobStatus: {
          'job-1': {
            runId: 'run-123',
            status: 'running',
            tool: 'researchIndustry',
            startedAt: '2026-03-10T09:00:00.000Z',
          },
        },
        updatedAt: '2026-03-10T09:01:00.000Z',
      }),
    });
  });

  it('loads the latest activity through the journey session API', async () => {
    const { result } = renderHook(() =>
      useResearchJobActivity({
        activeRunId: 'run-123',
        userId: 'user-123',
      }),
    );

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith('/api/journey/session?runId=run-123', {
        cache: 'no-store',
        credentials: 'same-origin',
      });
    });

    await waitFor(() => {
      expect(result.current).toEqual({
        industryMarket: {
          jobId: 'job-1',
          runId: 'run-123',
          section: 'industryMarket',
          startedAt: '2026-03-10T09:00:00.000Z',
          status: 'running',
          tool: 'researchIndustry',
        },
      });
    });

    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('logs structured API failures instead of an empty error object', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({
        error: 'Unauthorized',
      }),
    });

    renderHook(() =>
      useResearchJobActivity({
        activeRunId: 'run-123',
        userId: 'user-123',
      }),
    );

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        '[journey] Failed to fetch research job activity:',
        {
          message: 'Unauthorized',
          status: 401,
        },
      );
    });
  });

  it('does not poll until an active run id exists', async () => {
    renderHook(() =>
      useResearchJobActivity({
        activeRunId: null,
        userId: 'user-123',
      }),
    );

    await waitFor(() => {
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
