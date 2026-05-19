import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BuyerICPSubSection } from '../sub-section';

describe('BuyerICPSubSection', () => {
  it('renders a semantic heading, markdown prose, and responsive card grid children', () => {
    render(
      <BuyerICPSubSection
        title="Persona reality"
        prose="**Strong claim** about the buying committee."
        gridLabel="Persona reality cards"
      >
        <article>Card child</article>
      </BuyerICPSubSection>,
    );

    expect(
      screen.getByRole('heading', { level: 3, name: 'Persona reality' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Strong claim')).toBeInTheDocument();
    expect(screen.getByText('Card child')).toBeInTheDocument();

    const grid = screen.getByRole('list', { name: 'Persona reality cards' });
    expect(grid).toHaveClass('grid-cols-1');
    expect(grid).toHaveClass('md:grid-cols-2');
    expect(grid).toHaveClass('lg:grid-cols-3');
  });
});
