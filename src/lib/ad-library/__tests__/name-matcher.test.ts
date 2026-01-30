import { describe, it, expect } from 'vitest';
import { isAdvertiserMatch, calculateSimilarity, normalizeCompanyName, extractCompanyFromDomain } from '../name-matcher';

describe('Ad Library - Name Matcher', () => {
  describe('normalizeCompanyName', () => {
    it('should remove common suffixes', () => {
      expect(normalizeCompanyName('Tesla Inc')).toBe('tesla');
      expect(normalizeCompanyName('Amazon LLC')).toBe('amazon');
      expect(normalizeCompanyName('Apple Corp')).toBe('apple');
    });

    it('should remove punctuation', () => {
      // Note: dots are removed completely, no space
      expect(normalizeCompanyName('Amazon.com')).toBe('amazoncom');
      expect(normalizeCompanyName('Tesla, Inc.')).toBe('tesla');
    });

    it('should handle empty strings', () => {
      expect(normalizeCompanyName('')).toBe('');
    });
  });

  describe('calculateSimilarity', () => {
    it('should return 1 for identical strings', () => {
      expect(calculateSimilarity('Nike', 'Nike')).toBe(1);
    });

    it('should return 1 for normalized identical strings', () => {
      expect(calculateSimilarity('Nike Inc', 'Nike Inc.')).toBe(1);
    });

    it('should return 0.75 for substring matches (lowered score)', () => {
      // This tests the fix where substring match score was lowered from 0.85 to 0.75
      expect(calculateSimilarity('Nike', 'Nike Store')).toBe(0.75);
      expect(calculateSimilarity('Nike Store', 'Nike')).toBe(0.75);
    });

    it('should return 0.75 for substring matches with punctuation', () => {
      // Amazon vs Amazoncom (after normalization) is a substring match
      const result = calculateSimilarity('Amazon', 'Amazon.com');
      expect(result).toBe(0.75);
    });

    it('should return low similarity for different names', () => {
      expect(calculateSimilarity('Nike', 'Adidas')).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      expect(calculateSimilarity('', 'Nike')).toBe(0);
      expect(calculateSimilarity('Nike', '')).toBe(0);
    });
  });

  describe('isAdvertiserMatch', () => {
    it('should match exact company names', () => {
      expect(isAdvertiserMatch('Tesla Inc', 'Tesla Inc')).toBe(true);
    });

    it('should match normalized company names', () => {
      expect(isAdvertiserMatch('Tesla, Inc.', 'Tesla Inc')).toBe(true);
    });

    it('should match with high similarity', () => {
      expect(isAdvertiserMatch('Amazon.com', 'Amazon')).toBe(true);
    });

    it('should match substring with default threshold (0.7)', () => {
      // 0.75 similarity is above 0.7 threshold
      expect(isAdvertiserMatch('Nike Store', 'Nike', 0.7)).toBe(true);
    });

    it('should not match with higher threshold for substring', () => {
      // With 0.8 threshold, 0.75 similarity is rejected
      expect(isAdvertiserMatch('Nike Footwear Outlet LLC', 'Nike', 0.8)).toBe(false);
    });

    it('should not match completely different names', () => {
      expect(isAdvertiserMatch('Nike', 'Adidas')).toBe(false);
    });

    it('should return false for empty strings', () => {
      expect(isAdvertiserMatch('', 'Nike')).toBe(false);
      expect(isAdvertiserMatch('Nike', '')).toBe(false);
    });
  });

  describe('extractCompanyFromDomain', () => {
    it('should extract company from simple domains', () => {
      expect(extractCompanyFromDomain('tesla.com')).toBe('tesla');
      expect(extractCompanyFromDomain('amazon.com')).toBe('amazon');
    });

    it('should handle www prefix', () => {
      expect(extractCompanyFromDomain('www.nike.com')).toBe('nike');
    });

    it('should handle protocols', () => {
      expect(extractCompanyFromDomain('https://apple.com')).toBe('apple');
      expect(extractCompanyFromDomain('http://google.com')).toBe('google');
    });

    it('should handle country TLDs', () => {
      expect(extractCompanyFromDomain('shop.nike.co.uk')).toBe('nike');
    });

    it('should handle subdomains', () => {
      expect(extractCompanyFromDomain('store.shopify.com')).toBe('shopify');
    });

    it('should return undefined for invalid domains', () => {
      expect(extractCompanyFromDomain('')).toBeUndefined();
    });
  });
});
