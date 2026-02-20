import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  verifyReviewSource,
  type CompetitorContext,
  type ReviewSourceInfo,
} from '../review-verification';

// Mock the 'ai' module for Tier 2 tests
vi.mock('ai', () => ({
  generateObject: vi.fn(),
}));

// Mock providers (needed by review-verification imports)
vi.mock('../providers', () => ({
  anthropic: vi.fn(() => 'mock-anthropic-model'),
  MODELS: { CLAUDE_HAIKU: 'claude-haiku-4-5-20251001' },
  estimateCost: vi.fn(() => 0.0005),
}));

import { generateObject } from 'ai';
const mockGenerateObject = vi.mocked(generateObject);

beforeEach(() => {
  vi.clearAllMocks();
});

// =============================================================================
// True Positives (should verify)
// =============================================================================

describe('True Positives', () => {
  it('verifies Trustpilot domain match', async () => {
    const competitor: CompetitorContext = {
      name: 'HubSpot',
      website: 'https://www.hubspot.com',
      positioning: 'All-in-one CRM platform',
      offer: 'CRM, marketing, sales, and service software',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'trustpilot',
      url: 'https://www.trustpilot.com/review/hubspot.com',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.tier).toBe(1);
    expect(result.cost).toBe(0);
  });

  it('verifies Trustpilot with www normalization', async () => {
    const competitor: CompetitorContext = {
      name: 'Acme Corp',
      website: 'https://acme.io',
      positioning: 'Project management',
      offer: 'Team collaboration tool',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'trustpilot',
      url: 'https://www.trustpilot.com/review/www.acme.io',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(true);
    expect(result.confidence).toBe('high');
    expect(result.tier).toBe(1);
  });

  it('verifies G2 via LLM when name/category/description align', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { match: true, reason: 'Same product — both are CRM platforms by HubSpot' },
      usage: { inputTokens: 300, outputTokens: 50 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'HubSpot',
      website: 'https://hubspot.com',
      positioning: 'All-in-one CRM platform',
      offer: 'CRM, marketing, sales, and service software',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      url: 'https://www.g2.com/products/hubspot-crm/reviews',
      productName: 'HubSpot CRM',
      productCategory: 'CRM Software',
      productDescription: 'Free CRM solution for managing contacts, deals, and tasks',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(true);
    expect(result.confidence).toBe('low'); // LLM results always low confidence
    expect(result.tier).toBe(2);
    expect(result.cost).toBeGreaterThan(0);
  });
});

// =============================================================================
// True Negatives (should reject)
// =============================================================================

describe('True Negatives', () => {
  it('rejects Bonnie (AI voice agents) vs Bon Loyalty (loyalty management)', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        match: false,
        reason: 'Different products — competitor is AI voice agents, listing is loyalty management software',
      },
      usage: { inputTokens: 350, outputTokens: 60 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'Bonnie',
      website: 'https://meetbonnie.com',
      positioning: 'AI voice agents for sales',
      offer: 'Automated sales calls using AI voice technology',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      url: 'https://www.g2.com/products/bon-loyalty/reviews',
      productName: 'Bon Loyalty',
      productCategory: 'Loyalty Management',
      productDescription: 'Loyalty program management for retail businesses',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(false);
    expect(result.tier).toBe(2);
  });

  it('rejects Mercury (banking) vs Mercury Systems (defense)', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        match: false,
        reason: 'Different companies — competitor is fintech banking, listing is defense electronics',
      },
      usage: { inputTokens: 340, outputTokens: 55 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'Mercury',
      website: 'https://mercury.com',
      positioning: 'Banking for startups',
      offer: 'Business banking, credit cards, and treasury for startups',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      productName: 'Mercury Systems',
      productCategory: 'Defense Electronics',
      productDescription: 'Processing subsystems for defense and intelligence applications',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(false);
  });

  it('rejects Notion (productivity) vs Notion Capital (VC)', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: {
        match: false,
        reason: 'Different entities — competitor is a productivity tool, listing is a venture capital firm',
      },
      usage: { inputTokens: 330, outputTokens: 50 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'Notion',
      website: 'https://notion.so',
      positioning: 'All-in-one workspace',
      offer: 'Notes, docs, wikis, and project management in one tool',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      productName: 'Notion Capital',
      productCategory: 'Venture Capital',
      productDescription: 'European venture capital firm investing in B2B SaaS',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(false);
  });
});

// =============================================================================
// Edge Cases
// =============================================================================

describe('Edge Cases', () => {
  it('rejects Trustpilot domain mismatch with high confidence', async () => {
    const competitor: CompetitorContext = {
      name: 'Stripe',
      website: 'https://stripe.com',
      positioning: 'Payment processing',
      offer: 'Online payment infrastructure',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'trustpilot',
      url: 'https://www.trustpilot.com/review/stripecleaning.com',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(false);
    expect(result.confidence).toBe('high');
    expect(result.tier).toBe(1);
    expect(result.cost).toBe(0);
  });

  it('falls to Tier 2 when competitor has no website', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { match: true, reason: 'Names and categories align' },
      usage: { inputTokens: 300, outputTokens: 40 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'Gong',
      website: undefined,
      positioning: 'Revenue intelligence',
      offer: 'AI-powered revenue platform',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'trustpilot',
      url: 'https://www.trustpilot.com/review/gong.io',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    // Should fall to Tier 2 since no competitor website to match
    expect(result.tier).toBe(2);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it('falls to Tier 2 when review has no URL', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { match: true, reason: 'Product name and description match' },
      usage: { inputTokens: 290, outputTokens: 35 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'Salesforce',
      website: 'https://salesforce.com',
      positioning: 'Enterprise CRM',
      offer: 'Cloud-based CRM platform',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      productName: 'Salesforce CRM',
      productCategory: 'CRM Software',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.tier).toBe(2);
    expect(mockGenerateObject).toHaveBeenCalledTimes(1);
  });

  it('fails closed on LLM error', async () => {
    mockGenerateObject.mockRejectedValueOnce(new Error('API rate limit exceeded'));

    const competitor: CompetitorContext = {
      name: 'TestCo',
      website: 'https://testco.com',
      positioning: 'Testing platform',
      offer: 'Automated testing tools',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      productName: 'TestCo Platform',
      productCategory: 'Testing Software',
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    expect(result.verified).toBe(false);
    expect(result.confidence).toBe('low');
    expect(result.reason).toContain('LLM error');
    expect(result.cost).toBe(0);
  });

  it('handles empty/minimal review data gracefully', async () => {
    mockGenerateObject.mockResolvedValueOnce({
      object: { match: false, reason: 'Insufficient data to confirm match' },
      usage: { inputTokens: 250, outputTokens: 30 },
    } as never);

    const competitor: CompetitorContext = {
      name: 'SomeTool',
      website: 'https://sometool.com',
      positioning: 'Data analytics',
      offer: 'Business intelligence dashboards',
    };

    const reviewInfo: ReviewSourceInfo = {
      source: 'g2',
      // No productName, no URL, no category — minimal data
    };

    const result = await verifyReviewSource(competitor, reviewInfo);

    // Should not throw, should complete via Tier 2
    expect(result.tier).toBe(2);
    expect(typeof result.verified).toBe('boolean');
  });
});
