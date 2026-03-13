import { describe, expect, it } from 'vitest';
import {
  buildAdInsight,
  buildLibraryLinks,
  isAdvertiserMatch,
  normalizeSearchApiToCreatives,
} from '../tools/adlibrary';

describe('isAdvertiserMatch', () => {
  it('matches exact company name', () => {
    expect(isAdvertiserMatch('Hey Digital', 'Hey Digital')).toBe(true);
  });

  it('matches case-insensitively', () => {
    expect(isAdvertiserMatch('hey digital', 'Hey Digital')).toBe(true);
  });

  it('matches when advertiser contains company name', () => {
    expect(isAdvertiserMatch('Hey Digital Inc.', 'Hey Digital')).toBe(true);
  });

  it('matches domain-based name', () => {
    expect(
      isAdvertiserMatch('HeyDigital', 'Hey Digital Agency', 'heydigital.com'),
    ).toBe(true);
  });

  it('rejects false positives with unrelated prefix', () => {
    expect(isAdvertiserMatch('AR Funnel.io', 'Funnel.io')).toBe(false);
  });

  it('keeps records without advertiser name (no filter possible)', () => {
    expect(isAdvertiserMatch(undefined, 'Funnel.io')).toBe(true);
  });
});

describe('normalizeSearchApiToCreatives', () => {
  it('normalizes Google ad records to WorkerAdCreative[]', () => {
    const records = [
      {
        ad_id: 'g-1',
        advertiser_name: 'Acme Corp',
        headline: 'Try Acme Free',
        format: 'image',
        image_url: 'https://cdn.test/img.jpg',
        details_url: 'https://adstransparency.google.com/advertiser/AR123',
      },
    ];

    const creatives = normalizeSearchApiToCreatives(
      records, 'google', 'Acme Corp',
    );

    expect(creatives).toHaveLength(1);
    expect(creatives[0]).toMatchObject({
      platform: 'google',
      id: 'g-1',
      advertiser: 'Acme Corp',
      headline: 'Try Acme Free',
      format: 'image',
      isActive: true,
      detailsUrl: 'https://adstransparency.google.com/advertiser/AR123',
    });
  });

  it('filters out false-positive advertisers', () => {
    const records = [
      {
        ad_id: 'g-1',
        advertiser_name: 'AR Funnel.io',
        headline: 'Augmented Reality Funnels',
      },
      {
        ad_id: 'g-2',
        advertiser_name: 'Funnel.io',
        headline: 'Marketing Data Hub',
      },
    ];

    const creatives = normalizeSearchApiToCreatives(
      records, 'google', 'Funnel.io',
    );

    expect(creatives).toHaveLength(1);
    expect(creatives[0]!.id).toBe('g-2');
  });
});

describe('buildLibraryLinks', () => {
  it('generates platform library links from company name', () => {
    const links = buildLibraryLinks('Hey Digital');

    expect(links.metaLibraryUrl).toContain('facebook.com/ads/library');
    expect(links.metaLibraryUrl).toContain('Hey%20Digital');
    expect(links.linkedInLibraryUrl).toContain('linkedin.com/ad-library');
    expect(links.linkedInLibraryUrl).toContain('Hey%20Digital');
    expect(links.googleAdvertiserUrl).toContain('adstransparency.google.com');
  });

  it('derives google URL from creatives when available', () => {
    const links = buildLibraryLinks('Hey Digital', 'heydigital.com', [
      {
        platform: 'google',
        id: 'g-1',
        advertiser: 'Hey Digital',
        format: 'image',
        isActive: true,
        detailsUrl: 'https://adstransparency.google.com/advertiser/AR123',
      },
    ]);

    expect(links.googleAdvertiserUrl).toBe(
      'https://adstransparency.google.com/advertiser/AR123?region=US',
    );
  });

  it('falls back to domain-based google search', () => {
    const links = buildLibraryLinks('Hey Digital', 'heydigital.com');

    expect(links.googleAdvertiserUrl).toContain('heydigital.com');
  });
});

describe('buildAdInsight', () => {
  it('builds a complete WorkerAdInsight from multi-platform results', () => {
    const googleAds = [
      {
        ad_id: 'g-1',
        advertiser_name: 'Acme',
        headline: 'Try Acme Free',
        details_url: 'https://adstransparency.google.com/advertiser/AR1',
      },
    ];
    const linkedInAds = [
      {
        ad_id: 'li-1',
        advertiser_name: 'Acme',
        headline: 'Pipeline growth for B2B',
        platform: 'linkedin',
      },
    ];
    const metaAds = [
      {
        ad_id: 'meta-1',
        advertiser_name: 'Acme',
        headline: 'Scale your pipeline',
        platform: 'facebook',
      },
    ];

    const insight = buildAdInsight(
      googleAds, linkedInAds, metaAds, [], 'Acme', 'acme.com',
    );

    expect(insight.summary.activeAdCount).toBe(3);
    expect(insight.summary.platforms).toContain('google');
    expect(insight.summary.platforms).toContain('linkedin');
    expect(insight.summary.platforms).toContain('meta');
    expect(insight.summary.sourceConfidence).toBe('medium');
    expect(insight.adCreatives).toHaveLength(3);
    expect(insight.libraryLinks.metaLibraryUrl).toContain('facebook.com/ads/library');
    expect(insight.libraryLinks.linkedInLibraryUrl).toContain('linkedin.com/ad-library');
    expect(insight.libraryLinks.googleAdvertiserUrl).toContain(
      'adstransparency.google.com/advertiser/AR1',
    );
    expect(insight.sourcesUsed.google).toBe(1);
    expect(insight.sourcesUsed.linkedin).toBe(1);
    expect(insight.sourcesUsed.meta).toBe(1);
    expect(insight.sourcesUsed.foreplay).toBe(0);
  });

  it('returns low confidence and Not verified when no ads found', () => {
    const insight = buildAdInsight([], [], [], [], 'Unknown Corp');

    expect(insight.summary.sourceConfidence).toBe('low');
    expect(insight.summary.platforms).toEqual(['Not verified']);
    expect(insight.summary.evidence).toContain('Not verified');
    expect(insight.adCreatives).toEqual([]);
    expect(insight.libraryLinks.metaLibraryUrl).toContain('Unknown%20Corp');
  });

  it('returns high confidence when SearchAPI + Foreplay both contribute', () => {
    const googleAds = [
      { ad_id: 'g-1', advertiser_name: 'Acme', headline: 'Ad 1' },
      { ad_id: 'g-2', advertiser_name: 'Acme', headline: 'Ad 2' },
      { ad_id: 'g-3', advertiser_name: 'Acme', headline: 'Ad 3' },
    ];
    const foreplayAds = [{ headline: 'Historical ad' }];

    const insight = buildAdInsight(
      googleAds, [], [], foreplayAds, 'Acme',
    );

    expect(insight.summary.sourceConfidence).toBe('high');
  });
});
