/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  parseCitationMarkers,
  renderProseWithCitations,
  SourcesFooter,
  toReaderSources,
  type ReaderSource,
} from '../reader-sources';
import type { PositioningArtifactSource } from '@/types/positioning-artifact';

function makeArtifactSources(): PositioningArtifactSource[] {
  return [
    {
      title: 'Ramp pricing page',
      url: 'https://ramp.com/pricing',
      whyItMatters: 'Primary competitor pricing signal',
    },
    {
      title: 'G2 reviews',
      url: 'https://g2.com/products/ramp',
    },
  ];
}

function makeReaderSources(): ReaderSource[] {
  return toReaderSources(makeArtifactSources());
}

describe('toReaderSources', () => {
  it('returns empty array for empty input', () => {
    expect(toReaderSources([])).toEqual([]);
  });

  it('assigns 1-based n in order without re-dedup', () => {
    const sources = makeArtifactSources();
    const mapped = toReaderSources(sources);
    expect(mapped.map((s) => s.n)).toEqual([1, 2]);
    expect(mapped[0].title).toBe('Ramp pricing page');
    expect(mapped[1].title).toBe('G2 reviews');
  });

  it('carries whyItMatters when present and omits when absent', () => {
    const mapped = toReaderSources(makeArtifactSources());
    expect(mapped[0].whyItMatters).toBe('Primary competitor pricing signal');
    expect(mapped[1].whyItMatters).toBeUndefined();
  });
});

describe('parseCitationMarkers', () => {
  it('returns one text token for plain prose', () => {
    expect(parseCitationMarkers('foo')).toEqual([{ kind: 'text', value: 'foo' }]);
  });

  it('splits text around a single citation', () => {
    expect(parseCitationMarkers('foo [1] bar')).toEqual([
      { kind: 'text', value: 'foo ' },
      { kind: 'cite', indices: [1], raw: '[1]' },
      { kind: 'text', value: ' bar' },
    ]);
  });

  it('parses comma-separated indices in one marker', () => {
    expect(parseCitationMarkers('x [1, 3] y')).toEqual([
      { kind: 'text', value: 'x ' },
      { kind: 'cite', indices: [1, 3], raw: '[1, 3]' },
      { kind: 'text', value: ' y' },
    ]);
  });

  it('parses adjacent citation markers', () => {
    expect(parseCitationMarkers('[2][5]')).toEqual([
      { kind: 'cite', indices: [2], raw: '[2]' },
      { kind: 'cite', indices: [5], raw: '[5]' },
    ]);
  });

  it('leaves non-numeric bracket text untouched', () => {
    expect(parseCitationMarkers('see [abc] here')).toEqual([
      { kind: 'text', value: 'see [abc] here' },
    ]);
  });

  it('handles citation embedded in a word boundary', () => {
    expect(parseCitationMarkers('price was $4[1]m')).toEqual([
      { kind: 'text', value: 'price was $4' },
      { kind: 'cite', indices: [1], raw: '[1]' },
      { kind: 'text', value: 'm' },
    ]);
  });

  it('returns empty array for empty string', () => {
    expect(parseCitationMarkers('')).toEqual([]);
  });
});

describe('renderProseWithCitations', () => {
  it('renders prose verbatim when sources are empty', () => {
    const { container } = render(
      <>{renderProseWithCitations('Claim [1] here', [])}</>,
    );
    expect(container.textContent).toBe('Claim [1] here');
  });

  it('renders prose verbatim when no citation markers exist', () => {
    const { container } = render(
      <>{renderProseWithCitations('Plain prose', makeReaderSources())}</>,
    );
    expect(container.textContent).toBe('Plain prose');
  });

  it('renders a citation sup for a matching index', () => {
    render(
      <>{renderProseWithCitations('Claim [1] here', makeReaderSources())}</>,
    );
    expect(screen.getByText('1', { selector: 'sup' })).toBeInTheDocument();
  });

  it('renders out-of-range markers as literal text', () => {
    const { container } = render(
      <>{renderProseWithCitations('Claim [9] here', makeReaderSources())}</>,
    );
    expect(container.textContent).toBe('Claim [9] here');
    expect(screen.queryByText('9', { selector: 'sup' })).not.toBeInTheDocument();
  });
});

describe('SourcesFooter', () => {
  it('renders nothing for empty sources', () => {
    const { container } = render(<SourcesFooter sources={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows trigger label and keeps list collapsed by default', () => {
    render(<SourcesFooter sources={makeReaderSources()} />);
    expect(screen.getByText('2 sources')).toBeInTheDocument();
    expect(screen.queryByText('Ramp pricing page')).not.toBeInTheDocument();
  });

  it('expands to show numbered links and whyItMatters', () => {
    render(<SourcesFooter sources={makeReaderSources()} />);

    fireEvent.click(screen.getByText('2 sources'));

    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: 'Ramp pricing page' });
    expect(link).toHaveAttribute('href', 'https://ramp.com/pricing');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
    expect(screen.getByText('Primary competitor pricing signal')).toBeInTheDocument();
  });
});
