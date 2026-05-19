import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ClusterVenueCard } from '../cluster-venue-card';
import { clusterVenueFixture } from './test-fixtures';

describe('ClusterVenueCard', () => {
  it('renders bucket type, venue name, audience size, rationale, and source link', () => {
    render(<ClusterVenueCard venue={clusterVenueFixture} />);

    expect(screen.getByText('slack-group')).toBeInTheDocument();
    expect(screen.getByText('RevOps Co-op')).toBeInTheDocument();
    expect(screen.getByText('15,000+ members')).toBeInTheDocument();
    expect(
      screen.getByText('Operators ask tactical attribution and forecasting questions there.'),
    ).toBeInTheDocument();

    const sourceLink = screen.getByRole('link', {
      name: 'Open source for RevOps Co-op',
    });
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/revops-coop');
  });
});
