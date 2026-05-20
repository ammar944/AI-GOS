/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { DemandIntentRenderer } from '../demand-intent';
import fixture from '../../../../../tmp/managed-agents-section-canary-positioningDemandIntent-1779217686293-artifact.json';
import type { DemandIntentArtifact } from '@/lib/managed-agents/schemas/demand-intent-signals';

const artifact = fixture as unknown as DemandIntentArtifact;

describe('DemandIntentRenderer', () => {
  it('renders five subsection blocks in plan order', () => {
    render(<DemandIntentRenderer artifact={artifact} />);
    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(5);
    expect(blocks[0]).toHaveTextContent('1 · Keyword Demand');
    expect(blocks[1]).toHaveTextContent('2 · Question Mining');
    expect(blocks[2]).toHaveTextContent('3 · Content Gaps');
    expect(blocks[3]).toHaveTextContent('4 · Intent Signals');
    expect(blocks[4]).toHaveTextContent('5 · Venue Map');
  });

  it('renders at least three keyword rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('keyword-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three question rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('question-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three content-gap rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('gap-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three intent-signal rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('intent-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });

  it('renders at least three venue rows from the fixture', () => {
    render(<DemandIntentRenderer artifact={artifact} />);
    const items = screen.getAllByTestId('venue-item');
    expect(items.length).toBeGreaterThanOrEqual(3);
  });
});
