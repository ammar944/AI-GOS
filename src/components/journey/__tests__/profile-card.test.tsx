import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ProfileCard } from '../profile-card';
import { createEmptyState } from '@/lib/journey/session-state';
import type { OnboardingState } from '@/lib/journey/session-state';

describe('ProfileCard', () => {
  it('renders nothing when state is null', () => {
    const { container } = render(<ProfileCard state={null} />);
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when no fields have values', () => {
    const state = createEmptyState();
    const { container } = render(<ProfileCard state={state} />);
    expect(container.firstChild).toBeNull();
  });

  it('shows the profile snapshot heading with company name', () => {
    const state: Partial<OnboardingState> = {
      companyName: 'Acme AI',
      businessModel: 'B2B SaaS',
      industry: 'AI tooling',
    };

    render(<ProfileCard state={state} />);

    expect(screen.getByText(/Profile Snapshot: Acme AI/i)).toBeInTheDocument();
  });

  it('falls back to "Project Alpha" when companyName is absent', () => {
    const state: Partial<OnboardingState> = {
      businessModel: 'B2B SaaS',
    };

    render(<ProfileCard state={state} />);

    expect(screen.getByText(/Profile Snapshot: Project Alpha/i)).toBeInTheDocument();
  });

  it('renders answered field values in the grid', () => {
    const state: Partial<OnboardingState> = {
      companyName: 'Acme AI',
      businessModel: 'B2B SaaS',
      industry: 'AI tooling',
    };

    render(<ProfileCard state={state} />);

    expect(screen.getByText('Acme AI')).toBeInTheDocument();
    expect(screen.getByText('B2B SaaS')).toBeInTheDocument();
    expect(screen.getByText('AI tooling')).toBeInTheDocument();
  });

  it('renders the label for each populated field', () => {
    const state: Partial<OnboardingState> = {
      companyName: 'Acme AI',
      businessModel: 'B2B SaaS',
    };

    render(<ProfileCard state={state} />);

    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Model')).toBeInTheDocument();
  });

  it('joins array values with a comma', () => {
    const state: Partial<OnboardingState> = {
      marketingChannels: ['Google Ads', 'Meta Ads'],
    };

    render(<ProfileCard state={state} />);

    expect(screen.getByText('Google Ads, Meta Ads')).toBeInTheDocument();
  });

  it('skips fields with empty arrays', () => {
    const state: Partial<OnboardingState> = {
      companyName: 'Acme AI',
      marketingChannels: [],
    };

    render(<ProfileCard state={state} />);

    // Only Company label should appear — Active Channels should be absent
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.queryByText('Active Channels')).toBeNull();
  });
});
