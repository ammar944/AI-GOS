import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JourneyManusWelcome } from '@/components/journey/journey-manus-welcome';

describe('JourneyManusWelcome', () => {
  it('renders the chat-first Journey entry instead of the old strategy intake screen', () => {
    render(
      <JourneyManusWelcome
        websiteUrl=""
        onWebsiteUrlChange={vi.fn()}
        onAnalyze={vi.fn()}
      />,
    );

    expect(
      screen.getByText('Ask for research. Watch AI-GOS write the report.'),
    ).toBeInTheDocument();
    expect(screen.getByText('AI-GOS Journey')).toBeInTheDocument();
    expect(screen.getByText('Deep Research')).toBeInTheDocument();
    expect(screen.getByText('Synthesis')).toBeInTheDocument();
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
