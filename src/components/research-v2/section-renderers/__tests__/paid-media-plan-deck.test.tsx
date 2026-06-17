/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { PaidMediaPlanDeck } from '../paid-media-plan-deck';

type FixtureArtifact = typeof paidMediaPlanFixtureArtifact;

function cloneFixture(): FixtureArtifact {
  return structuredClone(paidMediaPlanFixtureArtifact);
}

describe('<PaidMediaPlanDeck>', (): void => {
  it('renders the deck pages in deck order with the cover band and overview tiles', (): void => {
    const { container } = render(
      <PaidMediaPlanDeck
        artifact={paidMediaPlanFixtureArtifact}
        subjectName="Acme"
      />,
    );

    expect(screen.getByTestId('paid-media-plan-deck')).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Paid Media Plan' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme')).toBeInTheDocument();

    const pageTitles = [
      'Campaign Overview',
      'Campaign Phases',
      'Audience Types',
      'Angles to Test',
      'Creative Strategy',
      'Creative Framework',
      'Funnel Ideation',
      'Projected Results',
      'Sales Process',
      'Competitor Insights — Marketing',
      'Competitor Insights — Reviews',
      'Suggestions on Current Funnels',
      'KPIs & Success Metrics',
    ];
    for (const title of pageTitles) {
      expect(screen.getByRole('heading', { name: title })).toBeInTheDocument();
    }
    expect(screen.getByText('Assumptions & provenance')).toBeInTheDocument();

    // Overview tiles carry the budget cascade values.
    expect(screen.getAllByText('Monthly Budget').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('$3,000').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Daily Spend')).toBeInTheDocument();
    expect(
      container.textContent?.indexOf('Funnel Ideation') ?? -1,
    ).toBeLessThan(container.textContent?.indexOf('Projected Results') ?? -1);
    expect(
      container.textContent?.indexOf('Projected Results') ?? -1,
    ).toBeLessThan(container.textContent?.indexOf('KPIs & Success Metrics') ?? -1);

    // No analyst chrome: sourceSection enums and gap sentinels never render.
    expect(container.textContent).not.toContain('positioningVoiceOfCustomer');
    expect(container.textContent).not.toMatch(/evidence gap/i);
  });

  it('renders audience detail and grounding text (researched fields the operator view dropped)', (): void => {
    render(<PaidMediaPlanDeck artifact={paidMediaPlanFixtureArtifact} />);

    expect(
      screen.getByText('Operators researching workflow automation and CRM cleanup.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Buyer ICP names founder-led operators with messy CRM handoffs.'),
    ).toBeInTheDocument();
  });

  it('drops gap channel rows and omits the suggestions page when none survive', (): void => {
    const oneGap = cloneFixture();
    oneGap.body.channelSuggestions[0].recommendation =
      'Evidence gap: channel recommendation missing.';

    const { unmount } = render(<PaidMediaPlanDeck artifact={oneGap} />);
    expect(
      screen.getByRole('heading', { name: 'Suggestions on Current Funnels' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(oneGap.body.channelSuggestions[0].channel)).not.toBeInTheDocument();
    expect(screen.getByText('Email / Nurture')).toBeInTheDocument();
    unmount();

    const allGaps = cloneFixture();
    for (const row of allGaps.body.channelSuggestions) {
      row.recommendation = 'Evidence gap: channel recommendation missing.';
    }
    render(<PaidMediaPlanDeck artifact={allGaps} />);
    expect(
      screen.queryByRole('heading', { name: 'Suggestions on Current Funnels' }),
    ).not.toBeInTheDocument();
  });

  it('renders one clean callout when only sales-process gap rows exist', (): void => {
    const gapsOnly = cloneFixture();
    gapsOnly.body.salesProcess = gapsOnly.body.salesProcess.filter(
      (asset) => asset.url === '',
    );

    const { container } = render(<PaidMediaPlanDeck artifact={gapsOnly} />);

    expect(
      screen.getByText('Share your sales process to complete this page'),
    ).toBeInTheDocument();
    expect(screen.getByText(/SDR Opt-In Flow/)).toBeInTheDocument();
    // The gap-note sentinel text never prints, and no table renders.
    expect(container.textContent).not.toMatch(/evidence gap/i);
    expect(container.querySelector('table')).not.toBeInTheDocument();
  });

  it('strips money provenance suffixes from display strings and lists them in the assumptions panel', (): void => {
    const suffixed = cloneFixture();
    suffixed.body.campaignOverview.monthlyBudget = '$3,000 (user-supplied)';

    render(<PaidMediaPlanDeck artifact={suffixed} />);

    expect(screen.queryByText('$3,000 (user-supplied)')).not.toBeInTheDocument();
    // Provenance still surfaces — once, in the assumptions ledger.
    expect(screen.getAllByText(/from your brief/).length).toBeGreaterThanOrEqual(1);
  });

  it('renders projected results only for rows with computed counts', (): void => {
    const projected = cloneFixture();
    projected.body.projectedResults[0].countBasis =
      'At your target CAC from the GTM brief, this is the conservative count.';

    render(<PaidMediaPlanDeck artifact={projected} />);

    const heading = screen.getByRole('heading', {
      name: 'Projected Results',
      level: 2,
    });
    const page = heading.closest('section');
    expect(page).not.toBeNull();
    const scoped = within(page as HTMLElement);

    expect(scoped.getByText('50')).toBeInTheDocument();
    expect(scoped.getByText('MQL')).toBeInTheDocument();
    expect(scoped.getByText(/KPI cost: \$120/)).toBeInTheDocument();
    expect(
      scoped.getByText(/At your target CAC from the GTM brief/),
    ).toBeInTheDocument();
    expect(scoped.queryByText(/RevOps leaders at mid-market SaaS/)).not.toBeInTheDocument();
  });

  it('renders a single full-width creative framework card when all rendered slots are static', (): void => {
    const allStatic = cloneFixture();
    allStatic.body.creativeFramework = [
      {
        label: 'Static 1',
        angleType: 'Problem-Aware',
        hook: 'Lead with the campaign-delay problem.',
        executesAngle: 'Launch Delay Anxiety',
        sourceSection: 'positioningVoiceOfCustomer',
        grounding: 'VoC names slow campaign handoff.',
      },
      {
        label: 'Static 2',
        angleType: 'Comparison',
        hook: 'Show how generic workflow promises fail paid media.',
        executesAngle: 'Competitor Drag',
        sourceSection: 'positioningCompetitorLandscape',
        grounding: 'Competitor messaging is too broad.',
      },
    ];
    allStatic.body.creativeStrategy.staticCount = 5;
    allStatic.body.creativeStrategy.videoCount = 3;

    render(<PaidMediaPlanDeck artifact={allStatic} />);

    const heading = screen.getByRole('heading', {
      name: 'Creative Framework',
      level: 2,
    });
    const page = heading.closest('section');
    expect(page).not.toBeNull();
    const scoped = within(page as HTMLElement);

    expect(scoped.getByText('2 creative slots')).toBeInTheDocument();
    expect(scoped.getAllByText('Static')).toHaveLength(2);
    expect(scoped.queryByText('UGC Creatives')).not.toBeInTheDocument();
    expect(scoped.queryByText('3 UGC videos')).not.toBeInTheDocument();
    expect(
      scoped.getByText(
        'UGC slots are planned in the creative strategy — 3 videos — but no UGC concepts were framed this round.',
      ),
    ).toBeInTheDocument();
  });

  it('derives creative chip counts from the rendered slot lists', (): void => {
    const mismatchedStrategyCounts = cloneFixture();
    mismatchedStrategyCounts.body.creativeStrategy.staticCount = 99;
    mismatchedStrategyCounts.body.creativeStrategy.videoCount = 88;

    render(<PaidMediaPlanDeck artifact={mismatchedStrategyCounts} />);

    const heading = screen.getByRole('heading', {
      name: 'Creative Framework',
      level: 2,
    });
    const page = heading.closest('section');
    expect(page).not.toBeNull();
    const scoped = within(page as HTMLElement);

    expect(scoped.getByText('5 static ads')).toBeInTheDocument();
    expect(scoped.getByText('3 UGC videos')).toBeInTheDocument();
    expect(scoped.queryByText('99 static ads')).not.toBeInTheDocument();
    expect(scoped.queryByText('88 UGC videos')).not.toBeInTheDocument();
  });

  it('does not render stat tiles whose value is absent', (): void => {
    const missingOverviewStats = cloneFixture();
    missingOverviewStats.body.campaignOverview.monthlyBudget = '';
    missingOverviewStats.body.campaignOverview.dailySpend = '';
    missingOverviewStats.body.campaignPhases = [];

    render(<PaidMediaPlanDeck artifact={missingOverviewStats} />);

    const heading = screen.getByRole('heading', {
      name: 'Campaign Overview',
      level: 2,
    });
    const page = heading.closest('section');
    expect(page).not.toBeNull();
    const scoped = within(page as HTMLElement);

    expect(scoped.queryByText('Monthly Budget')).not.toBeInTheDocument();
    expect(scoped.queryByText('Daily Spend')).not.toBeInTheDocument();
  });

  it('labels derived provenance as computed in the deck appendix', (): void => {
    const derived = cloneFixture();
    derived.body.projectedResults[0].projectedCountProvenance = 'derived';

    const { container } = render(<PaidMediaPlanDeck artifact={derived} />);

    expect(screen.getByText(/computed/)).toBeInTheDocument();
    expect(container.textContent).not.toContain('derived');
  });

  it('renders cost-per-trial and modeled customer CAC as distinct, unconfusable tiles', (): void => {
    const artifact = cloneFixture();
    (artifact.body.projectedResults as Array<Record<string, unknown>>)[0] = {
      ...artifact.body.projectedResults[0],
      projectedCountValue: 45,
      impliedCacValue: 133.69,
      customerCacValue: 668.45,
      goalGapNote: 'Modeled customer CAC $668 is under the $3,000 target.',
    };

    render(<PaidMediaPlanDeck artifact={artifact} />);

    expect(
      screen.getByText('Cost per qualified trial (signup)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Modeled customer CAC (after trial→paid)'),
    ).toBeInTheDocument();
    expect(screen.getByText('$133.69')).toBeInTheDocument();
    expect(screen.getByText('$668.45')).toBeInTheDocument();
    expect(
      screen.getByText(/Modeled customer CAC \$668 is under the \$3,000 target/i),
    ).toBeInTheDocument();
  });

  it('renders the modeled customer-CAC band on a cost-path funnel row (no forward exhibit fields)', (): void => {
    const artifact = cloneFixture();
    (artifact.body.projectedResults as Array<Record<string, unknown>>)[0] = {
      ...artifact.body.projectedResults[0],
      kpi: 'Free trial signups',
      kpiCostValue: 3000,
      projectedCountValue: 8,
      impliedCacValue: undefined,
      customerCacValue: undefined,
      costPerTrialLabel: 'Cost per free-trial signup',
      customerCacBandLowValue: 9000,
      customerCacBandHighValue: 30000,
    };

    render(<PaidMediaPlanDeck artifact={artifact} />);

    expect(
      screen.getByText('Modeled customer CAC (after trial→paid)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$9,000.+\$30,000/)).toBeInTheDocument();
  });
});
