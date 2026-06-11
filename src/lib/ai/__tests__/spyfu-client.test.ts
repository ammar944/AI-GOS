import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  getKeywordsByBulkSearch,
  getRelatedKeywords,
  SpyFuRateLimitError,
} from '../spyfu-client';

function jsonOk(value: unknown): Response {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
    status: 200,
  });
}

function rateLimited(headers: Record<string, string> = {}): Response {
  return new Response('rate limited', { headers, status: 429 });
}

// Suppress [SpyFu] retry/exhaustion logging during tests
beforeEach(() => {
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('call-time API key read', () => {
  it('throws when the key is absent, then succeeds once the key appears in the same process', async () => {
    // Warm-process fix: the key must be read per call, not frozen at module load.
    vi.stubEnv('SPYFU_API_KEY', '');
    await expect(getRelatedKeywords('crm software')).rejects.toThrow(
      'SPYFU_API_KEY not configured',
    );

    const fetchMock = vi.fn(async (url: string | URL) => {
      void url;
      return jsonOk({ results: [] });
    });
    vi.stubGlobal('fetch', fetchMock);
    vi.stubEnv('SPYFU_API_KEY', 'late-provisioned-key');

    await expect(getRelatedKeywords('crm software')).resolves.toEqual([]);
    const calledUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(calledUrl.searchParams.get('api_key')).toBe('late-provisioned-key');
  });
});

describe('429 exhaustion', () => {
  it('throws SpyFuRateLimitError (not a generic error) when every GET attempt is 429', async () => {
    vi.stubEnv('SPYFU_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => rateLimited());
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const resultPromise = getRelatedKeywords('crm software').catch(
      (error: unknown) => error,
    );
    await vi.runAllTimersAsync();
    const error = await resultPromise;

    expect(error).toBeInstanceOf(SpyFuRateLimitError);
    expect((error as SpyFuRateLimitError).status).toBe(429);
    // MAX_RETRIES=3 -> 4 total attempts
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('throws SpyFuRateLimitError when every POST attempt is 429', async () => {
    vi.stubEnv('SPYFU_API_KEY', 'test-key');
    const fetchMock = vi.fn(async () => rateLimited());
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const resultPromise = getKeywordsByBulkSearch(['crm software']).catch(
      (error: unknown) => error,
    );
    await vi.runAllTimersAsync();
    const error = await resultPromise;

    expect(error).toBeInstanceOf(SpyFuRateLimitError);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
});

describe('Retry-After parsing', () => {
  it('falls back to the backoff schedule (no zero-delay hot loop) on an HTTP-date Retry-After', async () => {
    vi.stubEnv('SPYFU_API_KEY', 'test-key');
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(
        rateLimited({ 'Retry-After': 'Wed, 21 Oct 2026 07:28:00 GMT' }),
      )
      .mockResolvedValueOnce(jsonOk({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const resultPromise = getRelatedKeywords('crm software');
    await vi.advanceTimersByTimeAsync(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // NaN from Number('Wed, ...') must NOT schedule an immediate retry.
    await vi.advanceTimersByTimeAsync(1_900);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // First 429 backoff step is 2s (jitter mocked to 0).
    await vi.advanceTimersByTimeAsync(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(resultPromise).resolves.toEqual([]);
  });

  it('clamps a large Retry-After seconds value to 30s', async () => {
    vi.stubEnv('SPYFU_API_KEY', 'test-key');
    const fetchMock = vi
      .fn<() => Promise<Response>>()
      .mockResolvedValueOnce(rateLimited({ 'Retry-After': '120' }))
      .mockResolvedValueOnce(jsonOk({ results: [] }));
    vi.stubGlobal('fetch', fetchMock);
    vi.useFakeTimers();

    const resultPromise = getRelatedKeywords('crm software');
    await vi.advanceTimersByTimeAsync(29_999);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await expect(resultPromise).resolves.toEqual([]);
  });
});
