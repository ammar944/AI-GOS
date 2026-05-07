import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { JourneyAgentChat } from '@/components/journey/journey-agent-chat';

const baseProps = {
  websiteUrl: '',
  onWebsiteUrlChange: vi.fn(),
  onSubmitWebsite: vi.fn(),
  activeRunId: null,
  companyName: null,
  phase: 'welcome' as const,
  deepResearchStatus: 'idle' as const,
  deepResearchError: null,
  deepResearchFields: {},
  researchActivity: {},
  researchResults: {},
  messages: [],
};

describe('JourneyAgentChat', () => {
  it('renders the minimal AionUI-style agent chat entry instead of workspace preview chrome', () => {
    render(<JourneyAgentChat {...baseProps} />);

    expect(screen.getByText('What company should I research?')).toBeInTheDocument();
    expect(screen.getByText(/Anthropic GTM agents · chat mode/u)).toBeInTheDocument();
    expect(screen.getByText(/Claude web search \+ code execution \+ Platform Skills/u)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste company URL...')).toBeInTheDocument();

    expect(screen.queryByText('Live report artifact preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the GTM report like an agent run.')).not.toBeInTheDocument();
    expect(screen.queryByText('Artifact canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('Onboarding review')).not.toBeInTheDocument();
  });

  it('submits the company URL through the deep research composer', () => {
    const onSubmitWebsite = vi.fn();

    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="https://example.com"
        onSubmitWebsite={onSubmitWebsite}
      />,
    );

    fireEvent.click(screen.getByLabelText('Start deep research'));

    expect(onSubmitWebsite).toHaveBeenCalledTimes(1);
  });

  it('renders specialist agents inline once a run starts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="https://example.com"
        activeRunId="journey-test-123"
        deepResearchStatus="queued"
      />,
    );

    expect(screen.getByText('Deep Research Agent')).toBeInTheDocument();
    expect(screen.getByText('Market Category Agent')).toBeInTheDocument();
    expect(screen.getByText('GTM Synthesis Agent')).toBeInTheDocument();
    expect(screen.queryByText('Journey Workbench')).not.toBeInTheDocument();
  });
});
