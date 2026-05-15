import { describe, expect, it } from 'vitest';

import {
  CompetitorLandscapeArtifactSchema,
  validateCompetitorLandscapeMinimums,
  type CompetitorLandscapeArtifact,
} from '../competitor-landscape';

const COMPETITOR_LANDSCAPE_FIXTURE: CompetitorLandscapeArtifact = {
  sectionTitle: 'Competitor Landscape & Positioning',
  verdict:
    'The competitive set is split between meeting workflow platforms, AI note takers, status-quo docs, and DIY operating cadences.',
  statusSummary:
    'Fellow competes with direct meeting-management tools, indirect AI meeting assistants, and the status quo of docs plus calendar routines. Public positioning is crowded around productivity and AI summaries, which makes workflow accountability and operating cadence the cleaner differentiation axis.',
  confidence: 8,
  sources: [
    {
      title: 'Fellow home page',
      url: 'https://fellow.app',
      whyItMatters: 'Primary source for Fellow positioning and use cases.',
    },
    {
      title: 'G2 meeting management category',
      url: 'https://www.g2.com/categories/meeting-management',
      whyItMatters: 'Public competitor-category evidence.',
    },
    {
      title: 'Otter.ai pricing',
      url: 'https://otter.ai/pricing',
      whyItMatters: 'Public pricing evidence for an indirect AI meeting assistant.',
    },
    {
      title: 'Google Docs',
      url: 'https://docs.google.com',
      whyItMatters: 'Status-quo document workflow source.',
    },
    {
      title: 'Notion pricing',
      url: 'https://www.notion.com/pricing',
      whyItMatters: 'DIY workspace pricing and packaging evidence.',
    },
  ],
  competitorSet: {
    prose:
      'The competitive reality is broader than a meeting-management category page. Direct tools frame themselves around meeting agendas and follow-through, indirect AI tools claim notes and summaries, status-quo documents absorb lightweight teams, and DIY workspaces support operators who build their own cadence.',
    competitors: [
      {
        name: 'Fellow',
        url: 'https://fellow.app',
        competitorType: 'direct',
        oneLinePositioning:
          'Meeting management platform for agendas, notes, action items, and team habits.',
        verbatimHeroCopy: 'Meetings worth showing up to',
        pricingPosition: 'Public paid tiers with per-user packaging.',
        sourceUrl: 'https://fellow.app/pricing',
      },
      {
        name: 'Otter.ai',
        url: 'https://otter.ai',
        competitorType: 'indirect',
        oneLinePositioning:
          'AI meeting assistant focused on transcription, summaries, and meeting notes.',
        verbatimHeroCopy: 'AI meeting notes and summaries',
        pricingPosition: 'Public freemium and paid tiers.',
        sourceUrl: 'https://otter.ai/pricing',
      },
      {
        name: 'Google Docs',
        url: 'https://docs.google.com',
        competitorType: 'status-quo',
        oneLinePositioning:
          'Shared documents used as default meeting notes and action-item records.',
        verbatimHeroCopy: 'Create and edit web-based documents',
        pricingPosition: 'Bundled in Google Workspace plans.',
        sourceUrl: 'https://workspace.google.com/pricing.html',
      },
      {
        name: 'Notion',
        url: 'https://www.notion.com',
        competitorType: 'diy',
        oneLinePositioning:
          'Workspace where teams can create custom meeting operating systems.',
        verbatimHeroCopy: 'Your connected workspace for wiki, docs, and projects',
        pricingPosition: 'Public per-seat workspace pricing.',
        sourceUrl: 'https://www.notion.com/pricing',
      },
      {
        name: 'Lattice',
        url: 'https://lattice.com',
        competitorType: 'indirect',
        oneLinePositioning:
          'People-management platform that owns recurring one-on-one and performance rituals.',
        verbatimHeroCopy: 'The people platform for high-performing teams',
        pricingPosition: 'Gated sales-led pricing.',
        sourceUrl: 'https://lattice.com',
      },
    ],
  },
  positioningTaxonomy: {
    prose:
      'The positioning map separates capture, cadence, and performance-management narratives. Fellow can avoid the crowded AI-note-taking lane by owning meeting discipline across recurring operating rituals.',
    axes: [
      {
        axisName: 'Meeting capture versus meeting operating system',
        ourPosition: 'Recurring meeting operating system with action accountability.',
        competitorPositions: [
          { competitor: 'Otter.ai', position: 'AI capture and summary assistant.' },
          { competitor: 'Google Docs', position: 'Generic collaborative note surface.' },
        ],
        evidenceUrl: 'https://otter.ai',
      },
      {
        axisName: 'Standalone meeting workflow versus bundled suite',
        ourPosition: 'Purpose-built workflow across agendas, notes, and follow-up.',
        competitorPositions: [
          { competitor: 'Google Docs', position: 'Bundled document collaboration.' },
          { competitor: 'Notion', position: 'Configurable workspace templates.' },
        ],
        evidenceUrl: 'https://fellow.app',
      },
      {
        axisName: 'Team ritual versus HR performance process',
        ourPosition: 'Team operating rituals before and after recurring meetings.',
        competitorPositions: [
          { competitor: 'Lattice', position: 'Performance and people-management rituals.' },
          { competitor: 'Fellow', position: 'Manager and team meeting habits.' },
        ],
        evidenceUrl: 'https://lattice.com',
      },
    ],
  },
  pricingReality: {
    prose:
      'Pricing is mixed: AI meeting assistants publish self-serve tiers, workspace tools bundle meeting workflows into broader per-seat pricing, and people platforms often gate pricing. That means the buyer sees meeting workflow both as a standalone line item and as a bundled feature.',
    dataPoints: [
      {
        competitor: 'Fellow',
        tierName: 'Team',
        monthlyPrice: 'public per-user paid tier',
        packagingPattern: 'Per-user SaaS plan with team collaboration features.',
        gatedSignals: 'Enterprise plan requires sales contact.',
        sourceUrl: 'https://fellow.app/pricing',
      },
      {
        competitor: 'Otter.ai',
        tierName: 'Pro',
        monthlyPrice: 'public self-serve pricing',
        packagingPattern: 'Freemium plus paid tiers for transcription and summaries.',
        gatedSignals: 'Enterprise plan uses contact-sales motion.',
        sourceUrl: 'https://otter.ai/pricing',
      },
      {
        competitor: 'Notion',
        tierName: 'Business',
        monthlyPrice: 'public per-seat pricing',
        packagingPattern: 'Workspace suite pricing, not meeting-specific pricing.',
        gatedSignals: 'Enterprise controls require sales contact.',
        sourceUrl: 'https://www.notion.com/pricing',
      },
    ],
  },
  shareOfVoice: {
    prose:
      'Share of voice is fragmented by surface. Review categories reward meeting-management language, search and AI-assistant pages reward summary and notes language, while community and template surfaces reward workflow-operating-system phrasing.',
    slices: [
      {
        surface: 'G2 meeting management category',
        winner: 'Direct meeting-management vendors',
        evidence: 'Category pages cluster vendors by meeting management features.',
        sourceUrl: 'https://www.g2.com/categories/meeting-management',
      },
      {
        surface: 'AI meeting assistant search',
        winner: 'Otter.ai',
        evidence: 'AI assistant competitors own transcription and summary language.',
        sourceUrl: 'https://otter.ai',
      },
      {
        surface: 'Workspace templates',
        winner: 'Notion',
        evidence: 'Template and docs surfaces normalize DIY meeting systems.',
        sourceUrl: 'https://www.notion.com/templates',
      },
    ],
  },
  publicWeaknesses: {
    prose:
      'Public weakness evidence should be read as buyer-language signal, not as a takedown. The most useful complaints expose where competitors over-index on capture, generic documents, or configurable workspaces without making the meeting ritual accountable.',
    items: [
      {
        competitor: 'Otter.ai',
        verbatimQuote: 'The summaries still need cleanup before I can send them.',
        source: 'G2 review',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
        whyItMatters:
          'AI capture can still leave a workflow gap after the meeting.',
      },
      {
        competitor: 'Otter.ai',
        verbatimQuote: 'It misses context when people talk over each other.',
        source: 'G2 review',
        sourceUrl: 'https://www.g2.com/products/otter-ai/reviews',
        whyItMatters:
          'Transcript accuracy and meeting context are distinct from operating cadence.',
      },
      {
        competitor: 'Notion',
        verbatimQuote: 'We had to build our own meeting template system.',
        source: 'Reddit thread',
        sourceUrl: 'https://www.reddit.com',
        whyItMatters:
          'DIY workspaces create setup burden before users get a repeatable ritual.',
      },
      {
        competitor: 'Google Docs',
        verbatimQuote: 'Action items get buried in docs after the meeting.',
        source: 'Community thread',
        sourceUrl: 'https://support.google.com/docs',
        whyItMatters:
          'The status quo captures notes but does not enforce follow-through.',
      },
    ],
  },
  narrativeArcs: {
    prose:
      'Competitor narratives generally name a villain, then claim a hero mechanism and a better after-state. The strongest Fellow arc should make scattered meeting work the villain and operating cadence the hero, not simply repeat AI-note-summary claims.',
    arcs: [
      {
        competitor: 'Fellow',
        villain: 'Unproductive meetings with weak follow-through.',
        hero: 'Structured agendas, notes, action items, and manager habits.',
        transformationClaim: 'Meetings become accountable operating rituals.',
        sourceUrl: 'https://fellow.app',
      },
      {
        competitor: 'Otter.ai',
        villain: 'Manual note-taking and missed meeting details.',
        hero: 'AI transcription and summary automation.',
        transformationClaim: 'Teams leave meetings with searchable notes and summaries.',
        sourceUrl: 'https://otter.ai',
      },
      {
        competitor: 'Notion',
        villain: 'Scattered tools and disconnected documentation.',
        hero: 'A connected workspace for docs, wiki, and projects.',
        transformationClaim: 'Teams build their own operating system in one place.',
        sourceUrl: 'https://www.notion.com',
      },
    ],
  },
};

describe('CompetitorLandscapeArtifactSchema', () => {
  it('accepts a full fixture with the six canonical Section 03 sub-sections populated', () => {
    const result = CompetitorLandscapeArtifactSchema.safeParse(
      COMPETITOR_LANDSCAPE_FIXTURE,
    );
    expect(result.success).toBe(true);
  });

  it('rejects when competitorSet.competitors is missing', () => {
    const result = CompetitorLandscapeArtifactSchema.safeParse({
      ...COMPETITOR_LANDSCAPE_FIXTURE,
      competitorSet: {
        prose: COMPETITOR_LANDSCAPE_FIXTURE.competitorSet.prose,
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects an out-of-enum competitorType', () => {
    const [first, ...rest] = COMPETITOR_LANDSCAPE_FIXTURE.competitorSet.competitors;
    const result = CompetitorLandscapeArtifactSchema.safeParse({
      ...COMPETITOR_LANDSCAPE_FIXTURE,
      competitorSet: {
        ...COMPETITOR_LANDSCAPE_FIXTURE.competitorSet,
        competitors: [{ ...first, competitorType: 'adjacent' }, ...rest],
      },
    });
    expect(result.success).toBe(false);
  });

  it('passes validateCompetitorLandscapeMinimums on the full fixture', () => {
    expect(validateCompetitorLandscapeMinimums(COMPETITOR_LANDSCAPE_FIXTURE)).toEqual({
      ok: true,
      errors: [],
    });
  });

  it('fails validateCompetitorLandscapeMinimums when competitor set is too thin', () => {
    const artifact: CompetitorLandscapeArtifact = {
      ...COMPETITOR_LANDSCAPE_FIXTURE,
      competitorSet: {
        ...COMPETITOR_LANDSCAPE_FIXTURE.competitorSet,
        competitors: COMPETITOR_LANDSCAPE_FIXTURE.competitorSet.competitors.slice(0, 4),
      },
    };

    const result = validateCompetitorLandscapeMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'competitorSet.competitors: have 4, need >=5 competitors across direct, indirect, status-quo, and diy.',
    );
  });

  it('fails validateCompetitorLandscapeMinimums when a required competitor type is missing', () => {
    const artifact: CompetitorLandscapeArtifact = {
      ...COMPETITOR_LANDSCAPE_FIXTURE,
      competitorSet: {
        ...COMPETITOR_LANDSCAPE_FIXTURE.competitorSet,
        competitors: COMPETITOR_LANDSCAPE_FIXTURE.competitorSet.competitors.filter(
          (competitor) => competitor.competitorType !== 'status-quo',
        ),
      },
    };

    const result = validateCompetitorLandscapeMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'competitorSet.competitors: missing competitor types status-quo.',
    );
  });

  it('fails validateCompetitorLandscapeMinimums when public weaknesses do not span two competitors', () => {
    const artifact: CompetitorLandscapeArtifact = {
      ...COMPETITOR_LANDSCAPE_FIXTURE,
      publicWeaknesses: {
        ...COMPETITOR_LANDSCAPE_FIXTURE.publicWeaknesses,
        items: COMPETITOR_LANDSCAPE_FIXTURE.publicWeaknesses.items.map((item) => ({
          ...item,
          competitor: 'Otter.ai',
        })),
      },
    };

    const result = validateCompetitorLandscapeMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain(
      'publicWeaknesses.items: need weaknesses across >=2 competitors, have 1.',
    );
  });

  it('fails validateCompetitorLandscapeMinimums when confidence is outside 0-10', () => {
    const artifact: CompetitorLandscapeArtifact = {
      ...COMPETITOR_LANDSCAPE_FIXTURE,
      confidence: 11,
    };

    const result = validateCompetitorLandscapeMinimums(artifact);
    expect(result.ok).toBe(false);
    expect(result.errors).toContain('confidence: expected 0-10, got 11.');
  });
});
