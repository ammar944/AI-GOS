/**
 * Integration tests for GET /api/research-v2/_capabilities
 *
 * Phase 7: the response shape is now { worker_url, worker_version,
 * worker_reachable, orchestrate_supported, lastError }. The three rollout-gate flags
 * (orchestrator_enabled, parallel_sections_enabled, artifact_ui_v2) were
 * removed when the orchestrator + centered artifact UI became the only
 * code path.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/research-v2/_capabilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.RAILWAY_WORKER_URL;
    delete process.env.RAILWAY_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns 200 with explicit worker reachability diagnostics', async () => {
    const { GET } = await import('../route');
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Object.keys(json).sort()).toEqual(
      [
        'lastError',
        'orchestrate_supported',
        'worker_reachable',
        'worker_url',
        'worker_version',
      ].sort(),
    );
    expect(typeof json.worker_url).toBe('string');
    expect(typeof json.worker_version).toBe('string');
    expect(typeof json.worker_reachable).toBe('boolean');
    expect(typeof json.orchestrate_supported).toBe('boolean');
    expect(
      typeof json.lastError === 'string' || json.lastError === null,
    ).toBe(true);
  });

  it('reports worker_reachable=false when RAILWAY_WORKER_URL is unset', async () => {
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.worker_url).toBe('');
    expect(json.worker_version).toBe('unconfigured');
    expect(json.worker_reachable).toBe(false);
    expect(json.orchestrate_supported).toBe(false);
    expect(json.lastError).toBe('RAILWAY_WORKER_URL is not configured');
  });

  it('reports worker_reachable=false and lastError when worker fetch fails', async () => {
    process.env.RAILWAY_WORKER_URL = 'http://worker.invalid';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.worker_url).toBe('http://worker.invalid');
    expect(json.worker_version).toBe('unreachable');
    expect(json.worker_reachable).toBe(false);
    expect(json.orchestrate_supported).toBe(false);
    expect(json.lastError).toBe('boom');
  });

  it('mirrors worker_version and orchestrate_supported from a successful worker response', async () => {
    process.env.RAILWAY_WORKER_URL = 'http://worker.invalid/';
    process.env.RAILWAY_API_KEY = 'dev-secret';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          worker_version: '1.4.2',
          orchestrate_supported: true,
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.worker_version).toBe('1.4.2');
    expect(json.worker_reachable).toBe(true);
    expect(json.orchestrate_supported).toBe(true);
    expect(json.lastError).toBeNull();
  });

  it('returns structured unreachable diagnostics on non-2xx worker responses', async () => {
    process.env.RAILWAY_WORKER_URL = 'http://worker.invalid';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', { status: 500 }),
    );
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.worker_version).toBe('unreachable');
    expect(json.worker_reachable).toBe(false);
    expect(json.orchestrate_supported).toBe(false);
    expect(json.lastError).toBe('Worker /capabilities returned HTTP 500');
  });
});
