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

  it('labels cost-per-trial and modeled customer CAC so a buyer cannot confuse them', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    // Inject a forward-projection row carrying both the cost-per-trial (implied
    // CAC) and the modeled paid-customer CAC after the trial->paid bridge.
    (artifact.body.projectedResults as Array<Record<string, unknown>>)[0] = {
      ...artifact.body.projectedResults[0],
      cpcValue: 4,
      cpcProvenance: 'derived',
      projectedClicks: 1500,
      blendedCvrPercent: 3,
      projectedCountValue: 45,
      impliedCacValue: 133.69,
      impliedCacProvenance: 'derived',
      customerCacValue: 668.45,
      customerCacBasis: 'benchmark',
      customerCacProvenance: 'derived',
      goalGapNote:
        'Modeled customer CAC $668 runs under your $3,000 target at a 20% trial→paid rate.',
    };

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    expect(
      screen.getByText('Cost per qualified trial (signup)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Modeled customer CAC (after trial→paid)'),
    ).toBeInTheDocument();
    expect(screen.getByText('$133.69')).toBeInTheDocument();
    expect(screen.getByText('$668.45')).toBeInTheDocument();
    expect(screen.getByText(/runs under your \$3,000 target/i)).toBeInTheDocument();
  });

  it('respects a composer-supplied costPerTrialLabel and omits the customer-CAC row when no bridge is modeled', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    (artifact.body.projectedResults as Array<Record<string, unknown>>)[0] = {
      ...artifact.body.projectedResults[0],
      cpcValue: 4,
      projectedClicks: 1500,
      blendedCvrPercent: 3,
      projectedCountValue: 45,
      impliedCacValue: 133.69,
      costPerTrialLabel: 'Cost per free signup',
      // No customerCacValue -> the modeled-customer-CAC step must not appear.
    };

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    expect(screen.getByText('Cost per free signup')).toBeInTheDocument();
    expect(
      screen.queryByText('Modeled customer CAC (after trial→paid)'),
    ).not.toBeInTheDocument();
  });

  it('renders the cost-per-trial label and modeled customer-CAC band on a cost-path funnel row (no forward exhibit fields)', (): void => {
    // c9bc2056 shape: a funnel-stage row projected on the cost path (no cpcValue /
    // impliedCacValue) carrying the honest cost-per-trial label + customer-CAC
    // band. The renderer must surface the band so $3,000 is never read as a flat
    // paid-customer CAC.
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    (artifact.body.projectedResults as Array<Record<string, unknown>>)[0] = {
      ...artifact.body.projectedResults[0],
      kpi: 'Free trial signups from Business-plan-target ICP',
      kpiCostValue: 3000,
      kpiCostProvenance: 'user-supplied',
      projectedCountValue: 8,
      cpcValue: undefined,
      impliedCacValue: undefined,
      costPerTrialLabel: 'Cost per free-trial signup',
      customerCacBandLowValue: 9000,
      customerCacBandHighValue: 30000,
      customerCacBandBasis:
        '$3,000 is cost per free-trial signup, NOT customer CAC; modeled customer CAC = $9,000–$30,000.',
    };

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    expect(screen.getByText('Cost per free-trial signup')).toBeInTheDocument();
    expect(
      screen.getByText('Modeled customer CAC (after trial→paid)'),
    ).toBeInTheDocument();
    expect(screen.getByText(/\$9,000.+\$30,000/)).toBeInTheDocument();
  });

  it('shows a gap audience budget as test/probe language in the budget bar, never a bare confident allocation', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    // Gap row: synthesized with no row-level anchor, cited at section level only.
    artifact.body.audienceTypes[0].evidencePack = {
      status: 'gap',
      refs: [],
      note: 'Cited at section level only — no row-level anchor matched.',
    };
    artifact.body.audienceTypes[0].dailyBudget = '$300/day';
    // Grounded row: tied to a real upstream committed row; keeps its money budget.
    artifact.body.audienceTypes[1].evidencePack = {
      status: 'grounded',
      refs: [
        {
          sourceSection: 'positioningVoiceOfCustomer',
          evidenceKind: 'quote',
          locator: 'voc#3',
          excerpt: 'Slow handoffs block campaign launch.',
        },
      ],
    };
    artifact.body.audienceTypes[1].dailyBudget = '$200/day';

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    const budgetBar = screen.getByTestId('budget-bar');
    const scoped = within(budgetBar);

    // The gap segment never prints its confident "$300/day" allocation; it reads
    // as a test/probe budget instead.
    expect(scoped.queryByText('$300/day')).not.toBeInTheDocument();
    expect(scoped.getByText(/test budget/i)).toBeInTheDocument();
    // The grounded segment still shows its confident money allocation.
    expect(scoped.getByText('$200/day')).toBeInTheDocument();
  });

  it('renders the Plan Provenance strip from evidenceBinding', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    (artifact.body as Record<string, unknown>).evidenceBinding = {
      groundedRows: 8,
      gapRows: 2,
      bindRate: 0.8,
    };

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    const strip = screen.getByTestId('plan-provenance-strip');
    expect(strip).toBeInTheDocument();
    expect(strip).toHaveTextContent('8 of 10 rows traced');
    expect(strip).toHaveTextContent('2 gaps');
    // bindRate 0.8 >= 0.5 -> no red banner.
    expect(strip.className).not.toContain('border-red-500');
  });

  it('shows the red banner on the Plan Provenance strip when bindRate < 0.5', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    (artifact.body as Record<string, unknown>).evidenceBinding = {
      groundedRows: 3,
      gapRows: 7,
      bindRate: 0.3,
    };

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    const strip = screen.getByTestId('plan-provenance-strip');
    expect(strip.className).toContain('border-red-500');
  });

  it('renders no Plan Provenance strip when the body lacks evidenceBinding', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    expect(
      (artifact.body as Record<string, unknown>).evidenceBinding,
    ).toBeUndefined();

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    expect(screen.queryByTestId('plan-provenance-strip')).not.toBeInTheDocument();
  });

  it('shows a directional banner over the competitor exhibit when no row bound, without hiding the committed data', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    // Every competitor-sourced row carries an explicit gap pack (no upstream
    // Competitor Landscape row matched this run) and none grounded.
    const gapPack = {
      status: 'gap' as const,
      refs: [],
      note: 'No exact upstream row in positioningCompetitorLandscape matched this synthesized row; cited at section level only.',
    };
    for (const row of artifact.body.competitorMarketingInsights) {
      (row as Record<string, unknown>).evidencePack = gapPack;
    }
    for (const row of artifact.body.competitorReviewInsights) {
      (row as Record<string, unknown>).evidencePack = gapPack;
    }

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    // Binding-honest banner — NOT a false "section did not commit" pipeline claim.
    expect(
      screen.getByText(
        /No competitor rows bound to a committed Competitor Landscape row this run/,
      ),
    ).toBeInTheDocument();
    // The committed competitor data is shown as directional, NOT hidden.
    expect(screen.getAllByText('Competitor 1').length).toBeGreaterThanOrEqual(1);
  });

  it('keeps competitor tables when at least one competitor row is grounded', (): void => {
    const artifact = structuredClone(paidMediaPlanFixtureArtifact);
    (artifact.body.competitorMarketingInsights[0] as Record<string, unknown>).evidencePack =
      {
        status: 'grounded',
        refs: [
          {
            sourceSection: 'positioningCompetitorLandscape',
            evidenceKind: 'competitor',
            locator: 'body.competitorSet.competitors[0]',
            excerpt: 'Competitor 1 — workflow automation.',
          },
        ],
      };

    render(<PaidMediaPlanRenderer artifact={artifact} />);

    expect(
      screen.queryByText(
        /No competitor rows bound to a committed Competitor Landscape row this run/,
      ),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('Competitor 1').length).toBeGreaterThanOrEqual(1);
  });
});
