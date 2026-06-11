import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeEach, vi } from 'vitest';

const trackerSource = readFileSync(
  `${process.cwd()}/public/sl-analytics.v1.js`,
  'utf8',
);

interface FetchCallOptions {
  body?: string;
}

function installScriptTag(): void {
  document.body.innerHTML = `
    <script
      src="/sl-analytics.v1.js"
      data-client="anura"
      data-site="try-anura"
      data-endpoint="/api/landing-events"
    ></script>
    <form data-sl-form="lead_form">
      <input name="email" value="person@example.com" />
    </form>
  `;
}

function setDoNotTrack(value: string): void {
  Object.defineProperty(window.navigator, 'doNotTrack', {
    configurable: true,
    value,
  });
}

function evaluateTracker(): void {
  window.eval(trackerSource);
}

function parseFetchBody(fetchMock: ReturnType<typeof vi.fn>, index: number): Record<string, unknown> {
  const options = fetchMock.mock.calls[index]?.[1] as FetchCallOptions | undefined;
  if (!options?.body) {
    throw new Error(`Missing tracker fetch body at call index ${index}`);
  }
  return JSON.parse(options.body) as Record<string, unknown>;
}

describe('sl-analytics.v1.js', (): void => {
  beforeEach((): void => {
    vi.restoreAllMocks();
    sessionStorage.clear();
    document.body.innerHTML = '';
    window.history.pushState({}, '', '/landing?utm_source=meta&email=drop@example.com');
    setDoNotTrack('0');
    Object.defineProperty(window.navigator, 'sendBeacon', {
      configurable: true,
      value: undefined,
    });
  });

  it('respects Do Not Track before creating session state or sending events', (): void => {
    const fetchMock = vi.fn();
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      value: fetchMock,
    });
    setDoNotTrack('1');
    installScriptTag();

    evaluateTracker();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('sl_analytics_v1_session_id')).toBeNull();
  });

  it('sends anonymous page views and strips non-UTM query parameters', (): void => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      value: fetchMock,
    });
    installScriptTag();

    evaluateTracker();

    const body = parseFetchBody(fetchMock, 0);
    expect(body.event_name).toBe('page_viewed');
    expect(body.client_slug).toBe('anura');
    expect(body.site_slug).toBe('try-anura');
    expect(body.page_url).toBe('http://localhost:3000/landing?utm_source=meta');
    expect(body.session_id).toMatch(/^sl_/);
  });

  it('tracks form starts without reading form values', (): void => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 202 }));
    Object.defineProperty(window, 'fetch', {
      configurable: true,
      value: fetchMock,
    });
    installScriptTag();

    evaluateTracker();
    const input = document.querySelector('input');
    if (!input) throw new Error('Expected test input');
    input.dispatchEvent(new FocusEvent('focusin', { bubbles: true }));

    const body = parseFetchBody(fetchMock, 1);
    expect(body.event_name).toBe('form_started');
    expect(body.properties).toEqual({ form_id: 'lead_form' });
    expect(JSON.stringify(body)).not.toContain('person@example.com');
  });
});
