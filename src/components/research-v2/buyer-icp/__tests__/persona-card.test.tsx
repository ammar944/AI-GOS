import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { PersonaCard } from '../persona-card';
import { personaFixture } from './test-fixtures';

describe('PersonaCard', () => {
  it('renders identity, role badges, source link, and tolerates omitted optional fields', () => {
    render(<PersonaCard persona={personaFixture} />);

    expect(screen.getByText('Jordan Lee')).toBeInTheDocument();
    expect(screen.getByText('VP Revenue Operations')).toBeInTheDocument();
    expect(screen.getByText('Acme Cloud')).toBeInTheDocument();
    expect(screen.getByText('VP+')).toBeInTheDocument();
    expect(screen.getByText('decision-maker')).toBeInTheDocument();
    expect(screen.queryByText(/Team size/u)).not.toBeInTheDocument();

    const sourceLink = screen.getByRole('link', {
      name: 'Open source for Jordan Lee',
    });
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/jordan-lee');
  });
});
