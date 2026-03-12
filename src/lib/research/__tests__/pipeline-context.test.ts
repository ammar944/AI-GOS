import { describe, expect, it } from 'vitest';

import {
  buildCompetitorContext,
  buildIcpContext,
  buildIndustryContext,
  buildKeywordContext,
  buildOfferContext,
  buildSynthesisContext,
} from '@/lib/research/pipeline-context';

describe('buildIndustryContext', () => {
  it('emits a business context block with stable labeled bullets', () => {
    const context = buildIndustryContext({
      companyName: 'Acme Corp',
      industry: 'SaaS',
      companyUrl: 'https://acme.com',
    });

    expect(context).toContain('Business context:');
    expect(context).toContain('- Company Name: Acme Corp');
    expect(context).toContain('- Industry: SaaS');
    expect(context).toContain('- Website URL: https://acme.com');
  });
});

describe('buildCompetitorContext', () => {
  it('includes onboarding context and the market overview dependency block', () => {
    const context = buildCompetitorContext({
      onboardingData: {
        companyName: 'Acme Corp',
        industry: 'SaaS',
        competitors: ['Rival Co'],
      },
      industryResearch: {
        data: { marketSize: '$5B' },
      },
    });

    expect(context).toContain('Business context:');
    expect(context).toContain('- Company Name: Acme Corp');
    expect(context).toContain('- Top Competitors: Rival Co');
    expect(context).toContain('Existing persisted research to reuse:');
    expect(context).toContain('## Market Overview');
    expect(context).toContain('$5B');
  });
});

describe('buildIcpContext', () => {
  it('includes the required prior sections with the expected headings', () => {
    const context = buildIcpContext({
      onboardingData: { companyName: 'Acme Corp' },
      industryResearch: {
        data: { marketSize: '$5B' },
      },
      competitorIntel: {
        data: { competitors: [{ name: 'Rival' }] },
      },
    });

    expect(context).toContain('Business context:');
    expect(context).toContain('Existing persisted research to reuse:');
    expect(context).toContain('## Market Overview');
    expect(context).toContain('## Competitor Intel');
  });
});

describe('buildOfferContext', () => {
  it('includes website URL and the expected three dependency sections', () => {
    const context = buildOfferContext({
      onboardingData: {
        companyName: 'Acme Corp',
        companyUrl: 'https://acme.com',
      },
      industryResearch: { data: {} },
      competitorIntel: { data: {} },
      icpValidation: { data: {} },
    });

    expect(context).toContain('- Website URL: https://acme.com');
    expect(context).toContain('## Market Overview');
    expect(context).toContain('## Competitor Intel');
    expect(context).toContain('## ICP Validation');
  });
});

describe('buildSynthesisContext', () => {
  it('emits the full dependency chain with runner-compatible section headings', () => {
    const context = buildSynthesisContext({
      onboardingData: {
        companyName: 'Acme Corp',
        industry: 'SaaS',
      },
      industryResearch: { data: { marketSize: '$5B' } },
      competitorIntel: { data: { competitors: ['Foo'] } },
      icpValidation: { data: { persona: 'SMB' } },
      offerAnalysis: { data: { score: 7 } },
    });

    expect(context).toContain('Business context:');
    expect(context).toContain('- Company Name: Acme Corp');
    expect(context).toContain('Existing persisted research to reuse:');
    expect(context).toContain('## Market Overview');
    expect(context).toContain('## Competitor Intel');
    expect(context).toContain('## ICP Validation');
    expect(context).toContain('## Offer Analysis');
    expect(context).toContain('$5B');
  });
});

describe('buildKeywordContext', () => {
  it('places top competitors inside the business context block before dependencies', () => {
    const context = buildKeywordContext({
      onboardingData: { companyName: 'Acme Corp' },
      industryResearch: { data: {} },
      competitorIntel: {
        data: {
          competitors: [{ name: 'Hey Digital' }, { name: 'Refine Labs' }],
        },
      },
      icpValidation: { data: {} },
      offerAnalysis: { data: {} },
      strategicSynthesis: { data: {} },
    });

    expect(context).toContain('- Top Competitors: Hey Digital, Refine Labs');
    expect(context.indexOf('- Top Competitors:')).toBeLessThan(
      context.indexOf('Existing persisted research to reuse:'),
    );
    expect(context).toContain('## Strategic Synthesis');
  });
});
