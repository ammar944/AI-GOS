import { describe, expect, it } from 'vitest';
import type { CardState } from '@/lib/workspace/types';
import { buildWorkspaceHydrationPlan } from '../workspace-hydration';

function makeViewCard(): CardState {
  return {
    id: 'industryMarket-prose-card-research-verdict',
    sectionKey: 'industryMarket',
    cardType: 'prose-card',
    label: 'Research Verdict',
    content: {
      text: 'View-generated market card',
    },
    status: 'draft',
    versions: [],
  };
}

function makeCanonicalIndustryResult(): Record<string, unknown> {
  return {
    status: 'complete',
    section: 'industryResearch',
    durationMs: 1200,
    data: {
      categorySnapshot: {
        category: 'AI attribution software',
        marketSize: '$4.2B',
        marketMaturity: 'growing',
        awarenessLevel: 'high',
        buyingBehavior: 'roi_based',
        averageSalesCycle: '45-90 days',
      },
      marketDynamics: {
        demandDrivers: ['Pressure to prove ROI'],
        buyingTriggers: ['Board reporting pressure'],
        barriersToPurchase: ['Attribution skepticism'],
      },
      painPoints: {
        primary: ['Paid spend is hard to attribute'],
      },
      messagingOpportunities: {
        summaryRecommendations: ['Lead with revenue visibility'],
      },
      marketOpportunities: [
        {
          opportunity: 'Proof-led attribution messaging',
          size: 'large',
          timing: 'now',
          difficulty: 'medium',
          evidence: 'Buyers need spend accountability.',
        },
      ],
    },
  };
}

describe('buildWorkspaceHydrationPlan', () => {
  it('prefers Journey run view sections and phases when raw results use canonical keys', () => {
    const viewCard = makeViewCard();
    const plan = buildWorkspaceHydrationPlan({
      view: {
        sections: [
          {
            id: 'industryMarket',
            phase: 'review',
            cards: [viewCard],
          },
          {
            id: 'icpValidation',
            phase: 'researching',
            cards: [],
          },
        ],
      },
      researchResults: {
        industryResearch: makeCanonicalIndustryResult(),
      },
    });

    expect(plan.sections).toEqual([
      {
        section: 'industryMarket',
        phase: 'review',
        cards: [viewCard],
        error: undefined,
      },
      {
        section: 'icpValidation',
        phase: 'researching',
        cards: [],
        error: undefined,
      },
    ]);
  });

  it('falls back to old raw researchResults payloads and normalizes canonical keys', () => {
    const plan = buildWorkspaceHydrationPlan({
      view: null,
      researchResults: {
        industryResearch: makeCanonicalIndustryResult(),
      },
    });

    expect(plan.sections).toHaveLength(1);
    expect(plan.sections[0]?.section).toBe('industryMarket');
    expect(plan.sections[0]?.phase).toBe('review');
    expect(plan.sections[0]?.cards.length).toBeGreaterThan(0);
    expect(plan.sections[0]?.cards.every((card) => card.sectionKey === 'industryMarket')).toBe(true);
  });

  it('preserves persisted card edits after view card hydration', () => {
    const viewCard = makeViewCard();
    const editedContent = {
      text: 'Edited market card from persisted AI change',
    };
    const plan = buildWorkspaceHydrationPlan({
      view: {
        sections: [
          {
            id: 'industryMarket',
            phase: 'review',
            cards: [viewCard],
          },
        ],
      },
      researchResults: {
        industryResearch: {
          ...makeCanonicalIndustryResult(),
          __cardEdits: {
            [viewCard.id]: editedContent,
          },
        },
      },
    });

    expect(plan.cardEdits).toEqual([
      {
        cardId: viewCard.id,
        content: editedContent,
      },
    ]);
  });
});
