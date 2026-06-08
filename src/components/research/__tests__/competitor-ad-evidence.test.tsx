import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  CompetitorAdEvidence,
  type CompetitorAdEvidenceProps,
} from '../competitor-ad-evidence';

const FIXTURE: CompetitorAdEvidenceProps = {
  adActivity: {
    activeAdCount: 8,
    platforms: ['LinkedIn', 'Google'],
    themes: ['Pipeline growth'],
    evidence: 'Observed 8 current ad-library records.',
    sourceConfidence: 'medium',
  },
  adCreatives: [
    {
      platform: 'meta',
      id: 'meta-1',
      advertiser: 'Hey Digital',
      headline: 'Pipeline growth without attribution guesswork',
      format: 'image',
      isActive: true,
      detailsUrl: 'https://www.facebook.com/ads/library/?id=123',
    },
    {
      platform: 'linkedin',
      id: 'li-1',
      advertiser: 'Hey Digital',
      headline: 'Scale B2B SaaS pipeline',
      format: 'video',
      isActive: true,
      videoUrl: 'https://cdn.example.com/ad.mp4',
      detailsUrl: 'https://www.linkedin.com/ad-library/detail/1',
    },
  ],
  libraryLinks: {
    metaLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=ALL&q=Hey%20Digital',
    linkedInLibraryUrl:
      'https://www.linkedin.com/ad-library/search?keyword=Hey%20Digital',
    googleAdvertiserUrl:
      'https://adstransparency.google.com/advertiser/AR123?region=US',
  },
};

describe('CompetitorAdEvidence', () => {
  it('renders creative headlines when adCreatives are provided', () => {
    render(<CompetitorAdEvidence {...FIXTURE} />);

    const headlines = screen.getAllByTestId('creative-headline');
    expect(headlines).toHaveLength(2);
    expect(headlines[0]).toHaveTextContent(
      'Pipeline growth without attribution guesswork',
    );
    expect(headlines[1]).toHaveTextContent('Scale B2B SaaS pipeline');
  });

  it('renders Meta Library link', () => {
    render(<CompetitorAdEvidence {...FIXTURE} />);

    const link = screen.getByTestId('library-link-meta-library');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('facebook.com/ads/library'),
    );
  });

  it('renders LinkedIn Ads link', () => {
    render(<CompetitorAdEvidence {...FIXTURE} />);

    const link = screen.getByTestId('library-link-linkedin-ads');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('linkedin.com/ad-library'),
    );
  });

  it('renders video creatives with a play affordance and detail link', () => {
    render(<CompetitorAdEvidence {...FIXTURE} />);

    expect(screen.getByLabelText('Play video')).toBeInTheDocument();
    expect(screen.getAllByText('View ad')).toHaveLength(2);
  });

  it('renders Google Ads link', () => {
    render(<CompetitorAdEvidence {...FIXTURE} />);

    const link = screen.getByTestId('library-link-google-ads');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('adstransparency.google.com'),
    );
  });

  it('renders nothing when no creatives or links are provided', () => {
    const { container } = render(<CompetitorAdEvidence />);
    expect(container.firstChild).toBeNull();
  });

  it('renders links even when creatives are empty', () => {
    render(
      <CompetitorAdEvidence
        adCreatives={[]}
        libraryLinks={FIXTURE.libraryLinks}
      />,
    );

    expect(screen.getByTestId('library-link-meta-library')).toBeInTheDocument();
    expect(screen.queryAllByTestId('creative-headline')).toHaveLength(0);
  });

  it('renders source provenance, cta, and transcript when present', () => {
    render(
      <CompetitorAdEvidence
        adCreatives={[
          {
            platform: 'meta',
            id: '987654321',
            advertiser: 'Gong',
            headline: 'Win more deals',
            body: 'Forecast accuracy',
            videoUrl: 'https://cdn.example.com/ad.mp4',
            format: 'video',
            isActive: true,
            detailsUrl: 'https://www.facebook.com/ads/library/?id=987654321',
            source: 'foreplay',
            cta: 'Book a demo',
            transcript: 'Spoken script of the winning video ad.',
          },
        ]}
      />,
    );

    expect(screen.getByText('via foreplay')).toBeInTheDocument();
    expect(screen.getByTestId('creative-cta')).toHaveTextContent('Book a demo');
    expect(screen.getByTestId('creative-transcript')).toHaveTextContent(
      'Spoken script of the winning video ad.',
    );
  });

  it('does not render the via chip for default-provider (searchapi) creatives', () => {
    render(
      <CompetitorAdEvidence
        adCreatives={[
          {
            platform: 'meta',
            id: '111222333',
            advertiser: 'Gong',
            headline: 'Win more deals',
            format: 'image',
            isActive: true,
            imageUrl: 'https://cdn.example.com/i.jpg',
            source: 'searchapi',
          },
        ]}
      />,
    );

    expect(screen.queryByText(/^via /)).not.toBeInTheDocument();
  });

  it('collapses the same numeric-id ad across providers and keeps the richer video variant', () => {
    render(
      <CompetitorAdEvidence
        adCreatives={[
          {
            // SearchAPI: bare image variant of ad 555.
            platform: 'meta',
            id: '555',
            advertiser: 'Gong',
            headline: 'Win more deals',
            format: 'image',
            isActive: true,
            imageUrl: 'https://cdn.example.com/555.jpg',
            detailsUrl: 'https://www.facebook.com/ads/library/?id=555',
          },
          {
            // Foreplay: richer video + transcript variant of the SAME ad 555.
            platform: 'meta',
            id: '555',
            advertiser: 'Gong',
            headline: 'Different headline',
            body: 'Forecast accuracy',
            videoUrl: 'https://cdn.example.com/555.mp4',
            format: 'video',
            isActive: true,
            detailsUrl: 'https://www.facebook.com/ads/library/?id=555',
            source: 'foreplay',
            transcript: 'Spoken script.',
          },
        ]}
      />,
    );

    // One unique creative survives, and it is the richer (video) variant.
    expect(screen.getAllByTestId('creative-headline')).toHaveLength(1);
    expect(screen.getByLabelText('Play video')).toBeInTheDocument();
    expect(screen.getByText('via foreplay')).toBeInTheDocument();
  });
});

describe('CompetitorAdEvidence — verified wall + quarantine', () => {
  const props: CompetitorAdEvidenceProps = {
    adCreatives: [
      {
        platform: 'meta',
        id: 'ok',
        advertiser: 'Gong',
        headline: 'Win more deals with revenue intelligence',
        format: 'image',
        isActive: true,
        verified: true,
        identityBasis: 'domain',
        detailsUrl: 'https://www.facebook.com/ads/library/?id=ok',
      },
      {
        platform: 'meta',
        id: 'bad',
        advertiser: 'Gong',
        headline: 'Cierra mas tratos ahora',
        format: 'image',
        isActive: true,
        verified: false,
        language: 'es',
        identityBasis: 'name',
        detailsUrl: 'https://www.facebook.com/ads/library/?id=bad',
      },
    ],
  };

  it('shows a Verified chip on a verified creative', () => {
    render(<CompetitorAdEvidence {...props} />);
    expect(screen.getAllByTestId('creative-verified').length).toBe(1);
  });

  it('quarantines a verified:false creative behind a reveal with a reason', () => {
    render(<CompetitorAdEvidence {...props} />);
    const quarantine = screen.getByTestId('ad-quarantine');
    expect(quarantine).toBeInTheDocument();
    expect(quarantine).toHaveTextContent(/low-confidence/i);
    expect(screen.getByTestId('creative-quarantine-reason')).toHaveTextContent(
      /non-English/i,
    );
  });

  it('keeps the verified creative out of the quarantine subtree', () => {
    render(<CompetitorAdEvidence {...props} />);
    const quarantine = screen.getByTestId('ad-quarantine');
    expect(quarantine).not.toHaveTextContent(
      'Win more deals with revenue intelligence',
    );
    expect(quarantine).toHaveTextContent('Cierra mas tratos ahora');
  });

  it('keeps the quarantine drawer closed when a verified wall exists', () => {
    render(<CompetitorAdEvidence {...props} />);
    const quarantine = screen.getByTestId('ad-quarantine');
    // 1 verified vs 1 quarantined → wall is not sparser → stays collapsed,
    // keeps the "low-confidence" label.
    expect(quarantine).not.toHaveAttribute('open');
    expect(quarantine).toHaveTextContent(/low-confidence/i);
  });
});

describe('CompetitorAdEvidence — quarantine surfaced when wall is empty/sparse', () => {
  // The deploy-blocker case: every creative is name-matched only (no verified
  // wall). The quarantine must be visible (open-by-default) and labeled
  // "unverified / name-matched" rather than buried behind a closed reveal.
  const allQuarantinedProps: CompetitorAdEvidenceProps = {
    adCreatives: [
      {
        platform: 'meta',
        id: 'q1',
        advertiser: 'Ramp',
        headline: 'Corporate cards and spend management',
        format: 'image',
        isActive: true,
        verified: false,
        identityBasis: 'name_only',
        detailsUrl: 'https://www.facebook.com/ads/library/?id=q1',
      },
      {
        platform: 'meta',
        id: 'q2',
        advertiser: 'Ramp',
        headline: 'Save time on expense reports',
        format: 'image',
        isActive: true,
        verified: false,
        identityBasis: 'name_only',
        detailsUrl: 'https://www.facebook.com/ads/library/?id=q2',
      },
    ],
  };

  it('opens the quarantine by default and labels it unverified / name-matched', () => {
    render(<CompetitorAdEvidence {...allQuarantinedProps} />);
    const quarantine = screen.getByTestId('ad-quarantine');
    expect(quarantine).toBeInTheDocument();
    // <details open> renders the `open` attribute.
    expect(quarantine).toHaveAttribute('open');
    expect(quarantine).toHaveTextContent(/unverified \/ name-matched/i);
    // The quarantined creatives are present (not silently dropped).
    expect(quarantine).toHaveTextContent('Corporate cards and spend management');
    expect(quarantine).toHaveTextContent('Save time on expense reports');
  });

  it('opens the quarantine when the verified wall is sparser than the quarantine', () => {
    const sparseProps: CompetitorAdEvidenceProps = {
      adCreatives: [
        {
          platform: 'meta',
          id: 'v1',
          advertiser: 'Ramp',
          headline: 'The verified one',
          format: 'image',
          isActive: true,
          verified: true,
          identityBasis: 'domain',
          detailsUrl: 'https://www.facebook.com/ads/library/?id=v1',
        },
        ...allQuarantinedProps.adCreatives!,
      ],
    };
    render(<CompetitorAdEvidence {...sparseProps} />);
    const quarantine = screen.getByTestId('ad-quarantine');
    // 1 verified vs 2 quarantined → wall is sparser → open-by-default.
    expect(quarantine).toHaveAttribute('open');
    expect(quarantine).toHaveTextContent(/unverified \/ name-matched/i);
  });
});
