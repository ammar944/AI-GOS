import { describe, it, expect, vi } from 'vitest';
import { postProcessSynthesis, type SynthesisInput } from '../synthesize';
import type { ParallelFetchResults } from '../parallel-fetch';

function makeBaseSynthInput(reviews: ParallelFetchResults['reviews']): SynthesisInput {
  return {
    parsed: {
      companyName: 'TestCo',
      productDescription: 'A test product',
      icpDescription: '',
      websiteUrl: '',
      competitors: [
        { name: 'Acme', domain: 'acme.com', inferredDomain: false },
        { name: 'BetaCo', domain: 'betaco.com', inferredDomain: false },
      ],
    },
    fetchResults: {
      reviews,
      pricing: [],
      spyfu: [],
      adLibrary: [],
    } as unknown as ParallelFetchResults,
    sonarResults: {
      competitorInsights: [],
      marketPatterns: [],
      whiteSpaceOpportunities: [],
      citations: [],
      verifiedEntries: [],
      removedCompetitors: [],
    },
  } as unknown as SynthesisInput;
}

function makeParsedOutput(competitorNames: string[]) {
  return {
    competitors: competitorNames.map(name => ({
      name,
      website: `${name.toLowerCase()}.com`,
      positioning: 'test',
    })),
  };
}

describe('injectReviews via postProcessSynthesis', () => {
  it('injects trustpilot and g2 data', () => {
    const parsed = makeParsedOutput(['Acme']);
    const input = makeBaseSynthInput([{
      competitorName: 'Acme',
      domain: 'acme.com',
      trustpilot: { rating: 4.2, reviewCount: 100, recentThemes: ['fast'], url: 'https://tp.com/acme' },
      g2: { rating: 3.8, reviewCount: 50, categories: ['analytics'], url: 'https://g2.com/acme' },
      capterra: null,
      google: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
    }]);

    postProcessSynthesis(parsed as Record<string, unknown>, input);

    const comp = (parsed.competitors[0] as Record<string, unknown>);
    const reviews = comp.reviews as Record<string, unknown>;
    expect(reviews.trustpilot).toBeDefined();
    expect(reviews.g2).toBeDefined();
  });

  it('injects capterra data', () => {
    const parsed = makeParsedOutput(['Acme']);
    const input = makeBaseSynthInput([{
      competitorName: 'Acme',
      domain: 'acme.com',
      trustpilot: null,
      g2: null,
      capterra: { rating: 4.0, reviewCount: 200, categories: ['CRM'], url: 'https://capterra.com/acme' },
      google: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
    }]);

    postProcessSynthesis(parsed as Record<string, unknown>, input);

    const comp = (parsed.competitors[0] as Record<string, unknown>);
    const reviews = comp.reviews as Record<string, unknown>;
    expect(reviews).toBeDefined();
    expect(reviews.capterra).toBeDefined();
  });

  it('injects negativeReviews', () => {
    const parsed = makeParsedOutput(['Acme']);
    const input = makeBaseSynthInput([{
      competitorName: 'Acme',
      domain: 'acme.com',
      trustpilot: null,
      g2: null,
      capterra: null,
      google: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [
        { text: 'Terrible onboarding', rating: 1, source: 'g2' as const },
      ],
    }]);

    postProcessSynthesis(parsed as Record<string, unknown>, input);

    const comp = (parsed.competitors[0] as Record<string, unknown>);
    const reviews = comp.reviews as Record<string, unknown>;
    expect(reviews).toBeDefined();
    expect(reviews.negativeReviews).toHaveLength(1);
  });

  it('allows capterra-only competitors (guard fix)', () => {
    const parsed = makeParsedOutput(['Acme']);
    const input = makeBaseSynthInput([{
      competitorName: 'Acme',
      domain: 'acme.com',
      trustpilot: null,
      g2: null,
      capterra: { rating: 3.5, reviewCount: 30, categories: [], url: 'https://capterra.com/acme' },
      google: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
    }]);

    postProcessSynthesis(parsed as Record<string, unknown>, input);

    const comp = (parsed.competitors[0] as Record<string, unknown>);
    expect(comp.reviews).toBeDefined();
  });

  it('allows negativeReviews-only competitors (guard fix)', () => {
    const parsed = makeParsedOutput(['Acme']);
    const input = makeBaseSynthInput([{
      competitorName: 'Acme',
      domain: 'acme.com',
      trustpilot: null,
      g2: null,
      capterra: null,
      google: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [
        { text: 'Bad UX', rating: 2, source: 'capterra' as const },
      ],
    }]);

    postProcessSynthesis(parsed as Record<string, unknown>, input);

    const comp = (parsed.competitors[0] as Record<string, unknown>);
    expect(comp.reviews).toBeDefined();
  });

  it('skips competitors with no review data', () => {
    const parsed = makeParsedOutput(['Acme']);
    const input = makeBaseSynthInput([{
      competitorName: 'Acme',
      domain: 'acme.com',
      trustpilot: null,
      g2: null,
      capterra: null,
      google: null,
      testimonials: [],
      testimonialPages: [],
      negativeReviews: [],
    }]);

    postProcessSynthesis(parsed as Record<string, unknown>, input);

    const comp = (parsed.competitors[0] as Record<string, unknown>);
    expect(comp.reviews).toBeUndefined();
  });
});
