import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth and fetch before importing dispatch
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user-123' }),
}));

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Helper: build a minimal Response-like object
function makeResponse(status: number, body = ''): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body),
  } as Response;
}

describe('dispatchResearch retry logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RAILWAY_WORKER_URL = 'http://localhost:3001';
    process.env.RAILWAY_API_KEY = 'dev-secret';
  });

  it('succeeds on the first attempt when /run returns 202', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(202));

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('threads the active run id to the worker dispatch', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(202));

    const { dispatchResearch } = await import('../dispatch');
    await dispatchResearch('researchIndustry', 'industryMarket', 'ctx', {
      activeRunId: 'run-123',
    });

    const [, requestInit] = mockFetch.mock.calls[0] as [
      string,
      { body?: string },
    ];
    const payload = JSON.parse(requestInit.body ?? '{}') as { runId?: unknown };

    expect(payload.runId).toBe('run-123');
  });

  it('retries /run up to 3 times on network error before returning error', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // attempt 1
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // attempt 2
      .mockRejectedValueOnce(new Error('ECONNREFUSED')); // attempt 3

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('error');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('succeeds on second attempt if first /run throws', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('fetch failed')) // attempt 1 fails
      .mockResolvedValueOnce(makeResponse(202));         // attempt 2 succeeds

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on a 400 non-retryable worker response', async () => {
    mockFetch.mockResolvedValueOnce(makeResponse(400, 'bad'));

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('error');
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
