import { describe, it, expect } from 'vitest';
import {
  parseCompetitorNames,
  rankCompetitorsByEmphasis,
  DEFAULT_FULL_TIER_LIMIT,
  MAX_TOTAL_COMPETITORS,
} from '../competitor-utils';
import type { OnboardingFormData } from '@/lib/onboarding/types';

// =============================================================================
// Minimal form data factory for tests
// =============================================================================

function makeFormData(overrides: Partial<OnboardingFormData['marketCompetition']> = {}): OnboardingFormData {
  return {
    businessBasics: { businessName: 'TestCo', websiteUrl: 'https://testco.com' },
    icp: {
      primaryIcpDescription: '', industryVertical: '', jobTitles: '',
      companySize: [], geography: '', easiestToClose: '', buyingTriggers: '', bestClientSources: [],
    },
    productOffer: {
      productDescription: '', coreDeliverables: '', offerPrice: 0,
      pricingModel: [], valueProp: '', currentFunnelType: [],
    },
    marketCompetition: {
      topCompetitors: '',
      uniqueEdge: '',
      marketBottlenecks: '',
      competitorFrustrations: '',
      ...overrides,
    },
    customerJourney: {
      situationBeforeBuying: '', desiredTransformation: '', commonObjections: '',
      salesCycleLength: '14_to_30_days',
    },
    brandPositioning: { brandPositioning: '' },
    assetsProof: {},
    budgetTargets: { monthlyAdBudget: 0, campaignDuration: 'ongoing' },
    compliance: {},
  } as OnboardingFormData;
}

// =============================================================================
// parseCompetitorNames
// =============================================================================

describe('parseCompetitorNames', () => {
  it('splits on commas', () => {
    expect(parseCompetitorNames('HubSpot, Dreamdata, Bizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('splits on semicolons', () => {
    expect(parseCompetitorNames('HubSpot; Dreamdata; Bizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('splits on newlines', () => {
    expect(parseCompetitorNames('HubSpot\nDreamdata\nBizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('splits on " and "', () => {
    expect(parseCompetitorNames('HubSpot and Dreamdata and Bizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('splits on " vs "', () => {
    expect(parseCompetitorNames('HubSpot vs Dreamdata vs. Bizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('splits on " / "', () => {
    expect(parseCompetitorNames('HubSpot / Dreamdata / Bizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('handles mixed delimiters', () => {
    expect(parseCompetitorNames('HubSpot, Dreamdata; Bizible\nFactors.ai and Windsor.ai')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible', 'Factors.ai', 'Windsor.ai',
    ]);
  });

  it('preserves parenthetical notes', () => {
    const result = parseCompetitorNames('HubSpot, Bizible (Marketo), Dreamdata');
    expect(result).toContain('Bizible (Marketo)');
  });

  it('deduplicates case-insensitively', () => {
    expect(parseCompetitorNames('HubSpot, hubspot, HUBSPOT')).toEqual(['HubSpot']);
  });

  it('handles numbered lists', () => {
    expect(parseCompetitorNames('1. HubSpot\n2. Dreamdata\n3. Bizible')).toEqual([
      'HubSpot', 'Dreamdata', 'Bizible',
    ]);
  });

  it('caps at MAX_TOTAL_COMPETITORS', () => {
    const names = Array.from({ length: 30 }, (_, i) => `Competitor${i + 1}`);
    const result = parseCompetitorNames(names.join(', '));
    expect(result).toHaveLength(MAX_TOTAL_COMPETITORS);
  });

  it('returns empty array for empty input', () => {
    expect(parseCompetitorNames('')).toEqual([]);
    expect(parseCompetitorNames('  ')).toEqual([]);
  });

  it('trims whitespace from names', () => {
    expect(parseCompetitorNames('  HubSpot  ,  Dreamdata  ')).toEqual(['HubSpot', 'Dreamdata']);
  });
});

// =============================================================================
// rankCompetitorsByEmphasis
// =============================================================================

describe('rankCompetitorsByEmphasis', () => {
  it('puts all competitors in full tier when <= limit', () => {
    const names = ['HubSpot', 'Dreamdata', 'Bizible'];
    const result = rankCompetitorsByEmphasis(names, makeFormData());
    expect(result.fullTier).toEqual(['HubSpot', 'Dreamdata', 'Bizible']);
    expect(result.summaryTier).toEqual([]);
  });

  it('splits into full + summary tiers when > limit', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    const result = rankCompetitorsByEmphasis(names, makeFormData(), 5);
    expect(result.fullTier).toHaveLength(5);
    expect(result.summaryTier).toHaveLength(2);
    // All names should be present
    expect([...result.fullTier, ...result.summaryTier].sort()).toEqual(names.sort());
  });

  it('boosts competitors mentioned in frustrations', () => {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta', 'Eta'];
    const formData = makeFormData({
      competitorFrustrations: 'Zeta is too expensive and Eta has poor support',
    });
    const result = rankCompetitorsByEmphasis(names, formData, 5);
    // Zeta and Eta should be boosted into full tier despite being last in list
    expect(result.fullTier).toContain('Zeta');
    expect(result.fullTier).toContain('Eta');
  });

  it('respects list order as primary signal', () => {
    const names = ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth'];
    const result = rankCompetitorsByEmphasis(names, makeFormData(), 3);
    // First 3 should be in full tier (position is dominant signal)
    expect(result.fullTier).toContain('First');
    expect(result.fullTier).toContain('Second');
    expect(result.fullTier).toContain('Third');
  });

  it('handles empty names array', () => {
    const result = rankCompetitorsByEmphasis([], makeFormData());
    expect(result.fullTier).toEqual([]);
    expect(result.summaryTier).toEqual([]);
  });

  it('handles single competitor', () => {
    const result = rankCompetitorsByEmphasis(['Solo'], makeFormData());
    expect(result.fullTier).toEqual(['Solo']);
    expect(result.summaryTier).toEqual([]);
  });

  it('uses custom fullTierLimit', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F'];
    const result = rankCompetitorsByEmphasis(names, makeFormData(), 2);
    expect(result.fullTier).toHaveLength(2);
    expect(result.summaryTier).toHaveLength(4);
  });

  it('boosts competitor mentioned in uniqueEdge', () => {
    const names = ['Alpha', 'Beta', 'Gamma', 'Delta', 'Epsilon', 'Zeta'];
    const formData = makeFormData({
      uniqueEdge: 'Unlike Zeta, we offer real-time analytics',
    });
    const result = rankCompetitorsByEmphasis(names, formData, 3);
    expect(result.fullTier).toContain('Zeta');
  });

  it('handles exactly fullTierLimit competitors (no summary)', () => {
    const names = ['A', 'B', 'C', 'D', 'E'];
    const result = rankCompetitorsByEmphasis(names, makeFormData(), 5);
    expect(result.fullTier).toHaveLength(5);
    expect(result.summaryTier).toHaveLength(0);
  });

  it('handles 12 competitors with default limit (8 full, 4 summary)', () => {
    const names = [
      'Smith.ai', 'Ruby Receptionists', 'Abby Connect', 'Nexa',
      'PATLive', 'Answering Service Care', 'Maple', 'Sadie',
      'Slang.ai', 'TimeShark', 'VoicePlug', 'PolyAI',
    ];
    const result = rankCompetitorsByEmphasis(names, makeFormData());
    expect(result.fullTier).toHaveLength(DEFAULT_FULL_TIER_LIMIT); // 8
    expect(result.summaryTier).toHaveLength(4);
    // All 12 competitors must be present across both tiers
    expect([...result.fullTier, ...result.summaryTier].sort()).toEqual(names.sort());
  });

  it('puts all 8 competitors in full tier when exactly at default limit', () => {
    const names = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
    const result = rankCompetitorsByEmphasis(names, makeFormData());
    expect(result.fullTier).toHaveLength(8);
    expect(result.summaryTier).toHaveLength(0);
  });
});
