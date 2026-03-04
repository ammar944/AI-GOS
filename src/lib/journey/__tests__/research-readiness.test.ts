import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn().mockResolvedValue({ userId: 'user-test' }),
}));

const mockSingle = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSelect = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect.mockReturnThis(),
      eq: mockEq.mockReturnThis(),
      order: mockOrder.mockReturnThis(),
      limit: mockLimit.mockReturnThis(),
      single: mockSingle,
    })),
  })),
}));

describe('waitForResearchReadiness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately when all 4 sections are already complete', async () => {
    mockSingle.mockResolvedValue({
      data: {
        research_results: {
          industryMarket: { status: 'complete' },
          competitors: { status: 'complete' },
          icpValidation: { status: 'complete' },
          offerAnalysis: { status: 'complete' },
        },
      },
      error: null,
    });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 5000 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(true);
    expect(result.timedOut).toBe(false);
    expect(result.completedSections).toHaveLength(4);
  });

  it('polls and resolves when sections complete during wait', async () => {
    // First poll: 2 sections complete
    // Second poll: all 4 complete
    mockSingle
      .mockResolvedValueOnce({
        data: {
          research_results: {
            industryMarket: { status: 'complete' },
            competitors: { status: 'complete' },
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          research_results: {
            industryMarket: { status: 'complete' },
            competitors: { status: 'complete' },
            icpValidation: { status: 'complete' },
            offerAnalysis: { status: 'complete' },
          },
        },
        error: null,
      });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 5000 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(true);
    expect(mockSingle).toHaveBeenCalledTimes(2);
  });

  it('resolves with timedOut: true when timeout is exceeded', async () => {
    // Always incomplete
    mockSingle.mockResolvedValue({
      data: {
        research_results: {
          industryMarket: { status: 'complete' },
          // others missing
        },
      },
      error: null,
    });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 300 });

    await vi.runAllTimersAsync();
    const result = await promise;

    expect(result.ready).toBe(false);
    expect(result.timedOut).toBe(true);
  });

  it('resolves with timedOut: true when Supabase session not found', async () => {
    mockSingle.mockResolvedValue({ data: null, error: { message: 'not found' } });

    const { waitForResearchReadiness } = await import('../research-readiness');
    const promise = waitForResearchReadiness('user-test', { pollIntervalMs: 100, timeoutMs: 300 });

    await vi.runAllTimersAsync();
    const result = await promise;

    // No session = no research results = treat as timed out
    expect(result.timedOut).toBe(true);
  });
});
