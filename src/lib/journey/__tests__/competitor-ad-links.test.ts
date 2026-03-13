import { describe, expect, it } from 'vitest';
import { buildCompetitorLibraryLinks } from '../competitor-ad-links';

describe('buildCompetitorLibraryLinks', () => {
  it('generates platform library links from competitor name', () => {
    const links = buildCompetitorLibraryLinks({
      name: 'Hey Digital',
      website: 'https://heydigital.com',
    });

    expect(links.metaLibraryUrl).toContain('facebook.com/ads/library');
    expect(links.metaLibraryUrl).toContain('Hey%20Digital');
    expect(links.linkedInLibraryUrl).toContain('linkedin.com/ad-library');
    expect(links.linkedInLibraryUrl).toContain('Hey%20Digital');
    expect(links.googleAdvertiserUrl).toContain('adstransparency.google.com');
  });

  it('extracts google advertiser URL from creatives when available', () => {
    const links = buildCompetitorLibraryLinks({
      name: 'Hey Digital',
      website: 'https://heydigital.com',
      adCreatives: [
        {
          platform: 'google',
          detailsUrl:
            'https://adstransparency.google.com/advertiser/AR123',
        },
      ],
    });

    expect(links.googleAdvertiserUrl).toBe(
      'https://adstransparency.google.com/advertiser/AR123?region=US',
    );
  });

  it('falls back to domain-based google search when no google creatives exist', () => {
    const links = buildCompetitorLibraryLinks({
      name: 'Hey Digital',
      website: 'https://heydigital.com',
      adCreatives: [
        {
          platform: 'meta',
          detailsUrl: 'https://facebook.com/ads/library/?id=123',
        },
      ],
    });

    expect(links.googleAdvertiserUrl).toContain(
      'adstransparency.google.com',
    );
    expect(links.googleAdvertiserUrl).toContain('heydigital.com');
  });

  it('uses name-based google search when no website provided', () => {
    const links = buildCompetitorLibraryLinks({
      name: 'Unknown Corp',
    });

    expect(links.googleAdvertiserUrl).toContain(
      'adstransparency.google.com',
    );
    expect(links.googleAdvertiserUrl).toContain('Unknown%20Corp');
  });
});
