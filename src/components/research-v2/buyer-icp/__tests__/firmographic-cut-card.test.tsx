import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { FirmographicCutCard } from '../firmographic-cut-card';
import { firmographicCutFixture } from './test-fixtures';

describe('FirmographicCutCard', () => {
  it('renders the cut, account-count callout, source link, and observed date', () => {
    render(<FirmographicCutCard cut={firmographicCutFixture} />);

    expect(screen.getByText('employeeBands')).toBeInTheDocument();
    expect(
      screen.getByText('B2B SaaS companies with 200-1000 employees'),
    ).toBeInTheDocument();
    expect(screen.getByText('1,200+ accounts')).toBeInTheDocument();
    expect(screen.getByText('2026-05-15')).toBeInTheDocument();

    const sourceLink = screen.getByRole('link', {
      name: 'Open source for B2B SaaS companies with 200-1000 employees',
    });
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/firmographic-cut');
  });
});
