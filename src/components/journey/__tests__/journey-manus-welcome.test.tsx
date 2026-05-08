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
    expect(screen.getByText(/checking source-backed company context/u)).toBeInTheDocument();
    expect(screen.getByTestId('deep-research-report-artifact')).not.toHaveTextContent(
      'Market Category',
    );
    expect(screen.queryByText('GTM Synthesis Agent')).not.toBeInTheDocument();
    expect(screen.queryByText('Journey Workbench')).not.toBeInTheDocument();
  });

  it('renders a live artifact skeleton immediately when Deep Research starts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="starting"
      />,
    );

    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Live GTM Research Artifact',
    );
    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Deep Research Agent is building the source-backed corpus',
    );
  });

  it('renders typed Deep Research artifact deltas without leaking profile field counts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="starting"
        deepResearchFields={{ companyName: 'Airtable', businessModel: 'B2B SaaS' }}
        researchActivity={{
          deepResearchProgram: {
            jobId: 'job-deep',
            section: 'deepResearchProgram',
            status: 'running',
            tool: 'runDeepResearchProgram',
            startedAt: '2026-05-07T09:00:00.000Z',
            updates: [
              {
                at: '2026-05-07T09:00:01.000Z',
                id: 'artifact-delta-1',
                message: '# Airtable GTM Research\n\n## Deep Research\n\nAirtable is positioned as an app platform for teams.',
                phase: 'artifact',
                meta: {
                  eventType: 'artifact-delta',
                  section: 'deepResearchProgram',
                  title: 'Airtable GTM Research',
                },
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

  it('places the live artifact after the assistant output', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="starting"
        researchActivity={{
          deepResearchProgram: {
            jobId: 'job-deep',
            section: 'deepResearchProgram',
            status: 'running',
            tool: 'runDeepResearchProgram',
            startedAt: '2026-05-07T09:00:00.000Z',
            updates: [
              {
                at: '2026-05-07T09:00:01.000Z',
                id: 'tool-log',
                message: 'Opened Airtable product page.',
                phase: 'tool',
                meta: {
                  toolName: 'web_search',
                  url: 'https://www.airtable.com/product',
                },
              },
            ],
          },
        }}
      />,
    );

    const assistant = screen.getByTestId('journey-assistant-output');
    const artifact = screen.getByTestId('deep-research-report-artifact');

    expect(
      assistant.compareDocumentPosition(artifact) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(artifact).toHaveTextContent('Live GTM Research Artifact');
  });
});
