import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import {
  JourneyPremiumPreview,
} from '@/components/journey/journey-premium-preview-scenes';

describe('JourneyPremiumPreview', () => {
  it('renders the welcome scene with strategic brief prompts', () => {
    render(<JourneyPremiumPreview scene="welcome" showSceneSwitcher={false} />);

    expect(screen.getByText('Stage the strategic brief')).toBeInTheDocument();
    expect(screen.getByText('Strategic operator brief')).toBeInTheDocument();
    expect(screen.getByText('Homepage teardown')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start operator brief' })).toBeInTheDocument();
  });

  it('renders the cards scene with premium research dossiers', () => {
    render(<JourneyPremiumPreview scene="cards" showSceneSwitcher={false} />);

    expect(screen.getByText('Evidence modules')).toBeInTheDocument();
    expect(screen.getByText('Paid search intent beats the homepage story')).toBeInTheDocument();
    expect(screen.getByText('Review routing')).toBeInTheDocument();
    expect(screen.getAllByText('Strategic read').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Open full review').length).toBeGreaterThan(0);
  });

  it('renders the artifact scene as a decision dock', () => {
    render(<JourneyPremiumPreview scene="artifact" showSceneSwitcher={false} />);

    expect(screen.getByText('Decision dock')).toBeInTheDocument();
    expect(screen.getByText('Review the market overview before dispatching the next wave')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Approve section' })).toBeInTheDocument();
  });

  it('renders the chat scene with the premium composer', () => {
    render(<JourneyPremiumPreview scene="chat" showSceneSwitcher={false} />);

    expect(screen.getByText('Operator conversation')).toBeInTheDocument();
    expect(screen.getByTestId('journey-chat-input')).toHaveAttribute('data-variant', 'premium');
  });
});
