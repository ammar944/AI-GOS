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
    // Health check + dispatch both succeed first try
    mockFetch
      .mockResolvedValueOnce(makeResponse(200)) // /health
      .mockResolvedValueOnce(makeResponse(202)); // /run

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('retries /run up to 3 times on network error before returning error', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200))        // /health ok
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // attempt 1
      .mockRejectedValueOnce(new Error('ECONNREFUSED')) // attempt 2
      .mockRejectedValueOnce(new Error('ECONNREFUSED')); // attempt 3

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('error');
    // health + 3 dispatch attempts = 4 total
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('succeeds on second attempt if first /run throws', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200))         // /health ok
      .mockRejectedValueOnce(new Error('fetch failed')) // attempt 1 fails
      .mockResolvedValueOnce(makeResponse(202));         // attempt 2 succeeds

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('queued');
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it('does NOT retry on a 400 non-retryable worker response', async () => {
    mockFetch
      .mockResolvedValueOnce(makeResponse(200))         // /health ok
      .mockResolvedValueOnce(makeResponse(400, 'bad')); // /run 400 — not retryable

    const { dispatchResearch } = await import('../dispatch');
    const result = await dispatchResearch('researchIndustry', 'industryMarket', 'ctx');

    expect(result.status).toBe('error');
    // health + 1 dispatch attempt only (no retry on 4xx)
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
