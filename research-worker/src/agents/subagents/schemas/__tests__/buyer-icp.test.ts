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
    {
      name: 'Alex P',
      title: 'Director RevOps',
      company: 'Acme SaaS',
      sourceUrl: 'https://linkedin.com/in/alex',
    },
    {
      name: 'Beth Q',
      title: 'VP RevOps',
      company: 'Bravo Corp',
      sourceUrl: 'https://linkedin.com/in/beth',
    },
    {
      name: 'Carl R',
      title: 'RevOps Lead',
      company: 'Charlie Inc',
      sourceUrl: 'https://linkedin.com/in/carl',
    },
    {
      name: 'Dana S',
      title: 'Head of RevOps',
      company: 'Delta Co',
      sourceUrl: 'https://linkedin.com/in/dana',
    },
    {
      name: 'Erin T',
      title: 'Sr RevOps Manager',
      company: 'Echo LLC',
      sourceUrl: 'https://linkedin.com/in/erin',
    },
  ],
  icpAccountCounts: {
    industry: { value: 'SaaS', source: 'LinkedIn', dateObserved: '2026-05-14' },
    employeeBands: { value: '200-1000', source: 'LinkedIn', dateObserved: '2026-05-14' },
    revenueBands: { value: '$10M-$100M', source: 'ZoomInfo', dateObserved: '2026-05-14' },
  },
  awarenessDistribution: [
    { level: 'unaware' as const, evidence: '60% informational search' },
    { level: 'problem-aware' as const, evidence: 'Reviews lean problem-first' },
    { level: 'solution-aware' as const, evidence: 'Comparison terms +22% YoY' },
    { level: 'product-aware' as const, evidence: 'Branded search 8K/mo' },
    { level: 'most-aware' as const, evidence: 'NPS promoters cite features' },
  ],
  triggers: [
    { name: 'Funding round', detectionSignal: 'Crunchbase filter, last 30 days' },
    { name: 'Leadership change', detectionSignal: 'LinkedIn job-change alerts' },
    { name: 'Hiring spike', detectionSignal: 'LinkedIn jobs API delta >3x baseline' },
  ],
  clusters: {
    communities: [
      { name: 'r/RevOps', subscribers: 15000, sourceUrl: 'https://reddit.com/r/RevOps' },
      { name: 'RevOps Co-op Slack', subscribers: 8500, sourceUrl: 'https://revopscoop.com' },
    ],
    newsletters: [
      { name: 'RevOps Roundup', subscribers: 12000, sourceUrl: 'https://revopsroundup.com' },
      { name: 'The RevOps Letter', subscribers: 7000, sourceUrl: 'https://revopsletter.com' },
    ],
  },
};

describe('BuyerICPSectionSchema', () => {
  it('accepts a rich plan with all required fields', () => {
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...RICH_FIELDS });
    expect(result.success).toBe(true);
  });

  it('still requires envelope-core fields (sectionTitle/verdict/statusSummary)', () => {
    const { sectionTitle, ...withoutTitle } = ENVELOPE_CORE;
    const result = BuyerICPSectionSchema.safeParse({ ...withoutTitle, ...RICH_FIELDS });
    expect(result.success).toBe(false);
  });

  it('requires personas[] (rich field)', () => {
    const { personas, ...withoutPersonas } = RICH_FIELDS;
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...withoutPersonas });
    expect(result.success).toBe(false);
  });

  it('requires awarenessDistribution[] (rich field)', () => {
    const { awarenessDistribution, ...withoutAwareness } = RICH_FIELDS;
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...withoutAwareness });
    expect(result.success).toBe(false);
  });

  it('accepts personas with only the required keys (role+evidence optional)', () => {
    const slim = {
      ...RICH_FIELDS,
      personas: RICH_FIELDS.personas.map(({ role: _r, evidence: _e, ...rest }) => rest),
    };
    const result = BuyerICPSectionSchema.safeParse({ ...ENVELOPE_CORE, ...slim });
    expect(result.success).toBe(true);
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

  it('exposes the inferred BuyerICPSection type with rich fields', () => {
    // Type-only check via parse — if .data is not narrow enough the build fails.
    const parsed = BuyerICPSectionSchema.parse({ ...ENVELOPE_CORE, ...RICH_FIELDS });
    expect(parsed.personas.length).toBeGreaterThan(0);
    expect(parsed.clusters.communities.length).toBe(2);
    expect(parsed.triggers[0].detectionSignal).toBeTypeOf('string');
  });
});
