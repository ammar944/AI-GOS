import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { paidMediaPlanFixtureArtifact } from '@/lib/lab-engine/fixtures/paid-media-plan-artifact';
import { PaidMediaPlanRenderer } from '../paid-media-plan';

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
    expect(within(renderer).getByText('Testing')).toBeInTheDocument();
    expect(
      within(renderer).getByText('Stop losing qualified pipeline to manual handoffs 1.'),
    ).toBeInTheDocument();
    expect(within(renderer).getAllByText('Free audit').length).toBeGreaterThan(0);
    expect(within(renderer).getAllByText('MQLs').length).toBeGreaterThan(0);
  });
});
