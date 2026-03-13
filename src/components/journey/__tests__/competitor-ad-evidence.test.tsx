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
});
