import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(),
}));

vi.mock('@/lib/ai/tools/research/dispatch', () => ({
  dispatchResearchForUser: vi.fn(),
}));

vi.mock('@/lib/journey/session-state.server', () => ({
  persistPipelineState: vi.fn(),
}));

vi.mock('@/lib/research/pipeline-context', () => ({
  buildIndustryContext: vi.fn(),
}));

import { auth } from '@clerk/nextjs/server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import { persistPipelineState } from '@/lib/journey/session-state.server';
import { buildIndustryContext } from '@/lib/research/pipeline-context';

const mockAuth = vi.mocked(auth);
const mockDispatchResearchForUser = vi.mocked(dispatchResearchForUser);
const mockPersistPipelineState = vi.mocked(persistPipelineState);
const mockBuildIndustryContext = vi.mocked(buildIndustryContext);

function buildRequest(body: unknown): Request {
  return new Request('http://localhost/api/research/pipeline/start', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
}

describe('POST /api/research/pipeline/start', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('run-123');
    mockAuth.mockResolvedValue({ userId: 'user-1' } as Awaited<ReturnType<typeof auth>>);
    mockBuildIndustryContext.mockReturnValue('industry context');
    mockPersistPipelineState.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns 401 when the request is unauthenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null } as Awaited<ReturnType<typeof auth>>);

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ onboardingData: { companyName: 'Acme' } }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    expect(mockDispatchResearchForUser).not.toHaveBeenCalled();
  });

  it('returns 400 when onboardingData is missing', async () => {
    const { POST } = await import('../route');
    const response = await POST(buildRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body: onboardingData is required',
    });
    expect(mockDispatchResearchForUser).not.toHaveBeenCalled();
  });

  it('returns 400 when onboardingData is not an object', async () => {
    const { POST } = await import('../route');
    const response = await POST(buildRequest({ onboardingData: 'Acme' }));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: 'Invalid request body: onboardingData is required',
    });
    expect(mockDispatchResearchForUser).not.toHaveBeenCalled();
  });

  it('returns 500 when persisting the started pipeline state fails', async () => {
    mockDispatchResearchForUser.mockResolvedValue({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
      userId: 'user-1',
    });
    mockPersistPipelineState.mockRejectedValueOnce(new Error('merge failed'));

    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ onboardingData: { companyName: 'Acme' } }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: 'Failed to persist pipeline start state for user user-1 and run run-123: merge failed',
    });
    expect(mockDispatchResearchForUser).toHaveBeenCalledWith(
      'researchIndustry',
      'industryMarket',
      'industry context',
      'user-1',
      { activeRunId: 'run-123' },
    );
  });

  it('dispatches the first section and persists onboarding data on success', async () => {
    mockDispatchResearchForUser.mockResolvedValue({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
      userId: 'user-1',
    });

    const onboardingData = {
      companyName: 'Acme',
      industry: 'B2B SaaS',
    };

    const { POST } = await import('../route');
    const response = await POST(buildRequest({ onboardingData }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      status: 'started',
      runId: 'run-123',
      section: 'industryResearch',
    });
    expect(mockBuildIndustryContext).toHaveBeenCalledWith(onboardingData);
    expect(mockDispatchResearchForUser).toHaveBeenCalledWith(
      'researchIndustry',
      'industryMarket',
      'industry context',
      'user-1',
      { activeRunId: 'run-123' },
    );
    expect(mockPersistPipelineState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        runId: 'run-123',
        status: 'running',
        currentSectionId: 'industryResearch',
        approvedSectionIds: [],
        sections: expect.arrayContaining([
          expect.objectContaining({
            id: 'industryResearch',
            status: 'running',
            jobId: 'job-1',
          }),
        ]),
      }),
      { onboardingData },
    );
  });

  it('persists an error state and returns 500 when dispatch fails', async () => {
    mockDispatchResearchForUser.mockResolvedValue({
      status: 'error',
      section: 'industryMarket',
      error: 'worker unavailable',
    });

    const { POST } = await import('../route');
    const response = await POST(
      buildRequest({ onboardingData: { companyName: 'Acme' } }),
    );

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({ error: 'worker unavailable' });
    expect(mockPersistPipelineState).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        runId: 'run-123',
        status: 'error',
        currentSectionId: null,
      }),
    );
  });
});
