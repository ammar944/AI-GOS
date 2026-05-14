import { describe, expect, it } from 'vitest';

import { BuyerICPSectionSchema } from '../buyer-icp';

const ENVELOPE_CORE = {
  sectionTitle: 'Buyer & ICP Validation',
  verdict: 'Mid-market RevOps leads are the wedge',
  statusSummary: 'Five named directors confirm the ICP exists; triggers are LinkedIn-detectable.',
  confidence: 7,
  keyFindings: [
    { title: 'ICP exists', detail: 'Five named buyers across five named companies.' },
  ],
  evidenceQuotes: [],
  risksOrGaps: [],
  recommendedMoves: [],
  sources: [],
};

const RICH_FIELDS = {
  personas: [
    { name: 'Alex P', title: 'Director RevOps', company: 'Acme', sourceUrl: 'https://linkedin.com/in/alex', role: 'champion', evidence: 'Case study' },
    { name: 'Beth Q', title: 'VP RevOps', company: 'Bravo', sourceUrl: 'https://linkedin.com/in/beth', role: 'buyer', evidence: 'Conference' },
    { name: 'Carl R', title: 'Lead', company: 'Charlie', sourceUrl: 'https://linkedin.com/in/carl', role: 'buyer', evidence: 'Bio' },
    { name: 'Dana S', title: 'Head', company: 'Delta', sourceUrl: 'https://linkedin.com/in/dana', role: 'buyer', evidence: 'G2' },
    { name: 'Erin T', title: 'Manager', company: 'Echo', sourceUrl: 'https://linkedin.com/in/erin', role: 'champion', evidence: 'Podcast' },
  ],
  icpAccountCounts: [
    { cutType: 'industry' as const, value: 'SaaS', source: 'LinkedIn', dateObserved: '2026-05-14' },
    { cutType: 'employeeBands' as const, value: '200-1000', source: 'LinkedIn', dateObserved: '2026-05-14' },
    { cutType: 'revenueBands' as const, value: '$10M-$100M', source: 'ZoomInfo', dateObserved: '2026-05-14' },
  ],
  awarenessDistribution: [
    { level: 'unaware' as const, evidence: '60% informational search' },
    { level: 'problem-aware' as const, evidence: 'Reviews lean problem-first' },
    { level: 'solution-aware' as const, evidence: 'Comparison terms +22% YoY' },
    { level: 'product-aware' as const, evidence: 'Branded search 8K/mo' },
    { level: 'most-aware' as const, evidence: 'NPS promoters cite features' },
  ],
  triggers: [
    { name: 'Funding round', detectionSignal: 'Crunchbase filter', window: 'weeks' as const },
    { name: 'Leadership change', detectionSignal: 'LinkedIn job-change alerts', window: 'immediate' as const },
    { name: 'Hiring spike', detectionSignal: 'Jobs API delta', window: 'quarters' as const },
  ],
  clusters: [
    { bucketType: 'community' as const, name: 'r/RevOps', metric: 15000, sourceUrl: 'https://reddit.com/r/RevOps' },
    { bucketType: 'community' as const, name: 'RevOps Slack', metric: 8500, sourceUrl: 'https://revopscoop.com' },
    { bucketType: 'newsletter' as const, name: 'RevOps Roundup', metric: 12000, sourceUrl: 'https://revopsroundup.com' },
    { bucketType: 'newsletter' as const, name: 'RevOps Letter', metric: 7000, sourceUrl: 'https://revopsletter.com' },
  ],
};

describe('BuyerICPSectionSchema', () => {
  it('accepts a rich plan with all required fields', () => {
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...RICH_FIELDS });
    expect(result.success).toBe(true);
  });

  it('still requires envelope-core fields (sectionTitle/verdict/statusSummary)', () => {
    const { sectionTitle: _t, ...withoutTitle } = ENVELOPE_CORE;
    const result = BuyerICPSectionSchema.safeParse({ ...withoutTitle, ...RICH_FIELDS });
    expect(result.success).toBe(false);
  });

  it('requires personas[] (rich field)', () => {
    const { personas: _p, ...withoutPersonas } = RICH_FIELDS;
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...withoutPersonas });
    expect(result.success).toBe(false);
  });

  it('requires awarenessDistribution[] (rich field)', () => {
    const { awarenessDistribution: _a, ...withoutAwareness } = RICH_FIELDS;
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...withoutAwareness });
    expect(result.success).toBe(false);
  });

  it('requires triggers[].window (no longer optional)', () => {
    const bad = {
      ...RICH_FIELDS,
      triggers: [{ name: 'Funding', detectionSignal: 'Crunchbase' }],
    };
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...bad });
    expect(result.success).toBe(false);
  });

  it('requires clusters as a flat array (not nested object)', () => {
    const bad = {
      ...RICH_FIELDS,
      clusters: {
        communities: RICH_FIELDS.clusters.filter((c) => c.bucketType === 'community'),
      } as unknown as typeof RICH_FIELDS.clusters,
    };
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...bad });
    expect(result.success).toBe(false);
  });

  it('rejects an awareness level outside the Schwartz enum', () => {
    const bad = {
      ...RICH_FIELDS,
      awarenessDistribution: [
        { level: 'super-aware' as unknown as 'most-aware', evidence: 'fake' },
      ],
    };
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...bad });
    expect(result.success).toBe(false);
  });

  it('rejects clusters bucketType outside the enum', () => {
    const bad = {
      ...RICH_FIELDS,
      clusters: [
        {
          bucketType: 'made-up' as unknown as 'community',
          name: 'x',
          metric: 0,
          sourceUrl: 'https://x.com',
        },
      ],
    };
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...bad });
    expect(result.success).toBe(false);
  });

  it('exposes the inferred BuyerICPSection type with rich fields', () => {
    const parsed = BuyerICPSectionSchema.parse({ ...ENVELOPE_CORE, ...RICH_FIELDS });
    expect(parsed.personas.length).toBe(5);
    expect(parsed.icpAccountCounts.length).toBe(3);
    expect(parsed.clusters.filter((c) => c.bucketType === 'community').length).toBe(2);
    expect(parsed.triggers[0].window).toBe('weeks');
  });
});
