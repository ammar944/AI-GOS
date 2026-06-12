/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
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
});
