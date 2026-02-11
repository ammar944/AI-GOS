/**
 * Integration Tests for GET /api/health
 *
 * Tests the health check API route handler including:
 * - Status 'ok' when all services healthy
 * - Status 'degraded' when warnings exist
 * - Status 'error' (503) when required vars missing
 * - Response includes timestamp and version
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '../route';

// Mock validateEnv from the env module
vi.mock('@/lib/env', () => ({
  validateEnv: vi.fn(),
}));

import { validateEnv } from '@/lib/env';

const mockValidateEnv = vi.mocked(validateEnv);

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Health Status Responses', () => {
    it('returns 200 with status "ok" when all services healthy', async () => {
      mockValidateEnv.mockReturnValue({
        valid: true,
        missing: [],
        warnings: [],
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('ok');
      expect(json.checks.environment.status).toBe('ok');
    });

    it('returns 200 with status "degraded" when warnings exist', async () => {
      mockValidateEnv.mockReturnValue({
        valid: true,
        missing: [],
        warnings: ['Optional environment variable NEXT_PUBLIC_APP_URL is not set'],
      });

      const response = await GET();

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.status).toBe('degraded');
      expect(json.checks.environment.status).toBe('ok');
    });

    it('returns 503 with status "error" when required vars missing', async () => {
      mockValidateEnv.mockReturnValue({
        valid: false,
        missing: ['ANTHROPIC_API_KEY', 'SEARCHAPI_KEY'],
        warnings: [],
      });

      const response = await GET();

      expect(response.status).toBe(503);
      const json = await response.json();
      expect(json.status).toBe('error');
      expect(json.checks.environment.status).toBe('error');
      expect(json.checks.environment.missing).toContain('ANTHROPIC_API_KEY');
      expect(json.checks.environment.missing).toContain('SEARCHAPI_KEY');
    });
  });

  describe('Response Fields', () => {
    it('response includes timestamp', async () => {
      mockValidateEnv.mockReturnValue({
        valid: true,
        missing: [],
        warnings: [],
      });

      const beforeRequest = new Date().toISOString();
      const response = await GET();
      const afterRequest = new Date().toISOString();

      const json = await response.json();
      expect(json.timestamp).toBeDefined();

      // Verify timestamp is a valid ISO string between before and after
      const timestamp = new Date(json.timestamp);
      expect(timestamp.toISOString()).toBe(json.timestamp);
      expect(timestamp.getTime()).toBeGreaterThanOrEqual(new Date(beforeRequest).getTime() - 1000);
      expect(timestamp.getTime()).toBeLessThanOrEqual(new Date(afterRequest).getTime() + 1000);
    });

    it('response includes version', async () => {
      mockValidateEnv.mockReturnValue({
        valid: true,
        missing: [],
        warnings: [],
      });

      const response = await GET();

      const json = await response.json();
      expect(json.version).toBeDefined();
      expect(typeof json.version).toBe('string');
      // Expect semantic version format
      expect(json.version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });
});
