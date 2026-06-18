import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ExecutiveBriefCard } from '../executive-brief-card';

describe('ExecutiveBriefCard', () => {
  it('renders fact reconciliation as client sentences without the raw readings wall', () => {
    const { container } = render(
      <ExecutiveBriefCard
        brief={{
          executiveThesis: 'The report supports a focused capture thesis.',
          factConflicts: [
            {
              factKey: 'customer-count',
              label: 'Customer count',
              readings: [
                { sectionId: 'positioningBuyerICP', value: '50%' },
                { sectionId: 'positioningOfferDiagnostic', value: '500,000+' },
              ],
              resolution:
                'Customer count: we use 500,000+ (measured); 1 conflicting figure set aside.',
              setAsideCount: 1,
              winningSectionId: 'positioningOfferDiagnostic',
            },
          ],
          rankedMoves: [
            {
              move: 'Launch the verified comparison campaign.',
              provingSections: ['positioningDemandIntent'],
              rank: 1,
            },
          ],
          status: 'complete',
        }}
        sectionLabelOf={(sectionId) =>
          sectionId === 'positioningBuyerICP'
            ? 'Buyer & ICP Validation'
            : 'Offer Diagnostic'
        }
      />,
    );

    expect(screen.getByText('Customer count')).toBeInTheDocument();
    expect(
      screen.getByText(/we use 500,000\+ \(measured\)/i),
    ).toBeInTheDocument();
    expect(container.textContent).not.toContain('Buyer & ICP Validation: 50%');
    expect(container.textContent).not.toContain(
      'Offer Diagnostic: 500,000+',
    );
  });

  it('suppresses an out-of-context monthly-budget reconciliation from the appendix', () => {
    const { container } = render(
      <ExecutiveBriefCard
        brief={{
          executiveThesis: 'The report supports a focused capture thesis.',
          factConflicts: [
            {
              factKey: 'monthly-budget',
              label: 'Monthly budget',
              readings: [
                { sectionId: 'positioningPaidMediaPlan', value: '$100' },
              ],
              resolution: 'Monthly budget: we use $100 (user-supplied).',
              winningSectionId: 'positioningPaidMediaPlan',
            },
            {
              factKey: 'customer-count',
              label: 'Customer count',
              readings: [
                { sectionId: 'positioningOfferDiagnostic', value: '500,000+' },
              ],
              resolution:
                'Customer count: we use 500,000+ (measured); 1 conflicting figure set aside.',
              winningSectionId: 'positioningOfferDiagnostic',
            },
          ],
          rankedMoves: [],
          status: 'complete',
        }}
      />,
    );

    expect(container.textContent).not.toContain('$100');
    expect(container.textContent).not.toContain('Monthly budget');
    expect(screen.getByText('Customer count')).toBeInTheDocument();
  });

  it('omits The Three Moves when no real ranked moves exist', () => {
    render(
      <ExecutiveBriefCard
        brief={{
          executiveThesis: 'The report supports a focused capture thesis.',
          factConflicts: [],
          rankedMoves: [],
          status: 'complete',
        }}
      />,
    );

    expect(screen.queryByText('The Three Moves')).not.toBeInTheDocument();
  });
});
