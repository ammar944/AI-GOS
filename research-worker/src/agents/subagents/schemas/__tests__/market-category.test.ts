import { describe, expect, it } from 'vitest';

import {
  MarketCategoryArtifactSchema,
  validateMarketCategoryMinimums,
  type MarketCategoryArtifact,
} from '../market-category';

const MARKET_CATEGORY_FIXTURE: MarketCategoryArtifact = {
  sectionTitle: 'Market & Category Intelligence',
  verdict:
    'The category is growing but still buyer-education heavy, with workflow consolidation as the strongest wedge.',
  statusSummary:
    'The market sits between meeting productivity, collaboration, and revenue operations tooling. Public demand signals point to growth, but adjacent-category confusion means positioning has to define the workflow problem before claiming a broad platform category.',
  confidence: 8,
  sources: [
    {
      title: 'Fellow product overview',
      url: 'https://fellow.app',
      whyItMatters: 'Primary source for the product category and workflow scope.',
    },
    {
      title: 'G2 meeting management category',
      url: 'https://www.g2.com/categories/meeting-management',
      whyItMatters: 'Public category evidence for meeting management software.',
    },
    {
      title: 'LinkedIn hiring search',
      url: 'https://www.linkedin.com/jobs',
      whyItMatters: 'Hiring velocity proxy for collaboration and RevOps workflow demand.',
    },
  ],
  categoryDefinition: {
    prose:
      'Buyers would most likely understand this as meeting management software with collaboration and revenue-operating-system overlap. The practical category definition should anchor on recurring meeting workflows, decisions, and follow-through rather than a generic productivity claim.',
    adjacentCategories: [
      {
        name: 'AI meeting assistants',
        whyBuyersConfuseIt:
          'Both categories touch notes, agendas, summaries, and follow-up from meetings.',
        disambiguatingSignal:
          'AI meeting assistants emphasize capture and transcription; this category emphasizes recurring workflow control before and after the meeting.',
        sourceTitle: 'G2 AI meeting assistants category',
        sourceUrl: 'https://www.g2.com/categories/ai-meeting-assistants',
      },
      {
        name: 'Project management software',
        whyBuyersConfuseIt:
          'Meeting actions and project tasks often land in the same collaboration stack.',
        disambiguatingSignal:
          'Project management tools organize work after decisions; meeting management organizes agenda, decision, and accountability rituals.',
        sourceTitle: 'G2 project management category',
        sourceUrl: 'https://www.g2.com/categories/project-management',
      },
    ],
  },
  marketSize: {
    prose:
      'Market sizing is best treated as a directional triangulation rather than a single TAM number. Public category pages, funding activity, hiring velocity, and search-language trends all point to a durable workflow market, but precise spend is fragmented across collaboration, productivity, and revenue operations budgets.',
    signals: [
      {
        signalType: 'public-data',
        name: 'Meeting management category presence',
        evidence:
          'Public review sites maintain a dedicated meeting management category with multiple vendors and buyer comparisons.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'G2 meeting management category',
        sourceUrl: 'https://www.g2.com/categories/meeting-management',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'funding-flow',
        name: 'Collaboration tooling funding',
        evidence:
          'Funding and launch activity around collaboration and AI meeting tooling suggests the budget is still attracting new entrants.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'Crunchbase collaboration software search',
        sourceUrl: 'https://www.crunchbase.com',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'hiring-velocity',
        name: 'RevOps and collaboration operations hiring',
        evidence:
          'Job postings for revenue operations and workplace collaboration roles mention meeting cadence, CRM hygiene, and operating rhythms.',
        trajectory: 'stable',
        methodology: 'bottom-up',
        sourceTitle: 'LinkedIn Jobs',
        sourceUrl: 'https://www.linkedin.com/jobs',
        dateObserved: '2026-05-15',
      },
    ],
  },
  structuralForces: {
    prose:
      'The market is being pulled by AI platform shifts, governance pressure around meeting records, and buyer fatigue with scattered collaboration workflows. These forces support demand but also raise the bar for trust, integrations, and category clarity.',
    forces: [
      {
        forceType: 'regulation',
        name: 'Meeting-record governance',
        evidence:
          'Companies increasingly need retention, permissioning, and auditability around meeting notes and action records.',
        implication:
          'Positioning should avoid casual note-taking language when enterprise buyers need governed workflow records.',
        impact: 'medium',
        direction: 'neutral',
        sourceTitle: 'Zoom security and compliance',
        sourceUrl: 'https://www.zoom.com/en/trust/',
      },
      {
        forceType: 'platform-shift',
        name: 'AI-native collaboration assistants',
        evidence:
          'Major collaboration platforms now bundle AI summaries, transcripts, and follow-up suggestions into meetings.',
        implication:
          'A standalone entrant needs to differentiate on workflow depth, cross-tool rituals, or vertical operating context.',
        impact: 'high',
        direction: 'decelerating',
        sourceTitle: 'Microsoft Teams AI features',
        sourceUrl: 'https://www.microsoft.com/en-us/microsoft-teams',
      },
      {
        forceType: 'buyer-behavior',
        name: 'Operating-cadence consolidation',
        evidence:
          'Revenue and operations leaders increasingly want fewer disconnected tools and more repeatable operating cadences.',
        implication:
          'Messaging should focus on the repeated team ritual and downstream accountability, not generic productivity.',
        impact: 'high',
        direction: 'accelerating',
        sourceTitle: 'Fellow use cases',
        sourceUrl: 'https://fellow.app/use-cases/',
      },
    ],
  },
  categoryMaturity: {
    prose:
      'The category is growing rather than fully mature. Buyers recognize the meeting productivity problem, review sites show named vendor clusters, and AI platform bundling is increasing competitive pressure before the space has fully consolidated.',
    classification: {
      stage: 'growing',
      evidenceSummary:
        'There are enough named vendors and public buyer comparisons to prove category awareness, but platform bundling and uneven terminology show the category is not fully settled.',
      supportingSignals: [
        {
          signalType: 'player-count',
          evidence:
            'Dedicated public category pages list multiple meeting management vendors.',
          implication: 'The market has visible alternatives and buyer education already exists.',
          sourceUrl: 'https://www.g2.com/categories/meeting-management',
        },
        {
          signalType: 'buyer-education',
          evidence:
            'Search and review language still mixes meeting management, AI assistant, collaboration, and project-management framing.',
          implication:
            'The entrant still has to teach the category boundary in paid and owned messaging.',
          sourceUrl: 'https://www.g2.com/categories/ai-meeting-assistants',
        },
      ],
    },
  },
};

describe('MarketCategoryArtifactSchema', () => {
  it('accepts a full fixture with the four canonical Section 01 sub-sections populated', () => {
    const result = MarketCategoryArtifactSchema.safeParse(MARKET_CATEGORY_FIXTURE);
    expect(result.success).toBe(true);
  });

  it('rejects when categoryDefinition.adjacentCategories is missing', () => {
    const result = MarketCategoryArtifactSchema.safeParse({
      ...MARKET_CATEGORY_FIXTURE,
      categoryDefinition: {
        prose: MARKET_CATEGORY_FIXTURE.categoryDefinition.prose,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum category maturity stage', () => {
    const result = MarketCategoryArtifactSchema.safeParse({
      ...MARKET_CATEGORY_FIXTURE,
      categoryMaturity: {
        ...MARKET_CATEGORY_FIXTURE.categoryMaturity,
        classification: {
          ...MARKET_CATEGORY_FIXTURE.categoryMaturity.classification,
          stage: 'declining',
        },
      },
    });
    expect(result.success).toBe(false);
  });

  it('passes validateMarketCategoryMinimums on the full fixture', () => {
    expect(validateMarketCategoryMinimums(MARKET_CATEGORY_FIXTURE)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('fails validateMarketCategoryMinimums when adjacent categories are thin', () => {
    const artifact: MarketCategoryArtifact = {
      ...MARKET_CATEGORY_FIXTURE,
      categoryDefinition: {
        ...MARKET_CATEGORY_FIXTURE.categoryDefinition,
        adjacentCategories:
          MARKET_CATEGORY_FIXTURE.categoryDefinition.adjacentCategories.slice(0, 1),
      },
    };

    const result = validateMarketCategoryMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'adjacentCategories: have 1, need >=2 categories buyers confuse this with.',
    );
  });

  it('fails validateMarketCategoryMinimums when structural forces omit a required force type', () => {
    const artifact: MarketCategoryArtifact = {
      ...MARKET_CATEGORY_FIXTURE,
      structuralForces: {
        ...MARKET_CATEGORY_FIXTURE.structuralForces,
        forces: MARKET_CATEGORY_FIXTURE.structuralForces.forces.filter(
          (force) => force.forceType !== 'regulation',
        ),
      },
    };

    const result = validateMarketCategoryMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'structuralForces: missing force types regulation.',
    );
  });

  it('fails validateMarketCategoryMinimums when confidence is outside 0-10', () => {
    const artifact: MarketCategoryArtifact = {
      ...MARKET_CATEGORY_FIXTURE,
      confidence: 12,
    };

    const result = validateMarketCategoryMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('confidence: expected 0-10, got 12.');
  });

  it('fails validateMarketCategoryMinimums when only top-down market signals are present', () => {
    const artifact: MarketCategoryArtifact = {
      ...MARKET_CATEGORY_FIXTURE,
      marketSize: {
        ...MARKET_CATEGORY_FIXTURE.marketSize,
        signals: MARKET_CATEGORY_FIXTURE.marketSize.signals.map((signal) => ({
          ...signal,
          methodology: 'top-down' as const,
        })),
      },
    };

    const result = validateMarketCategoryMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.startsWith('marketSize.signals: triangulation required'),
      ),
    ).toBe(true);
  });

  it('fails validateMarketCategoryMinimums when only bottom-up market signals are present', () => {
    const artifact: MarketCategoryArtifact = {
      ...MARKET_CATEGORY_FIXTURE,
      marketSize: {
        ...MARKET_CATEGORY_FIXTURE.marketSize,
        signals: MARKET_CATEGORY_FIXTURE.marketSize.signals.map((signal) => ({
          ...signal,
          methodology: 'bottom-up' as const,
        })),
      },
    };

    const result = validateMarketCategoryMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(
      result.errors.some((error) =>
        error.startsWith('marketSize.signals: triangulation required'),
      ),
    ).toBe(true);
  });

  it('rejects out-of-enum impact on a structural force', () => {
    const [first, ...rest] = MARKET_CATEGORY_FIXTURE.structuralForces.forces;
    const result = MarketCategoryArtifactSchema.safeParse({
      ...MARKET_CATEGORY_FIXTURE,
      structuralForces: {
        ...MARKET_CATEGORY_FIXTURE.structuralForces,
        forces: [{ ...first, impact: 'massive' }, ...rest],
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects out-of-enum direction on a structural force', () => {
    const [first, ...rest] = MARKET_CATEGORY_FIXTURE.structuralForces.forces;
    const result = MarketCategoryArtifactSchema.safeParse({
      ...MARKET_CATEGORY_FIXTURE,
      structuralForces: {
        ...MARKET_CATEGORY_FIXTURE.structuralForces,
        forces: [{ ...first, direction: 'upward' }, ...rest],
      },
    });
    expect(result.success).toBe(false);
  });
});
