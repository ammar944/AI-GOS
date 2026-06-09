import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
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
    expect(
      within(renderer).getByText('A four-month paid-media plan starts with controlled testing before scale.'),
    ).toBeInTheDocument();
    expect(within(renderer).getByText('Cross-section insight')).toBeInTheDocument();
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
});
