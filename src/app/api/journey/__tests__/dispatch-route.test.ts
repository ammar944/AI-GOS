import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => ({
  auth: vi.fn(),
  dispatchJourneyResearchForUser: vi.fn(),
  getJourneyResearchTool: vi.fn(),
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: () => routeMocks.auth(),
}));

vi.mock('@/lib/journey/server/dispatch-research', () => ({
  DISPATCH_PIPELINE_ORDER: [],
  dispatchJourneyResearchForUser: routeMocks.dispatchJourneyResearchForUser,
  getJourneyResearchTool: routeMocks.getJourneyResearchTool,
  normalizeWikiEntries: vi.fn(),
  summarizeForSynthesis: vi.fn(),
}));

const { POST } = await import('../dispatch/route');

function makeDispatchRequest(body: unknown): Request {
  return new Request('http://localhost/api/journey/dispatch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('Journey dispatch route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    routeMocks.auth.mockResolvedValue({ userId: 'user-1' });
    routeMocks.getJourneyResearchTool.mockReturnValue('runDeepResearchProgram');
    routeMocks.dispatchJourneyResearchForUser.mockResolvedValue({
      status: 'queued',
      section: 'deepResearchProgram',
      jobId: 'job-1',
    });
  });

  it('rejects deep research dispatch without a run id', async () => {
    const response = await POST(
      makeDispatchRequest({
        section: 'deepResearchProgram',
        context: 'Company Name: AI-GOS',
      }),
    );

    expect(response.status).toBe(400);
    const json = await response.json();
    expect(json.error).toContain('runId');
    expect(routeMocks.dispatchJourneyResearchForUser).not.toHaveBeenCalled();
  });

  it('forwards run-scoped context to the Journey research dispatcher', async () => {
    const response = await POST(
      makeDispatchRequest({
        section: 'deepResearchProgram',
        runId: 'run-1',
        context: 'Company Name: AI-GOS',
      }),
    );

    expect(response.status).toBe(200);
    expect(routeMocks.dispatchJourneyResearchForUser).toHaveBeenCalledWith({
      userId: 'user-1',
      section: 'deepResearchProgram',
      runId: 'run-1',
      context: 'Company Name: AI-GOS',
    });
  });
});
