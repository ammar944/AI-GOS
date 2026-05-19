/**
 * Dev-only preview route for typed-artifact UI primitives + section renderers.
 *
 * Mounts each typed section renderer with a fixture so we can visually verify
 * the new Arc 2 work without running a full research pipeline. NOT linked in
 * navigation; access by typing the URL.
 *
 * Add new renderers here as PR #2 lands them.
 */

import type { ReactElement } from 'react';
import { CompetitorLandscapeRenderer } from '@/components/research-v2/section-renderers';
import type { CompetitorLandscapeArtifact } from '@/lib/managed-agents/schemas/competitor-landscape';

const competitorFixture: CompetitorLandscapeArtifact = {
  sectionTitle: 'Competitor Landscape & Positioning',
  verdict:
    'Direct competitors converge on "all-in-one CRM" messaging; the wedge is verticalized for real estate teams.',
  statusSummary:
    'Three direct competitors fight on the same axis (workflow breadth). DIY (Google Sheets) still wins ~40% of small teams under 5 agents.',
  confidence: 0.78,
  sources: [
    {
      title: 'Follow Up Boss pricing page',
      url: 'https://www.followupboss.com/pricing',
      whyItMatters:
        'Anchors mid-market tier pricing; positions against larger CRMs by simplicity.',
    },
    {
      title: 'Lofty (formerly Chime) demo video',
      url: 'https://www.lofty.com/demo',
      whyItMatters:
        'Shows the same "AI assistant for follow-ups" pitch we use, but bundled with phone dialer.',
    },
    {
      title: 'r/realtors thread on CRM frustrations',
      url: 'https://www.reddit.com/r/realtors/comments/abc123',
    },
  ],
  competitorSet: {
    prose:
      'Direct competitors (Follow Up Boss, Lofty, Wise Agent) cluster on "all-in-one CRM for agents". Indirect competitors (kvCORE, BoomTown) come from the brokerage-tech side. DIY remains Google Sheets + Calendly for solo agents under 5 deals/year.',
    competitors: [
      {
        name: 'Follow Up Boss',
        url: 'https://www.followupboss.com',
        competitorType: 'direct',
        oneLinePositioning: 'The all-in-one CRM for real estate teams.',
        verbatimHeroCopy: 'Follow Up Boss helps teams convert more leads.',
        pricingPosition: '$69/user/mo starter; $99/user/mo team',
        sourceUrl: 'https://www.followupboss.com/pricing',
      },
      {
        name: 'Lofty',
        url: 'https://www.lofty.com',
        competitorType: 'direct',
        oneLinePositioning: 'AI-powered real estate CRM with dialer.',
        verbatimHeroCopy: 'Close more deals with AI that works while you sleep.',
        pricingPosition: '$449/mo flat (no per-seat)',
        sourceUrl: 'https://www.lofty.com/pricing',
      },
      {
        name: 'kvCORE',
        url: 'https://insiderealestate.com/kvcore',
        competitorType: 'indirect',
        oneLinePositioning: 'Brokerage operating system, sold top-down.',
        verbatimHeroCopy: 'The OS for high-performing brokerages.',
        pricingPosition: 'Enterprise contract (typically $499+/mo per office)',
        sourceUrl: 'https://insiderealestate.com/kvcore-pricing',
      },
      {
        name: 'Google Sheets + Calendly',
        url: 'https://sheets.google.com',
        competitorType: 'diy',
        oneLinePositioning: 'Free DIY stack for solo agents.',
        verbatimHeroCopy: 'Build it yourself in an hour.',
        pricingPosition: 'Free / $10/mo for Calendly Pro',
        sourceUrl: 'https://www.calendly.com/pricing',
      },
    ],
  },
  positioningTaxonomy: {
    prose:
      'Axes split along three live tensions: workflow breadth, AI assistance depth, and pricing model. We claim the verticalized + AI assistant + per-seat-fair quadrant.',
    axes: [
      {
        axisName: 'Workflow breadth (point tool ↔ all-in-one)',
        ourPosition: 'All-in-one with real estate primitives baked in',
        competitorPositions: [
          { competitor: 'Follow Up Boss', position: 'All-in-one, generic' },
          { competitor: 'Lofty', position: 'All-in-one + dialer' },
          { competitor: 'kvCORE', position: 'Brokerage suite (over-broad)' },
        ],
        evidenceUrl: 'https://www.followupboss.com/features',
      },
      {
        axisName: 'AI depth (search-and-suggest ↔ autonomous-acts)',
        ourPosition: 'Autonomous agent that drafts and sends',
        competitorPositions: [
          { competitor: 'Follow Up Boss', position: 'Templates only' },
          { competitor: 'Lofty', position: 'Suggests; agent must approve' },
        ],
        evidenceUrl: 'https://www.lofty.com/ai-features',
      },
      {
        axisName: 'Pricing model (per-seat ↔ flat-tier)',
        ourPosition: 'Per-seat with team discounts',
        competitorPositions: [
          { competitor: 'Follow Up Boss', position: 'Per-seat' },
          { competitor: 'Lofty', position: 'Flat $449/mo' },
        ],
        evidenceUrl: 'https://www.followupboss.com/pricing',
      },
    ],
  },
  pricingReality: {
    prose:
      'Mid-market pricing converges around $69–99/seat/mo. Lofty is the price-anchor outlier with a flat tier. Free trials are 14 days everywhere except kvCORE (no trial).',
    dataPoints: [
      {
        competitor: 'Follow Up Boss',
        tierName: 'Grow',
        monthlyPrice: '$69',
        packagingPattern: 'Per-seat, 14-day trial',
        gatedSignals: 'Calling minutes, integrations',
        sourceUrl: 'https://www.followupboss.com/pricing',
      },
      {
        competitor: 'Follow Up Boss',
        tierName: 'Pro',
        monthlyPrice: '$99',
        packagingPattern: 'Per-seat, advanced reporting',
        gatedSignals: 'Custom roles, API access',
        sourceUrl: 'https://www.followupboss.com/pricing',
      },
      {
        competitor: 'Lofty',
        tierName: 'Pro',
        monthlyPrice: '$449',
        packagingPattern: 'Flat-rate (unlimited seats)',
        gatedSignals: 'AI dialer minutes, IDX',
        sourceUrl: 'https://www.lofty.com/pricing',
      },
    ],
  },
  shareOfVoice: {
    prose:
      'Follow Up Boss owns "real estate CRM" SEO. Lofty wins YouTube tutorials. Reddit /r/realtors trends DIY-frustration, opening a wedge for us.',
    slices: [
      {
        surface: 'Google search "real estate CRM"',
        winner: 'Follow Up Boss',
        evidence: 'Top 3 organic + 2 ads',
        sourceUrl: 'https://www.google.com/search?q=real+estate+crm',
      },
      {
        surface: 'YouTube tutorials',
        winner: 'Lofty',
        evidence: '12 of top 20 tutorials',
        sourceUrl: 'https://www.youtube.com/results?search_query=real+estate+crm+tutorial',
      },
      {
        surface: 'r/realtors discussion',
        winner: 'No one (DIY rage)',
        evidence: '5 of top 10 threads complain about CRMs being bloated',
        sourceUrl: 'https://www.reddit.com/r/realtors',
      },
    ],
  },
  publicWeaknesses: {
    prose:
      'All three direct competitors have visible weakness around setup complexity and AI quality. Reddit + G2 reviews surface specific verbatim complaints we can quote in ads.',
    items: [
      {
        competitor: 'Follow Up Boss',
        verbatimQuote:
          'Took me 3 weeks to import my contacts and set up the workflows. Almost gave up.',
        source: 'G2 review (3-star)',
        sourceUrl: 'https://www.g2.com/products/follow-up-boss/reviews',
        whyItMatters:
          'Onboarding pain is a buy-no-go for solo agents. We win with 30-min setup.',
      },
      {
        competitor: 'Lofty',
        verbatimQuote: 'The AI keeps suggesting generic responses my clients see through.',
        source: 'r/realtors thread',
        sourceUrl: 'https://www.reddit.com/r/realtors',
        whyItMatters:
          'Generic AI is the obvious cliff. Our differentiator is "trained on YOUR voice".',
      },
    ],
  },
  narrativeArcs: {
    prose:
      'Each competitor positions around a different villain. Follow Up Boss fights "lost leads". Lofty fights "slow follow-up". kvCORE fights "broker chaos". Our open lane: fighting "the generic CRM that does not know real estate".',
    arcs: [
      {
        competitor: 'Follow Up Boss',
        villain: 'Lost leads from slow response',
        hero: 'Automated lead routing',
        transformationClaim: 'Convert 30% more leads in 60 days',
        sourceUrl: 'https://www.followupboss.com',
      },
      {
        competitor: 'Lofty',
        villain: 'Slow manual follow-up',
        hero: 'AI that calls and texts for you',
        transformationClaim: 'Triple your contacts per day',
        sourceUrl: 'https://www.lofty.com',
      },
      {
        competitor: 'kvCORE',
        villain: 'Disorganized brokerages',
        hero: 'Brokerage operating system',
        transformationClaim: 'Run a 50-agent team with 10 staff',
        sourceUrl: 'https://insiderealestate.com/kvcore',
      },
    ],
  },
};

export default function TypedArtifactPreviewPage(): ReactElement {
  return (
    <div className="mx-auto max-w-[960px] px-6 py-16">
      <header className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.12em] text-[color:var(--accent-blue)]">
          Dev preview — not user-facing
        </p>
        <h1 className="font-serif text-[36px] font-normal leading-[1.12] tracking-[0] text-[color:var(--text-primary)]">
          Typed Artifact Preview
        </h1>
        <p className="max-w-[70ch] text-[15px] leading-[1.75] text-[color:var(--text-secondary)]">
          Renders the new Arc 2 typed-artifact UI with a fixture so we can verify primitives + section renderers without running a real audit.
        </p>
      </header>

      <section className="mt-16">
        <CompetitorLandscapeRenderer artifact={competitorFixture} />
      </section>
    </div>
  );
}
