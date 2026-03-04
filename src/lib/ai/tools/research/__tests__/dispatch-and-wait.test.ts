import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../dispatch', () => ({
  dispatchResearch: vi.fn(),
}));
vi.mock('../poll-result', () => ({
  pollForResult: vi.fn(),
}));

describe('dispatchAndWait', () => {
  beforeEach(() => vi.clearAllMocks());

  it('dispatches then polls and returns complete result', async () => {
    const { dispatchResearch } = await import('../dispatch');
    const { pollForResult } = await import('../poll-result');

    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
      userId: 'user-123',
    });
    vi.mocked(pollForResult).mockResolvedValueOnce({
      status: 'complete',
      data: { categorySnapshot: { category: 'B2B SaaS' } },
      durationMs: 15000,
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait(
      'researchIndustry',
      'industryMarket',
      'context',
    );

    expect(result.status).toBe('complete');
    expect(result.data).toEqual({
      categorySnapshot: { category: 'B2B SaaS' },
    });
  });

  it('returns structured error when dispatch fails', async () => {
    const { dispatchResearch } = await import('../dispatch');
    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'error',
      section: 'industryMarket',
      error: 'Worker unreachable',
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait(
      'researchIndustry',
      'industryMarket',
      'context',
    );

    expect(result.status).toBe('error');
    expect(result.errorDetail?.error).toBe(true);
  });

  it('returns partial result on timeout', async () => {
    const { dispatchResearch } = await import('../dispatch');
    const { pollForResult } = await import('../poll-result');

    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
      userId: 'user-123',
    });
    vi.mocked(pollForResult).mockResolvedValueOnce({
      status: 'timeout',
      data: null,
      durationMs: 120000,
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait(
      'researchIndustry',
      'industryMarket',
      'context',
    );

    expect(result.status).toBe('partial');
    expect(result.gaps).toContain('Timed out after 120.0s');
  });

  it('returns error when poll returns error', async () => {
    const { dispatchResearch } = await import('../dispatch');
    const { pollForResult } = await import('../poll-result');

    vi.mocked(dispatchResearch).mockResolvedValueOnce({
      status: 'queued',
      section: 'industryMarket',
      jobId: 'job-1',
      userId: 'user-123',
    });
    vi.mocked(pollForResult).mockResolvedValueOnce({
      status: 'error',
      error: 'Sub-agent crashed',
      durationMs: 8000,
    });

    const { dispatchAndWait } = await import('../dispatch-and-wait');
    const result = await dispatchAndWait(
      'researchIndustry',
      'industryMarket',
      'context',
    );

    expect(result.status).toBe('error');
    expect(result.errorDetail?.reason).toBe('Sub-agent crashed');
  });
});
