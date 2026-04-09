import { describe, it, expect } from 'vitest';
import { extractClaims, formatClaimsForScript } from '../stages/02-claims/claim-extractor';

const MOCK_CONTEXT = {
  icpValidation: {
    persona: { role: 'Marketing Director', company: 'Mid-market SaaS' },
    triggers: [
      { trigger: 'CEO asked why CAC increased 40% this quarter' },
      { trigger: 'Lost 3 deals to competitor with multi-channel presence' },
    ],
    objections: [
      { objection: 'Tried agencies before, burned $15K with no results' },
    ],
    painPoints: ['Manual reporting takes 6 hours every Monday'],
  },
  offerAnalysis: {
    strengths: ['Full-funnel attribution across 5 channels'],
    differentiators: ['Only platform connecting ad spend to closed revenue'],
    redFlags: [{ flag: 'Pricing 3x higher at $2,500/month vs category avg $800' }],
    pricingAnalysis: { marketBenchmark: 'Category average $800/month, premium justified' },
  },
  competitors: {
    competitors: [
      {
        name: 'HubSpot',
        weaknesses: ['No native Salesforce attribution'],
        threatAssessment: { topAdHooks: ['All-in-one marketing platform'] },
      },
    ],
  },
  researchStats: [
    { stat: '67% of B2B marketers cannot attribute pipeline', source: 'icpValidation' },
  ],
};

describe('extractClaims', () => {
  it('extracts claims from all research sections', () => {
    const claims = extractClaims(MOCK_CONTEXT);
    expect(claims.length).toBeGreaterThan(5);
  });

  it('extracts stats from claims containing numbers', () => {
    const claims = extractClaims(MOCK_CONTEXT);
    const withStats = claims.filter((c) => c.stat !== null);
    expect(withStats.length).toBeGreaterThan(0);
    expect(withStats[0].stat).toMatch(/\d/);
  });

  it('assigns correct categories', () => {
    const claims = extractClaims(MOCK_CONTEXT);
    const categories = new Set(claims.map((c) => c.category));
    expect(categories.has('audience-trigger')).toBe(true);
    expect(categories.has('objection-data')).toBe(true);
    expect(categories.has('offer-strength')).toBe(true);
    expect(categories.has('competitor-weakness')).toBe(true);
  });

  it('deduplicates claims', () => {
    const contextWithDupes = {
      ...MOCK_CONTEXT,
      icpValidation: {
        ...MOCK_CONTEXT.icpValidation,
        triggers: [
          { trigger: 'CEO asked why CAC increased 40% this quarter' },
          { trigger: 'CEO asked why CAC increased 40% this quarter' },
        ],
      },
    };
    const claims = extractClaims(contextWithDupes);
    const triggerClaims = claims.filter((c) => c.claim.includes('CAC increased'));
    expect(triggerClaims).toHaveLength(1);
  });

  it('assigns sequential IDs', () => {
    const claims = extractClaims(MOCK_CONTEXT);
    for (let i = 0; i < claims.length; i++) {
      expect(claims[i].id).toBe(i);
    }
  });

  it('handles empty research context', () => {
    const claims = extractClaims({});
    expect(claims).toHaveLength(0);
  });
});

describe('formatClaimsForScript', () => {
  it('formats assigned claims as a readable block', () => {
    const claims = extractClaims(MOCK_CONTEXT);
    const formatted = formatClaimsForScript(claims, [0, 1]);
    expect(formatted).toContain('[');
    expect(formatted).toContain(']');
    expect(formatted.split('\n').length).toBe(2);
  });

  it('returns fallback for empty indices', () => {
    const claims = extractClaims(MOCK_CONTEXT);
    const formatted = formatClaimsForScript(claims, []);
    expect(formatted).toContain('No specific claims');
  });
});
