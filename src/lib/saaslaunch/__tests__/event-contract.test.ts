import { describe, expect, it } from 'vitest';
import {
  LandingEventValidationError,
  parseLandingEventPayload,
} from '@/lib/saaslaunch/event-contract';

function validPayload(): Record<string, unknown> {
  return {
    event_name: 'cta_clicked',
    client_slug: 'anura',
    site_slug: 'try-anura',
    page_url: 'https://try.anura.io/path?utm_source=meta&email=a@example.com',
    path: '/path',
    occurred_at: '2026-06-11T08:00:00.000Z',
    session_id: 'sl_session_123',
    utm_source: 'meta',
    utm_medium: null,
    utm_campaign: null,
    utm_content: null,
    utm_term: null,
    referrer: 'https://facebook.com/ad?fbclid=secret',
    device_type: 'desktop',
    browser: 'chrome',
    properties: {
      cta_id: 'hero',
      href_path: '/book',
    },
  };
}

describe('parseLandingEventPayload', (): void => {
  it('accepts registry-owned event keys and strips non-UTM URL parameters', (): void => {
    const parsed = parseLandingEventPayload(validPayload());

    expect(parsed.eventKey).toBe('cta_clicked');
    expect(parsed.pageUrl).toBe('https://try.anura.io/path?utm_source=meta');
    expect(parsed.referrer).toBe('https://facebook.com/ad');
  });

  it('rejects PII-looking property keys', (): void => {
    expect(() =>
      parseLandingEventPayload({
        ...validPayload(),
        properties: { email: 'hidden@example.com' },
      }),
    ).toThrow(LandingEventValidationError);
  });

  it('rejects PII-looking property values', (): void => {
    expect(() =>
      parseLandingEventPayload({
        ...validPayload(),
        properties: { cta_text: 'Call me at +1 555 555 1212' },
      }),
    ).toThrow('PII-looking value is not allowed');
  });

  it('rejects non-HTTP page URLs', (): void => {
    expect(() =>
      parseLandingEventPayload({
        ...validPayload(),
        page_url: 'mailto:test@example.com',
      }),
    ).toThrow(LandingEventValidationError);
  });
});
