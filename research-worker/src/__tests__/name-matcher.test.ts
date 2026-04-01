import { describe, expect, it } from 'vitest';
import {
  normalizeCompanyName,
  calculateSimilarity,
  extractCompanyFromDomain,
} from '../utils/name-matcher';
import { isAdvertiserMatch } from '../tools/adlibrary';

describe('normalizeCompanyName', () => {
  it('strips Inc suffix', () => {
    expect(normalizeCompanyName('Acme Inc.')).toBe('acme');
  });

  it('strips LLC suffix', () => {
    expect(normalizeCompanyName('Buffer LLC')).toBe('buffer');
  });

  it('strips TLD suffixes', () => {
    expect(normalizeCompanyName('Salesforce.com')).toBe('salesforce');
    expect(normalizeCompanyName('Windsor.ai')).toBe('windsor');
  });

  it('collapses spaces and lowercases', () => {
    expect(normalizeCompanyName('  Hey   Digital  ')).toBe('hey digital');
  });

  it('handles empty/null input', () => {
    expect(normalizeCompanyName('')).toBe('');
    expect(normalizeCompanyName(null as unknown as string)).toBe('');
  });
});

describe('calculateSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(calculateSimilarity('Directive', 'Directive')).toBe(1);
  });

  it('returns 1.0 after normalization', () => {
    expect(calculateSimilarity('Buffer LLC', 'buffer')).toBe(1);
  });

  it('returns low score for unrelated strings', () => {
    expect(calculateSimilarity('Directive', 'California Institute')).toBeLessThan(0.7);
  });

  it('handles short names — exact word match', () => {
    // "Go" as exact word in "GoTo Meeting" shouldn't match (no exact word boundary)
    const score = calculateSimilarity('Go', 'GoTo Meeting');
    expect(score).toBeLessThan(0.8);
  });

  it('handles short names — exact match', () => {
    expect(calculateSimilarity('Go', 'Go')).toBe(1.0);
  });

  it('scores "Directive" vs "Directive Consulting" below 0.8 (different entity)', () => {
    // "Directive Consulting" is a different company than "Directive"
    // The extra word "Consulting" drops the score below the match threshold
    expect(calculateSimilarity('Directive', 'Directive Consulting')).toBeLessThan(0.8);
  });

  it('scores "Directive" vs "Directive" exactly', () => {
    expect(calculateSimilarity('Directive', 'Directive')).toBe(1.0);
  });

  it('scores "HubSpot" vs "HubSpot, Inc." as 1.0', () => {
    expect(calculateSimilarity('HubSpot', 'HubSpot, Inc.')).toBe(1);
  });

  it('returns 0 for empty inputs', () => {
    expect(calculateSimilarity('', 'test')).toBe(0);
    expect(calculateSimilarity('test', '')).toBe(0);
  });
});

describe('isAdvertiserMatch', () => {
  it('returns true for exact match', () => {
    expect(isAdvertiserMatch('Directive', 'Directive')).toBe(true);
  });

  it('allows "Directive Consulting" for "Directive" — plausible same company (long name, containment match)', () => {
    // For long names (>6 chars), containment match is acceptable. "Directive Consulting"
    // starts with "Directive" and could be the company's full registered name.
    // Short names like "Atlas" are handled differently — see short-name tests below.
    expect(isAdvertiserMatch('Directive Consulting', 'Directive')).toBe(true);
  });

  it('returns true for close match — "Buffer Inc" matches "Buffer"', () => {
    expect(isAdvertiserMatch('Buffer Inc', 'Buffer')).toBe(true);
  });

  it('returns false for unrelated names', () => {
    expect(isAdvertiserMatch('California Institute', 'Directive')).toBe(false);
  });

  it('returns false when advertiser is undefined', () => {
    expect(isAdvertiserMatch(undefined, 'Directive')).toBe(false);
  });
});

// --- Short-name regression tests (the Atlas bug) ---

describe('calculateSimilarity — short name regression', () => {
  it('"Atlas" vs "Atlas VPN" scores ≤0.6 (MUST reject)', () => {
    expect(calculateSimilarity('Atlas', 'Atlas VPN')).toBeLessThanOrEqual(0.6);
  });

  it('"Atlas" vs "Atlas Copco" scores ≤0.6', () => {
    expect(calculateSimilarity('Atlas', 'Atlas Copco')).toBeLessThanOrEqual(0.6);
  });

  it('"Atlas" vs "Atlas Obscura" scores ≤0.6', () => {
    expect(calculateSimilarity('Atlas', 'Atlas Obscura')).toBeLessThanOrEqual(0.6);
  });

  it('"Clay" vs "Clayton" scores ≤0.6', () => {
    expect(calculateSimilarity('Clay', 'Clayton')).toBeLessThanOrEqual(0.6);
  });

  it('"Spot" vs "HubSpot" scores ≤0.5 (Spot is not the leading word)', () => {
    expect(calculateSimilarity('Spot', 'HubSpot')).toBeLessThanOrEqual(0.5);
  });

  it('"Drift" vs "Driftwood" scores ≤0.6', () => {
    expect(calculateSimilarity('Drift', 'Driftwood')).toBeLessThanOrEqual(0.6);
  });

  it('"Buffer" (6 chars) vs "Buffer Zone" scores ≤0.6', () => {
    expect(calculateSimilarity('Buffer', 'Buffer Zone')).toBeLessThanOrEqual(0.6);
  });

  it('"Buffer" vs "Buffer Inc" scores 1.0 (normalizes to same string)', () => {
    expect(calculateSimilarity('Buffer', 'Buffer Inc')).toBe(1);
  });

  it('"Atlas" vs "Atlas" scores 1.0 (exact match)', () => {
    expect(calculateSimilarity('Atlas', 'Atlas')).toBe(1);
  });

  it('"Zoom" vs "Zoom" scores 1.0', () => {
    expect(calculateSimilarity('Zoom', 'Zoom')).toBe(1);
  });

  it('"Atlas" vs "Atlas Group" scores 0.95 (corporate suffix)', () => {
    expect(calculateSimilarity('Atlas', 'Atlas Group')).toBeGreaterThanOrEqual(0.9);
  });
});

describe('isAdvertiserMatch — short name regression', () => {
  it('rejects "Atlas VPN" for "Atlas" (short name, non-suffix extra word)', () => {
    expect(isAdvertiserMatch('Atlas VPN', 'Atlas')).toBe(false);
  });

  it('rejects "Atlas Copco" for "Atlas"', () => {
    expect(isAdvertiserMatch('Atlas Copco', 'Atlas')).toBe(false);
  });

  it('accepts "Atlas" for "Atlas" (exact match)', () => {
    expect(isAdvertiserMatch('Atlas', 'Atlas')).toBe(true);
  });

  it('accepts "Atlas Inc" for "Atlas" (corporate suffix)', () => {
    expect(isAdvertiserMatch('Atlas Inc', 'Atlas')).toBe(true);
  });

  it('rejects "HubSpot" for "Spot" (short name not at start)', () => {
    expect(isAdvertiserMatch('HubSpot', 'Spot')).toBe(false);
  });

  it('rejects "Buffer Zone" for "Buffer" (6 chars, non-suffix)', () => {
    expect(isAdvertiserMatch('Buffer Zone', 'Buffer')).toBe(false);
  });

  it('accepts "Buffer" for "Buffer" (exact)', () => {
    expect(isAdvertiserMatch('Buffer', 'Buffer')).toBe(true);
  });

  it('accepts "Buffer Inc" for "Buffer" (suffix stripped by normalization)', () => {
    expect(isAdvertiserMatch('Buffer Inc', 'Buffer')).toBe(true);
  });

  it('rejects "Drift" for "Driftwood" — different entities', () => {
    expect(isAdvertiserMatch('Driftwood', 'Drift')).toBe(false);
  });
});

// --- Adversarial scenarios ---

describe('isAdvertiserMatch — adversarial parent-brand vs product-brand', () => {
  it('"Salesforce" vs "Salesforce Marketing Cloud" — long name, passes containment', () => {
    expect(isAdvertiserMatch('Salesforce Marketing Cloud', 'Salesforce')).toBe(true);
  });

  it('"Salesforce" vs "Salesforce" — exact', () => {
    expect(isAdvertiserMatch('Salesforce', 'Salesforce')).toBe(true);
  });
});

describe('extractCompanyFromDomain', () => {
  it('extracts from simple domain', () => {
    expect(extractCompanyFromDomain('tesla.com')).toBe('tesla');
  });

  it('strips www prefix', () => {
    expect(extractCompanyFromDomain('www.amazon.com')).toBe('amazon');
  });

  it('handles country TLDs', () => {
    expect(extractCompanyFromDomain('shop.nike.co.uk')).toBe('nike');
  });

  it('strips protocol', () => {
    expect(extractCompanyFromDomain('https://hubspot.com/pricing')).toBe('hubspot');
  });

  it('returns undefined for empty input', () => {
    expect(extractCompanyFromDomain('')).toBeUndefined();
  });
});
