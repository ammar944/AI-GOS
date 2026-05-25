import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('validateWorkerUrl', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    process.env = originalEnv;
  });

  it('returns configured: true when RAILWAY_WORKER_URL is set', async () => {
    process.env.RAILWAY_WORKER_URL = 'https://my-worker.railway.app';
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(true);
  });

  it('returns configured: true when RAILWAY_WORKER_URL is missing outside production', async () => {
    delete process.env.RAILWAY_WORKER_URL;
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(true);
  });

  it('returns configured: false and a helpful message when RAILWAY_WORKER_URL is missing in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    delete process.env.RAILWAY_WORKER_URL;
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(false);
    expect(result.message).toContain('RAILWAY_WORKER_URL');
    expect(result.message).toContain('research');
  });

  it('uses the local fallback when RAILWAY_WORKER_URL is empty outside production', async () => {
    process.env.RAILWAY_WORKER_URL = '';
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(true);
  });

  it('returns configured: false when RAILWAY_WORKER_URL is whitespace only in production', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    process.env.RAILWAY_WORKER_URL = '   ';
    const { validateWorkerUrl } = await import('../env');
    const result = validateWorkerUrl();
    expect(result.configured).toBe(false);
  });
});
