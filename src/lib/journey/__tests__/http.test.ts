import { describe, expect, it } from 'vitest';
import {
  createJourneyGuardedFetch,
  formatJourneyErrorMessage,
} from '@/lib/journey/http';

describe('formatJourneyErrorMessage', () => {
  it('converts clerk html payloads into a friendly session error', () => {
    const message = formatJourneyErrorMessage(
      '<!DOCTYPE html><html><body>Lost in space? x-clerk-auth-reason</body></html>',
    );

    expect(message).toBe('Your session could not be verified. Refresh the page and try again.');
  });

  it('extracts nested json error messages', () => {
    const message = formatJourneyErrorMessage('{"error":"Unauthorized"}');

    expect(message).toBe('Your session expired. Refresh the page and try again.');
  });
});

describe('createJourneyGuardedFetch', () => {
  it('throws a friendly error for html responses', async () => {
    const originalFetch = global.fetch;
    try {
      global.fetch = (async () =>
        new Response('<!DOCTYPE html><html><body>Lost in space? x-clerk-auth-reason</body></html>', {
          status: 404,
          headers: { 'Content-Type': 'text/html; charset=utf-8' },
        })) as typeof fetch;

      const guardedFetch = createJourneyGuardedFetch('Journey');

      await expect(guardedFetch('/api/journey/stream')).rejects.toThrow(
        'Your session could not be verified. Refresh the page and try again.',
      );
    } finally {
      global.fetch = originalFetch;
    }
  });
});
