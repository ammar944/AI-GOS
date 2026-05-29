/** @vitest-environment jsdom */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { competitorLandscapeFixtureArtifact } from '@/lib/lab-engine/fixtures/competitor-landscape-artifact';
import type { CompetitorLandscapeArtifact } from '@/types/positioning-artifact';
import { CompetitorLandscapeRenderer } from '../competitor-landscape';

type AdEvidenceGroup =
  CompetitorLandscapeArtifact['adEvidence']['advertiserGroups'][number];

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

function makeGroup(overrides: Partial<AdEvidenceGroup>): AdEvidenceGroup {
  return {
    advertiserName: 'AcmeAds',
    domain: null,
    platforms: ['google'],
    rawCounts: { google: 0, meta: 0, linkedin: 0 },
    displayableCounts: { google: 0, meta: 0, linkedin: 0 },
    displayableTotal: 0,
    returnedCreativeCount: 0,
    creatives: [],
    libraryLinks: {},
    rawSourceSamples: [],
    dataGaps: [],
    sourceErrors: [],
    observedAt: '2026-05-20T15:45:00.000Z',
    ...overrides,
  };
}

function withAdvertiserGroups(
  advertiserGroups: AdEvidenceGroup[],
): CompetitorLandscapeArtifact {
  const base = makeManagedArtifact();
  return {
    ...base,
    adEvidence: { prose: base.adEvidence.prose, advertiserGroups },
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
    expect(blocks[7]).toHaveTextContent('Turn scattered GTM signals into account priorities');
    expect(within(blocks[7]).getByTestId('library-link-linkedin-ads')).toBeInTheDocument();
  });

  it('renders creative cards in the ads-found state when an advertiser has creatives', () => {
    const artifact = withAdvertiserGroups([
      makeGroup({
        advertiserName: 'AcmeAds',
        platforms: ['meta'],
        rawCounts: { google: 0, meta: 1, linkedin: 0 },
        displayableCounts: { google: 0, meta: 1, linkedin: 0 },
        displayableTotal: 1,
        returnedCreativeCount: 1,
        creatives: [
          {
            id: 'ad_meta_acmeads_0',
            platform: 'meta',
            advertiserName: 'AcmeAds',
            headline: 'Ship pipeline reviews in minutes',
            body: 'Automated account prioritisation for revenue teams.',
            landingUrl: null,
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: null,
            sourceUrl: 'https://example.com/fixtures/ad-library/acmeads-meta',
            firstSeen: '2026-04-08',
            lastSeen: '2026-05-18',
            format: 'text',
            isActive: true,
          },
        ],
        libraryLinks: {
          meta: 'https://www.facebook.com/ads/library/?q=AcmeAds',
        },
      }),
    ]);

    render(<CompetitorLandscapeRenderer artifact={artifact} />);

    const group = screen.getByTestId('ad-evidence-group');
    expect(group).toHaveAttribute('data-state', 'ads-found');
    expect(within(group).getByTestId('creative-headline')).toHaveTextContent(
      'Ship pipeline reviews in minutes',
    );
    // Source link falls back to sourceUrl when detailsUrl is null.
    expect(
      within(group).getByRole('link', { name: /View ad/i }),
    ).toHaveAttribute(
      'href',
      'https://example.com/fixtures/ad-library/acmeads-meta',
    );
  });

  it('renders the lookup-capped state with a transparency link when a budget gap blocks lookup', () => {
    const artifact = withAdvertiserGroups([
      makeGroup({
        advertiserName: 'CappedCo',
        platforms: ['google'],
        creatives: [],
        libraryLinks: {
          google: 'https://adstransparency.google.com/?region=US&query=CappedCo',
        },
        dataGaps: [
          {
            platform: 'google',
            reason:
              'google lookup failed: section budget exhausted after 4 lookups',
          },
        ],
      }),
    ]);

    render(<CompetitorLandscapeRenderer artifact={artifact} />);

    const group = screen.getByTestId('ad-evidence-group');
    expect(group).toHaveAttribute('data-state', 'lookup-capped');
    expect(within(group).getByTestId('ad-evidence-state-lookup-capped')).toHaveTextContent(
      /Lookup capped/i,
    );
    // It must NOT collapse to an empty row — a transparency link is present.
    expect(within(group).getByTestId('transparency-link-google')).toHaveAttribute(
      'href',
      'https://adstransparency.google.com/?region=US&query=CappedCo',
    );
    expect(group).not.toHaveAttribute('data-state', 'no-active-ads');
  });

  it('renders no-active-ads and not-checked honest states', () => {
    const artifact = withAdvertiserGroups([
      makeGroup({
        advertiserName: 'QuietCo',
        platforms: ['meta'],
        creatives: [],
        dataGaps: [
          { platform: 'meta', reason: 'meta returned no raw ad-library rows for this advertiser.' },
        ],
      }),
      makeGroup({
        advertiserName: 'UnknownCo',
        platforms: [],
        creatives: [],
      }),
    ]);

    render(<CompetitorLandscapeRenderer artifact={artifact} />);

    const groups = screen.getAllByTestId('ad-evidence-group');
    expect(groups[0]).toHaveAttribute('data-state', 'no-active-ads');
    expect(within(groups[0]).getByTestId('ad-evidence-state-no-active-ads')).toHaveTextContent(
      /No active ads found/i,
    );
    expect(groups[1]).toHaveAttribute('data-state', 'not-checked');
    expect(within(groups[1]).getByTestId('ad-evidence-state-not-checked')).toHaveTextContent(
      /Not yet checked/i,
    );
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
