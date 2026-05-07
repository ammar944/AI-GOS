import { describe, expect, it } from 'vitest';
import type { CardState, SectionKey, SectionPhase } from '@/lib/workspace/types';
import { buildWorkspaceHydrationPlan } from '../workspace-hydration';

const REVIEW_RESEARCH_SECTIONS: SectionKey[] = [
  'industryMarket',
  'icpValidation',
  'competitors',
  'offerAnalysis',
  'keywordIntel',
  'crossAnalysis',
];

function makeViewCard(section: SectionKey = 'industryMarket'): CardState {
  return {
    id: `${section}-prose-card-research-verdict`,
    sectionKey: section,
    cardType: 'prose-card',
    label: 'Research Verdict',
    content: {
      text: `View-generated ${section} card`,
    },
    status: 'draft',
    versions: [],
  };
}

function makeDeepResearchResult(section: SectionKey): Record<string, unknown> {
  return {
    status: 'complete',
    section,
    durationMs: 1200,
    data: {
      source: 'deepResearchProgram',
      sectionTitle: section,
      verdict: `${section} is ready for review.`,
      statusSummary: `${section} research is complete.`,
      confidence: 82,
    },
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

  it('gates six completed view sections to one review section at a time', () => {
    const plan = buildWorkspaceHydrationPlan({
      view: {
        sections: REVIEW_RESEARCH_SECTIONS.map((section) => ({
          id: section,
          phase: 'review',
          cards: [makeViewCard(section)],
        })),
      },
      researchResults: null,
    });

    const phasesBySection = Object.fromEntries(
      plan.sections.map((section) => [section.section, section.phase]),
    ) as Partial<Record<SectionKey, SectionPhase>>;

    expect(phasesBySection.industryMarket).toBe('review');
    expect(phasesBySection.icpValidation).toBe('queued');
    expect(phasesBySection.competitors).toBe('queued');
    expect(phasesBySection.offerAnalysis).toBe('queued');
    expect(phasesBySection.keywordIntel).toBe('queued');
    expect(phasesBySection.crossAnalysis).toBe('queued');
    expect(
      plan.sections.filter((section) => section.phase === 'review'),
    ).toHaveLength(1);
    expect(plan.sections.every((section) => section.cards.length > 0)).toBe(true);
  });

  it('preserves an approved market section and reveals ICP next', () => {
    const plan = buildWorkspaceHydrationPlan({
      view: {
        sections: REVIEW_RESEARCH_SECTIONS.map((section) => ({
          id: section,
          phase: section === 'industryMarket' ? 'approved' : 'review',
          cards: [makeViewCard(section)],
        })),
      },
      researchResults: null,
    });

    const phasesBySection = Object.fromEntries(
      plan.sections.map((section) => [section.section, section.phase]),
    ) as Partial<Record<SectionKey, SectionPhase>>;

    expect(phasesBySection.industryMarket).toBe('approved');
    expect(phasesBySection.icpValidation).toBe('review');
    expect(phasesBySection.competitors).toBe('queued');
    expect(phasesBySection.offerAnalysis).toBe('queued');
    expect(phasesBySection.keywordIntel).toBe('queued');
    expect(phasesBySection.crossAnalysis).toBe('queued');
  });

  it('gates fallback raw research results to one review section at a time', () => {
    const plan = buildWorkspaceHydrationPlan({
      view: null,
      researchResults: Object.fromEntries(
        REVIEW_RESEARCH_SECTIONS.map((section) => [
          section,
          makeDeepResearchResult(section),
        ]),
      ),
    });

    const phasesBySection = Object.fromEntries(
      plan.sections.map((section) => [section.section, section.phase]),
    ) as Partial<Record<SectionKey, SectionPhase>>;

    expect(phasesBySection.industryMarket).toBe('review');
    expect(phasesBySection.icpValidation).toBe('queued');
    expect(phasesBySection.competitors).toBe('queued');
    expect(phasesBySection.offerAnalysis).toBe('queued');
    expect(phasesBySection.keywordIntel).toBe('queued');
    expect(phasesBySection.crossAnalysis).toBe('queued');
    expect(
      plan.sections.filter((section) => section.phase === 'review'),
    ).toHaveLength(1);
  });
});
