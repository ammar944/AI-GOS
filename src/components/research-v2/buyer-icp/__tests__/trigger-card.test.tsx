import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TriggerCard } from '../trigger-card';
import { triggerFixture } from './test-fixtures';

describe('TriggerCard', () => {
  it('renders trigger signal, action window, evidence, and source link', () => {
    render(<TriggerCard trigger={triggerFixture} />);

    expect(screen.getByText('New RevOps leader hired')).toBeInTheDocument();
    expect(
      screen.getByText('VP Revenue Operations job changes in target accounts.'),
    ).toBeInTheDocument();
    expect(screen.getByText('weeks')).toBeInTheDocument();
    expect(
      screen.getByText('Public job-change announcements often precede tooling audits.'),
    ).toBeInTheDocument();

    const sourceLink = screen.getByRole('link', {
      name: 'Open source for New RevOps leader hired',
    });
    expect(sourceLink).toHaveAttribute('href', 'https://example.com/revops-trigger');
  });
});
