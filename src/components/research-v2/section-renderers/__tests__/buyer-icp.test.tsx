/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BuyerICPRenderer } from '../buyer-icp';
import { buyerIcpArtifact } from './fixtures';

describe('BuyerICPRenderer', () => {
  it('renders verdict, key findings, and ICP thesis', () => {
    render(<BuyerICPRenderer artifact={buyerIcpArtifact} />);

    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(
      /operations-led mid-market/i,
    );
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
    expect(screen.getByText('ICP thesis')).toBeInTheDocument();
    expect(screen.getByText('Who pays')).toBeInTheDocument();
    expect(
      screen.getAllByText(
        /excludes lower-complexity teams that only want lightweight task automation/i,
      ).length,
    ).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/low-complexity teams without/i)).not.toBeInTheDocument();
  });

  it('shows the status summary once — as the verdict, never duplicated as a key finding', () => {
    render(<BuyerICPRenderer artifact={buyerIcpArtifact} />);

    expect(
      screen.getAllByText(/converge on RevOps and CX Ops buyers/i),
    ).toHaveLength(1);
  });

  it('renders five narrative blocks with expected labels', () => {
    render(<BuyerICPRenderer artifact={buyerIcpArtifact} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('ICP existence');
    expect(blocks[1]).toHaveTextContent('Persona reality');
    expect(blocks[2]).toHaveTextContent('Awareness distribution');
    expect(blocks[3]).toHaveTextContent('Buying context');
    expect(blocks[4]).toHaveTextContent('Clusters and venues');
  });

  it('renders persona evidence cards, awareness bar, and suppressible venues', () => {
    render(<BuyerICPRenderer artifact={buyerIcpArtifact} />);

    expect(screen.getAllByTestId('persona-card').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Awareness mix')).toBeInTheDocument();
    expect(screen.getAllByTestId('cluster-item').length).toBeGreaterThanOrEqual(2);
  });

  it('suppresses placeholder venues from render', () => {
    const artifact = structuredClone(buyerIcpArtifact);
    artifact.clusters.venues.push({
      bucketType: 'community',
      name: 'Placeholder Venue',
      audienceSize: 'unknown',
      sourceUrl: 'https://placeholder.invalid',
      whyItMatters: 'Should not render.',
    });

    render(<BuyerICPRenderer artifact={artifact} />);

    expect(screen.queryByText('Placeholder Venue')).not.toBeInTheDocument();
  });
});
