/**
 * Integration tests for GET /api/research-v2/_capabilities
 *
 * Verifies the JSON shape and value mapping required by the orchestrator +
 * artifact UI cycle Phase 0. The response is the local frontend flag state
 * merged with a best-effort reflection of the worker /capabilities response.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const ORIGINAL_ENV = { ...process.env };

describe('GET /api/research-v2/_capabilities', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...ORIGINAL_ENV };
    delete process.env.ENABLE_POSITIONING_ORCHESTRATOR;
    delete process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS;
    delete process.env.NEXT_PUBLIC_ARTIFACT_UI_V2;
    delete process.env.RAILWAY_WORKER_URL;
    delete process.env.RAILWAY_API_KEY;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns 200 with the full capabilities key set when no worker is configured', async () => {
    const { GET } = await import('../route');
    const response = await GET();
    expect(response.status).toBe(200);
    const json = await response.json();
    expect(Object.keys(json).sort()).toEqual(
      [
        'artifact_ui_v2',
        'orchestrate_supported',
        'orchestrator_enabled',
        'parallel_sections_enabled',
        'worker_url',
        'worker_version',
      ].sort(),
    );
    expect(typeof json.orchestrator_enabled).toBe('boolean');
    expect(typeof json.parallel_sections_enabled).toBe('boolean');
    expect(typeof json.artifact_ui_v2).toBe('boolean');
    expect(typeof json.worker_url).toBe('string');
    expect(typeof json.worker_version).toBe('string');
    expect(typeof json.orchestrate_supported).toBe('boolean');
    expect(json.worker_url).toBe('');
    expect(json.worker_version).toBe('unconfigured');
    expect(json.orchestrate_supported).toBe(false);
  });

  it('reflects local frontend flags exactly when set to "true"', async () => {
    process.env.ENABLE_POSITIONING_ORCHESTRATOR = 'true';
    process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS = 'true';
    process.env.NEXT_PUBLIC_ARTIFACT_UI_V2 = 'true';
    process.env.RAILWAY_WORKER_URL = 'http://worker.invalid';
    const { GET } = await import('../route');
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('unreachable'));
    const response = await GET();
    const json = await response.json();
    expect(json.orchestrator_enabled).toBe(true);
    expect(json.parallel_sections_enabled).toBe(true);
    expect(json.artifact_ui_v2).toBe(true);
    expect(json.worker_url).toBe('http://worker.invalid');
  });

  it('treats any value other than "true" as false', async () => {
    process.env.ENABLE_POSITIONING_ORCHESTRATOR = '1';
    process.env.NEXT_PUBLIC_ENABLE_PARALLEL_SECTIONS = 'yes';
    process.env.NEXT_PUBLIC_ARTIFACT_UI_V2 = 'on';
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.orchestrator_enabled).toBe(false);
    expect(json.parallel_sections_enabled).toBe(false);
    expect(json.artifact_ui_v2).toBe(false);
  });

  it('reports worker_version="unreachable" and orchestrate_supported=false when worker fetch fails', async () => {
    process.env.RAILWAY_WORKER_URL = 'http://worker.invalid';
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('boom'));
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.worker_url).toBe('http://worker.invalid');
    expect(json.worker_version).toBe('unreachable');
    expect(json.orchestrate_supported).toBe(false);
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
    expect(json.orchestrate_supported).toBe(true);
  });

  it('falls back to "unreachable" on non-2xx worker responses', async () => {
    process.env.RAILWAY_WORKER_URL = 'http://worker.invalid';
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response('nope', { status: 500 }),
    );
    const { GET } = await import('../route');
    const response = await GET();
    const json = await response.json();
    expect(json.worker_version).toBe('unreachable');
    expect(json.orchestrate_supported).toBe(false);
  });
});
