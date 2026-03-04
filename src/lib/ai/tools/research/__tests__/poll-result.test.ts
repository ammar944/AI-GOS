import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/lib/journey/read-research-result', () => ({
  readJobStatus: vi.fn(),
  readResearchResult: vi.fn(),
}));

describe('pollForResult', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns complete when job finishes on first poll', async () => {
    const { readJobStatus, readResearchResult } = await import(
      '@/lib/journey/read-research-result'
    );
    vi.mocked(readJobStatus).mockResolvedValueOnce({
      status: 'complete',
      tool: 'researchIndustry',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    });
    vi.mocked(readResearchResult).mockResolvedValueOnce({
      status: 'complete',
      data: { categorySnapshot: {} },
    });

    const { pollForResult } = await import('../poll-result');
    const result = await pollForResult('user-123', 'industryMarket', 'job-1', {
      intervalMs: 10,
      maxWaitMs: 1000,
    });

    expect(result.status).toBe('complete');
    expect(result.data).toBeDefined();
  });

  it('returns timeout when maxWaitMs exceeded', async () => {
    const { readJobStatus } = await import(
      '@/lib/journey/read-research-result'
    );
    vi.mocked(readJobStatus).mockResolvedValue({
      status: 'running',
      tool: 'researchIndustry',
      startedAt: new Date().toISOString(),
    });

    const { pollForResult } = await import('../poll-result');
    const result = await pollForResult('user-123', 'industryMarket', 'job-1', {
      intervalMs: 10,
      maxWaitMs: 50,
    });

    expect(result.status).toBe('timeout');
  });

  it('returns error when job fails', async () => {
    const { readJobStatus } = await import(
      '@/lib/journey/read-research-result'
    );
    vi.mocked(readJobStatus).mockResolvedValueOnce({
      status: 'error',
      tool: 'researchIndustry',
      startedAt: new Date().toISOString(),
      error: 'Sub-agent timed out',
    });

    const { pollForResult } = await import('../poll-result');
    const result = await pollForResult('user-123', 'industryMarket', 'job-1', {
      intervalMs: 10,
    });

    expect(result.status).toBe('error');
    expect(result.error).toBe('Sub-agent timed out');
  });
});
