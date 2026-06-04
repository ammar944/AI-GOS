import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { PaidMediaPlanRenderer } from '../paid-media-plan';

interface LegacyPaidMediaPlanBody {
  campaignOverview: Record<string, unknown>;
  campaignPhases: {
    phases: Array<Record<string, unknown>>;
  };
  audienceTypes: {
    audiences: Array<Record<string, unknown>>;
  };
  competitorMarketingInsights: {
    competitors: Array<Record<string, unknown>>;
  };
}

function buildLegacyPaidMediaPlanArtifact(): typeof paidMediaPlanFixtureArtifact {
  const legacyArtifact = structuredClone(paidMediaPlanFixtureArtifact);
  const legacyBody = legacyArtifact.body as unknown as LegacyPaidMediaPlanBody;

  delete legacyBody.campaignOverview.monthlyBudgetProvenance;
  legacyBody.campaignOverview.dailySpendProvenance = '';
  delete legacyBody.campaignPhases.phases[0]?.monthlyBudgetProvenance;
  delete legacyBody.audienceTypes.audiences[0]?.dailyBudgetProvenance;
  delete legacyBody.competitorMarketingInsights.competitors[0]?.estSpendProvenance;

  return legacyArtifact;
}

describe('<PaidMediaPlanRenderer>', (): void => {
  it('renders typed paid-media subsections instead of generic key dumps', (): void => {
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    const renderer = screen.getByTestId('paid-media-plan-renderer');

    expect(renderer).toBeInTheDocument();
    expect(
      within(renderer).getByText('A four-month paid-media plan starts with controlled testing before scale.'),
    ).toBeInTheDocument();
    expect(within(renderer).getByText('Monthly budget')).toBeInTheDocument();
    expect(within(renderer).getAllByText('$3,000').length).toBeGreaterThan(0);
    expect(
      within(renderer).getAllByText('user-supplied').length,
    ).toBeGreaterThan(0);
    expect(
      within(renderer).getAllByText('model-estimated').length,
    ).toBeGreaterThan(0);
    expect(within(renderer).getByText('Testing')).toBeInTheDocument();
    expect(
      within(renderer).getByText('Stop losing qualified pipeline to manual handoffs 1.'),
    ).toBeInTheDocument();
    expect(within(renderer).getAllByText('Free audit').length).toBeGreaterThan(0);
    expect(within(renderer).getAllByText('MQLs').length).toBeGreaterThan(0);
  });

  it('renders unknown provenance for legacy artifacts missing provenance fields', (): void => {
    const legacyArtifact = buildLegacyPaidMediaPlanArtifact();

    render(<PaidMediaPlanRenderer artifact={legacyArtifact} />);

    const renderer = screen.getByTestId('paid-media-plan-renderer');

    expect(within(renderer).getAllByText('unknown').length).toBeGreaterThanOrEqual(
      5,
    );
  });
});
