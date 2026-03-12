import type { UIMessage } from 'ai';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  anthropicMock,
  authMock,
  convertToModelMessagesMock,
  createAdminClientMock,
  invalidateDownstreamMock,
  persistPipelineStateMock,
  readPipelineStateMock,
  stepCountIsMock,
  streamTextMock,
  supabaseState,
  toolMock,
} = vi.hoisted(() => {
  const authMock = vi.fn();
  const convertToModelMessagesMock = vi.fn();
  const stepCountIsMock = vi.fn((count: number) => ({ type: 'stepCountIs', count }));
  const streamTextMock = vi.fn();
  const toolMock = vi.fn((definition) => definition);
  const anthropicMock = vi.fn((model: string) => ({ provider: 'anthropic', model }));
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
    anthropicMock,
    authMock,
    convertToModelMessagesMock,
    createAdminClientMock,
    invalidateDownstreamMock,
    persistPipelineStateMock,
    readPipelineStateMock,
    stepCountIsMock,
    streamTextMock,
    supabaseState,
    toolMock,
  };
});

vi.mock('@clerk/nextjs/server', () => ({
  auth: authMock,
}));

vi.mock('ai', () => ({
  convertToModelMessages: convertToModelMessagesMock,
  stepCountIs: stepCountIsMock,
  streamText: streamTextMock,
  tool: toolMock,
}));

vi.mock('@/lib/ai/providers', () => ({
  MODELS: {
    CLAUDE_SONNET: 'claude-sonnet-4-20250514',
  },
  anthropic: anthropicMock,
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

describe('POST /api/research/chat', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ userId: 'user-1' });
    readPipelineStateMock.mockResolvedValue({
      runId: 'run-1',
      currentSectionId: 'industryResearch',
      status: 'gated',
      approvedSectionIds: ['industryResearch'],
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
      ],
    });
    persistPipelineStateMock.mockResolvedValue({ ok: true });
    supabaseState.singleMock.mockResolvedValue({
      data: {
        research_results: {
          industryResearch: {
            status: 'complete',
            section: 'industryResearch',
            durationMs: 1200,
            runId: 'run-1',
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
    supabaseState.rpcMock.mockResolvedValue({ error: null });
    convertToModelMessagesMock.mockResolvedValue([{ role: 'user', content: 'hello' }]);
    streamTextMock.mockReturnValue({
      toUIMessageStreamResponse: () =>
        new Response('stream-ok', {
          status: 200,
          headers: { 'Content-Type': 'text/plain' },
        }),
    });
  });

  it('returns 401 when the user is not authenticated', async () => {
    authMock.mockResolvedValue({ userId: null });
    const { POST } = await import('../route');

    const response = await POST(
      new Request('http://localhost/api/research/chat', {
        method: 'POST',
        body: JSON.stringify({
          runId: 'run-1',
          sectionId: 'industryResearch',
          messages: [],
        }),
      }),
    );

    expect(response.status).toBe(401);
  });

  it('sanitizes incomplete tool parts before converting messages and streams with a 3-step stop condition', async () => {
    const messages = [
      {
        id: 'm1',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Prior response' },
          { type: 'tool-editSection', state: 'approval-requested' },
        ],
      },
      {
        id: 'm2',
        role: 'user',
        parts: [{ type: 'text', text: 'Update the market size' }],
      },
    ] satisfies UIMessage[];

    const { POST } = await import('../route');
    const response = await POST(
      new Request('http://localhost/api/research/chat', {
        method: 'POST',
        body: JSON.stringify({
          runId: 'run-1',
          sectionId: 'industryResearch',
          messages,
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(convertToModelMessagesMock).toHaveBeenCalledWith([
      {
        id: 'm1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'Prior response' }],
      },
      messages[1],
    ]);
    expect(anthropicMock).toHaveBeenCalledWith('claude-sonnet-4-20250514');
    expect(stepCountIsMock).toHaveBeenCalledWith(3);
    expect(streamTextMock).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: 'anthropic', model: 'claude-sonnet-4-20250514' },
        stopWhen: { type: 'stepCountIs', count: 3 },
      }),
    );
  });

  it('deep merges edits through the editSection tool and persists invalidated pipeline state', async () => {
    const invalidatedState = {
      runId: 'run-1',
      currentSectionId: 'industryResearch',
      status: 'gated',
      approvedSectionIds: ['industryResearch'],
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
              marketSize: '$5.1B',
            },
            messagingOpportunities: {
              summaryRecommendations: ['Lead with measurement clarity'],
            },
          },
          jobId: 'job-1',
          error: null,
        },
      ],
    };
    invalidateDownstreamMock.mockReturnValue(invalidatedState);

    const { POST } = await import('../route');
    await POST(
      new Request('http://localhost/api/research/chat', {
        method: 'POST',
        body: JSON.stringify({
          runId: 'run-1',
          sectionId: 'industryResearch',
          messages: [],
        }),
      }),
    );

    const streamCall = streamTextMock.mock.calls[0]?.[0];
    expect(streamCall).toBeDefined();

    const toolResult = await streamCall.tools.editSection.execute({
      sectionId: 'industryResearch',
      updates: {
        categorySnapshot: {
          marketSize: '$5.1B',
        },
        messagingOpportunities: {
          summaryRecommendations: ['Lead with measurement clarity'],
        },
      },
      summary: 'Updated market size and messaging',
    });

    expect(supabaseState.rpcMock).toHaveBeenCalledWith(
      'merge_journey_session_research_result',
      {
        p_user_id: 'user-1',
        p_section: 'industryResearch',
        p_result: {
          status: 'complete',
          section: 'industryResearch',
          durationMs: 1200,
          runId: 'run-1',
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
    expect(persistPipelineStateMock).toHaveBeenCalledWith('user-1', invalidatedState);
    expect(toolResult).toEqual({
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
      summary: 'Updated market size and messaging',
    });
  });
});
