import { describe, it, expect } from 'vitest';
import { buildSubsectionCards } from '../build-subsection-cards';

describe('buildSubsectionCards', () => {
  it('returns empty array for unknown section', () => {
    expect(buildSubsectionCards('unknown', {})).toHaveLength(0);
  });

  it('returns empty array when required data is missing (preamble fallback)', () => {
    const cards = buildSubsectionCards('industryMarket', { summary: "I'll research this market..." });
    expect(cards).toHaveLength(0);
  });

  it('returns verdict + list cards for valid industry data', () => {
    const data = {
      categorySnapshot: {
        category: 'Supply Chain Tech',
        marketMaturity: 'Growing',
        averageSalesCycle: '3-6 months',
      },
      painPoints: {
        primary: ['Pain 1', 'Pain 2', 'Pain 3'],
        triggers: ['Trigger 1'],
      },
      messagingOpportunities: { angles: ['Angle 1'] },
    };
    const cards = buildSubsectionCards('industryMarket', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[1].type).toBe('list');
    expect(cards[1].props.title).toBe('Top Pain Points');
    expect(cards[1].props.items).toHaveLength(3);
  });

  it('builds one competitor card per competitor', () => {
    const data = {
      competitors: [
        { name: 'Cogsy', positioning: 'Smart inventory', weaknesses: ['Accuracy issues'], threatAssessment: { counterPositioning: 'Lead 94%' } },
        { name: 'Inventory Planner', positioning: 'Shopify native', weaknesses: ['No ML'] },
      ],
      whiteSpaceGaps: [{ gap: 'ML prediction' }],
    };
    const cards = buildSubsectionCards('competitors', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[1].type).toBe('competitor');
    expect(cards[1].props.name).toBe('Cogsy');
    expect(cards[2].type).toBe('competitor');
    expect(cards[2].props.name).toBe('Inventory Planner');
  });

  it('builds stat card for ICP fit score', () => {
    const data = {
      finalVerdict: { status: 'Validated', summary: 'Good fit for mid-market DTC' },
      painSolutionFit: { fitScore: 8.5, primaryPain: 'Stockouts' },
    };
    const cards = buildSubsectionCards('icpValidation', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[0].props.status).toBe('Validated');
    expect(cards[1].type).toBe('stat');
    expect(cards[1].props.value).toBe(8.5);
  });

  it('builds budget bar card for synthesis with valid platform allocations', () => {
    const data = {
      positioningStrategy: { recommendedAngle: 'Lead with 94% accuracy' },
      platformRecommendations: [
        { platform: 'LinkedIn', budgetAllocation: '55% ($8,250)' },
        { platform: 'Google', budgetAllocation: '25% ($3,750)' },
      ],
      messagingAngles: [{ exampleHook: 'Still in spreadsheets?' }],
      nextSteps: ['Step 1', 'Step 2'],
    };
    const cards = buildSubsectionCards('crossAnalysis', data);
    expect(cards[0].type).toBe('quote');
    expect(cards[1].type).toBe('budgetBar');
    expect(cards[1].props.allocations).toHaveLength(2);
    expect(cards[1].props.allocations[0].percentage).toBe(55);
    expect(cards[1].props.allocations[0].amount).toBe('$8,250');
  });

  it('builds summary cards for media plan output', () => {
    const data = {
      dataSourced: { note: 'Benchmarks used because live connectors were unavailable.' },
      channelPlan: [
        { platform: 'Google', monthlyBudget: 6000, budgetPercentage: 60 },
        { platform: 'LinkedIn', monthlyBudget: 4000, budgetPercentage: 40 },
      ],
      launchSequence: [
        { week: 1, actions: ['Launch brand + competitor search'], milestone: 'Initial launch' },
      ],
      kpiFramework: {
        northStar: 'Qualified pipeline per month',
        weeklyReview: ['Check CPL by platform', 'Review search term waste'],
      },
      budgetSummary: {
        totalMonthly: 10000,
        byPlatform: [
          { platform: 'Google', amount: 6000, percentage: 60 },
          { platform: 'LinkedIn', amount: 4000, percentage: 40 },
        ],
      },
    };
    const cards = buildSubsectionCards('mediaPlan', data);
    expect(cards[0].type).toBe('verdict');
    expect(cards[0].props.summary).toContain('Benchmarks used');
    expect(cards[1].type).toBe('budgetBar');
    expect(cards[1].props.totalBudget).toBe('$10,000');
    expect(cards[2].type).toBe('quote');
    expect(cards[3].type).toBe('list');
    expect(cards[3].props.title).toBe('Launch Sequence');
  });
});
