import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it, vi, beforeAll } from "vitest";

import { JourneyAgentChat } from "@/components/journey/journey-agent-chat";

beforeAll(() => {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
});

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

function JourneyAgentChatHarness({
  onSubmitWebsite,
}: {
  onSubmitWebsite: (input: string) => void;
}) {
  const [websiteUrl, setWebsiteUrl] = useState("");

  return (
    <JourneyAgentChat
      {...baseProps}
      websiteUrl={websiteUrl}
      onWebsiteUrlChange={setWebsiteUrl}
      onSubmitWebsite={onSubmitWebsite}
    />
  );
}

describe('JourneyAgentChat', () => {
  it('renders the minimal AionUI-style agent chat entry instead of workspace preview chrome', () => {
    render(<JourneyAgentChat {...baseProps} />);

    expect(screen.getByText('What company should I research?')).toBeInTheDocument();
    expect(screen.getByText(/GTM research workspace/u)).toBeInTheDocument();
    expect(screen.getByText(/Source-backed research \+ GTM synthesis/u)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('research airtable.com or paste company URL...')).toBeInTheDocument();

    expect(screen.queryByText('Live report artifact preview')).not.toBeInTheDocument();
    expect(screen.queryByText('Build the GTM report like an agent run.')).not.toBeInTheDocument();
    expect(screen.queryByText('Artifact canvas')).not.toBeInTheDocument();
    expect(screen.queryByText('Onboarding review')).not.toBeInTheDocument();
  });

  it('submits the company research command through the deep research composer', async () => {
    const onSubmitWebsite = vi.fn();

    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        onSubmitWebsite={onSubmitWebsite}
      />,
    );

    const submitBtn = screen.getByLabelText("Start research");
    expect(submitBtn).not.toBeDisabled();
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(onSubmitWebsite).toHaveBeenCalledWith("research airtable.com");
    });
  });

  it('submits the current pasted domain value instead of waiting on stale state', async () => {
    const onSubmitWebsite = vi.fn();

    render(<JourneyAgentChatHarness onSubmitWebsite={onSubmitWebsite} />);

    fireEvent.change(screen.getByLabelText("Research command or company URL"), {
      target: { value: "airtable.com" },
    });
    fireEvent.click(screen.getByLabelText("Start research"));

    await waitFor(() => {
      expect(onSubmitWebsite).toHaveBeenCalledWith("airtable.com");
    });
  });

  it('shows validation errors without fabricating failed reasoning or artifacts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research aritable"
        deepResearchError="Enter a valid company domain or URL after the research command."
      />,
    );

    expect(screen.getByTestId('journey-user-command')).toHaveTextContent(
      'research aritable',
    );
    expect(screen.getByText(/valid company domain/u)).toBeInTheDocument();
    expect(screen.queryByText(/Research Agent — failed/u)).not.toBeInTheDocument();
    expect(screen.queryByTestId('deep-research-report-artifact')).not.toBeInTheDocument();
  });

  it('renders a run-next-section control when a workspace section is ready', () => {
    const onRunNextSection = vi.fn();

    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="airtable.com"
        activeRunId="journey-test-123"
        phase="workspace"
        deepResearchStatus="complete"
        deepResearchFields={{ companyName: 'Airtable' }}
        nextSectionLabel="Market Overview"
        onRunNextSection={onRunNextSection}
      />,
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /Run next research section: Market Overview/u,
      }),
    );

    expect(onRunNextSection).toHaveBeenCalledTimes(1);
  });

  it('shows Research Agent in the assistant status bubble once a run starts', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="starting"
      />,
    );

    expect(screen.getAllByText('Research Agent').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/checking source-backed company context/u).length).toBeGreaterThan(0);
    expect(screen.queryByText('Journey Workbench')).not.toBeInTheDocument();
  });

  it('does not show a fake streaming artifact for a restored run with no activity', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        activeRunId="journey-restored-123"
        phase="workspace"
      />,
    );

    expect(screen.getByText(/Journey run is ready/u)).toBeInTheDocument();
    expect(screen.queryByTestId('deep-research-report-artifact')).not.toBeInTheDocument();
  });

  it('keeps the corpus build out of the report artifact pane (Stage 1 contract)', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        deepResearchStatus="starting"
      />,
    );

    // Stage 1: chain-of-thought + corpus terminal — never the report artifact.
    expect(screen.getByTestId('journey-corpus-terminal')).toBeInTheDocument();
    expect(screen.queryByTestId('deep-research-report-artifact')).not.toBeInTheDocument();
  });

  it('does not surface raw deep-research markdown into the report artifact during corpus build', () => {
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

    // Corpus markdown stays as data — it must NOT appear inside the report artifact pane.
    expect(screen.queryByTestId('deep-research-report-artifact')).not.toBeInTheDocument();
    // The corpus terminal IS the surface for in-flight corpus work.
    expect(screen.getByTestId('journey-corpus-terminal')).toBeInTheDocument();
  });

  it('places the corpus terminal after the assistant output during Stage 1', () => {
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
    const terminal = screen.getByTestId('journey-corpus-terminal');

    expect(
      assistant.compareDocumentPosition(terminal) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(terminal).toHaveTextContent('https://www.airtable.com/product');
  });

  it('renders an operator control for the next report section when provided', () => {
    const onRunNextSection = vi.fn();

    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        phase="workspace"
        deepResearchStatus="complete"
        deepResearchFields={{ companyName: 'Airtable' }}
        nextSectionLabel="Market Category"
        onRunNextSection={onRunNextSection}
      />,
    );

    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
      'Next report section: Market Category',
    );
    expect(screen.getByTestId('journey-next-section-control')).toHaveTextContent(
      'Company research is ready',
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: 'Run next research section: Market Category',
      }),
    );

    expect(onRunNextSection).toHaveBeenCalledTimes(1);
  });

  it('shows the live artifact growth count as report sections are added (Stage 3)', () => {
    render(
      <JourneyAgentChat
        {...baseProps}
        websiteUrl="research airtable.com"
        activeRunId="journey-test-123"
        phase="workspace"
        deepResearchStatus="complete"
        deepResearchFields={{ companyName: 'Airtable' }}
        researchResults={{
          industryMarket: {
            status: 'complete',
            section: 'industryMarket',
            durationMs: 12,
            data: {
              statusSummary: 'Market section saved.',
            },
          },
        }}
      />,
    );

    expect(screen.getByTestId('artifact-growth-summary')).toHaveTextContent(
      '1 of 1 section saved',
    );
    expect(screen.getByTestId('deep-research-report-artifact')).toHaveTextContent(
      'Market section saved.',
    );
  });
});
