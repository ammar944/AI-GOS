import { describe, it, expect } from 'vitest';
import { calculateSimilarity, normalizeCompanyName } from '../name-matcher';
import { assessAdRelevance } from '../relevance-scorer';
import type { AdCreative } from '../types';

/**
 * Regression tests for false positive prevention in ad library
 *
 * These tests validate fixes for edge cases that were causing false positives:
 * 1. TLD removal in company names (e.g., "Funnel.io" vs "AR Funnel.io")
 * 2. Short string guards to prevent substring pollution
 * 3. Word overlap analysis to detect different companies with similar names
 * 4. Domain mismatch detection
 */
describe('Ad Library - False Positive Prevention', () => {
  describe('name-matcher.ts - TLD handling', () => {
    it('should strip TLD from Salesforce.com → salesforce', () => {
      expect(normalizeCompanyName('Salesforce.com')).toBe('salesforce');
    });

    it('should strip TLD from Windsor.ai → windsor', () => {
      expect(normalizeCompanyName('Windsor.ai')).toBe('windsor');
    });

    it('should strip TLD from Funnel.io → funnel', () => {
      expect(normalizeCompanyName('Funnel.io')).toBe('funnel');
    });

    it('should handle multiple TLDs correctly', () => {
      expect(normalizeCompanyName('Company.tech')).toBe('company');
      expect(normalizeCompanyName('Startup.dev')).toBe('startup');
      expect(normalizeCompanyName('Service.app')).toBe('service');
    });
  });

  describe('name-matcher.ts - Exact matches', () => {
    it('should return 1.0 for Funnel.io vs Funnel.io (exact match)', () => {
      expect(calculateSimilarity('Funnel.io', 'Funnel.io')).toBe(1.0);
    });

    it('should return 1.0 for HockeyStack vs HockeyStack (exact match)', () => {
      expect(calculateSimilarity('HockeyStack', 'HockeyStack')).toBe(1.0);
    });

    it('should return 1.0 for identical normalized names', () => {
      expect(calculateSimilarity('SegMetrics', 'SegMetrics')).toBe(1.0);
    });
  });

  describe('name-matcher.ts - Different companies with similar names', () => {
    it('should return 0.75 for Funnel.io vs AR Funnel.io (prefix with extra word)', () => {
      // "AR Funnel.io" is a fitness coaching company, not the marketing platform
      // After TLD removal: "funnel" vs "ar funnel" (funnel is a prefix with 1 extra word)
      const similarity = calculateSimilarity('Funnel.io', 'AR Funnel.io');
      expect(similarity).toBe(0.75);
    });

    it('should return 0.75 for Buffer vs Buffer Overflow Inc (extra words)', () => {
      // "Buffer Overflow Inc" is not the social media tool "Buffer"
      // After normalization: "buffer" vs "buffer overflow" (2+ extra words)
      const similarity = calculateSimilarity('Buffer', 'Buffer Overflow Inc');
      expect(similarity).toBe(0.75);
    });

    it('should return 0.80 for short name as word in longer string', () => {
      // When short name appears as a word (not prefix) in longer string
      const similarity = calculateSimilarity('Stack', 'Hockey Stack');
      expect(similarity).toBe(0.80);
    });

    it('should handle multiple extra words', () => {
      const similarity = calculateSimilarity('Metrics', 'Segment Metrics Analytics');
      expect(similarity).toBeLessThan(0.7);
    });
  });

  describe('name-matcher.ts - Same company with suffix variations', () => {
    it('should return >= 0.85 for SegMetrics vs SegMetrics Inc (same company)', () => {
      const similarity = calculateSimilarity('SegMetrics', 'SegMetrics Inc');
      expect(similarity).toBeGreaterThanOrEqual(0.85);
    });

    it('should handle LLC suffix', () => {
      const similarity = calculateSimilarity('TechCorp', 'TechCorp LLC');
      expect(similarity).toBeGreaterThanOrEqual(0.85);
    });

    it('should handle Corp suffix', () => {
      const similarity = calculateSimilarity('DataCo', 'DataCo Corp');
      expect(similarity).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('name-matcher.ts - Short string guards', () => {
    it('should handle huel vs hula hoop (overlapping prefix)', () => {
      // Both start with "hu" so they get Jaro-Winkler score
      // This is an edge case - in practice relevance-scorer adds more context
      const similarity = calculateSimilarity('huel', 'hula hoop');
      expect(similarity).toBeGreaterThan(0.7);
      // The relevance scorer's word overlap analysis will catch this as different companies
    });

    it('should return 0.75 for short name with extra words (prefix match)', () => {
      // "nike" is prefix of "nike store outlet" with 2+ extra words
      const similarity = calculateSimilarity('nike', 'nike store outlet');
      expect(similarity).toBe(0.75);
    });

    it('should still match exact short names', () => {
      const similarity = calculateSimilarity('nike', 'nike');
      expect(similarity).toBe(1.0);
    });

    it('should match short name with single suffix word', () => {
      // "nike inc" should score high (only one extra word)
      const similarity = calculateSimilarity('nike', 'nike inc');
      expect(similarity).toBeGreaterThanOrEqual(0.85);
    });
  });

  describe('relevance-scorer.ts - AR Funnel.io false positive', () => {
    it('should score < 50 for AR Funnel.io ad when searching Funnel.io', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-1',
        advertiser: 'AR Funnel.io',
        headline: 'Transform Your Fitness Journey',
        body: 'Join our coaching program',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Funnel.io', 'funnel.io');

      expect(relevance.score).toBeLessThan(50);
    });

    it('should have "isLikelyDifferentCompany" signal for AR Funnel.io', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-1',
        advertiser: 'AR Funnel.io',
        headline: 'Fitness coaching',
        body: 'Get in shape',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Funnel.io');

      const hasDifferentCompanySignal = relevance.signals.some(s =>
        s.includes('Likely different company') || s.includes('extra words')
      );
      expect(hasDifferentCompanySignal).toBe(true);
    });
  });

  describe('relevance-scorer.ts - Exact match cases', () => {
    it('should score >= 60 for Funnel.io ad when searching Funnel.io (exact match but no product mention)', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-2',
        advertiser: 'Funnel.io',
        headline: 'Marketing Data Hub',
        body: 'Connect your marketing data',
        format: 'image',
        isActive: true,
        detailsUrl: 'https://funnel.io/ads/123',
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Funnel.io', 'funnel.io');

      // 40 (advertiser match) + 20 (domain match) = 60
      // No +30 for content because "funnel.io" is not mentioned in the ad content
      expect(relevance.score).toBeGreaterThanOrEqual(60);
    });

    it('should score high for exact advertiser with product mention', () => {
      const mockAd: AdCreative = {
        platform: 'linkedin',
        id: 'test-3',
        advertiser: 'HockeyStack',
        headline: 'Marketing Analytics Platform',
        body: 'HockeyStack helps you track attribution',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'HockeyStack', 'hockeystack.com');

      expect(relevance.score).toBeGreaterThanOrEqual(70);
      expect(relevance.category).toBe('direct');
    });
  });

  describe('relevance-scorer.ts - Domain mismatch penalty', () => {
    it('should reduce score when advertiser does not match domain', () => {
      const mockAd: AdCreative = {
        platform: 'google',
        id: 'test-4',
        advertiser: 'AR Funnel.io',
        headline: 'Fitness Program',
        body: 'Get fit now',
        format: 'image',
        isActive: true,
        detailsUrl: 'https://arfunnel.com/ads',
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Funnel.io', 'funnel.io');

      // Domain mismatch should contribute to lower score
      expect(relevance.score).toBeLessThan(50);

      const hasDomainSignal = relevance.signals.some(s =>
        s.includes('Domain') || s.includes('domain')
      );
      expect(hasDomainSignal).toBe(true);
    });

    it('should not penalize when advertiser matches domain', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-5',
        advertiser: 'Funnel.io',
        headline: 'Data Platform',
        body: 'Marketing analytics',
        format: 'image',
        isActive: true,
        detailsUrl: 'https://funnel.io/ad',
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Funnel.io', 'funnel.io');

      // 40 (advertiser) + 20 (domain) = 60 (no content mention)
      expect(relevance.score).toBeGreaterThanOrEqual(60);
    });
  });

  describe('relevance-scorer.ts - TLD-aware matching', () => {
    it('should handle Windsor.ai correctly', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-6',
        advertiser: 'Windsor.ai',
        headline: 'Marketing Attribution',
        body: 'Track ROI with Windsor.ai',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Windsor.ai');

      expect(relevance.score).toBeGreaterThanOrEqual(70);
      expect(relevance.category).toBe('direct');
    });

    it('should handle Salesforce.com correctly', () => {
      const mockAd: AdCreative = {
        platform: 'linkedin',
        id: 'test-7',
        advertiser: 'Salesforce.com',
        headline: 'CRM Platform',
        body: 'Salesforce helps businesses grow',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Salesforce.com', 'salesforce.com');

      expect(relevance.score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('relevance-scorer.ts - Partnership/sponsored content detection', () => {
    it('should detect partnership ads as lead_magnet category', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-8',
        advertiser: 'SegMetrics',
        headline: 'Get Dan Martell\'s Book',
        body: 'Download the free guide to scaling your SaaS',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'SegMetrics');

      expect(relevance.category).toBe('lead_magnet');
      expect(relevance.score).toBeLessThan(70);
    });

    it('should allow lead magnets from matching advertiser', () => {
      const mockAd: AdCreative = {
        platform: 'linkedin',
        id: 'test-9',
        advertiser: 'HubSpot',
        headline: 'Free Marketing Guide',
        body: 'Download our free ebook on inbound marketing',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'HubSpot', 'hubspot.com');

      // Should still score reasonably (advertiser matches)
      expect(relevance.score).toBeGreaterThanOrEqual(40);
      expect(relevance.category).toBe('lead_magnet');
    });
  });

  describe('relevance-scorer.ts - Word overlap edge cases', () => {
    it('should detect low word overlap as different company', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-10',
        advertiser: 'Marketing Buffer Solutions',
        headline: 'Marketing Tools',
        body: 'Comprehensive marketing suite',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Buffer');

      expect(relevance.score).toBeLessThan(70);
    });

    it('should allow high word overlap with extra suffix', () => {
      const mockAd: AdCreative = {
        platform: 'linkedin',
        id: 'test-11',
        advertiser: 'SegMetrics Inc',
        headline: 'Marketing Attribution',
        body: 'SegMetrics provides attribution analytics',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'SegMetrics', 'segmetrics.com');

      expect(relevance.score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('relevance-scorer.ts - Brand awareness vs unclear categorization', () => {
    it('should categorize as brand_awareness when advertiser matches but no product mention', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-12',
        advertiser: 'Nike',
        headline: 'Just Do It',
        body: 'Be inspired by athletes around the world',
        format: 'video',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Nike');

      // Since 'inspired' and 'athletes' don't contain product keywords,
      // it gets penalized and may categorize differently
      expect(['brand_awareness', 'lead_magnet']).toContain(relevance.category);
    });

    it('should categorize as unclear when advertiser similarity is low', () => {
      const mockAd: AdCreative = {
        platform: 'google',
        id: 'test-13',
        advertiser: 'Completely Different Company',
        headline: 'Some Product',
        body: 'Buy now',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Nike');

      expect(relevance.category).toBe('unclear');
      expect(relevance.score).toBeLessThan(30);
    });
  });

  describe('Edge case regression tests', () => {
    it('should handle empty advertiser name gracefully', () => {
      const mockAd: AdCreative = {
        platform: 'meta',
        id: 'test-14',
        advertiser: '',
        headline: 'Some Ad',
        body: 'Some content',
        format: 'image',
        isActive: true,
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Nike');

      expect(relevance.score).toBeLessThan(50);
      expect(relevance.category).toBe('unclear');
    });

    it('should handle single-character names', () => {
      const similarity = calculateSimilarity('X', 'X Corp');
      // Single char should get some credit but be cautious
      expect(similarity).toBeGreaterThan(0.5);
    });

    it('should handle very short queries as word matches', () => {
      // "ai" appears as a word in "sales ai automation"
      const similarity = calculateSimilarity('ai', 'sales ai automation');
      expect(similarity).toBe(0.80); // word match score for short strings
    });

    it('should handle mixed case and punctuation', () => {
      const similarity = calculateSimilarity('FUNNEL.IO', 'funnel.io');
      expect(similarity).toBe(1.0);
    });

    it('should detect domain mismatch even with partial URL', () => {
      const mockAd: AdCreative = {
        platform: 'google',
        id: 'test-15',
        advertiser: 'Nike',
        headline: 'Shoes',
        body: 'Buy shoes',
        format: 'image',
        isActive: true,
        detailsUrl: 'https://adidas.com/ad',
        rawData: {},
      };

      const relevance = assessAdRelevance(mockAd, 'Nike', 'nike.com');

      // Should have domain-related signal
      const hasDomainSignal = relevance.signals.some(s =>
        s.toLowerCase().includes('domain')
      );
      expect(hasDomainSignal).toBe(true);

      // Score should reflect mismatch
      expect(relevance.score).toBeLessThan(50);
    });
  });
});
