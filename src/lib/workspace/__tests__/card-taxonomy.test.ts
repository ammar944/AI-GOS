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
