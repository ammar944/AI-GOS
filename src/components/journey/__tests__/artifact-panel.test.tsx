import { render, screen } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ArtifactPanel } from '../artifact-panel';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: HTMLAttributes<HTMLElement>) => <section {...props}>{children}</section>,
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

const competitorData = {
  competitors: [
    {
      name: 'Hey Digital',
      website: 'https://heydigital.com',
      price: 'Custom retainer',
      pricingConfidence: 'high',
      positioning: 'Performance-driven paid media and CRO for B2B SaaS',
      strengths: ['Deep SaaS specialization', 'Strong paid media + CRO execution'],
      weaknesses: ['Small team capacity'],
      opportunities: ['Broader GTM advisory whitespace'],
      ourAdvantage: 'Win on deeper attribution and sharper launch planning.',
      adActivity: {
        activeAdCount: 18,
        platforms: ['LinkedIn', 'Google'],
        themes: ['Pipeline clarity', 'SaaS specialization'],
        evidence: 'SearchAPI and ad-library enrichment both show always-on prospecting ads.',
        sourceConfidence: 'high',
      },
    },
    {
      name: 'SalesCaptain (salescaptain.io)',
      website: 'https://salescaptain.io',
      price: '~$3,500/month',
      pricingConfidence: 'medium',
      positioning: 'Outbound-first GTM partner',
      strengths: ['Strong cold outreach systems'],
      weaknesses: ['No full-funnel paid media capability'],
      opportunities: ['Demand capture gap'],
      ourAdvantage: 'Position against the channel gap and missing revenue attribution.',
      adActivity: {
        activeAdCount: 6,
        platforms: ['LinkedIn'],
        themes: ['Outbound scale'],
        evidence: 'LinkedIn ad library shows cold outbound positioning.',
        sourceConfidence: 'medium',
      },
    },
  ],
  marketPatterns: ['Competitors skew toward channel execution instead of revenue accountability.'],
  whiteSpaceGaps: [
    {
      gap: 'Pipeline attribution for SaaS-only buyers',
      type: 'messaging',
      evidence: 'No competitor owns revenue accountability end-to-end.',
      exploitability: 8,
      impact: 9,
      recommendedAction: 'Lead with click-to-closed-won accountability in paid messaging.',
    },
  ],
  overallLandscape: 'Fragmented competitive set across paid media and outbound.',
};

const lowConfidenceCompetitorData = {
  competitors: [
    {
      name: 'Historical Ads Inc.',
      website: 'https://historical-ads.test',
      price: 'See pricing page',
      pricingConfidence: 'low',
      positioning: 'Historical creative archive only',
      strengths: ['Known brand'],
      weaknesses: ['Current ad coverage is weak'],
      opportunities: ['Own current-market proof'],
      ourAdvantage: 'Use verified current proof instead of inferred activity.',
      adActivity: {
        activeAdCount: 2,
        platforms: ['Not verified'],
        themes: ['Historical creative snapshots'],
        evidence: 'Limited coverage: historical records only. Current active ads are not verified.',
        sourceConfidence: 'low',
      },
    },
  ],
  whiteSpaceGaps: [
    {
      gap: 'Current-proof messaging',
      type: 'messaging',
      evidence: 'Weak current ad verification across the category.',
      exploitability: 7,
      impact: 8,
      recommendedAction: 'Lead with verified pipeline proof.',
    },
  ],
};

const synthesisData = {
  keyInsights: [
    {
      insight: 'LinkedIn holds the highest ICP concentration for mid-market RevOps buyers.',
      source: 'icpValidation',
      implication: 'Lead with title-based targeting before expanding into broader awareness.',
    },
  ],
  positioningStrategy: {
    recommendedAngle: 'Own the RevOps-to-pipeline narrative instead of generic lead gen.',
    alternativeAngles: ['Faster attribution clarity', 'Paid media with CRM accountability'],
    leadRecommendation: 'It is closest to the prospect pain documented in reviews and interviews.',
    keyDifferentiator: 'Revenue accountability from click to closed-won.',
  },
  platformRecommendations: [
    {
      platform: 'LinkedIn',
      role: 'primary',
      budgetAllocation: '60% ($3,000)',
      rationale: 'High-density audience of RevOps and demand gen leaders.',
      priority: 1,
    },
    {
      platform: 'Google Search',
      role: 'secondary',
      budgetAllocation: '40% ($2,000)',
      rationale: 'Captures active solution demand from high-intent buyers.',
      priority: 2,
    },
  ],
  messagingAngles: [
    {
      angle: 'Pipeline visibility',
      targetEmotion: 'Confidence',
      exampleHook: 'See where revenue is leaking before finance does.',
      evidence: 'Review data repeatedly mentions opaque reporting and weak attribution.',
    },
  ],
  planningContext: {
    monthlyBudget: '$5,000/month',
    targetCpl: '$300',
    downstreamSequence: ['keywordIntel', 'mediaPlan'],
  },
  criticalSuccessFactors: ['Tight CRM attribution', 'Message-platform fit'],
  nextSteps: ['Ship the LinkedIn hero campaign', 'Build search landing pages by use case'],
  strategicNarrative:
    'The market is crowded with channel operators but thin on revenue-accountable positioning.',
  charts: [
    {
      chartType: 'radar',
      title: 'Competitive Positioning',
      imageUrl: 'https://example.com/radar.png',
      description: 'Compares key positioning strengths across top competitors.',
    },
  ],
};

const keywordData = {
  totalKeywordsFound: 42,
  competitorGapCount: 6,
  campaignGroups: [
    {
      campaign: 'Competitor Alternatives',
      intent: 'bottom-of-funnel',
      recommendedMonthlyBudget: 1800,
      adGroups: [
        {
          name: 'Directive Alternatives',
          recommendedMatchTypes: ['phrase', 'exact'],
          keywords: [
            {
              keyword: 'directive alternative',
              searchVolume: 390,
              estimatedCpc: '$16.20',
              difficulty: 'medium',
              priorityScore: 87,
              confidence: 'high',
            },
          ],
          negativeKeywords: ['jobs'],
        },
      ],
    },
  ],
  topOpportunities: [
    {
      keyword: 'revops agency',
      searchVolume: 1300,
      estimatedCpc: '$14.30',
      difficulty: 'medium',
      priorityScore: 83,
      confidence: 'high',
    },
    {
      keyword: 'b2b saas paid media',
      searchVolume: 900,
      estimatedCpc: '$11.80',
      difficulty: 'medium',
      priorityScore: 79,
      confidence: 'medium',
    },
  ],
  recommendedStartingSet: [
    {
      keyword: 'directive alternative',
      campaign: 'Competitor Alternatives',
      adGroup: 'Directive Alternatives',
      recommendedMonthlyBudget: 700,
      reason: 'Strong switching signal and manageable CPC for the starting budget.',
      priorityScore: 87,
    },
  ],
  competitorGaps: [
    {
      keyword: 'hubspot attribution partner',
      competitorName: 'Directive',
      searchVolume: 180,
      estimatedCpc: '$12.10',
      priorityScore: 74,
    },
  ],
  negativeKeywords: [{ keyword: 'jobs', reason: 'Employment intent' }],
  confidenceNotes: ['Gap volumes are directional because some terms have sparse SpyFu coverage.'],
  quickWins: ['Launch branded comparison pages'],
};

const mediaPlanData = {
  dataSourced: {
    note: 'Plan uses live keyword and synthesis outputs.',
  },
  channelPlan: [
    { platform: 'LinkedIn', monthlyBudget: 3000, budgetPercentage: 60 },
    { platform: 'Google Search', monthlyBudget: 2000, budgetPercentage: 40 },
  ],
  budgetSummary: {
    totalMonthly: 5000,
    byPlatform: [
      { platform: 'LinkedIn', amount: 3000, percentage: 60 },
      { platform: 'Google Search', amount: 2000, percentage: 40 },
    ],
  },
  launchSequence: [
    { week: 1, milestone: 'Launch', actions: ['Launch LinkedIn retargeting and search capture'] },
  ],
  kpiFramework: {
    northStar: 'Qualified pipeline generated',
    weeklyReview: ['Review CPL by audience', 'Check CRM attribution integrity'],
  },
};

describe('ArtifactPanel', () => {
  it('switches from worker activity to the completed competitor artifact when data arrives', () => {
    const props = {
      section: 'competitors',
      approved: false,
      onApprove: vi.fn(),
      onRequestChanges: vi.fn(),
      onClose: vi.fn(),
    };

    const { rerender } = render(
      <ArtifactPanel
        {...props}
        status="loading"
        activity={{
          jobId: 'job-1',
          section: 'competitors',
          status: 'running',
          tool: 'researchCompetitors',
          startedAt: '2026-03-10T18:07:15.100Z',
          lastHeartbeat: '2026-03-10T18:08:15.100Z',
          updates: [
            {
              at: '2026-03-10T18:08:15.100Z',
              id: 'update-1',
              message: 'searching: "b2b saas paid media agencies"',
              phase: 'tool',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Worker Running')).toBeInTheDocument();
    expect(screen.getByText(/searching: "b2b saas paid media agencies"/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Waiting for research...' })).toBeDisabled();

    rerender(
      <ArtifactPanel
        {...props}
        status="complete"
        data={competitorData}
      />,
    );

    expect(screen.queryByText('Worker Running')).not.toBeInTheDocument();
    expect(screen.getByText('Hey Digital')).toBeInTheDocument();
    expect(screen.getByText('SalesCaptain (salescaptain.io)')).toBeInTheDocument();
    expect(screen.getAllByText(/^Our Advantage vs /).length).toBeGreaterThan(0);
    expect(screen.getByText('White-Space Gaps')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Looks Good' })).toBeEnabled();
  });

  it('can hide review controls for dev-only previews', () => {
    render(
      <ArtifactPanel
        section="competitors"
        status="complete"
        data={competitorData}
        approved={false}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onClose={vi.fn()}
        showCloseButton={false}
        showReviewControls={false}
      />,
    );

    expect(screen.queryByRole('button', { name: 'Looks Good' })).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Close artifact panel' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Hey Digital')).toBeInTheDocument();
  });

  it('renders enriched competitor ad evidence with creatives and library links', () => {
    const enrichedCompetitorData = {
      ...competitorData,
      competitors: [
        {
          ...competitorData.competitors[0],
          adCreatives: [
            {
              platform: 'linkedin',
              id: 'li-1',
              advertiser: 'Hey Digital',
              headline: 'Pipeline growth for B2B SaaS',
              format: 'image',
              isActive: true,
              detailsUrl: 'https://www.linkedin.com/ad-library/detail/1',
            },
          ],
          libraryLinks: {
            metaLibraryUrl: 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Hey%20Digital',
            linkedInLibraryUrl: 'https://www.linkedin.com/ad-library/search?keyword=Hey%20Digital',
            googleAdvertiserUrl: 'https://adstransparency.google.com/advertiser/AR123?region=US',
          },
        },
        competitorData.competitors[1],
      ],
    };

    render(
      <ArtifactPanel
        section="competitors"
        status="complete"
        data={enrichedCompetitorData}
        approved={false}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    // Existing summary still renders
    expect(screen.getByText('Hey Digital')).toBeInTheDocument();
    expect(screen.getAllByText(/^Our Advantage vs /).length).toBeGreaterThan(0);

    // Creative headline renders
    expect(screen.getByText('Pipeline growth for B2B SaaS')).toBeInTheDocument();

    // Platform library links render
    expect(screen.getByTestId('library-link-meta-library')).toBeInTheDocument();
    expect(screen.getByTestId('library-link-linkedin-ads')).toBeInTheDocument();
    expect(screen.getByTestId('library-link-google-ads')).toBeInTheDocument();
  });

  it('uses limited-coverage wording for weak competitor ad evidence', () => {
    render(
      <ArtifactPanel
        section="competitors"
        status="complete"
        data={lowConfidenceCompetitorData}
        approved={false}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Observed Ads')).toBeInTheDocument();
    expect(screen.queryByText('Active Ads')).not.toBeInTheDocument();
    expect(screen.getByText('Limited Coverage')).toBeInTheDocument();
    expect(screen.getAllByText('Not Verified').length).toBeGreaterThan(0);
  });

  it('renders completed cross-analysis charts and strategy details', () => {
    render(
      <ArtifactPanel
        section="crossAnalysis"
        status="complete"
        data={synthesisData}
        approved={false}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Competitive Positioning')).toBeInTheDocument();
    expect(
      screen.getByText('Own the RevOps-to-pipeline narrative instead of generic lead gen.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Competitive Positioning' })).toBeInTheDocument();
  });

  it('renders completed keyword intelligence details', () => {
    render(
      <ArtifactPanel
        section="keywordIntel"
        status="complete"
        data={keywordData}
        approved={false}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Campaign groups')).toBeInTheDocument();
    expect(screen.getByText('Recommended starting set')).toBeInTheDocument();
    expect(screen.getByText(/revops agency/i)).toBeInTheDocument();
    expect(screen.getByText(/Directive ranks, you don't/i)).toBeInTheDocument();
  });

  it('renders completed media plan details', () => {
    render(
      <ArtifactPanel
        section="mediaPlan"
        status="complete"
        data={mediaPlanData}
        approved={false}
        onApprove={vi.fn()}
        onRequestChanges={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByText('Qualified pipeline generated')).toBeInTheDocument();
    expect(screen.getByText('Launch Sequence')).toBeInTheDocument();
    expect(screen.getAllByText(/LinkedIn/i).length).toBeGreaterThan(0);
  });
});
