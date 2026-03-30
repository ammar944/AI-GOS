import { describe, expect, it } from 'vitest';
import {
  normalizeCompanyName,
  calculateSimilarity,
  isAdvertiserMatch,
  extractCompanyFromDomain,
} from '../utils/name-matcher';

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

  it('returns false for fuzzy match below threshold', () => {
    // "Directive Consulting" != "Directive" at 0.8 threshold (correctly rejected)
    expect(isAdvertiserMatch('Directive Consulting', 'Directive', 0.8)).toBe(false);
  });

  it('returns true for close match above threshold', () => {
    expect(isAdvertiserMatch('Buffer Inc', 'Buffer', 0.8)).toBe(true);
  });

  it('returns false for unrelated names', () => {
    expect(isAdvertiserMatch('California Institute', 'Directive', 0.8)).toBe(false);
  });

  it('returns false when advertiser is undefined', () => {
    expect(isAdvertiserMatch(undefined, 'Directive')).toBe(false);
  });

  it('uses 0.8 as default threshold', () => {
    expect(isAdvertiserMatch('Buffer Inc', 'Buffer')).toBe(true);
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
