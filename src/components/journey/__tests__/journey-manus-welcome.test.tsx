import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JourneyManusWelcome } from '@/components/journey/journey-manus-welcome';

describe('JourneyManusWelcome', () => {
  it('renders the chat-first Journey entry instead of the old strategy intake screen', () => {
    render(
      <JourneyManusWelcome
        websiteUrl=""
        linkedinUrl=""
        onWebsiteUrlChange={vi.fn()}
        onLinkedinUrlChange={vi.fn()}
        onAnalyze={vi.fn()}
        onSkip={vi.fn()}
      />,
    );

    expect(screen.getByText('Drop a URL. Watch the agent build the GTM report.')).toBeInTheDocument();
    expect(screen.getByText('GTM research coworker')).toBeInTheDocument();
    expect(screen.getByText('Deep research')).toBeInTheDocument();
    expect(screen.getByText('Workspace synthesis')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding review')).not.toBeInTheDocument();
    expect(screen.queryByText('What should we build toward?')).not.toBeInTheDocument();
    expect(screen.queryByText('Strategy Intake')).not.toBeInTheDocument();
  });

  it('submits the company URL through the onboarding extraction entrypoint', () => {
    const onAnalyze = vi.fn();

    render(
      <JourneyManusWelcome
        websiteUrl="https://example.com"
        linkedinUrl=""
        onWebsiteUrlChange={vi.fn()}
        onLinkedinUrlChange={vi.fn()}
        onAnalyze={onAnalyze}
        onSkip={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByLabelText('Start deep research'));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });
});
