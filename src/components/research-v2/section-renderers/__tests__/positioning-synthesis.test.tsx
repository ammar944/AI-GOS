import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { positioningSynthesisFixtureArtifact } from '@/lib/lab-engine/fixtures/positioning-synthesis-artifact';
import { PositioningSynthesisRenderer } from '../positioning-synthesis';

describe('<PositioningSynthesisRenderer>', (): void => {
  it('renders the strategic thesis, contradiction, and ordered moves', (): void => {
    render(
      <PositioningSynthesisRenderer artifact={positioningSynthesisFixtureArtifact} />,
    );

    const renderer = screen.getByTestId('positioning-synthesis-renderer');

    expect(within(renderer).getByText('Strategic thesis')).toBeInTheDocument();
    expect(
      within(renderer).getAllByText(/time-to-first-campaign wedge/i).length,
    ).toBeGreaterThan(0);
    expect(
      within(renderer).getByText('Contradiction reconciliation'),
    ).toBeInTheDocument();
    expect(
      within(renderer).getByText(/Lead with the narrower/i),
    ).toBeInTheDocument();
    expect(within(renderer).getByText('Ordered moves')).toBeInTheDocument();
    expect(
      within(renderer).getByText(/Launch the time-to-first-campaign wedge/i),
    ).toBeInTheDocument();
    expect(
      within(renderer).getByText(/This directly tests the thesis/i),
    ).toBeInTheDocument();
    expect(within(renderer).getAllByText('positioningVoiceOfCustomer').length).toBeGreaterThan(0);
  });
});
