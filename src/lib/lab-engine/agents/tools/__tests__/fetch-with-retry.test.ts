import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchWithRetry } from "../_shared";

function makeResponse(status: number): Response {
  return new Response(status === 200 ? "ok" : "", { status });
}

describe("fetchWithRetry", (): void => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("retries a transient 429 and returns the subsequent 200", async (): Promise<void> => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(429))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const pending = fetchWithRetry("https://api.test/x");
    await vi.advanceTimersByTimeAsync(500);
    const response = await pending;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("retries a 5xx and returns the subsequent 200", async (): Promise<void> => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(makeResponse(503))
      .mockResolvedValueOnce(makeResponse(200));
    vi.stubGlobal("fetch", fetchMock);
    vi.useFakeTimers();

    const pending = fetchWithRetry("https://api.test/x");
    await vi.advanceTimersByTimeAsync(500);
    const response = await pending;

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("passes a non-retryable 404 through without a second fetch", async (): Promise<void> => {
    const fetchMock = vi.fn().mockResolvedValue(makeResponse(404));
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://api.test/x");

    expect(response.status).toBe(404);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not re-fetch when the signal aborts before the backoff", async (): Promise<void> => {
    const controller = new AbortController();
    const fetchMock = vi.fn().mockImplementation(async () => {
      // Abort as soon as the first request resolves (simulating mid-flight abort).
      controller.abort();
      return makeResponse(429);
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await fetchWithRetry("https://api.test/x", {
      abortSignal: controller.signal,
    });

    expect(response.status).toBe(429);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
