/** @vitest-environment jsdom */
import { render, screen, within } from '@testing-library/react';
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
  it('renders the editorial template, competitor summary cards, and 2x2', () => {
    render(<CompetitorLandscapeRenderer artifact={makeManagedArtifact()} />);

    expect(screen.getByTestId('verdict-hero')).toBeInTheDocument();
    expect(screen.getByTestId('key-findings')).toBeInTheDocument();
    expect(screen.getByTestId('positioning-2x2')).toBeInTheDocument();
    expect(screen.getAllByTestId('ad-evidence-group').length).toBeGreaterThan(0);

    const blocks = screen.getAllByTestId('subsection');
    expect(blocks).toHaveLength(7);
    expect(blocks[0]).toHaveTextContent('Competitor set');
    expect(blocks[2]).toHaveTextContent('Pricing reality');
    expect(blocks[6]).toHaveTextContent('Ad evidence');
  });

  it('keeps earned comparison tables behind exhibits except pricing', () => {
    render(<CompetitorLandscapeRenderer artifact={makeManagedArtifact()} />);

    expect(screen.getByText(/Exhibits: full competitor comparison/i)).toBeInTheDocument();
    expect(screen.getByText(/Exhibits: share-of-voice rows/i)).toBeInTheDocument();
    expect(screen.getByText(/Exhibits: narrative arc table/i)).toBeInTheDocument();
    expect(screen.getByText(/Pricing reality/i)).toBeInTheDocument();
  });

  it('renders verified creative cards in the curated gallery', () => {
    const artifact = withAdvertiserGroups([
      makeGroup({
        advertiserName: 'AcmeAds',
        platforms: ['meta'],
        verifiedCount: 1,
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
            source: null,
            transcript: null,
            cta: null,
            verified: true,
          },
        ],
        libraryLinks: {
          meta: 'https://www.facebook.com/ads/library/?q=AcmeAds',
        },
      }),
    ]);

    render(<CompetitorLandscapeRenderer artifact={artifact} />);

    const groups = screen.getAllByTestId('ad-evidence-group');
    expect(groups[0]).toHaveTextContent('1 verified');
    expect(screen.getByTestId('creative-headline')).toHaveTextContent(
      'Ship pipeline reviews in minutes',
    );
  });

  it('routes unverified-only creatives to a GapNote instead of client-facing raw counters', () => {
    const artifact = withAdvertiserGroups([
      makeGroup({
        advertiserName: 'Notion',
        platforms: ['meta'],
        verifiedCount: 0,
        quarantinedCount: 41,
        creatives: [
          {
            id: 'notion-q1',
            platform: 'meta',
            advertiserName: 'Notion',
            headline: 'All-in-one workspace',
            body: 'Docs, projects, and company knowledge in one place.',
            landingUrl: null,
            creativeUrl: null,
            imageUrl: null,
            videoUrl: null,
            detailsUrl: 'https://www.facebook.com/ads/library/?id=notion-q1',
            sourceUrl: 'https://www.facebook.com/ads/library/?id=notion-q1',
            firstSeen: null,
            lastSeen: null,
            format: 'text',
            isActive: true,
            source: null,
            transcript: null,
            cta: null,
            verified: false,
            identityBasis: 'name_only',
          },
        ],
        dataGaps: [
          {
            reason:
              'Identity-unverified ad signals only: verifiedCount=0; quarantinedCount=41.',
          },
        ],
      }),
    ]);

    render(<CompetitorLandscapeRenderer artifact={artifact} />);

    expect(screen.getAllByTestId('gap-note').length).toBeGreaterThanOrEqual(1);
    expect(screen.queryByText(/verifiedCount=0/i)).not.toBeInTheDocument();
    expect(screen.queryByText('All-in-one workspace')).not.toBeInTheDocument();
  });

  it('keeps lookup diagnostics behind an exhibit and rewrites budget text', () => {
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

    expect(screen.getByText(/Exhibits: evidence diagnostics/i)).toBeInTheDocument();
    expect(screen.queryByText(/budget exhausted/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/not enough public evidence was found/i).length).toBeGreaterThan(0);
    const group = screen.getByTestId('ad-evidence-group');
    expect(within(group).getByRole('link')).toHaveAttribute(
      'href',
      'https://adstransparency.google.com/?region=US&query=CappedCo',
    );
  });
});
