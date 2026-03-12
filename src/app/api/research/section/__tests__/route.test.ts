import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authMock,
  createAdminClientMock,
  invalidateDownstreamMock,
  persistPipelineStateMock,
  readPipelineStateMock,
  supabaseState,
} = vi.hoisted(() => {
  const authMock = vi.fn();
  const persistPipelineStateMock = vi.fn();
  const readPipelineStateMock = vi.fn();
  const invalidateDownstreamMock = vi.fn();

  const rpcMock = vi.fn();
  const singleMock = vi.fn();
  const eqMock = vi.fn();
  const selectMock = vi.fn();
  const fromMock = vi.fn();

  const supabaseState = {
    rpcMock,
    singleMock,
    eqMock,
    selectMock,
    fromMock,
  };

  eqMock.mockImplementation(() => ({
    single: singleMock,
  }));
  selectMock.mockImplementation(() => ({
    eq: eqMock,
  }));
  fromMock.mockImplementation(() => ({
    select: selectMock,
  }));

  const createAdminClientMock = vi.fn(() => ({
    from: fromMock,
    rpc: rpcMock,
  }));

  return {
    authMock,
    createAdminClientMock,
    invalidateDownstreamMock,
    persistPipelineStateMock,
    readPipelineStateMock,
    supabaseState,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock('@/lib/journey/session-state.server', () => ({
  readPipelineState: readPipelineStateMock,
  persistPipelineState: persistPipelineStateMock,
}));

vi.mock('@/lib/research/pipeline-controller', async () => {
  const actual = await vi.importActual<typeof import('@/lib/research/pipeline-controller')>(
    '@/lib/research/pipeline-controller',
  );

  return {
    ...actual,
    invalidateDownstream: invalidateDownstreamMock,
  };
});

describe('PATCH /api/research/section', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user-1' });
    persistPipelineStateMock.mockResolvedValue({ ok: true });
    supabaseState.singleMock.mockResolvedValue({
      data: {
        research_results: {},
      },
      error: null,
    });
    supabaseState.rpcMock.mockResolvedValue({ error: null });
  });

  it('returns 401 when the user is not authenticated', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { PATCH } = await import('../route');

    const response = await PATCH(
      new Request('http://localhost/api/research/section', {
        method: 'PATCH',
        body: JSON.stringify({
          runId: 'run-1',
          sectionId: 'industryResearch',
          updates: { summary: 'Updated' },
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('deep merges section updates, preserves wrapper metadata, and persists invalidated pipeline state', async () => {
    const existingState = {
      runId: 'run-1',
      currentSectionId: 'competitorIntel',
      status: 'gated',
      approvedSectionIds: ['industryResearch', 'competitorIntel'],
      sections: [
        {
          id: 'industryResearch',
          toolName: 'researchIndustry',
          boundaryKey: 'industryMarket',
          displayName: 'Market Overview',
          status: 'approved',
          data: {
            categorySnapshot: {
              category: 'AI attribution',
              marketSize: '$4.2B',
            },
          },
          jobId: 'job-1',
          error: null,
        },
        {
          id: 'competitorIntel',
          toolName: 'researchCompetitors',
          boundaryKey: 'competitors',
          displayName: 'Competitor Intel',
          status: 'approved',
          data: {
            competitors: [{ name: 'SalesCaptain' }],
          },
          jobId: 'job-2',
          error: null,
        },
      ],
    };
    const invalidatedState = {
      ...existingState,
      currentSectionId: 'industryResearch',
      approvedSectionIds: ['industryResearch'],
      sections: [
        {
          ...existingState.sections[0],
          data: {
            categorySnapshot: {
              category: 'AI attribution',
              marketSize: '$5.1B',
            },
            messagingOpportunities: {
              summaryRecommendations: ['Lead with measurement clarity'],
            },
          },
        },
        {
          ...existingState.sections[1],
          status: 'stale',
        },
      ],
    };

    readPipelineStateMock.mockResolvedValue(existingState);
    invalidateDownstreamMock.mockReturnValue(invalidatedState);
    supabaseState.singleMock.mockResolvedValue({
      data: {
        research_results: {
          industryResearch: {
            status: 'complete',
            section: 'industryResearch',
            durationMs: 4200,
            runId: 'run-1',
            citations: [{ title: 'Market study' }],
            data: {
              categorySnapshot: {
                category: 'AI attribution',
                marketSize: '$4.2B',
              },
            },
          },
        },
      },
      error: null,
    });

    const { PATCH } = await import('../route');
    const response = await PATCH(
      new Request('http://localhost/api/research/section', {
        method: 'PATCH',
        body: JSON.stringify({
          runId: 'run-1',
          sectionId: 'industryResearch',
          updates: {
            categorySnapshot: {
              marketSize: '$5.1B',
            },
            messagingOpportunities: {
              summaryRecommendations: ['Lead with measurement clarity'],
            },
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(supabaseState.rpcMock).toHaveBeenCalledWith(
      'merge_journey_session_research_result',
      {
        p_user_id: 'user-1',
        p_section: 'industryResearch',
        p_result: {
          status: 'complete',
          section: 'industryResearch',
          durationMs: 4200,
          runId: 'run-1',
          citations: [{ title: 'Market study' }],
          data: {
            categorySnapshot: {
              category: 'AI attribution',
              marketSize: '$5.1B',
            },
            messagingOpportunities: {
              summaryRecommendations: ['Lead with measurement clarity'],
            },
          },
        },
      },
    );
    expect(invalidateDownstreamMock).toHaveBeenCalledWith(
      expect.objectContaining({
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'industryResearch',
            data: {
              categorySnapshot: {
                category: 'AI attribution',
                marketSize: '$5.1B',
              },
              messagingOpportunities: {
                summaryRecommendations: ['Lead with measurement clarity'],
              },
            },
          }),
        ]),
      }),
      'industryResearch',
    );
    expect(persistPipelineStateMock).toHaveBeenCalledWith('user-1', invalidatedState);

    await expect(response.json()).resolves.toEqual({
      status: 'updated',
      sectionId: 'industryResearch',
      data: {
        categorySnapshot: {
          category: 'AI attribution',
          marketSize: '$5.1B',
        },
        messagingOpportunities: {
          summaryRecommendations: ['Lead with measurement clarity'],
        },
      },
    });
  });
});
