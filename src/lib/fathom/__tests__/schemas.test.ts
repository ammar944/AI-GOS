import { describe, it, expect } from 'vitest';
import { fathomShareUrlSchema, fathomFetchRequestSchema, salesCallInsightsSchema } from '../schemas';

describe('fathomShareUrlSchema', () => {
  it('accepts valid Fathom share URLs', () => {
    expect(fathomShareUrlSchema.safeParse('https://fathom.video/share/abc123').success).toBe(true);
    expect(fathomShareUrlSchema.safeParse('https://fathom.video/share/xyz-456-def').success).toBe(true);
  });

  it('rejects non-Fathom URLs', () => {
    expect(fathomShareUrlSchema.safeParse('https://zoom.us/share/abc').success).toBe(false);
    expect(fathomShareUrlSchema.safeParse('https://fathom.video/meetings/abc').success).toBe(false);
    expect(fathomShareUrlSchema.safeParse('not-a-url').success).toBe(false);
    expect(fathomShareUrlSchema.safeParse('').success).toBe(false);
  });
});

describe('fathomFetchRequestSchema', () => {
  it('accepts valid request', () => {
    const result = fathomFetchRequestSchema.safeParse({
      shareUrl: 'https://fathom.video/share/abc123',
      runId: 'run-001',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing runId', () => {
    const result = fathomFetchRequestSchema.safeParse({
      shareUrl: 'https://fathom.video/share/abc123',
    });
    expect(result.success).toBe(false);
  });
});

describe('salesCallInsightsSchema', () => {
  it('accepts a minimal valid extraction', () => {
    const result = salesCallInsightsSchema.safeParse({
      businessHealthSummary: 'Company growing steadily',
      callType: 'discovery',
      painPoints: [],
      budgetSignals: { priceSensitivity: 'medium', quotes: [] },
      competitorMentions: [],
      buyingTriggers: [],
      objections: [],
      icpSignals: {},
      currentMarketing: { channels: [], quotes: [] },
      goalsAndOutcomes: { quotes: [] },
      notableQuotes: [],
    });
    expect(result.success).toBe(true);
  });

  it('accepts a fully populated extraction', () => {
    const result = salesCallInsightsSchema.safeParse({
      businessHealthSummary: 'Series A SaaS growing 30% YoY',
      callType: 'discovery',
      painPoints: [
        { pain: 'Cannot track ROAS', severity: 'critical', quote: 'We have no idea what works' },
      ],
      budgetSignals: {
        mentionedSpend: '$15K/mo on Google',
        willingnessToPay: 'Flexible if ROI clear',
        priceSensitivity: 'low',
        quotes: ['Budget is flexible if ROI is there'],
      },
      competitorMentions: [
        { name: 'HubSpot Ads', sentiment: 'negative', context: 'Too expensive', quote: 'HubSpot was way too pricey' },
      ],
      buyingTriggers: [
        { trigger: 'Q2 board pressure', urgency: 'immediate', quote: 'Need results by June' },
      ],
      objections: [
        { objection: 'Burned by last agency', resolution: 'Data transparency promise' },
      ],
      icpSignals: {
        companySize: '50-200 employees',
        role: 'VP Marketing',
        industry: 'B2B SaaS',
        decisionProcess: 'Need CEO sign-off',
        decisionTimeline: '2 weeks',
      },
      currentMarketing: {
        channels: ['Google Ads', 'LinkedIn'],
        whatWorks: 'Google branded',
        whatFails: 'LinkedIn lead gen',
        monthlySpend: '$15K',
        quotes: ['Google branded is our only profitable channel'],
      },
      goalsAndOutcomes: {
        primaryGoal: '50 demos per month',
        successMetrics: 'Demo volume and SQL quality',
        desiredTransformation: 'Predictable pipeline',
        quotes: ['We need 50 demos a month minimum'],
      },
      notableQuotes: [
        { quote: 'Our CEO will cancel everything if Q2 numbers miss', context: 'Discussing urgency', relevance: 'High urgency signal for campaign timeline' },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid callType', () => {
    const result = salesCallInsightsSchema.safeParse({
      businessHealthSummary: 'ok',
      callType: 'unknown_type',
      painPoints: [],
      budgetSignals: { priceSensitivity: 'medium', quotes: [] },
      competitorMentions: [],
      buyingTriggers: [],
      objections: [],
      icpSignals: {},
      currentMarketing: { channels: [], quotes: [] },
      goalsAndOutcomes: { quotes: [] },
      notableQuotes: [],
    });
    expect(result.success).toBe(false);
  });
});
