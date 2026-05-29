import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { BuyerICPArtifact } from '@/types/buyer-icp-artifact';

import { BuyerICPArtifactRenderer } from '../renderer';
import {
  buyerIcpArtifactFixture,
  firmographicCutFixture,
} from './test-fixtures';

describe('BuyerICPArtifactRenderer', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces unique keys when sources and cards share the same URL', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const duplicateUrl = 'https://saaslaunch.net/';
    const duplicateArtifact: BuyerICPArtifact = {
      ...buyerIcpArtifactFixture,
      sources: [
        {
          title: 'SaaS Launch — page A',
          url: duplicateUrl,
          whyItMatters: 'First reference.',
          accessedAt: '2026-05-15',
        },
        {
          title: 'SaaS Launch — page B',
          url: duplicateUrl,
          whyItMatters: 'Second reference to the same URL.',
          accessedAt: '2026-05-15',
        },
      ],
      icpExistenceCheck: {
        prose: buyerIcpArtifactFixture.icpExistenceCheck.prose,
        firmographicCuts: [
          { ...firmographicCutFixture, sourceUrl: duplicateUrl },
          { ...firmographicCutFixture, sourceUrl: duplicateUrl },
        ],
      },
    };

    render(<BuyerICPArtifactRenderer artifact={duplicateArtifact} />);

    // Both duplicate-URL cards render (composite keys keep them distinct).
    expect(
      screen.getAllByText(firmographicCutFixture.value).length,
    ).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole('button', { name: 'Sources (2)' }));
    const sources = screen.getByRole('list', { name: 'Buyer ICP sources' });
    expect(within(sources).getByText('SaaS Launch — page A')).toBeInTheDocument();
    expect(within(sources).getByText('SaaS Launch — page B')).toBeInTheDocument();

    // No React "two children with the same key" warning.
    const keyWarnings = errorSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' ? message.includes('same key') : false,
    );
    expect(keyWarnings).toEqual([]);
  });

  it('renders the artifact header, all five sub-sections in canonical order, cards, and collapsible sources', () => {
    render(<BuyerICPArtifactRenderer artifact={buyerIcpArtifactFixture} />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Buyer & ICP Validation' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('The ICP exists and is reachable through public RevOps channels.'),
    ).toBeInTheDocument();
    // Section-level model confidence is no longer displayed (it was uncorrelated
    // with grounding); the header shows only the title, verdict, and summary.
    expect(screen.queryByText(/Confidence \d/)).not.toBeInTheDocument();
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
