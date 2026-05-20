/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { BuyerICPRenderer } from '../buyer-icp';
import fixture from '../../../../../tmp/managed-agents-section-canary-positioningBuyerICP-1779217681585-artifact.json';
import type { BuyerICPArtifact } from '@/lib/managed-agents/schemas/buyer-icp';

const artifact = fixture as unknown as BuyerICPArtifact;

describe('BuyerICPRenderer', () => {
  it('renders five subsection blocks in plan order', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('1 · ICP Existence Check');
    expect(blocks[1]).toHaveTextContent('2 · Persona Reality');
    expect(blocks[2]).toHaveTextContent('3 · Awareness Distribution');
    expect(blocks[3]).toHaveTextContent('4 · Buying Context');
    expect(blocks[4]).toHaveTextContent('5 · Clusters & Venues');
  });

  it('renders at least one firmographic-cut row from the fixture', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('firmographic-item');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('renders at least two persona cards from the fixture', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('persona-card');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('renders all five awareness rungs from the fixture', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('awareness-row');
    expect(items).toHaveLength(5);
  });

  it('renders at least one buying-trigger row from the fixture', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('trigger-item');
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  it('renders at least two cluster venues from the fixture', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('cluster-item');
    expect(items.length).toBeGreaterThanOrEqual(2);
  });

  it('surfaces prose for every sub-section', () => {
    render(<BuyerICPRenderer artifact={artifact} />);
    const proseBlocks = screen.getAllByTestId('subsection-prose');
    expect(proseBlocks).toHaveLength(5);
  });
});
