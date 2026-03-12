import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createInitialPipelineState,
  markSectionComplete,
  markSectionRunning,
} from '@/lib/research/pipeline-controller';
import type { PipelineSectionId, PipelineState } from '@/lib/research/pipeline-types';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/journey/session-state.server', () => ({
  readPipelineState: vi.fn(),
  persistPipelineState: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(),
}));

vi.mock('@/lib/ai/tools/research/dispatch', () => ({
  dispatchResearchForUser: vi.fn(),
}));

vi.mock('@/lib/research/pipeline-context', () => ({
  buildIndustryContext: vi.fn(),
  buildCompetitorContext: vi.fn(),
  buildIcpContext: vi.fn(),
  buildOfferContext: vi.fn(),
  buildSynthesisContext: vi.fn(),
  buildKeywordContext: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import {
  persistPipelineState,
  readPipelineState,
} from '@/lib/journey/session-state.server';
import {
  buildCompetitorContext,
  buildIcpContext,
  buildKeywordContext,
  buildOfferContext,
  buildSynthesisContext,
} from '@/lib/research/pipeline-context';
import { createAdminClient } from '@/lib/supabase/server';

const mockAuth = vi.mocked(auth);
const mockReadPipelineState = vi.mocked(readPipelineState);
const mockPersistPipelineState = vi.mocked(persistPipelineState);
const mockCreateAdminClient = vi.mocked(createAdminClient);
const mockDispatchResearchForUser = vi.mocked(dispatchResearchForUser);
const mockBuildCompetitorContext = vi.mocked(buildCompetitorContext);
const mockBuildIcpContext = vi.mocked(buildIcpContext);
const mockBuildOfferContext = vi.mocked(buildOfferContext);
const mockBuildSynthesisContext = vi.mocked(buildSynthesisContext);
const mockBuildKeywordContext = vi.mocked(buildKeywordContext);

const mockSingle = vi.fn();
const sampleOnboardingData = { companyName: 'Acme', industry: 'B2B SaaS' };
const sampleResearchResults = {
  industryResearch: {
    data: { market: 'B2B SaaS' },
  },
  competitorIntel: {
    data: { competitors: [{ name: 'Rival Co' }] },
  },
  icpValidation: {
    data: { persona: 'RevOps leaders' },
  },
  offerAnalysis: {
    data: { angle: 'Revenue clarity' },
  },
  strategicSynthesis: {
    data: { summary: 'Own the attribution narrative' },
  },
};

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/research/pipeline/advance', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

function buildCompletedState(
  sectionId: PipelineSectionId,
  approvedSectionIds: PipelineSectionId[] = [],
): PipelineState {
  const runningState = markSectionRunning(
    createInitialPipelineState('run-123'),
    sectionId,
    'job-current',
  );

  return {
    ...markSectionComplete(runningState, sectionId, {
      completed: true,
    }),
    approvedSectionIds,
  };
}

describe('POST /api/research/pipeline/advance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAuth.mockResolvedValue({ userId: 'user-1' } as Awaited<ReturnType<typeof auth>>);
    mockPersistPipelineState.mockResolvedValue(undefined);
    mockCreateAdminClient.mockReturnValue({
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: mockSingle,
          })),
        })),
      })),
    } as unknown as ReturnType<typeof createAdminClient>);
    mockSingle.mockResolvedValue({
      data: {
        metadata: {
          onboardingData: sampleOnboardingData,
        },
        research_results: sampleResearchResults,
      },
      error: null,
    });
    mockBuildCompetitorContext.mockReturnValue('competitor context');
    mockBuildIcpContext.mockReturnValue('icp context');
    mockBuildOfferContext.mockReturnValue('offer context');
    mockBuildSynthesisContext.mockReturnValue('synthesis context');
    mockBuildKeywordContext.mockReturnValue('keyword context');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ runId: 'run-123' }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
  });

  it('returns 400 when runId is missing', async () => {
    const { POST } = await import('../route');
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body: runId is required',
    });
  });

  it('returns 404 when the run does not match the persisted pipeline state', async () => {
    mockReadPipelineState.mockResolvedValue(buildCompletedState('industryResearch'));

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ runId: 'run-other' }));

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({
      error: 'Run not found or mismatch',
    });
  });

  it('returns 409 when the current section is not complete', async () => {
    const incompleteState = createInitialPipelineState('run-123');
    mockReadPipelineState.mockResolvedValue({
      ...incompleteState,
      currentSectionId: 'industryResearch',
      status: 'running',
      sections: incompleteState.sections.map((section) =>
        section.id === 'industryResearch'
          ? { ...section, status: 'running' }
          : section,
      ),
    });

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ runId: 'run-123' }));

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: 'Section industryResearch is running, not complete',
    });
  });

  it('returns complete when approving the final section', async () => {
    const completeReadyState = buildCompletedState('keywordIntel', [
      'industryResearch',
      'competitorIntel',
      'icpValidation',
      'offerAnalysis',
      'strategicSynthesis',
    ]);
    mockReadPipelineState.mockResolvedValue(completeReadyState);

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ runId: 'run-123' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'complete',
      runId: 'run-123',
    });
    expect(mockDispatchResearchForUser).not.toHaveBeenCalled();
    expect(mockPersistPipelineState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: 'complete',
        currentSectionId: null,
        approvedSectionIds: expect.arrayContaining(['keywordIntel']),
      }),
    );
  });

  it('dispatches the next section and persists the advanced running state', async () => {
    const currentState = buildCompletedState('industryResearch');
    mockReadPipelineState.mockResolvedValue(currentState);
    mockDispatchResearchForUser.mockResolvedValue({
      status: 'queued',
      section: 'competitors',
      jobId: 'job-next',
      userId: 'user-1',
    });

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ runId: 'run-123' }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'advanced',
      runId: 'run-123',
      section: 'competitorIntel',
    });
    expect(mockBuildCompetitorContext).toHaveBeenCalledWith({
      onboardingData: sampleOnboardingData,
      industryResearch: sampleResearchResults.industryResearch,
    });
    expect(mockDispatchResearchForUser).toHaveBeenCalledWith(
      'researchCompetitors',
      'competitors',
      'competitor context',
      'user-1',
      { activeRunId: 'run-123' },
    );
    expect(mockPersistPipelineState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: 'running',
        currentSectionId: 'competitorIntel',
        approvedSectionIds: ['industryResearch'],
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'competitorIntel',
            status: 'running',
            jobId: 'job-next',
          }),
        ]),
      }),
    );
  });

  it('persists an error state and returns 500 when the next dispatch fails', async () => {
    const currentState = buildCompletedState('offerAnalysis', [
      'industryResearch',
      'competitorIntel',
      'icpValidation',
    ]);
    mockReadPipelineState.mockResolvedValue(currentState);
    mockDispatchResearchForUser.mockResolvedValue({
      status: 'error',
      section: 'crossAnalysis',
      error: 'worker unavailable',
    });

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ runId: 'run-123' }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'worker unavailable' });
    expect(mockBuildSynthesisContext).toHaveBeenCalledWith({
      onboardingData: sampleOnboardingData,
      industryResearch: sampleResearchResults.industryResearch,
      competitorIntel: sampleResearchResults.competitorIntel,
      icpValidation: sampleResearchResults.icpValidation,
      offerAnalysis: sampleResearchResults.offerAnalysis,
    });
    expect(mockPersistPipelineState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        status: 'error',
        currentSectionId: 'offerAnalysis',
        approvedSectionIds: [
          'industryResearch',
          'competitorIntel',
          'icpValidation',
          'offerAnalysis',
        ],
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'strategicSynthesis',
            status: 'error',
            error: 'worker unavailable',
          }),
        ]),
      }),
    );
  });
});
