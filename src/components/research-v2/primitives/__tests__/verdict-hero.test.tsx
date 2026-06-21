/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { VerdictHero } from '../verdict-hero';

describe('VerdictHero', () => {
  it('renders the verdict in the body sans, never the display serif (guards the faux-bold regression)', () => {
    render(<VerdictHero verdict="Own the fastest-implementation position" />);

    const heading = screen.getByTestId('verdict-hero').querySelector('h2');
    expect(heading).not.toBeNull();
    // The display token (--font-instrument-sans) loads Instrument *Serif* at weight 400
    // only, so font-heading + font-semibold renders synthesized faux-bold serif. The
    // reader verdict must use the body sans (Geist), which has a real 600.
    expect(heading?.className).toContain('font-sans');
    expect(heading?.className).not.toContain('font-heading');
    expect(heading?.className).not.toContain('font-serif');
  });

  it('shows the verdict and its supporting line', () => {
    render(
      <VerdictHero
        verdict="Lead with integration depth"
        whyItMatters="Buyers compare on breadth; depth is the wedge."
      />,
    );

    expect(screen.getByTestId('verdict-hero')).toHaveTextContent(/lead with integration depth/i);
    expect(screen.getByText(/depth is the wedge/i)).toBeInTheDocument();
    expect(screen.queryByText(/confidence/i)).not.toBeInTheDocument();
  });

  it('surfaces a muted rich-count line when a block self-reports rich coverage', () => {
    render(
      <VerdictHero
        verdict="Lead with integration depth"
        valueReadiness={{
          leadReadiness: 'rich',
          anyRich: true,
          blocksByReadiness: { rich: 2, adequate: 1, thin: 0, gap: 0 },
        }}
      />,
    );

    expect(screen.getByTestId('verdict-hero-readiness')).toHaveTextContent(
      '2 of 3 blocks fully evidenced',
    );
  });

  it('renders no readiness line when no block is rich (or none provided)', () => {
    const { rerender } = render(
      <VerdictHero
        verdict="Directional only"
        valueReadiness={{
          leadReadiness: 'adequate',
          anyRich: false,
          blocksByReadiness: { rich: 0, adequate: 2, thin: 1, gap: 0 },
        }}
      />,
    );
    expect(
      screen.queryByTestId('verdict-hero-readiness'),
    ).not.toBeInTheDocument();

    rerender(<VerdictHero verdict="No readiness data" />);
    expect(
      screen.queryByTestId('verdict-hero-readiness'),
    ).not.toBeInTheDocument();
  });
});
