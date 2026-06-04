/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { MarketCategoryRenderer } from '../market-category';
import { marketCategoryArtifact } from './fixtures';

describe('MarketCategoryRenderer', () => {
  it('renders four subsection blocks in plan order', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toHaveTextContent('1 · Category Definition');
    expect(blocks[1]).toHaveTextContent('2 · Market Size');
    expect(blocks[2]).toHaveTextContent('3 · Structural Forces');
    expect(blocks[3]).toHaveTextContent('4 · Category Maturity');
  });

  it('renders at least two adjacent-category rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);
    const items = screen.getAllByTestId('adjacent-item');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('renders at least three market-size signal rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);
    const items = screen.getAllByTestId('signal-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders the four bottom-up TAM input rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);
    const items = screen.getAllByTestId('tam-input-item');
    expect(items).toHaveLength(4);
    expect(screen.getByText(/directional reachable revenue/i)).toBeInTheDocument();
    expect(screen.getByText('Keyword sample')).toBeInTheDocument();
    expect(screen.getAllByText('2026-05-20').length).toBeGreaterThanOrEqual(1);
  });

  it('renders evidence-gap TAM rows for legacy artifacts without bottomUpTam', () => {
    const legacyMarketSize = {
      prose: marketCategoryArtifact.marketSize.prose,
      signals: marketCategoryArtifact.marketSize.signals,
    };
    const legacyArtifact = {
      ...marketCategoryArtifact,
      marketSize: legacyMarketSize,
    } as unknown as typeof marketCategoryArtifact;

    render(<MarketCategoryRenderer artifact={legacyArtifact} />);

    const items = screen.getAllByTestId('tam-input-item');
    expect(items).toHaveLength(4);
    expect(
      screen.getByText(
        /this saved Market Category artifact predates bottom-up TAM input capture/i,
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/not captured in this saved artifact/i)).toHaveLength(4);
  });

  it('renders at least three structural-force rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);
    const items = screen.getAllByTestId('force-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('surfaces the category-maturity stage classification in the fourth block', () => {
    render(<MarketCategoryRenderer artifact={marketCategoryArtifact} />);
    const blocks = screen.getAllByTestId('subsection');
    const maturityBlock = blocks[3];
    const stage = marketCategoryArtifact.categoryMaturity.classification.stage;
    // Renderer title-cases the enum, so match case-insensitively.
    expect(maturityBlock.textContent?.toLowerCase()).toContain(stage.toLowerCase());
  });
});
