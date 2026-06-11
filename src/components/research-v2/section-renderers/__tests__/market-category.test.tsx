/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { MarketCategoryRenderer } from '../market-category';
import { marketCategoryArtifact } from './fixtures';

describe('MarketCategoryRenderer', () => {
  it('renders the editorial section template', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);

    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(
      /workflow automation category/i,
    );
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
    expect(screen.getByTestId('section-coverage-note')).toHaveTextContent(
      /what we verified/i,
    );
  });

  it('renders four narrative blocks with compact category cards and TAM formula', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);

    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toHaveTextContent('Category definition');
    expect(blocks[1]).toHaveTextContent('Market size');
    expect(blocks[2]).toHaveTextContent('Structural forces');
    expect(blocks[3]).toHaveTextContent('Category maturity');
    expect(screen.getByText('Task management')).toBeInTheDocument();
    expect(screen.getByText(/Formula:/i)).toHaveTextContent(/keyword volume/i);
    expect(screen.getByText(/directional reachable revenue/i)).toBeInTheDocument();
  });

  it('keeps market signal rows inside an exhibit', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);

    expect(screen.getByText(/Exhibits: market signals/i)).toBeInTheDocument();
    expect(screen.getAllByTestId('signal-item').length).toBeGreaterThanOrEqual(3);
  });

  it('renders a client-plain gap for legacy artifacts without bottomUpTam', () => {
    const legacyMarketSize = {
      prose: marketCategoryArtifact.marketSize.prose,
      signals: marketCategoryArtifact.marketSize.signals,
    };
    const legacyArtifact = {
      ...marketCategoryArtifact,
      marketSize: legacyMarketSize,
    } as unknown as typeof marketCategoryArtifact;

    render(<MarketCategoryRenderer artifact={legacyArtifact} />);

    expect(screen.getAllByTestId('gap-note')[0]).toHaveTextContent(
      /not enough public evidence was found/i,
    );
  });
});
