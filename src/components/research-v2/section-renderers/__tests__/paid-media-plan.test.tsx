import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { toneToClass } from '@/components/research-v2/ui-kit';
import { PaidMediaPlanRenderer } from '../paid-media-plan';

interface MissingProvenancePaidMediaPlanBody {
  campaignOverview: Record<string, unknown>;
  audienceTypes: Array<Record<string, unknown>>;
}

function buildMissingProvenancePaidMediaPlanArtifact(): typeof paidMediaPlanFixtureArtifact {
  const artifact = structuredClone(paidMediaPlanFixtureArtifact);
  const body = artifact.body as unknown as MissingProvenancePaidMediaPlanBody;

  delete body.campaignOverview.monthlyBudgetProvenance;
  body.campaignOverview.dailySpendProvenance = '';
  delete body.audienceTypes[0]?.dailyBudgetProvenance;

  return artifact;
}

describe('<PaidMediaPlanRenderer>', (): void => {
  it('renders the three-layer paid-media plan surface', (): void => {
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    const renderer = screen.getByTestId(
      'typed-artifact-renderer-positioningPaidMediaPlan',
    );

    expect(renderer).toBeInTheDocument();
    expect(within(renderer).getByTestId('verdict-hero')).toBeInTheDocument();
    expect(within(renderer).getByTestId('key-findings')).toBeInTheDocument();
    expect(within(renderer).getByTestId('budget-bar')).toBeInTheDocument();
    expect(within(renderer).getByTestId('creative-matrix')).toBeInTheDocument();
    expect(within(renderer).getAllByTestId('funnel-math').length).toBeGreaterThan(0);
    expect(within(renderer).getByText('Cross-section thesis')).toBeInTheDocument();
  });

  it('maps section enum ids to reader labels', (): void => {
    const { container } = render(
      <PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />,
    );

    expect(container.textContent).not.toContain('positioningVoiceOfCustomer');
    expect(container.textContent).toContain('Voice of Customer');
  });

  it('renders unknown provenance as assumption-confirm language', (): void => {
    const artifact = buildMissingProvenancePaidMediaPlanArtifact();

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    expect(screen.getAllByText(/assumption — confirm/i).length).toBeGreaterThanOrEqual(1);
  });

  it('renders missing USD values as "not available", never a raw unknown token', (): void => {
    // The fixture's second projection row has kpiCostValue undefined.
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    expect(screen.getAllByText('not available').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText('unknown')).not.toBeInTheDocument();
  });

  it('renders no needs-review pill even when the envelope flags needs_review', (): void => {
    render(
      <PaidMediaPlanRenderer
        artifact={{
          ...paidMediaPlanFixtureArtifact,
          needs_review: true,
        }}
      />,
    );

    expect(
      screen.queryByTestId('paid-media-needs-review-badge'),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Needs review')).not.toBeInTheDocument();
  });

  it('collapses missing sales assets into one GapNote', (): void => {
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    expect(screen.getAllByTestId('gap-note').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/SDR Opt-In Flow/i).length).toBeGreaterThanOrEqual(1);
    expect(
      screen.queryByText('Evidence gap: SDR opt-in flow was not provided.'),
    ).not.toBeInTheDocument();
  });

  it('maps channel verdicts to semantic status-pill tones', (): void => {
    render(<PaidMediaPlanRenderer artifact={paidMediaPlanFixtureArtifact} />);

    expect(screen.getByText('FIX')).toHaveClass(toneToClass('flagged'));
    expect(screen.getByText('REWORK')).toHaveClass(toneToClass('flagged'));
    expect(screen.getByText('REVIEW')).toHaveClass(toneToClass('flagged'));
    expect(screen.getByText('ADD')).toHaveClass(toneToClass('active'));
  });
});
