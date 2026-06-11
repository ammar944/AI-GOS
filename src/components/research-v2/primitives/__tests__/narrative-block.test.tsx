/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ReaderSourcesProvider } from '@/components/research-v2/reader-sources';

import { NarrativeBlock } from '../narrative-block';

const SOURCES = [
  { n: 1, title: 'Pricing page', url: 'https://example.com/pricing' },
];

describe('NarrativeBlock (markdown + citations)', () => {
  it('renders markdown structure: paragraphs from blank lines, bold, lists', () => {
    const { container } = render(
      <NarrativeBlock prose={'First point with **emphasis**.\n\nSecond paragraph.\n\n- item one\n- item two'} />,
    );

    const paragraphs = container.querySelectorAll('p');
    expect(paragraphs.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('emphasis').tagName).toBe('STRONG');
    expect(container.querySelectorAll('li')).toHaveLength(2);
    // Raw markdown markers must not leak into the rendered text.
    expect(container.textContent).not.toContain('**');
  });

  it('preserves inline [n] citations through markdown rendering, including inside bold runs', () => {
    const { container } = render(
      <ReaderSourcesProvider sources={SOURCES}>
        <NarrativeBlock prose={'Plain claim [1].\n\nBold claim with **inline cite [1]** too.'} />
      </ReaderSourcesProvider>,
    );

    // Cite renders a <sup> per resolved marker — one in the plain paragraph,
    // one inside the <strong> run.
    const sups = container.querySelectorAll('sup');
    expect(sups).toHaveLength(2);
    const strong = container.querySelector('strong');
    expect(strong?.querySelector('sup')).not.toBeNull();
    // The literal token is replaced by the Cite affordance.
    expect(container.textContent).not.toContain('[1]');
  });

  it('keeps unresolvable markers as literal text instead of dropping them', () => {
    const { container } = render(
      <ReaderSourcesProvider sources={SOURCES}>
        <NarrativeBlock prose={'Resolves [1] but not [7].'} />
      </ReaderSourcesProvider>,
    );

    expect(container.querySelectorAll('sup')).toHaveLength(1);
    expect(container.textContent).toContain('[7]');
  });

  it('flattens model-emitted headings to body-size text (no giant headings in cards)', () => {
    const { container } = render(
      <NarrativeBlock prose={'## Loud heading\n\nBody text.'} />,
    );

    const heading = container.querySelector('h2');
    expect(heading).not.toBeNull();
    expect(heading?.textContent).toBe('Loud heading');
  });
});
