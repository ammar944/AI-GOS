import { describe, expect, it } from 'vitest';
import {
  buildAdInsight,
  buildLibraryLinks,
  isAdvertiserMatch,
  normalizeSearchApiToCreatives,
  resolveBestCandidate,
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

  it('rejects records without advertiser name (no name = not verified)', () => {
    expect(isAdvertiserMatch(undefined, 'Funnel.io')).toBe(false);
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

// --- Verdict Resolver Tests ---

describe('resolveBestCandidate', () => {
  const mkCandidate = (name: string, id: string = 'id-1') => ({
    name, id, entity: {},
  });

  it('AMBIGUOUS — short name exact match but no domain info', () => {
    // "Atlas" exact match exists, but with no domain passed, short names
    // can't confirm WHICH "Atlas" this is. Correct: ambiguous.
    const result = resolveBestCandidate(
      [mkCandidate('Atlas'), mkCandidate('Atlas VPN')],
      'Atlas',
    );
    expect(result.verdict).toBe('ambiguous');
  });

  it('ACCEPTED — short name exact match WITH verified domain corroboration', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Atlas'), mkCandidate('Atlas VPN')],
      'Atlas',
      'atlas.com',
      true,
    );
    expect(result.verdict).toBe('accepted');
    expect(result.candidate?.name).toBe('Atlas');
  });

  it('ACCEPTED — long name exact match needs no domain', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Directive'), mkCandidate('Something Else')],
      'Directive',
    );
    expect(result.verdict).toBe('accepted');
  });

  it('ACCEPTED — domain corroboration with verified domain', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Atlas HQ', 'a1'), mkCandidate('Atlas VPN', 'a2')],
      'Atlas HQ',
      'atlashq.io',
      true,
    );
    expect(result.verdict).toBe('accepted');
    expect(result.candidate?.name).toBe('Atlas HQ');
  });

  it('REJECTED — no candidates above threshold', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Totally Different Company')],
      'Atlas',
    );
    expect(result.verdict).toBe('rejected');
  });

  it('REJECTED — empty candidates', () => {
    const result = resolveBestCandidate([], 'Atlas');
    expect(result.verdict).toBe('rejected');
  });

  it('REJECTED — short name, candidates score below 0.8 after short-name fix', () => {
    // "Atlas VPN" and "Atlas Copco" score ≤0.6 against "Atlas" (short-name boost killed).
    // Since no candidate reaches 0.8, the resolver rejects.
    const result = resolveBestCandidate(
      [mkCandidate('Atlas VPN'), mkCandidate('Atlas Copco')],
      'Atlas',
      'atlas.com',
      false,
    );
    expect(result.verdict).toBe('rejected');
  });

  it('REJECTED — short name with verified domain, candidates still below 0.8', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Atlas VPN'), mkCandidate('Atlas Copco')],
      'Atlas',
      'atlashq.io',
      true,
    );
    expect(result.verdict).toBe('rejected');
  });

  it('ACCEPTED — long name with clear winner (HubSpot)', () => {
    const result = resolveBestCandidate(
      [mkCandidate('HubSpot'), mkCandidate('Hub City')],
      'HubSpot',
    );
    expect(result.verdict).toBe('accepted');
    expect(result.candidate?.name).toBe('HubSpot');
  });

  it('logs all candidates for observability', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Atlas VPN'), mkCandidate('Atlas Copco'), mkCandidate('Atlas Corp')],
      'Atlas',
    );
    expect(result.candidates).toHaveLength(3);
    expect(result.candidates![0]).toHaveProperty('name');
    expect(result.candidates![0]).toHaveProperty('score');
  });

  // Adversarial: 5 candidates all containing "Atlas"
  it('AMBIGUOUS — adversarial: "Atlas Corp" exact match but unverified domain', () => {
    // "Atlas Corp" normalizes to "atlas" = exact match. But domain is unverified (false).
    // Short name + unverified domain = ambiguous, even with exact match.
    const result = resolveBestCandidate(
      [
        mkCandidate('Atlas VPN'),
        mkCandidate('Atlas Copco'),
        mkCandidate('Atlas Obscura'),
        mkCandidate('Atlas Air'),
        mkCandidate('Atlas Corp'),
      ],
      'Atlas',
      'atlas.com',
      false,
    );
    expect(result.verdict).toBe('ambiguous');
  });

  it('ACCEPTED — adversarial: "Atlas Corp" exact match WITH verified domain', () => {
    // Same candidates but now domain is verified → Atlas Corp accepted
    const result = resolveBestCandidate(
      [
        mkCandidate('Atlas VPN'),
        mkCandidate('Atlas Copco'),
        mkCandidate('Atlas Obscura'),
        mkCandidate('Atlas Air'),
        mkCandidate('Atlas Corp'),
      ],
      'Atlas',
      'atlas.com',
      true,
    );
    expect(result.verdict).toBe('accepted');
    expect(result.candidate?.name).toBe('Atlas Corp');
  });

  it('REJECTED — adversarial: 5 Atlas candidates, NONE with corporate suffix', () => {
    // When no candidate has a strippable suffix, all score ≤0.6 → rejected
    const result = resolveBestCandidate(
      [
        mkCandidate('Atlas VPN'),
        mkCandidate('Atlas Copco'),
        mkCandidate('Atlas Obscura'),
        mkCandidate('Atlas Air'),
        mkCandidate('Atlas Pro'),
      ],
      'Atlas',
      'atlas.com',
      false,
    );
    expect(result.verdict).toBe('rejected');
  });

  // Adversarial: legitimate short name with verified domain
  it('ACCEPTED — "Zoom" with verified domain and exact match in candidates', () => {
    const result = resolveBestCandidate(
      [mkCandidate('Zoom Video Communications'), mkCandidate('Zoom')],
      'Zoom',
      'zoom.us',
      true,
    );
    expect(result.verdict).toBe('accepted');
    expect(result.candidate?.name).toBe('Zoom');
  });
});
