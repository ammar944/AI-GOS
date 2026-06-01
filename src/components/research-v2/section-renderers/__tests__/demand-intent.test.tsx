/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { DemandIntentRenderer } from '../demand-intent';
import { demandIntentArtifact } from './fixtures';

describe('DemandIntentRenderer', () => {
  it('renders five subsection blocks in plan order', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('1 · Keyword Demand');
    expect(blocks[1]).toHaveTextContent('2 · Question Mining');
    expect(blocks[2]).toHaveTextContent('3 · Content Gaps');
    expect(blocks[3]).toHaveTextContent('4 · Intent Signals');
    expect(blocks[4]).toHaveTextContent('5 · Venue Map');
  });

  it('renders at least three keyword rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    const items = screen.getAllByTestId('keyword-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the CPC value for a keyword row that has cpc, and an em-dash for rows without', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    // Fixture row 0 carries cpc; later rows do not.
    expect(screen.getByText('$8.40 (SpyFu-estimated)')).toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);
  });

  it('renders at least three question rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    const items = screen.getAllByTestId('question-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three content-gap rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    const items = screen.getAllByTestId('gap-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three intent-signal rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    const items = screen.getAllByTestId('intent-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three venue rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);
    const items = screen.getAllByTestId('venue-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });
});
