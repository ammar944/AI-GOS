import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { PositioningTypedArtifact } from '@/types/positioning-artifact';

import { TypedArtifactRenderer } from '../typed-artifact-renderer';

// An unknown zoneId falls through the dispatch switch to the generic
// reflection renderer, which owns the source list whose key was fixed.
const GENERIC_ZONE_ID = 'genericFallbackZone';

describe('TypedArtifactRenderer (generic source list)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('produces unique keys when multiple sources share the same URL', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const duplicateUrl = 'https://saaslaunch.net/';
    const artifact: PositioningTypedArtifact = {
      sectionTitle: 'Generic Section',
      verdict: 'Verdict prose.',
      statusSummary: 'Status summary prose.',
      confidence: 7,
      sources: [
        { title: 'SaaS Launch — page A', url: duplicateUrl },
        { title: 'SaaS Launch — page B', url: duplicateUrl },
        { title: 'SaaS Launch — page C', url: duplicateUrl },
      ],
    };

    render(<TypedArtifactRenderer artifact={artifact} zoneId={GENERIC_ZONE_ID} />);

    fireEvent.click(screen.getByRole('button', { name: 'Sources (3)' }));
    const sources = screen.getByRole('list');
    expect(within(sources).getByText('SaaS Launch — page A')).toBeInTheDocument();
    expect(within(sources).getByText('SaaS Launch — page B')).toBeInTheDocument();
    expect(within(sources).getByText('SaaS Launch — page C')).toBeInTheDocument();

    const keyWarnings = errorSpy.mock.calls.filter(([message]) =>
      typeof message === 'string' ? message.includes('same key') : false,
    );
    expect(keyWarnings).toEqual([]);
  });
});

describe('TypedArtifactRenderer (§4.1 GLM narrative primary body)', () => {
  it('renders GLM narrativeMarkdown as the card body when present', () => {
    const artifact: PositioningTypedArtifact = {
      sectionTitle: 'Market & Category Intelligence',
      verdict: 'Own the API-first shelf.',
      statusSummary: 'Validated.',
      confidence: 0.6,
      sources: [],
      narrativeMarkdown:
        '## Strategic Verdict\n\nThe shelf to own is **API-first support**.\n\n- programmability\n- BYOA',
    };

    const { container } = render(
      <TypedArtifactRenderer artifact={artifact} zoneId="positioningMarketCategory" />,
    );

    // GLM's real markdown rendered to DOM (headings/bold/list), markers gone.
    expect(screen.getByText('API-first support').tagName).toBe('STRONG');
    expect(container.querySelectorAll('li').length).toBeGreaterThanOrEqual(2);
    expect(container.textContent).not.toContain('##');
    expect(container.textContent).toContain('The shelf to own is');
  });

  it('renders a REAL >1000-char, multi-link research body (not a gap note)', () => {
    // Regression guard for the textOrGap/looksLikeNavMenuGarbage collapse: a real
    // GLM body is >1000 chars and cites >=3 URLs. It must render the research,
    // NOT "Not enough public evidence was found...".
    const para =
      'Buyers describe stitching tools together as the core tax of the category, paying per-resolution fees that scale perversely, and watching context scatter across systems developers refuse to use. ';
    const narrativeMarkdown =
      '## Voice of the Customer\n\n' +
      `${para}([G2](https://www.g2.com/products/x/reviews)) ` +
      `${para}([Capterra](https://www.capterra.com/p/1/reviews/)) ` +
      `${para}([Reddit](https://old.reddit.com/r/saas/comments/abc/)) ` +
      para +
      para;
    expect(narrativeMarkdown.length).toBeGreaterThan(1000);

    const artifact: PositioningTypedArtifact = {
      sectionTitle: 'Voice of the Customer',
      verdict: 'V.',
      statusSummary: 'S.',
      confidence: 0.6,
      sources: [],
      narrativeMarkdown,
    };

    const { container } = render(
      <TypedArtifactRenderer artifact={artifact} zoneId="positioningVoiceOfCustomer" />,
    );
    expect(container.textContent).toContain('the core tax of the category');
    expect(container.textContent).not.toContain('Not enough public evidence');
  });

  it('does not take the narrative path when narrativeMarkdown is absent', () => {
    const artifact: PositioningTypedArtifact = {
      sectionTitle: 'Generic Section',
      verdict: 'Verdict prose here.',
      statusSummary: 'Status.',
      confidence: 0.6,
      sources: [],
    };

    // Generic zone avoids the bespoke renderers; the point is only that with no
    // narrativeMarkdown the NarrativeBlock primary-body path is skipped and the
    // existing typed render runs unchanged.
    const { container } = render(
      <TypedArtifactRenderer artifact={artifact} zoneId="genericFallbackZone" />,
    );
    expect(container.textContent).toContain('Verdict prose here.');
  });
});
