import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JourneyManusWelcome } from '@/components/journey/journey-manus-welcome';

describe('JourneyManusWelcome', () => {
  it('renders the Anthropic agent-console Journey entry instead of the old centered launcher', () => {
    render(
      <JourneyManusWelcome
        websiteUrl=""
        onWebsiteUrlChange={vi.fn()}
        onAnalyze={vi.fn()}
      />,
    );

    expect(screen.getByText('Build the GTM report like an agent run.')).toBeInTheDocument();
    expect(screen.getByText('Anthropic runtime')).toBeInTheDocument();
    expect(screen.getByText('Platform Skills agents')).toBeInTheDocument();
    expect(screen.getByText('Live report artifact preview')).toBeInTheDocument();
    expect(screen.getByText(/No old schema review/u)).toBeInTheDocument();
    expect(screen.getByText('Market Category')).toBeInTheDocument();
    expect(screen.queryByText('Onboarding review')).not.toBeInTheDocument();
    expect(screen.queryByText('Open onboarding manually')).not.toBeInTheDocument();
    expect(screen.queryByText('What should we build toward?')).not.toBeInTheDocument();
    expect(screen.queryByText('Strategy Intake')).not.toBeInTheDocument();
  });

  it('submits the company URL through the deep research entrypoint', () => {
    const onAnalyze = vi.fn();

    render(
      <JourneyManusWelcome
        websiteUrl="https://example.com"
        onWebsiteUrlChange={vi.fn()}
        onAnalyze={onAnalyze}
      />,
    );

    fireEvent.click(screen.getByLabelText('Start deep research'));

    expect(onAnalyze).toHaveBeenCalledTimes(1);
  });
});
