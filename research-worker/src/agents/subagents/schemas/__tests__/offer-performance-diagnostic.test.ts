import { describe, expect, it } from 'vitest';

import {
  OfferPerformanceArtifactSchema,
  validateOfferPerformanceMinimums,
  type OfferPerformanceArtifact,
} from '../offer-performance-diagnostic';

const OFFER_PERFORMANCE_FIXTURE: OfferPerformanceArtifact = {
  sectionTitle: 'Offer & Performance Diagnostic',
  verdict:
    'Fellow has clear offer-market fit signals in its public positioning, but the public funnel and retention math is largely not disclosed.',
  statusSummary:
    'The strongest public evidence sits in company-owned product pages, category pages, review surfaces, and third-party performance checks. Where Fellow does not disclose CAC, LTV, conversion rates, or retention rates, the Artifact says not disclosed instead of inventing math.',
  confidence: 7,
  sources: [
    { title: 'Fellow homepage', url: 'https://fellow.app' },
    { title: 'Fellow AI meeting assistant page', url: 'https://fellow.app/ai-meeting-assistant/' },
    { title: 'Fellow pricing page', url: 'https://fellow.app/pricing/' },
    { title: 'Fellow G2 profile', url: 'https://www.g2.com/products/fellow/reviews' },
    { title: 'PageSpeed Insights', url: 'https://pagespeed.web.dev/' },
  ],
  offerMarketFit: {
    prose:
      'Offer-market fit evidence is strongest where Fellow publicly ties the product to recurring meeting workflows, AI notes, and team accountability. The company does not publish complete revenue, CAC, or retention math, so proof points use sourced public evidence and not disclosed values where metrics are private.',
    proofPoints: [
      {
        metric: 'Customer count',
        value: 'not disclosed',
        reportedBy: 'company-own',
        confidence: 'medium',
        sourceUrl: 'https://fellow.app',
      },
      {
        metric: 'Review volume',
        value: 'not disclosed',
        reportedBy: 'external-source',
        confidence: 'medium',
        sourceUrl: 'https://www.g2.com/products/fellow/reviews',
      },
      {
        metric: 'Published pricing',
        value: 'paid tiers publicly listed',
        reportedBy: 'company-own',
        confidence: 'high',
        sourceUrl: 'https://fellow.app/pricing/',
      },
    ],
  },
  funnelDiagnosis: {
    prose:
      'The funnel diagnosis is constrained by missing internal conversion data. Public pages reveal the visible acquisition-to-signup path and pricing path, but the company does not disclose stage conversion, CAC, sales cycle, or payback metrics in public sources.',
    breaks: [
      {
        stageName: 'Homepage to product-qualified signup',
        metric: 'visitor-to-signup conversion',
        magnitude: 'not disclosed',
        hypothesis:
          'The offer may depend on visitors already understanding meeting operations pain before they see a quantified business case.',
        sourceUrl: 'https://fellow.app',
      },
      {
        stageName: 'Pricing evaluation to paid conversion',
        metric: 'free-to-paid or trial-to-paid conversion',
        magnitude: 'not disclosed',
        hypothesis:
          'Without public proof of conversion or payback, buyers must infer ROI from feature fit and social proof.',
        sourceUrl: 'https://fellow.app/pricing/',
      },
    ],
  },
  channelTruth: {
    prose:
      'Channel evidence is public but uneven. Fellow has visible owned search surfaces, review-marketplace presence, and product-led web pages, while paid-channel and partner-channel performance numbers are not disclosed in public sources.',
    channels: [
      {
        channelName: 'Organic search',
        hasWorked: 'partial',
        quantifiedEvidence: 'not disclosed',
        sourceUrl: 'https://fellow.app',
      },
      {
        channelName: 'Review marketplaces',
        hasWorked: 'partial',
        quantifiedEvidence: 'not disclosed',
        sourceUrl: 'https://www.g2.com/products/fellow/reviews',
      },
      {
        channelName: 'Product-led website',
        hasWorked: 'unknown',
        quantifiedEvidence: 'not disclosed',
        sourceUrl: 'https://fellow.app/ai-meeting-assistant/',
      },
    ],
  },
  retentionHealth: {
    prose:
      'Retention and activation health must be inferred from public product flows because Fellow does not disclose cohort retention, activation rate, or first-value timing. The public product promise centers on recurring meeting rituals, AI notes, and action-item follow-through.',
    signals: [
      {
        signalType: 'activation',
        metric: 'first successful meeting workflow setup',
        value: 'not disclosed',
        sourceUrl: 'https://fellow.app',
      },
      {
        signalType: 'first-value-moment',
        metric: 'AI meeting notes captured and shared',
        value: 'not disclosed',
        sourceUrl: 'https://fellow.app/ai-meeting-assistant/',
      },
      {
        signalType: 'retention',
        metric: 'recurring meeting adoption',
        value: 'not disclosed',
        sourceUrl: 'https://fellow.app',
      },
    ],
  },
  redFlags: {
    prose:
      'The red flags are not accusations that the offer is broken. They are contradictions between visible claims and missing public math, which tells the operator where private analytics or customer proof must be attached before making stronger performance claims.',
    items: [
      {
        claimedMotion: 'Product-led meeting workflow adoption',
        actualEvidence: 'Public sources do not disclose visitor-to-signup or activation conversion.',
        contradiction:
          'The motion implies measurable self-serve activation, but the public evidence does not disclose activation math.',
        severity: 'medium',
      },
      {
        claimedMotion: 'AI meeting assistant value proposition',
        actualEvidence: 'Public sources do not disclose time-to-first-value after connecting meeting tools.',
        contradiction:
          'The offer promises faster meeting value, but public evidence does not disclose first-value timing.',
        severity: 'medium',
      },
      {
        claimedMotion: 'Retained recurring meeting operating system',
        actualEvidence: 'Public sources do not disclose cohort retention or recurring active usage.',
        contradiction:
          'The claimed recurring workflow should produce retention signals, but those numbers are not public.',
        severity: 'high',
      },
    ],
  },
};

describe('OfferPerformanceArtifactSchema', () => {
  it('accepts a full fixture with the five canonical Section 06 sub-sections populated', () => {
    const result = OfferPerformanceArtifactSchema.safeParse(
      OFFER_PERFORMANCE_FIXTURE,
    );
    expect(result.success).toBe(true);
  });

  it('rejects when offerMarketFit.proofPoints is missing', () => {
    const result = OfferPerformanceArtifactSchema.safeParse({
      ...OFFER_PERFORMANCE_FIXTURE,
      offerMarketFit: {
        prose: OFFER_PERFORMANCE_FIXTURE.offerMarketFit.prose,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum channel truth value', () => {
    const [first, ...rest] = OFFER_PERFORMANCE_FIXTURE.channelTruth.channels;
    const result = OfferPerformanceArtifactSchema.safeParse({
      ...OFFER_PERFORMANCE_FIXTURE,
      channelTruth: {
        ...OFFER_PERFORMANCE_FIXTURE.channelTruth,
        channels: [{ ...first, hasWorked: 'sort-of' }, ...rest],
      },
    });
    expect(result.success).toBe(false);
  });

  it('passes validateOfferPerformanceMinimums on the full fixture', () => {
    expect(validateOfferPerformanceMinimums(OFFER_PERFORMANCE_FIXTURE)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('fails validateOfferPerformanceMinimums when offer proof is too thin', () => {
    const artifact: OfferPerformanceArtifact = {
      ...OFFER_PERFORMANCE_FIXTURE,
      offerMarketFit: {
        ...OFFER_PERFORMANCE_FIXTURE.offerMarketFit,
        proofPoints: OFFER_PERFORMANCE_FIXTURE.offerMarketFit.proofPoints.slice(0, 2),
      },
    };

    const result = validateOfferPerformanceMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'offerMarketFit.proofPoints: have 2, need >=3 proof points.',
    );
  });

  it('fails validateOfferPerformanceMinimums when channels are not distinct', () => {
    const artifact: OfferPerformanceArtifact = {
      ...OFFER_PERFORMANCE_FIXTURE,
      channelTruth: {
        ...OFFER_PERFORMANCE_FIXTURE.channelTruth,
        channels: OFFER_PERFORMANCE_FIXTURE.channelTruth.channels.map((channel) => ({
          ...channel,
          channelName: 'Organic search',
        })),
      },
    };

    const result = validateOfferPerformanceMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'channelTruth.channels: need >=3 distinct channels, have 1.',
    );
  });

  it('fails validateOfferPerformanceMinimums when retention signals cover one type', () => {
    const artifact: OfferPerformanceArtifact = {
      ...OFFER_PERFORMANCE_FIXTURE,
      retentionHealth: {
        ...OFFER_PERFORMANCE_FIXTURE.retentionHealth,
        signals: OFFER_PERFORMANCE_FIXTURE.retentionHealth.signals.map((signal) => ({
          ...signal,
          signalType: 'activation',
        })),
      },
    };

    const result = validateOfferPerformanceMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'retentionHealth.signals: need >=2 signalTypes, have 1.',
    );
  });

  it('fails validateOfferPerformanceMinimums when red flags are missing', () => {
    const artifact: OfferPerformanceArtifact = {
      ...OFFER_PERFORMANCE_FIXTURE,
      redFlags: {
        ...OFFER_PERFORMANCE_FIXTURE.redFlags,
        items: OFFER_PERFORMANCE_FIXTURE.redFlags.items.slice(0, 2),
      },
    };

    const result = validateOfferPerformanceMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('redFlags.items: have 2, need >=3 red flags.');
  });

  it('fails validateOfferPerformanceMinimums when confidence is outside 0-10', () => {
    const artifact: OfferPerformanceArtifact = {
      ...OFFER_PERFORMANCE_FIXTURE,
      confidence: 11,
    };

    const result = validateOfferPerformanceMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('confidence: expected 0-10, got 11.');
  });
});
