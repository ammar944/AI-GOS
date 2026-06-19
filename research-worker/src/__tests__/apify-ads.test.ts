import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const apifyMock = vi.hoisted(() => ({
  actorCall: vi.fn(),
  listItems: vi.fn(),
}));

vi.mock('apify-client', () => ({
  ApifyClient: vi.fn().mockImplementation(function ApifyClient() {
    return {
      actor: () => ({ call: apifyMock.actorCall }),
      dataset: () => ({ listItems: apifyMock.listItems }),
    };
  }),
}));

import { fetchApifyAds } from '../tools/apify-ads';

describe('fetchApifyAds', () => {
  let originalApifyToken: string | undefined;

  beforeEach(() => {
    originalApifyToken = process.env.APIFY_API_TOKEN;
    process.env.APIFY_API_TOKEN = 'test-token';
    apifyMock.actorCall.mockResolvedValue({ defaultDatasetId: 'dataset-1' });
    apifyMock.listItems.mockReset();
  });

  afterEach(() => {
    if (originalApifyToken !== undefined) {
      process.env.APIFY_API_TOKEN = originalApifyToken;
    } else {
      delete process.env.APIFY_API_TOKEN;
    }
    vi.restoreAllMocks();
  });

  it('summarizes only entity-matched Apify rows as accepted ad evidence', async () => {
    apifyMock.listItems.mockResolvedValue({
      items: [
        {
          ad_archive_id: 'bad-1',
          page_name: 'Fast & Fabulous',
          ad_library_url: 'https://www.facebook.com/ads/library/?id=bad-1',
          snapshot: {
            title: 'Fashion on the ramp',
            body: { text: 'From the cars on display to the fashion on the ramp.' },
            page_name: 'Fast & Fabulous',
          },
        },
        {
          ad_archive_id: 'good-1',
          page_name: 'Ramp',
          ad_library_url: 'https://www.facebook.com/ads/library/?id=good-1',
          snapshot: {
            title: 'Control spend before it happens',
            body: { text: 'Ramp helps finance teams manage company spend.' },
            page_name: 'Ramp',
          },
        },
      ],
    });
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const result = await fetchApifyAds('Ramp', 'ramp.com', { platforms: ['meta'] });

    expect(result.summary.activeAdCount).toBe(1);
    expect(result.sourcesUsed.meta).toBe(2);
    expect(result.adCreatives).toHaveLength(1);
    expect(result.adCreatives[0]).toMatchObject({
      id: 'good-1',
      advertiser: 'Ramp',
      headline: 'Control spend before it happens',
    });
    expect(result.summary.evidence).toContain('accepted 1 relevant ads from 2 raw rows');
    expect(result.summary.sampleMessages).toEqual(['Control spend before it happens']);
  });
});
