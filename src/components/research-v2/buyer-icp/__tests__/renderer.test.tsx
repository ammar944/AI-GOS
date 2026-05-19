import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BuyerICPArtifactRenderer } from '../renderer';
import { buyerIcpArtifactFixture } from './test-fixtures';

describe('BuyerICPArtifactRenderer', () => {
  it('renders the artifact header, all five sub-sections in canonical order, cards, and collapsible sources', () => {
    render(<BuyerICPArtifactRenderer artifact={buyerIcpArtifactFixture} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Buyer & ICP Validation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The ICP exists and is reachable through public RevOps channels.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Confidence 8/10')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Named operators, firmographic cuts, and cluster venues all point to a reachable ICP.',
      ),
    ).toBeInTheDocument();

    const headings = screen.getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent);
    expect(headings).toEqual([
      'ICP existence check',
      'Persona reality',
      'Awareness distribution',
      'Buying context',
      'Where they cluster',
    ]);

    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(
      screen.getByText('B2B SaaS companies with 200-1000 employees'),
    ).toBeInTheDocument();
    expect(screen.getByText('problem-aware')).toBeInTheDocument();
    expect(screen.getByText('New RevOps leader hired')).toBeInTheDocument();
    expect(screen.getByText('RevOps Co-op')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Sources (2)' }));
    const sources = screen.getByRole('list', { name: 'Buyer ICP sources' });
    expect(within(sources).getByText('LinkedIn company search')).toBeInTheDocument();
    expect(within(sources).getAllByText('2026-05-15')).toHaveLength(2);
    expect(
      within(sources).getByRole('link', { name: 'Open source: LinkedIn company search' }),
    ).toHaveAttribute('href', 'https://example.com/linkedin-search');
  });
});
