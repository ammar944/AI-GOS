import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const routeMocks = vi.hoisted(() => {
  class MockLandingSiteConfigError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'LandingSiteConfigError';
    }
  }

  class MockLandingEventValidationError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'LandingEventValidationError';
    }
  }

  return {
    recordLandingEvent: vi.fn(),
    LandingSiteConfigError: MockLandingSiteConfigError,
    LandingEventValidationError: MockLandingEventValidationError,
  };
});

vi.mock('@/lib/saaslaunch/events', () => ({
  LandingSiteConfigError: routeMocks.LandingSiteConfigError,
  recordLandingEvent: (...args: unknown[]) => routeMocks.recordLandingEvent(...args),
}));

vi.mock('@/lib/saaslaunch/event-contract', () => ({
  LandingEventValidationError: routeMocks.LandingEventValidationError,
}));

const { POST } = await import('../route');

function makeRequest(body: unknown, origin = 'https://try.anura.io'): NextRequest {
  return new NextRequest('http://localhost/api/landing-events', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin,
      'user-agent': 'vitest',
    },
    body: JSON.stringify(body),
  });
}

function payload(): Record<string, unknown> {
  return {
    event_name: 'page_viewed',
    client_slug: 'anura',
    site_slug: 'try-anura',
  };
}

describe('POST /api/landing-events', (): void => {
  beforeEach((): void => {
    vi.clearAllMocks();
  });

  it('returns 202 when the event is recorded', async (): Promise<void> => {
    routeMocks.recordLandingEvent.mockResolvedValue({ id: 'event-1' });

    const response = await POST(makeRequest(payload()));
    const body = await response.json();

    expect(response.status).toBe(202);
    expect(body).toEqual({ accepted: true, id: 'event-1' });
    expect(routeMocks.recordLandingEvent).toHaveBeenCalledWith({
      payload: payload(),
      origin: 'https://try.anura.io',
      userAgent: 'vitest',
    });
  });

  it('returns 400 for validation rejections', async (): Promise<void> => {
    routeMocks.recordLandingEvent.mockRejectedValue(
      new routeMocks.LandingEventValidationError('Invalid landing event payload'),
    );

    const response = await POST(makeRequest(payload()));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      accepted: false,
      error: 'Invalid landing event payload',
    });
  });

  it('returns 403 for site config rejections', async (): Promise<void> => {
    routeMocks.recordLandingEvent.mockRejectedValue(
      new routeMocks.LandingSiteConfigError('Origin is not allowed'),
    );

    const response = await POST(makeRequest(payload(), 'https://blocked.example'));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      accepted: false,
      error: 'Origin is not allowed',
    });
  });
});
