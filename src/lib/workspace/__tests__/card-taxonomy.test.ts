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
    // stat-grid + bullet(pain) + bullet(dynamics) + trend-card + check-list(messaging)
    expect(cards.length).toBe(5);
  });

  it('creates StatGrid card for categorySnapshot with definition layout', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    const statCard = cards.find((c) => c.cardType === 'stat-grid');
    expect(statCard).toBeDefined();
    expect(statCard!.label).toBe('Category Snapshot');
    expect(statCard!.content.stats).toHaveLength(6);
    expect(statCard!.content.layout).toBe('definition');
  });

  it('creates TrendCard for trendSignals', () => {
    const cards = parseResearchToCards('industryMarket', mockData);
    const trendCards = cards.filter((c) => c.cardType === 'trend-card');
    expect(trendCards).toHaveLength(1);
    // trends are now consolidated into a single card with a trends array
    const trends = trendCards[0].content.trends as Array<{ trend: string }>;
    expect(trends).toHaveLength(1);
    expect(trends[0].trend).toBe('AI adoption');
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

  it('creates correct number of cards (1 competitor + 1 gap)', () => {
    const cards = parseResearchToCards('competitors', mockData);
    // competitor-card + gap-card (marketPatterns string array no longer emits a card)
    expect(cards.length).toBe(2);
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
    // gaps are consolidated into a single card with a gaps array
    const gaps = gapCard!.content.gaps as Array<{ gap: string; exploitability: number; impact: number }>;
    expect(gaps).toHaveLength(1);
    expect(gaps[0].gap).toBe('SMB self-serve');
    expect(gaps[0].exploitability).toBe(8);
    expect(gaps[0].impact).toBe(7);
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
    // persona prose + demographics prose + icp-metrics + verdict + decision prose + 3 bullet-lists + 1 check-list = 9
    expect(cards.length).toBe(9);
  });

  it('creates verdict-card with status and reasoning', () => {
    const cards = parseResearchToCards('icpValidation', mockData);
    const verdict = cards.find((c) => c.cardType === 'verdict-card');
    expect(verdict).toBeDefined();
    expect(verdict!.content.status).toBe('validated');
    expect(verdict!.content.reasoning).toBe('Strong product-market fit signals');
  });

  it('creates icp-metrics and splits persona into prose cards', () => {
    const cards = parseResearchToCards('icpValidation', mockData);
    expect(cards.find((c) => c.cardType === 'stat-grid')).toBeUndefined();
    const metrics = cards.find((c) => c.cardType === 'icp-metrics');
    expect(metrics).toBeDefined();
    expect(metrics!.content.audienceSize).toBe('50K');
    expect(metrics!.content.confidenceScore).toBe(85);
    const persona = cards.find((c) => c.cardType === 'prose-card' && c.label === 'Validated Persona');
    expect(persona?.content.text).toBe('SaaS Founder');
    const demo = cards.find((c) => c.cardType === 'prose-card' && c.label === 'Demographics');
    expect(demo?.content.text).toBe('25-45, US-based');
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
    // stat-grid + prose(rationale) + pricing + 3 bullet-lists(strengths/weaknesses/actions) + flag-card = 7
    // (marketFitAssessment is not a handled field; messagingRecommendations has no card emitter)
    expect(cards.length).toBe(7);
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
    // flags are consolidated into a single card with a flags array
    const flags = flag!.content.flags as Array<{ issue: string; severity: string; priority: number }>;
    expect(flags).toHaveLength(1);
    expect(flags[0].issue).toBe('No social proof');
    expect(flags[0].severity).toBe('high');
    expect(flags[0].priority).toBe(1);
  });

  it('handles empty data', () => {
    const cards = parseResearchToCards('offerAnalysis', {});
    expect(cards.length).toBe(0);
  });
});

// -- Keyword Intel -------------------------------------------------------------

describe('parseResearchToCards — keywordIntel', () => {
  it('returns empty for unrecognised fields (no campaignGroups or topOpportunities)', () => {
    // keyword-grid is now derived from campaignGroups/topOpportunities, not raw passthrough
    const cards = parseResearchToCards('keywordIntel', { someField: 'value' });
    expect(cards.length).toBe(0);
  });

  it('returns empty for empty data', () => {
    const cards = parseResearchToCards('keywordIntel', {});
    expect(cards.length).toBe(0);
  });

  it('creates keyword-grid card from topOpportunities', () => {
    const mockData = {
      topOpportunities: [
        { keyword: 'crm software', searchVolume: 5000, difficulty: 'medium', cpc: '$3.50', priorityScore: 80 },
        { keyword: 'sales automation', searchVolume: 3000, difficulty: 'high', cpc: '$5.00', priorityScore: 70 },
      ],
    };
    const cards = parseResearchToCards('keywordIntel', mockData);
    const kwGrid = cards.find((c) => c.cardType === 'keyword-grid');
    expect(kwGrid).toBeDefined();
    const keywords = kwGrid!.content.keywords as Array<{ keyword: string }>;
    expect(keywords.length).toBeGreaterThan(0);
    expect(keywords[0].keyword).toBe('crm software');
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
    // strategy-card + stat-grid(planning) + chart-card + insight-card + angle-card + check-list(successFactors) + strategic-narrative = 7
    // platform-card and nextSteps check-list removed in sprint overhaul
    // strategic-narrative card added in Phase 6.2.4 (renders strategicNarrative prose when length >= 10)
    // downstreamSequence bullet removed (planningContext only emits stat-grid)
    expect(cards.length).toBe(7);
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
    // insights are consolidated into a single card with an insights array
    const insights = insight!.content.insights as Array<{ insight: string; source: string }>;
    expect(insights).toHaveLength(1);
    expect(insights[0].source).toBe('competitor analysis');
  });

  it('does not emit platform-card (removed in sprint overhaul)', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const platform = cards.find((c) => c.cardType === 'platform-card');
    expect(platform).toBeUndefined();
  });

  it('creates angle-card with hook', () => {
    const cards = parseResearchToCards('crossAnalysis', mockData);
    const angle = cards.find((c) => c.cardType === 'angle-card');
    expect(angle).toBeDefined();
    // angles are consolidated into a single card with an angles array
    const angles = angle!.content.angles as Array<{ angle: string; exampleHook: string }>;
    expect(angles).toHaveLength(1);
    expect(angles[0].exampleHook).toBe('Set up in 5 minutes');
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

// -- Media Plan ----------------------------------------------------------------

describe('parseResearchToCards — mediaPlan charts', () => {
  it('creates pie-chart from channelMixBudget platforms', () => {
    const mockData = {
      channelMixBudget: {
        platforms: [
          { name: 'Google Search', percentage: 45 },
          { name: 'LinkedIn', percentage: 30 },
          { name: 'Meta', percentage: 25 },
        ],
      },
    };

    const cards = parseResearchToCards('mediaPlan', mockData);
    const pieChart = cards.find((c) => c.cardType === 'pie-chart');

    expect(pieChart).toBeDefined();
    expect(pieChart!.sectionKey).toBe('mediaPlan');
    expect(pieChart!.content.platforms).toHaveLength(3);
  });

  it('creates funnel-split-chart from budgetSummary', () => {
    const mockData = {
      channelMixBudget: {
        budgetSummary: {
          funnelSplit: { awareness: 30, consideration: 45, conversion: 25 },
        },
      },
    };

    const cards = parseResearchToCards('mediaPlan', mockData);
    const funnelChart = cards.find((c) => c.cardType === 'funnel-split-chart');

    expect(funnelChart).toBeDefined();
    expect(funnelChart!.content.funnelSplit).toEqual({ awareness: 30, consideration: 45, conversion: 25 });
  });

  it('creates cac-funnel-chart from measurementGuardrails', () => {
    const mockData = {
      measurementGuardrails: {
        cacModel: {
          expectedLeadsPerMonth: 100,
          expectedSQLsPerMonth: 15,
          expectedCustomersPerMonth: 4,
        },
      },
    };

    const cards = parseResearchToCards('mediaPlan', mockData);
    const cacChart = cards.find((c) => c.cardType === 'cac-funnel-chart');

    expect(cacChart).toBeDefined();
    expect(cacChart!.content.cacModel).toEqual({
      expectedLeadsPerMonth: 100,
      expectedSQLsPerMonth: 15,
      expectedCustomersPerMonth: 4,
    });
  });

  it('handles empty block data without chart cards', () => {
    const mockData = {
      channelMixBudget: { platforms: [] },
      completedBlocks: ['channelMixBudget'],
    };

    const cards = parseResearchToCards('mediaPlan', mockData);
    const chartCards = cards.filter((c) => c.cardType.includes('chart'));

    expect(chartCards).toHaveLength(0);
  });

  it('handles missing charts key without error', () => {
    const cards = parseResearchToCards('mediaPlan', {});
    expect(cards).toHaveLength(0);
  });
});
