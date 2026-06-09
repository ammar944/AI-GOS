import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { toneToClass } from '@/components/research-v2/ui-kit';
import { PaidMediaPlanRenderer } from '../paid-media-plan';

interface MissingProvenancePaidMediaPlanBody {
  campaignOverview: Record<string, unknown>;
  campaignPhases: Array<Record<string, unknown>>;
  audienceTypes: Array<Record<string, unknown>>;
}

function buildMissingProvenancePaidMediaPlanArtifact(): typeof paidMediaPlanFixtureArtifact {
  const artifact = structuredClone(paidMediaPlanFixtureArtifact);
  const body = artifact.body as unknown as MissingProvenancePaidMediaPlanBody;

  delete body.campaignOverview.monthlyBudgetProvenance;
  body.campaignOverview.dailySpendProvenance = '';
  delete body.campaignPhases[0]?.monthlyBudgetProvenance;
  delete body.audienceTypes[0]?.dailyBudgetProvenance;

  return artifact;
}

describe('<PaidMediaPlanRenderer>', (): void => {
  it('renders typed paid-media subsections instead of generic key dumps', (): void => {
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    const renderer = screen.getByTestId('paid-media-plan-renderer');

    expect(renderer).toBeInTheDocument();
    expect(within(renderer).getAllByTestId('subsection')).toHaveLength(12);
    [
      'campaignOverview',
      'campaignPhases',
      'audienceTypes',
      'anglesToTest',
      'creativeStrategy',
      'creativeFramework',
      'funnelIdeation',
      'salesProcess',
      'competitorMarketingInsights',
      'competitorReviewInsights',
      'channelSuggestions',
      'kpis',
    ].forEach((key) => {
      expect(within(renderer).getByTestId(`pmp-block-${key}`)).toBeInTheDocument();
    });
    expect(
      within(renderer).getByText('A four-month paid-media plan starts with controlled testing before scale.'),
    ).toBeInTheDocument();
    expect(within(renderer).getByTestId('paid-media-driver-strip')).toBeInTheDocument();
    expect(
      within(renderer).getByText(/spend first on the narrow speed-and-proof loop/i),
    ).toBeInTheDocument();
    expect(within(renderer).getByText('Monthly budget')).toBeInTheDocument();
    expect(within(renderer).getAllByText('$3,000').length).toBeGreaterThan(0);
    expect(
      within(renderer).getAllByText('user-supplied').length,
    ).toBeGreaterThan(0);
    expect(
      within(renderer).getAllByText('model-estimated').length,
    ).toBeGreaterThan(0);
    expect(within(renderer).getByText('Campaign phases')).toBeInTheDocument();
    expect(within(renderer).getByText('Audience types')).toBeInTheDocument();
    expect(within(renderer).getByText('Angles to test')).toBeInTheDocument();
    expect(within(renderer).getByText('Creative framework')).toBeInTheDocument();
    expect(within(renderer).getByText('Channel suggestions')).toBeInTheDocument();
    expect(within(renderer).getByText('Phase 1 - Testing')).toBeInTheDocument();
    expect(
      within(renderer).getByText('Stop losing qualified pipeline while campaign decisions sit in docs.'),
    ).toBeInTheDocument();
    expect(within(renderer).getAllByText('Free audit').length).toBeGreaterThan(0);
    expect(within(renderer).getAllByText('MQLs').length).toBeGreaterThan(0);
    expect(
      within(renderer).getByText(/qualified free-audit leads that match the ICP/i),
    ).toBeInTheDocument();
    expect(
      within(renderer).getByText(/every launchable row carries a source section/i),
    ).toBeInTheDocument();
    expect(within(renderer).queryByText('Strategic thesis')).not.toBeInTheDocument();
    expect(
      within(renderer).queryByText('Contradiction reconciliation'),
    ).not.toBeInTheDocument();
    expect(within(renderer).queryByText('Ordered moves')).not.toBeInTheDocument();
  });

  it('renders unknown provenance for artifacts missing displayed provenance fields', (): void => {
    const artifact = buildMissingProvenancePaidMediaPlanArtifact();

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    const renderer = screen.getByTestId('paid-media-plan-renderer');

    expect(within(renderer).getAllByText('unknown').length).toBeGreaterThanOrEqual(
      4,
    );
  });

  it('renders the paid-media verifier needs-review badge from the envelope flag', (): void => {
    render(
      <PaidMediaPlanRenderer
        artifact={{
          ...paidMediaPlanFixtureArtifact,
          needs_review: true,
        }}
      />,
    );

    expect(screen.getByTestId('paid-media-needs-review-badge')).toHaveTextContent(
      'Needs review',
    );
  });

  it('maps channel verdicts to semantic status-pill tones', (): void => {
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    expect(screen.getByText('FIX')).toHaveClass(toneToClass('flagged'));
    expect(screen.getByText('REWORK')).toHaveClass(toneToClass('flagged'));
    expect(screen.getByText('REVIEW')).toHaveClass(toneToClass('flagged'));
    expect(screen.getByText('ADD')).toHaveClass(toneToClass('active'));
  });
});
