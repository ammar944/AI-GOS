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

  it('renders data gaps as an em-dash with no source link, and a compact line for empty question mining', () => {
    const artifact = structuredClone(demandIntentArtifact);
    const gapRow = artifact.keywordDemand.keywords[1];
    gapRow.monthlyVolume = 'Data gap: keyword_volume tool returned no rows';
    gapRow.sourceUrl = 'keyword_volume tool data gap';
    artifact.questionMining.questions = [];

    render(<DemandIntentRenderer artifact={artifact} />);

    // Gap volumes read as an em-dash, never as apology prose.
    expect(
      screen.queryByText('Data gap: keyword_volume tool returned no rows'),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText('—').length).toBeGreaterThan(0);

    // Non-URL source strings never render as link text or anchors.
    expect(
      screen.queryByText('keyword_volume tool data gap'),
    ).not.toBeInTheDocument();
    expect(
      screen
        .getAllByRole('link')
        .some(
          (link) =>
            link.getAttribute('href') === 'keyword_volume tool data gap',
        ),
    ).toBe(false);

    // Empty question mining renders one compact gap line, not an empty table.
    expect(screen.getByTestId('question-mining-gap')).toHaveTextContent(
      'No buyer questions were captured for this run.',
    );
    expect(screen.queryAllByTestId('question-item')).toHaveLength(0);
  });
});
