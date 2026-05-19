import { describe, expect, it } from 'vitest';

import {
  sectionArtifactSchemas,
  sectionIdForToolName,
  validateArtifactForSection,
  type MarketCategoryArtifact,
  type BuyerICPArtifact,
  type CompetitorLandscapeArtifact,
} from '../section-artifact-schemas';

describe('section-artifact-schemas registry', () => {
  it('covers all six positioning section ids', () => {
    expect(Object.keys(sectionArtifactSchemas).sort()).toEqual(
      [
        'positioningBuyerICP',
        'positioningCompetitorLandscape',
        'positioningDemandIntent',
        'positioningMarketCategory',
        'positioningOfferDiagnostic',
        'positioningVoiceOfCustomer',
      ].sort(),
    );
  });

  it('maps each tool name back to its section id', () => {
    for (const [sectionId, entry] of Object.entries(sectionArtifactSchemas)) {
      expect(sectionIdForToolName(entry.toolName)).toBe(sectionId);
    }
  });

  it('returns null for unknown tool names', () => {
    expect(sectionIdForToolName('save_unknown_thing')).toBe(null);
  });
});

const VALID_MARKET_CATEGORY: MarketCategoryArtifact = {
  sectionTitle: 'Market & Category Intelligence',
  verdict: 'Category is expanding with strong workflow consolidation pressure.',
  statusSummary:
    'The category is anchored on workflow consolidation. Demand signals are durable; competitive lines are still being drawn.',
  confidence: 7,
  sources: [
    { title: 'G2 category page', url: 'https://www.g2.com/categories/meeting-management' },
    { title: 'LinkedIn jobs', url: 'https://www.linkedin.com/jobs' },
    { title: 'Crunchbase funding feed', url: 'https://www.crunchbase.com' },
  ],
  categoryDefinition: {
    prose: 'Meeting management with collaboration overlap.',
    adjacentCategories: [
      {
        name: 'AI meeting assistants',
        whyBuyersConfuseIt: 'Both touch notes and follow-ups.',
        disambiguatingSignal: 'Workflow control vs capture-only.',
      },
      {
        name: 'Project management',
        whyBuyersConfuseIt: 'Tasks land in the same stack.',
        disambiguatingSignal: 'Meeting rituals vs task tracking.',
      },
    ],
  },
  marketSize: {
    prose: 'Triangulation across hiring, funding, and category presence supports a durable spend.',
    signals: [
      {
        signalType: 'public-data',
        name: 'G2 category presence',
        evidence: 'Active category with vendor density.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'G2 meeting management',
        sourceUrl: 'https://www.g2.com/categories/meeting-management',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'funding-flow',
        name: 'Collaboration funding',
        evidence: 'New entrants still raising capital.',
        trajectory: 'expanding',
        methodology: 'top-down',
        sourceTitle: 'Crunchbase',
        sourceUrl: 'https://www.crunchbase.com',
        dateObserved: '2026-05-15',
      },
      {
        signalType: 'hiring-velocity',
        name: 'RevOps hiring',
        evidence: 'Roles emphasize meeting cadence and operating rhythm.',
        trajectory: 'stable',
        methodology: 'bottom-up',
        sourceTitle: 'LinkedIn Jobs',
        sourceUrl: 'https://www.linkedin.com/jobs',
        dateObserved: '2026-05-15',
      },
    ],
  },
  structuralForces: {
    prose: 'AI platform shifts and governance pressure are reshaping the category.',
    forces: [
      {
        forceType: 'regulation',
        name: 'Record-keeping rules',
        evidence: 'New corporate guidance on meeting documentation.',
        implication: 'Trust and retention features become differentiators.',
        impact: 'medium',
        direction: 'accelerating',
      },
      {
        forceType: 'platform-shift',
        name: 'AI assistants in every meeting',
        evidence: 'Native integrations from Microsoft and Zoom.',
        implication: 'Differentiation moves up-stack to workflows.',
        impact: 'high',
        direction: 'accelerating',
      },
      {
        forceType: 'buyer-behavior',
        name: 'Workflow consolidation',
        evidence: 'Buyers consolidating meeting + decision + follow-through.',
        implication: 'Bundled value props beat single-feature claims.',
        impact: 'high',
        direction: 'accelerating',
      },
    ],
  },
  categoryMaturity: {
    prose: 'Growing stage — vendor density is increasing but buyer education is still uneven.',
    classification: {
      stage: 'growing',
      evidenceSummary: 'Multiple new entrants alongside established players.',
      supportingSignals: [
        {
          signalType: 'player-count',
          evidence: 'Dozens of vendors visible on G2.',
          implication: 'Category is recognized but not consolidated.',
        },
        {
          signalType: 'buyer-education',
          evidence: 'Comparison content still dominates SERPs.',
          implication: 'Buyers comparing categories, not just vendors.',
        },
      ],
    },
  },
};

describe('validateArtifactForSection (Market Category)', () => {
  it('accepts a fully-formed artifact', () => {
    const result = validateArtifactForSection(
      'positioningMarketCategory',
      VALID_MARKET_CATEGORY,
    );
    expect(result.ok).toBe(true);
  });

  it('reports schema errors when required fields are missing', () => {
    const result = validateArtifactForSection('positioningMarketCategory', {});
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.schemaErrors.length).toBeGreaterThan(0);
      expect(result.repairFeedback).toContain('Schema validation failed');
    }
  });

  it('reports minimum errors when sources are too few', () => {
    const tooFewSources = {
      ...VALID_MARKET_CATEGORY,
      sources: [VALID_MARKET_CATEGORY.sources[0]],
    };
    const result = validateArtifactForSection(
      'positioningMarketCategory',
      tooFewSources,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.minimumsErrors.some((e) => e.includes('sources'))).toBe(true);
      expect(result.repairFeedback).toContain('Business minimum validation failed');
    }
  });

  it('flags missing top-down/bottom-up triangulation', () => {
    const allTopDown: MarketCategoryArtifact = {
      ...VALID_MARKET_CATEGORY,
      marketSize: {
        ...VALID_MARKET_CATEGORY.marketSize,
        signals: VALID_MARKET_CATEGORY.marketSize.signals.map((signal) => ({
          ...signal,
          methodology: 'top-down',
        })),
      },
    };
    const result = validateArtifactForSection(
      'positioningMarketCategory',
      allTopDown,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.minimumsErrors.some((e) => e.includes('triangulation required')),
      ).toBe(true);
    }
  });
});

describe('validateArtifactForSection (Competitor Landscape)', () => {
  function makeValid(): CompetitorLandscapeArtifact {
    return {
      sectionTitle: 'Competitor Landscape & Positioning',
      verdict: 'Competitive lines are still being drawn; pricing is fragmented.',
      statusSummary: 'Five competitors hold the visible category surface.',
      confidence: 7,
      sources: Array.from({ length: 5 }, (_, i) => ({
        title: `Source ${i + 1}`,
        url: `https://example${i + 1}.com`,
      })),
      competitorSet: {
        prose: 'Direct, indirect, status-quo, and DIY all represented.',
        competitors: [
          {
            name: 'Alpha',
            url: 'https://alpha.com',
            competitorType: 'direct',
            oneLinePositioning: 'Alpha workflow platform.',
            verbatimHeroCopy: 'Run better meetings.',
            pricingPosition: 'Public pricing $20/user/mo.',
            sourceUrl: 'https://alpha.com/pricing',
          },
          {
            name: 'Beta',
            url: 'https://beta.com',
            competitorType: 'indirect',
            oneLinePositioning: 'AI meeting assistant.',
            verbatimHeroCopy: 'Never take notes again.',
            pricingPosition: 'Freemium with pro tier.',
            sourceUrl: 'https://beta.com/pricing',
          },
          {
            name: 'Status quo: shared docs',
            url: 'https://example.com/docs',
            competitorType: 'status-quo',
            oneLinePositioning: 'Plain docs and meetings.',
            verbatimHeroCopy: 'Just use Google Docs.',
            pricingPosition: 'Bundled in productivity suite.',
            sourceUrl: 'https://example.com/docs',
          },
          {
            name: 'DIY: shared notes',
            url: 'https://example.com/diy',
            competitorType: 'diy',
            oneLinePositioning: 'Shared Notion templates.',
            verbatimHeroCopy: 'Build your own.',
            pricingPosition: 'Free with templates.',
            sourceUrl: 'https://example.com/diy',
          },
          {
            name: 'Gamma',
            url: 'https://gamma.com',
            competitorType: 'direct',
            oneLinePositioning: 'Async meeting tool.',
            verbatimHeroCopy: 'Less meetings.',
            pricingPosition: 'Public pricing.',
            sourceUrl: 'https://gamma.com/pricing',
          },
        ],
      },
      positioningTaxonomy: {
        prose: 'Three primary axes.',
        axes: Array.from({ length: 3 }, (_, i) => ({
          axisName: `Axis ${i + 1}`,
          ourPosition: 'Workflow-first.',
          competitorPositions: [
            { competitor: 'Alpha', position: 'Tool-first.' },
            { competitor: 'Beta', position: 'AI-first.' },
          ],
          evidenceUrl: `https://example${i + 1}.com/axis`,
        })),
      },
      pricingReality: {
        prose: 'Pricing fragments across three competitors.',
        dataPoints: [
          {
            competitor: 'Alpha',
            tierName: 'Pro',
            monthlyPrice: '$20',
            packagingPattern: 'per-seat',
            gatedSignals: 'Public',
            sourceUrl: 'https://alpha.com/pricing',
          },
          {
            competitor: 'Beta',
            tierName: 'Plus',
            monthlyPrice: '$15',
            packagingPattern: 'per-seat',
            gatedSignals: 'Public',
            sourceUrl: 'https://beta.com/pricing',
          },
          {
            competitor: 'Gamma',
            tierName: 'Business',
            monthlyPrice: 'Contact sales',
            packagingPattern: 'sales-led',
            gatedSignals: 'Gated',
            sourceUrl: 'https://gamma.com/pricing',
          },
        ],
      },
      shareOfVoice: {
        prose: 'Surfaces split between Alpha and Beta.',
        slices: Array.from({ length: 3 }, (_, i) => ({
          surface: `Surface ${i + 1}`,
          winner: i === 0 ? 'Alpha' : 'Beta',
          evidence: 'Top organic result.',
          sourceUrl: `https://example${i + 1}.com/sov`,
        })),
      },
      publicWeaknesses: {
        prose: 'Reviews flag latency and onboarding friction.',
        items: [
          {
            competitor: 'Alpha',
            verbatimQuote: 'Loading times are unbearable.',
            source: 'G2',
            sourceUrl: 'https://www.g2.com/products/alpha',
            whyItMatters: 'Speed is a key buyer criterion.',
          },
          {
            competitor: 'Alpha',
            verbatimQuote: 'Setup took two weeks.',
            source: 'G2',
            sourceUrl: 'https://www.g2.com/products/alpha',
            whyItMatters: 'Time-to-value matters for adoption.',
          },
          {
            competitor: 'Beta',
            verbatimQuote: 'Misses my actual action items.',
            source: 'Reddit',
            sourceUrl: 'https://reddit.com/r/sales/comments/beta',
            whyItMatters: 'AI accuracy is critical.',
          },
          {
            competitor: 'Beta',
            verbatimQuote: 'Audio quality issues.',
            source: 'Reddit',
            sourceUrl: 'https://reddit.com/r/sales/comments/beta2',
            whyItMatters: 'Recording fidelity affects trust.',
          },
        ],
      },
      narrativeArcs: {
        prose: 'Three distinct villain/hero/transformation arcs.',
        arcs: Array.from({ length: 3 }, (_, i) => ({
          competitor: i === 0 ? 'Alpha' : i === 1 ? 'Beta' : 'Gamma',
          villain: 'Meeting chaos.',
          hero: 'Better workflow.',
          transformationClaim: 'Faster decisions.',
          sourceUrl: `https://example${i + 1}.com/arc`,
        })),
      },
    };
  }

  it('accepts a fully-formed Competitor Landscape artifact', () => {
    const result = validateArtifactForSection(
      'positioningCompetitorLandscape',
      makeValid(),
    );
    expect(result.ok).toBe(true);
  });

  it('flags missing competitor types', () => {
    const onlyDirect = makeValid();
    onlyDirect.competitorSet.competitors = onlyDirect.competitorSet.competitors.map(
      (c) => ({ ...c, competitorType: 'direct' as const }),
    );
    const result = validateArtifactForSection(
      'positioningCompetitorLandscape',
      onlyDirect,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(
        result.minimumsErrors.some((e) =>
          e.includes('missing competitor types'),
        ),
      ).toBe(true);
    }
  });
});

describe('validateArtifactForSection error envelope', () => {
  it('returns repair_feedback wrapping the schema errors (R5 contract)', () => {
    const result = validateArtifactForSection('positioningBuyerICP', {
      sectionTitle: 'X',
    } as Partial<BuyerICPArtifact>);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.repairFeedback.length).toBeGreaterThan(0);
    }
  });
});
