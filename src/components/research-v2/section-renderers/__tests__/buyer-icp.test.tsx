/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import type { BuyerICPArtifact } from '@/types/positioning-artifact';

import {
  BuyerICPRenderer,
  isBuyerICPHonestlyUnavailable,
} from '../buyer-icp';
import { buyerIcpArtifact } from './fixtures';

function buildHonestlyUnavailableBuyerIcp(): BuyerICPArtifact {
  const artifact: BuyerICPArtifact = structuredClone(buyerIcpArtifact);
  artifact.confidence = 0.1;
  artifact.icpExistenceCheck.firmographicCuts = [];
  artifact.icpExistenceCheck.blockGap = {
    summary: 'evidence gap: section exceeded its time budget — rerun to retry',
    foundCount: 0,
    requiredCount: 3,
    sourcingPlan: ['Rerun this section to retry — it exceeded its time budget'],
  };
  artifact.personaReality.personas = [];
  artifact.awarenessDistribution.levels = [];
  artifact.buyingContext.triggers = [];
  artifact.clusters.venues = [];
  return artifact;
}

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

  it('detects a wholly-empty artifact as honestly unavailable', () => {
    expect(isBuyerICPHonestlyUnavailable(buyerIcpArtifact)).toBe(false);
    expect(
      isBuyerICPHonestlyUnavailable(buildHonestlyUnavailableBuyerIcp()),
    ).toBe(true);
  });

  it('renders ONE compact honest gap note, not five carpet-bombed panels, when wholly unavailable', () => {
    render(
      <BuyerICPRenderer artifact={buildHonestlyUnavailableBuyerIcp()} />,
    );

    expect(
      screen.getByTestId('buyer-icp-honestly-unavailable'),
    ).toBeInTheDocument();
    // Exactly one quiet trust note — no subsection walls.
    expect(screen.getAllByTestId('gap-note')).toHaveLength(1);
    expect(screen.queryAllByTestId('subsection')).toHaveLength(0);
    expect(screen.queryAllByTestId('persona-card')).toHaveLength(0);
    expect(screen.queryAllByTestId('firmographic-item')).toHaveLength(0);
    // Honest framing, never the raw pipeline placeholder string.
    expect(
      screen.getByText(/Not enough public evidence was found/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/exceeded its time budget — rerun to retry/i),
    ).not.toBeInTheDocument();
  });

  it('keeps the full body for a PARTIAL shortfall (one block populated)', () => {
    const artifact = buildHonestlyUnavailableBuyerIcp();
    // Restore one block — this is a partial shortfall, not wholly unavailable.
    artifact.personaReality.personas =
      structuredClone(buyerIcpArtifact).personaReality.personas;

    expect(isBuyerICPHonestlyUnavailable(artifact)).toBe(false);

    render(<BuyerICPRenderer artifact={artifact} />);

    expect(
      screen.queryByTestId('buyer-icp-honestly-unavailable'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByTestId('subsection')).toHaveLength(5);
    expect(screen.getAllByTestId('persona-card').length).toBeGreaterThanOrEqual(1);
  });
});
