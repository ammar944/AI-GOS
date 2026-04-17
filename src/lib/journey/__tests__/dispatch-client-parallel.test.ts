import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dispatchAllResearchParallel,
  WAVE_1_PARALLEL_SECTIONS,
} from '../dispatch-client';

describe('dispatchAllResearchParallel', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.fetch = originalFetch;
  });

  it('dispatches identity first, then fans out wave-1 sections in parallel', async () => {
    const dispatched: string[] = [];

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/journey/dispatch') {
        const body = JSON.parse(init?.body as string) as { section: string };
        dispatched.push(body.section);
        return new Response(
          JSON.stringify({ status: 'queued', section: body.section, jobId: `job-${body.section}` }),
          { status: 200 },
        );
      }

      if (url.startsWith('/api/journey/research-status')) {
        return new Response(JSON.stringify({ complete: true }), { status: 200 });
      }

      return new Response('not-found', { status: 404 });
    }) as unknown as typeof fetch;

    const promise = dispatchAllResearchParallel('run-1', 'ctx');
    // Flush the identity-poll microtask delay so the timer fires
    await vi.advanceTimersByTimeAsync(1000);
    const result = await promise;

    expect(dispatched[0]).toBe('identityResolution');
    expect(dispatched.slice(1).sort()).toEqual([...WAVE_1_PARALLEL_SECTIONS].sort());
    expect(result.identity.status).toBe('queued');
    for (const section of WAVE_1_PARALLEL_SECTIONS) {
      expect(result.wave1[section].status).toBe('queued');
      expect(result.wave1[section].jobId).toBe(`job-${section}`);
    }
  });

  it('still fans out wave-1 even if identity dispatch fails', async () => {
    const dispatched: string[] = [];
    let callCount = 0;

    globalThis.fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === 'string' ? input : input.toString();

      if (url === '/api/journey/dispatch') {
        const body = JSON.parse(init?.body as string) as { section: string };
        dispatched.push(body.section);
        callCount += 1;
        if (body.section === 'identityResolution') {
          return new Response('boom', { status: 500 });
        }
        return new Response(
          JSON.stringify({ status: 'queued', section: body.section, jobId: `job-${callCount}` }),
          { status: 200 },
        );
      }

      return new Response('not-found', { status: 404 });
    }) as unknown as typeof fetch;

    const result = await dispatchAllResearchParallel('run-2', 'ctx');

    expect(result.identity.status).toBe('error');
    // All 4 wave-1 sections were still dispatched.
    expect(dispatched.filter((s) => s !== 'identityResolution').sort()).toEqual(
      [...WAVE_1_PARALLEL_SECTIONS].sort(),
    );
    for (const section of WAVE_1_PARALLEL_SECTIONS) {
      expect(result.wave1[section].status).toBe('queued');
    }
  });
});
