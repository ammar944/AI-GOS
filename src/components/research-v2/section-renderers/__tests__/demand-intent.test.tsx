/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { DemandIntentRenderer } from '../demand-intent';
import { demandIntentArtifact } from './fixtures';

describe('DemandIntentRenderer', () => {
  it('renders the editorial template and five narrative blocks', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(/demand is visible/i);
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('Keyword demand');
    expect(blocks[1]).toHaveTextContent('Question mining');
    expect(blocks[2]).toHaveTextContent('Content gaps');
    expect(blocks[3]).toHaveTextContent('Intent signals');
    expect(blocks[4]).toHaveTextContent('Venue map');
  });

  it('keeps the keyword table as an exhibit with source chips', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(screen.getByText(/Exhibits: keyword table/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('keyword-item').length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText('$8.40 (SpyFu-estimated)')).toBeInTheDocument();
  });

  it('renders buyer questions as quote cards', () => {
    render(<DemandIntentRenderer artifact={demandIntentArtifact} />);

    expect(screen.getAllByTestId('quote-card').length).toBeGreaterThanOrEqual(3);
    expect(screen.getAllByText(/automate lead routing/i).length).toBeGreaterThanOrEqual(2);
  });

  it('renders validator-style intent gaps as GapNote, never raw validator text', () => {
    const artifact = structuredClone(demandIntentArtifact);
    artifact.intentSignals.items[0].description = 'validator requires >=5 intent signals';
    artifact.questionMining.questions = [];

    render(<DemandIntentRenderer artifact={artifact} />);

    expect(screen.queryByText(/validator requires/i)).not.toBeInTheDocument();
    expect(screen.getAllByTestId('gap-note').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryAllByTestId('question-item')).toHaveLength(0);
  });
});
