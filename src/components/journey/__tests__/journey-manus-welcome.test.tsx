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
    expect(screen.getByPlaceholderText('research airtable.com or paste company URL...')).toBeInTheDocument();

    expect(screen.queryByText('Live report artifact preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the GTM report like an agent run.')).not.toBeInTheDocument();
    expect(screen.queryByText('Artifact canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('Onboarding review')).not.toBeInTheDocument();
  });

  it('submits the company research command through the deep research composer', () => {
    const onSubmitWebsite = vi.fn();

    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        onSubmitWebsite={onSubmitWebsite}
      />,
    );

    fireEvent.click(screen.getByLabelText('Start deep research'));

    expect(onSubmitWebsite).toHaveBeenCalledTimes(1);
  });

  it('renders only Deep Research Agent as the first visible assistant output once a run starts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="starting"
      />,
    );

    expect(screen.getAllByText('Deep Research Agent').length).toBeGreaterThan(0);
    expect(screen.getByText(/Starting source-backed company research/u)).toBeInTheDocument();
    expect(screen.queryByText('Market Category Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('GTM Synthesis Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Journey Workbench')).not.toBeInTheDocument();
  });

  it('renders a central report artifact from draft progress without leaking profile field counts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="complete"
        deepResearchFields={{ companyName: 'Airtable', businessModel: 'B2B SaaS' }}
        researchResults={{
          deepResearchProgram: {
            status: 'complete',
            section: 'deepResearchProgram',
            data: {},
            durationMs: 1000,
          },
        }}
        researchActivity={{
          industryMarket: {
            jobId: 'job-market',
            section: 'industryMarket',
            status: 'running',
            tool: 'researchIndustry',
            startedAt: '2026-05-07T09:00:00.000Z',
            updates: [
              {
                at: '2026-05-07T09:00:01.000Z',
                id: 'draft-1',
                message: 'draft Airtable is positioned as an app platform for teams.',
                phase: 'analysis',
              },
            ],
          },
        }}
      />,
    );

    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Airtable is positioned as an app platform for teams.',
    );
    expect(screen.queryByText(/Company corpus is ready with/u)).not.toBeInTheDocument();
  });
});
