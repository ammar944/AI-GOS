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
});
