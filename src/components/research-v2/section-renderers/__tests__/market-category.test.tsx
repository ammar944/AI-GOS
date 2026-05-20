/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { MarketCategoryRenderer } from '../market-category';
import fixture from '../../../../../tmp/managed-agents-section-canary-positioningMarketCategory-1779217459981-artifact.json';
import type { MarketCategoryArtifact } from '@/lib/managed-agents/schemas/market-category';

const artifact = fixture as unknown as MarketCategoryArtifact;

describe('MarketCategoryRenderer', () => {
  it('renders four subsection blocks in plan order', () => {
    render(<MarketCategoryRenderer artifact={artifact} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(4);
    expect(blocks[0]).toHaveTextContent('1 · Category Definition');
    expect(blocks[1]).toHaveTextContent('2 · Market Size');
    expect(blocks[2]).toHaveTextContent('3 · Structural Forces');
    expect(blocks[3]).toHaveTextContent('4 · Category Maturity');
  });

  it('renders at least two adjacent-category rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('adjacent-item');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('renders at least three market-size signal rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('signal-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three structural-force rows from the fixture', () => {
    render(<MarketCategoryRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('force-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('surfaces the category-maturity stage classification in the fourth block', () => {
    render(<MarketCategoryRenderer artifact={artifact} />);
    const blocks = screen.getAllByTestId('subsection');
    const maturityBlock = blocks[3];
    const stage = artifact.categoryMaturity.classification.stage;
    // Renderer title-cases the enum, so match case-insensitively.
    expect(maturityBlock.textContent?.toLowerCase()).toContain(stage.toLowerCase());
  });
});
