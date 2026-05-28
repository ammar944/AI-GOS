/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import type { CompetitorLandscapeArtifact } from '@/lib/managed-agents/schemas/competitor-landscape';
import { CompetitorLandscapeRenderer } from '../competitor-landscape';

function makeManagedArtifact(): CompetitorLandscapeArtifact {
  return {
    sectionTitle: competitorLandscapeFixtureArtifact.sectionTitle,
    verdict: competitorLandscapeFixtureArtifact.verdict,
    statusSummary: competitorLandscapeFixtureArtifact.statusSummary,
    confidence: competitorLandscapeFixtureArtifact.confidence * 10,
    sources: competitorLandscapeFixtureArtifact.sources.map((source) => ({
      title: source.title,
      url: source.url,
    })),
    ...competitorLandscapeFixtureArtifact.body,
  };
}

describe('CompetitorLandscapeRenderer', () => {
  it('renders the ad-presence subsection from typed competitor artifacts', () => {
    render(<CompetitorLandscapeRenderer artifact={makeManagedArtifact()} />);

    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(8);
    expect(blocks[6]).toHaveTextContent('7 · Ad Presence');
    expect(blocks[6]).toHaveTextContent('SignalForge');
    expect(blocks[6]).toHaveTextContent('LinkedIn');
    expect(blocks[6]).toHaveTextContent('unknown; one displayable LinkedIn creative observed');
  });

  it('renders adEvidence creatives and library links', () => {
    render(<CompetitorLandscapeRenderer artifact={makeManagedArtifact()} />);

    const blocks = screen.getAllByTestId('subsection');
    expect(blocks[7]).toHaveTextContent('8 · Ad Evidence');
    expect(blocks[7]).toHaveTextContent('SignalForge');
    expect(blocks[7]).toHaveTextContent('raw 1 / displayable 1');
    expect(blocks[7]).toHaveTextContent('Turn scattered GTM signals into account priorities');
    expect(within(blocks[7]).getByTestId('library-link-linkedin-ads')).toBeInTheDocument();
  });

  it('renders an honest empty state when adEvidence has no advertiser groups', () => {
    const artifact = {
      ...makeManagedArtifact(),
      adEvidence: {
        prose: 'Ad library lookup completed with no displayable live creatives.',
        advertiserGroups: [],
      },
    };

    render(<CompetitorLandscapeRenderer artifact={artifact} />);

    const blocks = screen.getAllByTestId('subsection');
    expect(blocks[7]).toHaveTextContent('8 · Ad Evidence');
    expect(blocks[7]).toHaveTextContent('No live ad creatives captured for this audit.');
  });

  it('switches the competitor focus panel via competitor tabs', () => {
    render(<CompetitorLandscapeRenderer artifact={makeManagedArtifact()} />);

    const tablist = screen.getByRole('tablist', { name: 'Competitors' });
    expect(within(tablist).getAllByRole('tab')).toHaveLength(5);

    fireEvent.click(within(tablist).getByRole('tab', { name: /PipelinePilot/i }));

    const panel = screen.getByTestId('competitor-focus-panel');
    expect(within(panel).getByRole('heading', { name: 'PipelinePilot' })).toBeInTheDocument();
    expect(within(panel).getByText('CRM hygiene and stale-deal cleanup before pipeline review.')).toBeInTheDocument();
    expect(within(panel).getAllByText(/Google/).length).toBeGreaterThan(0);
    expect(within(panel).getByText(/Stale CRM data/)).toBeInTheDocument();
  });
});
