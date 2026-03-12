import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  JourneyProgressPanel,
  type ProgressItem,
} from '@/components/journey/journey-progress-panel';

const ITEMS: ProgressItem[] = [
  { id: 'industryMarket', label: 'Market Overview', status: 'complete', detail: 'Completed' },
  { id: 'competitors', label: 'Competitor Intel', status: 'active', detail: 'Processing data...' },
];

describe('JourneyProgressPanel', () => {
  it('renders the default variant without studio marker', () => {
    render(<JourneyProgressPanel items={ITEMS} />);

    const panel = screen.getByTestId('journey-progress-panel');

    expect(panel).toHaveAttribute('data-variant', 'default');
    expect(panel).not.toHaveClass('journey-studio-progress-panel');
    expect(screen.getByText('Journey Progress')).toBeInTheDocument();
  });

  it('renders the studio variant marker and premium wrapper classes', () => {
    render(<JourneyProgressPanel items={ITEMS} variant="studio" />);

    const panel = screen.getByTestId('journey-progress-panel');

    expect(panel).toHaveAttribute('data-variant', 'studio');
    expect(panel).toHaveClass('journey-studio-progress-panel');
    expect(screen.getByText('Compute Node')).toBeInTheDocument();
  });
});
