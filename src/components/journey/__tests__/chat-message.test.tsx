import { render, screen } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../chat-message';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/chat/thinking-block', () => ({
  ThinkingBlock: ({
    content,
    state,
  }: {
    content: string;
    state?: string;
  }) => <div data-testid="thinking-block">{`${state ?? 'none'}:${content}`}</div>,
}));

vi.mock('@/components/chat/tool-loading-indicator', () => ({
  ToolLoadingIndicator: ({ toolName }: { toolName: string }) => (
    <div data-testid={`loading-${toolName}`} />
  ),
}));

vi.mock('@/components/chat/deep-research-card', () => ({
  DeepResearchCard: () => <div data-testid="deep-research-card" />,
}));

vi.mock('@/components/chat/edit-approval-card', () => ({
  EditApprovalCard: () => <div data-testid="edit-approval-card" />,
}));

vi.mock('@/components/chat/comparison-table-card', () => ({
  ComparisonTableCard: () => <div data-testid="comparison-table-card" />,
}));

vi.mock('@/components/chat/analysis-score-card', () => ({
  AnalysisScoreCard: () => <div data-testid="analysis-score-card" />,
}));

vi.mock('@/components/chat/visualization-card', () => ({
  VisualizationCard: () => <div data-testid="visualization-card" />,
}));

vi.mock('@/components/journey/ask-user-card', () => ({
  AskUserCard: () => <div data-testid="ask-user-card" />,
}));

vi.mock('@/components/journey/journey-keyword-intel-detail', () => ({
  JourneyKeywordIntelDetail: () => <div data-testid="keyword-intel-detail" />,
  getJourneyKeywordIntelDetailData: () => null,
}));

vi.mock('@/components/journey/research-inline-card', () => ({
  ResearchInlineCard: ({
    section,
    status,
    error,
  }: {
    section: string;
    status: string;
    error?: string;
  }) => (
    <div data-testid={`research-inline-${section}`}>
      {`${section}:${status}:${error ?? 'ok'}`}
    </div>
  ),
}));

vi.mock('@/components/journey/research-subsection-reveal', () => ({
  ResearchSubsectionReveal: ({ sectionKey }: { sectionKey: string }) => (
    <div data-testid={`research-subsection-${sectionKey}`} />
  ),
}));

vi.mock('@/components/journey/scrape-loading-card', () => ({
  ScrapeLoadingCard: () => <div data-testid="scrape-loading-card" />,
}));

describe('ChatMessage', () => {
  it('renders current Journey research tool output inline', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="research-output"
        parts={[
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'industry-1',
            toolName: 'researchIndustry',
            input: {},
            output: JSON.stringify({
              status: 'complete',
              section: 'industryMarket',
              data: { summary: 'Market overview ready' },
            }),
          },
        ]}
      />,
    );

    expect(screen.getByTestId('research-inline-industryMarket')).toHaveTextContent(
      'industryMarket:complete:ok',
    );
    expect(
      screen.getByTestId('research-subsection-industryMarket'),
    ).toBeInTheDocument();
  });

  it('renders research dispatch errors inline without crashing the assistant turn', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="research-error"
        parts={[
          {
            type: 'tool-researchCompetitors',
            state: 'output-error',
            toolCallId: 'competitors-1',
            toolName: 'researchCompetitors',
            errorText: 'Worker error: 500',
          },
          {
            type: 'text',
            text: 'I will retry once the worker is healthy.',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('research-inline-competitors')).toHaveTextContent(
      'competitors:error:Worker error: 500',
    );
    expect(
      screen.getByText('I will retry once the worker is healthy.'),
    ).toBeInTheDocument();
  });

  it('renders malformed research output payloads as explicit errors instead of fake completions', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="research-invalid-output"
        parts={[
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'industry-bad-1',
            toolName: 'researchIndustry',
            output: '{bad json',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('research-inline-industryMarket')).toHaveTextContent(
      'industryMarket:error:Malformed research payload',
    );
    expect(
      screen.queryByTestId('research-subsection-industryMarket'),
    ).not.toBeInTheDocument();
  });

  it('does not crash when assistant parts include malformed or partial entries', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="malformed-assistant"
        parts={[
          undefined,
          null,
          { foo: 'bar' },
          {
            type: 'reasoning',
            state: 'streaming',
            text: 'Checking whether the worker responded.',
          },
          {
            type: 'tool-researchIndustry',
            toolName: 'researchIndustry',
          },
          {
            type: 'text',
            text: 'Still rendering the valid content.',
          },
        ]}
      />,
    );

    expect(screen.getByTestId('thinking-block')).toHaveTextContent(
      'streaming:Checking whether the worker responded.',
    );
    expect(
      screen.getByText('Still rendering the valid content.'),
    ).toBeInTheDocument();
  });

  it('ignores malformed user parts and still renders the valid text payload', () => {
    render(
      <ChatMessage
        role="user"
        parts={[
          undefined,
          { text: 'missing type' },
          { type: 'text', text: 'Looks good' },
        ]}
      />,
    );

    expect(screen.getByText('Looks good')).toBeInTheDocument();
  });
});
