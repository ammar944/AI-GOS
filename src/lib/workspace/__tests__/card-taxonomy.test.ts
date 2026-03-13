import { describe, it, expect, beforeEach } from 'vitest';
import { parseResearchToCards, resetCardIdCounter } from '../card-taxonomy';

beforeEach(() => {
  resetCardIdCounter();
});

describe('parseResearchToCards — industryMarket', () => {
  const mockData = {
    categorySnapshot: {
      category: 'SaaS',
      marketSize: '$4.2B',
      marketMaturity: 'Growth',
      awarenessLevel: 'High',
      buyingBehavior: 'comparison_shopping',
      averageSalesCycle: '30 days',
    },
    painPoints: { primary: ['Pain 1', 'Pain 2'] },
    marketDynamics: {
      demandDrivers: ['Driver 1'],
      buyingTriggers: ['Trigger 1'],
      barriersToPurchase: ['Barrier 1'],
    },
    trendSignals: [
      { trend: 'AI adoption', direction: 'rising', evidence: 'Strong evidence' },
    ],
    messagingOpportunities: {
      summaryRecommendations: ['Rec 1', 'Rec 2'],
    },
  };

  it('creates correct number of cards', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    expect(cards.length).toBe(7);
  });

  it('creates StatGrid card for categorySnapshot', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    const statCard = cards.find((c) => c.cardType === 'stat-grid');
    expect(statCard).toBeDefined();
    expect(statCard!.label).toBe('Category Snapshot');
    expect(statCard!.content.stats).toHaveLength(6);
  });

  it('creates TrendCard for trendSignals', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    const trendCards = cards.filter((c) => c.cardType === 'trend-card');
    expect(trendCards).toHaveLength(1);
    expect(trendCards[0].content.trend).toBe('AI adoption');
  });

  it('assigns all cards to industryMarket section', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    expect(cards.every((c) => c.sectionKey === 'industryMarket')).toBe(true);
  });

  it('handles empty/missing data gracefully', () => {
    const cards = parseResearchToCards('industryMarket', {});
    expect(cards.length).toBe(0);
  });
});

// -- Competitors ---------------------------------------------------------------

describe('parseResearchToCards — competitors', () => {
  const mockData = {
    competitors: [
      {
        name: 'Acme Corp',
        website: 'https://acme.com',
        positioning: 'Enterprise focus',
        price: '$99/mo',
        pricingConfidence: 'high',
        strengths: ['Strong brand'],
        weaknesses: ['Slow support'],
        opportunities: ['SMB gap'],
        ourAdvantage: 'Better UX',
        adActivity: {
          activeAdCount: 12,
          platforms: ['Meta', 'Google'],
          themes: ['Productivity'],
          evidence: 'Observed via Meta Library',
          sourceConfidence: 'high',
        },
        adCreatives: [
          {
            platform: 'meta',
            id: 'cr-001',
            advertiser: 'Acme Corp',
            headline: 'Try Acme Free',
            body: 'Best tool for teams',
            imageUrl: 'https://example.com/img.png',
            videoUrl: null,
            format: 'image',
            isActive: true,
            detailsUrl: 'https://meta.com/ad/001',
            firstSeen: '2026-01-01',
            lastSeen: '2026-03-01',
          },
        ],
        libraryLinks: {
          metaLibraryUrl: 'https://meta.com/library/acme',
          linkedInLibraryUrl: 'https://linkedin.com/ads/acme',
          googleAdvertiserUrl: 'https://google.com/ads/acme',
        },
        threatAssessment: {
          topAdHooks: ['Free trial hook', 'ROI hook'],
          counterPositioning: 'Emphasize speed advantage',
        },
      },
    ],
    marketPatterns: ['Price war trend'],
    whiteSpaceGaps: [
      {
        gap: 'SMB self-serve',
        type: 'product',
        evidence: 'No competitor offers self-serve',
        exploitability: 8,
        impact: 7,
        recommendedAction: 'Launch self-serve tier',
      },
    ],
  };

  it('creates correct number of cards (1 competitor + 1 market patterns + 1 gap)', () => {
    const cards = parseResearchToCards('competitors', mockData);
    expect(cards.length).toBe(3);
  });

  it('creates competitor-card with all ad data preserved', () => {
    const cards = parseResearchToCards('competitors', mockData);
    const compCard = cards.find((c) => c.cardType === 'competitor-card');
    expect(compCard).toBeDefined();
    expect(compCard!.content.name).toBe('Acme Corp');

    // adCreatives preserved with all 12 fields
    const creatives = compCard!.content.adCreatives as Array<Record<string, unknown>>;
    expect(creatives).toHaveLength(1);
    expect(creatives[0].platform).toBe('meta');
    expect(creatives[0].id).toBe('cr-001');
    expect(creatives[0].advertiser).toBe('Acme Corp');
    expect(creatives[0].headline).toBe('Try Acme Free');
    expect(creatives[0].body).toBe('Best tool for teams');
    expect(creatives[0].imageUrl).toBe('https://example.com/img.png');
    expect(creatives[0].format).toBe('image');
    expect(creatives[0].isActive).toBe(true);
    expect(creatives[0].detailsUrl).toBe('https://meta.com/ad/001');
    expect(creatives[0].firstSeen).toBe('2026-01-01');
    expect(creatives[0].lastSeen).toBe('2026-03-01');

    // libraryLinks preserved with all 3 URLs
    const links = compCard!.content.libraryLinks as Record<string, unknown>;
    expect(links.metaLibraryUrl).toBe('https://meta.com/library/acme');
    expect(links.linkedInLibraryUrl).toBe('https://linkedin.com/ads/acme');
    expect(links.googleAdvertiserUrl).toBe('https://google.com/ads/acme');

    // threatAssessment extracted correctly
    expect(compCard!.content.topAdHooks).toEqual(['Free trial hook', 'ROI hook']);
    expect(compCard!.content.counterPositioning).toBe('Emphasize speed advantage');
  });

  it('creates gap-card with scores', () => {
    const cards = parseResearchToCards('competitors', mockData);
    const gapCard = cards.find((c) => c.cardType === 'gap-card');
    expect(gapCard).toBeDefined();
    expect(gapCard!.content.gap).toBe('SMB self-serve');
    expect(gapCard!.content.exploitability).toBe(8);
    expect(gapCard!.content.impact).toBe(7);
  });

  it('assigns all cards to competitors section', () => {
    const cards = parseResearchToCards('competitors', mockData);
    expect(cards.every((c) => c.sectionKey === 'competitors')).toBe(true);
  });

  it('handles empty data', () => {
    const cards = parseResearchToCards('competitors', {});
    expect(cards.length).toBe(0);
  });
});

// -- ICP Validation ------------------------------------------------------------

describe('parseResearchToCards — icpValidation', () => {
  const mockData = {
    validatedPersona: 'SaaS Founder',
    audienceSize: '50K',
    confidenceScore: 85,
    demographics: '25-45, US-based',
    decisionProcess: 'Self-serve research then demo',
    channels: ['Google Search', 'LinkedIn'],
    triggers: ['Funding round', 'Scaling pain'],
    objections: ['Price too high', 'Switching cost'],
    finalVerdict: {
      status: 'validated',
      reasoning: 'Strong product-market fit signals',
      recommendations: ['Double down on LinkedIn', 'Create case studies'],
    },
  };

  it('creates correct number of cards', () => {
    const cards = parseResearchToCards('icpValidation', mockData);
    // stat-grid + verdict + prose + 3 bullet-lists + 1 check-list = 7
    expect(cards.length).toBe(7);
  });

  it('creates verdict-card with status and reasoning', () => {
    const cards = parseResearchToCards('icpValidation', mockData);
    const verdict = cards.find((c) => c.cardType === 'verdict-card');
    expect(verdict).toBeDefined();
    expect(verdict!.content.status).toBe('validated');
    expect(verdict!.content.reasoning).toBe('Strong product-market fit signals');
  });

  it('creates stat-grid with persona stats', () => {
    const cards = parseResearchToCards('icpValidation', mockData);
    const statCard = cards.find((c) => c.cardType === 'stat-grid');
    expect(statCard).toBeDefined();
    expect(statCard!.content.stats).toHaveLength(4);
  });

  it('handles empty data', () => {
    const cards = parseResearchToCards('icpValidation', {});
    expect(cards.length).toBe(0);
  });
});

// -- Offer Analysis ------------------------------------------------------------

describe('parseResearchToCards — offerAnalysis', () => {
  const mockData = {
    offerStrength: { overallScore: 7 },
    recommendation: {
      status: 'ready_to_scale',
      summary: 'Offer is competitive with minor adjustments needed',
      topStrengths: ['Unique value prop'],
      priorityFixes: ['Improve onboarding'],
      recommendedActionPlan: ['Add social proof'],
    },
    pricingAnalysis: {
      currentPricing: '$49/mo',
      marketBenchmark: '$59/mo',
      pricingPosition: 'Below market',
      coldTrafficViability: 'Good for cold traffic with free trial',
    },
    messagingRecommendations: ['Lead with ROI'],
    marketFitAssessment: 'Strong fit for SMB segment',
    redFlags: [
      {
        issue: 'No social proof',
        severity: 'high',
        priority: 1,
        evidence: 'Landing page lacks testimonials',
        recommendedAction: 'Add 3 case studies',
      },
    ],
  };

  it('creates correct number of cards', () => {
    const cards = parseResearchToCards('offerAnalysis', mockData);
    // stat-grid + prose(rationale) + pricing + 4 bullet-lists + prose(market fit) + 1 flag = 9
    expect(cards.length).toBe(9);
  });

  it('creates pricing-card with all fields', () => {
    const cards = parseResearchToCards('offerAnalysis', mockData);
    const pricing = cards.find((c) => c.cardType === 'pricing-card');
    expect(pricing).toBeDefined();
    expect(pricing!.content.currentPricing).toBe('$49/mo');
    expect(pricing!.content.coldTrafficViability).toBe('Good for cold traffic with free trial');
  });

  it('creates flag-card for red flags', () => {
    const cards = parseResearchToCards('offerAnalysis', mockData);
    const flag = cards.find((c) => c.cardType === 'flag-card');
    expect(flag).toBeDefined();
    expect(flag!.content.issue).toBe('No social proof');
    expect(flag!.content.severity).toBe('high');
    expect(flag!.content.priority).toBe(1);
  });

  it('handles empty data', () => {
    const cards = parseResearchToCards('offerAnalysis', {});
    expect(cards.length).toBe(0);
  });
});

// -- Keyword Intel -------------------------------------------------------------

describe('parseResearchToCards — keywordIntel', () => {
  it('creates a single keyword-grid card with raw data', () => {
    const cards = parseResearchToCards('keywordIntel', { someField: 'value' });
    expect(cards.length).toBe(1);
    expect(cards[0].cardType).toBe('keyword-grid');
    expect(cards[0].content.rawData).toEqual({ someField: 'value' });
  });

  it('returns empty for empty data', () => {
    const cards = parseResearchToCards('keywordIntel', {});
    expect(cards.length).toBe(0);
  });
});

// -- Cross Analysis ------------------------------------------------------------

describe('parseResearchToCards — crossAnalysis', () => {
  const mockData = {
    positioningStrategy: {
      recommendedAngle: 'Speed-first positioning',
      leadRecommendation: 'Lead with time-to-value messaging',
      keyDifferentiator: '10x faster setup',
    },
    planningContext: {
      monthlyBudget: '$5,000',
      targetCpl: '$25',
      targetCac: '$150',
      downstreamSequence: ['Awareness', 'Consideration', 'Conversion'],
    },
    charts: [
      { title: 'Budget Split', description: 'Monthly allocation', imageUrl: 'https://example.com/chart.png' },
    ],
    strategicNarrative: 'The market is ripe for a speed-focused challenger.',
    keyInsights: [
      { insight: 'Competitors are slow to onboard', source: 'competitor analysis', implication: 'Speed is our wedge' },
    ],
    platformRecommendations: [
      { platform: 'Google Ads', role: 'primary', budgetAllocation: '60%', rationale: 'High intent traffic' },
    ],
    messagingAngles: [
      { angle: 'Speed Angle', exampleHook: 'Set up in 5 minutes', evidence: 'Competitor avg is 2 hours' },
    ],
    criticalSuccessFactors: ['Fast landing page', 'Strong CTA'],
    nextSteps: ['Launch Google campaign', 'A/B test headlines'],
  };

  it('creates correct number of cards', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    // strategy + stat-grid + bullet(downstream) + chart + prose(narrative) + insight + platform + angle + 2 check-lists = 10
    expect(cards.length).toBe(10);
  });

  it('creates strategy-card with positioning', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const strategy = cards.find((c) => c.cardType === 'strategy-card');
    expect(strategy).toBeDefined();
    expect(strategy!.content.recommendedAngle).toBe('Speed-first positioning');
    expect(strategy!.content.keyDifferentiator).toBe('10x faster setup');
  });

  it('creates insight-card with source', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const insight = cards.find((c) => c.cardType === 'insight-card');
    expect(insight).toBeDefined();
    expect(insight!.content.source).toBe('competitor analysis');
  });

  it('creates platform-card with budget allocation', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const platform = cards.find((c) => c.cardType === 'platform-card');
    expect(platform).toBeDefined();
    expect(platform!.content.budgetAllocation).toBe('60%');
  });

  it('creates angle-card with hook', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const angle = cards.find((c) => c.cardType === 'angle-card');
    expect(angle).toBeDefined();
    expect(angle!.content.exampleHook).toBe('Set up in 5 minutes');
  });

  it('creates chart-card with image', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const chart = cards.find((c) => c.cardType === 'chart-card');
    expect(chart).toBeDefined();
    expect(chart!.content.imageUrl).toBe('https://example.com/chart.png');
  });

  it('handles empty data', () => {
    const cards = parseResearchToCards('crossAnalysis', {});
    expect(cards.length).toBe(0);
  });
});
