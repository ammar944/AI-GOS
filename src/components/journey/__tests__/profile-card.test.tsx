import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileCard } from '../profile-card';
import { createEmptyState, setConfirmedField } from '@/lib/journey/session-state';

describe('ProfileCard', () => {
  it('frames the saved context as a user-facing orientation card', () => {
    let state = createEmptyState();
    state = setConfirmedField(state, 'companyName', 'Acme AI', {
      source: 'prefill',
      verifiedBy: 'prefill-review',
    });
    state = setConfirmedField(state, 'businessModel', 'B2B SaaS', {
      source: 'prefill',
      verifiedBy: 'prefill-review',
    });
    state = setConfirmedField(state, 'industryVertical', 'AI tooling', {
      source: 'prefill',
      verifiedBy: 'prefill-review',
    });

    render(<ProfileCard state={state} />);

    expect(screen.getByText('What I know so far')).toBeInTheDocument();
    expect(screen.getByText('2/8 essentials confirmed')).toBeInTheDocument();
    expect(
      screen.getByText(/next, answer the guided questions so i can sharpen the research/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Acme AI')).toBeInTheDocument();
  });
});
