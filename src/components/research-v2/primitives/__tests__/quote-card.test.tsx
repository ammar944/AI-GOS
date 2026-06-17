/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { QuoteCard } from '../quote-card';

describe('QuoteCard', (): void => {
  it('labels quote URLs as sources instead of claiming every URL is a permalink', (): void => {
    render(
      <QuoteCard
        quote="The follow-up still falls through the cracks."
        venue="G2"
        url="https://www.g2.com/products/example/reviews"
      />,
    );

    expect(screen.getByRole('link', { name: /source/i })).toHaveAttribute(
      'href',
      'https://www.g2.com/products/example/reviews',
    );
    expect(screen.queryByRole('link', { name: /permalink/i })).not.toBeInTheDocument();
  });
});
