import { render, screen } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../chat-message';

const { industryCardRenderCount } = vi.hoisted(() => ({
  industryCardRenderCount: { current: 0 },
}));

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}));

vi.mock('@/components/chat/thinking-block', () => ({
  ThinkingBlock: () => <div data-testid="thinking-block" />,
}));

vi.mock('@/components/chat/tool-loading-indicator', () => ({
  ToolLoadingIndicator: ({ toolName }: { toolName: string }) => <div data-testid={`loading-${toolName}`} />,
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

vi.mock('@/components/journey/research-inline-card', () => ({
  ResearchInlineCard: () => <div data-testid="legacy-research-inline-card" />,
}));

vi.mock('@/components/journey/research-subsection-reveal', () => ({
  ResearchSubsectionReveal: () => <div data-testid="legacy-research-subsection-reveal" />,
}));

vi.mock('@/components/journey/scrape-loading-card', () => ({
  ScrapeLoadingCard: () => <div data-testid="scrape-loading-card" />,
}));

vi.mock('@/components/journey/research-cards', () => ({
  MarketOverviewCard: ({
    citations,
    status,
    error,
  }: {
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    (() => {
      industryCardRenderCount.current += 1;
      return (
        <div data-testid="industryResearch-card">
          {status ?? 'complete'}:{error ?? citations?.map((citation) => citation.url).join(',') ?? ''}
        </div>
      );
    })()
  ),
  CompetitorIntelCard: ({
    citations,
    status,
    error,
  }: {
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    <div data-testid="competitorIntel-card">
      {status ?? 'complete'}:{error ?? citations?.map((citation) => citation.url).join(',') ?? ''}
    </div>
  ),
  ICPCard: ({
    citations,
    status,
    error,
  }: {
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    <div data-testid="icpValidation-card">
      {status ?? 'complete'}:{error ?? citations?.map((citation) => citation.url).join(',') ?? ''}
    </div>
  ),
  OfferAnalysisCard: ({
    data,
    citations,
    status,
    error,
  }: {
    data?: Record<string, unknown>;
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    <div data-testid="offerAnalysis-card">
      {status ?? 'complete'}:
      {error ??
        (typeof data?.recommendation === 'object' &&
        data.recommendation &&
        typeof (data.recommendation as { status?: string }).status === 'string'
          ? (data.recommendation as { status: string }).status
          : typeof data?.content === 'string'
            ? data.content
            : citations?.map((citation) => citation.url).join(',') ?? '')}
    </div>
  ),
  StrategySummaryCard: ({
    data,
    citations,
    status,
    error,
  }: {
    data?: Record<string, unknown>;
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    <div data-testid="strategicSynthesis-card">
      {status ?? 'complete'}:
      {error ??
        (typeof data?.recommendedPositioning === 'string'
          ? data.recommendedPositioning
          : typeof data?.content === 'string'
            ? data.content
            : citations?.map((citation) => citation.url).join(',') ?? '')}
    </div>
  ),
  KeywordIntelCard: ({
    citations,
    status,
    error,
  }: {
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    <div data-testid="keywordIntel-card">
      {status ?? 'complete'}:{error ?? citations?.map((citation) => citation.url).join(',') ?? ''}
    </div>
  ),
  MediaPlanCard: ({
    citations,
    status,
    error,
  }: {
    citations?: Array<{ url: string }>;
    status?: string;
    error?: string;
  }) => (
    <div data-testid="mediaPlan-card">
      {status ?? 'complete'}:{error ?? citations?.map((citation) => citation.url).join(',') ?? ''}
    </div>
  ),
}));

describe('ChatMessage', () => {
  it('does not rerender a completed research card for unrelated streaming updates', () => {
    industryCardRenderCount.current = 0;

    const props = {
      role: 'assistant' as const,
      messageId: 'memo-msg',
      parts: [
        {
          type: 'tool-generateResearch',
          state: 'output-available',
          toolCallId: 'research-call',
          input: { sectionId: 'industryResearch' },
          output: {
            status: 'complete',
            sectionId: 'industryResearch',
            content: 'Research body',
            citations: [{ number: 1, url: 'https://example.com/report' }],
          },
        },
      ],
      researchStreaming: {
        industryResearch: { text: 'industry text', status: 'complete' as const },
      },
    };

    const { rerender } = render(<ChatMessage {...props} />);
    expect(industryCardRenderCount.current).toBe(1);

    rerender(
      <ChatMessage
        {...props}
        researchStreaming={{
          ...props.researchStreaming,
          keywordIntel: { text: 'other section delta', status: 'running' },
        }}
      />,
    );

    expect(industryCardRenderCount.current).toBe(1);
  });

  it('does not render legacy research tool cards in Journey chat', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="legacy-msg"
        parts={[
          {
            type: 'tool-researchIndustry',
            state: 'output-available',
            toolCallId: 'legacy-call',
            input: { context: 'ctx' },
            output: { status: 'complete', section: 'industryMarket', data: {} },
          },
        ]}
      />,
    );

    expect(screen.queryByTestId('legacy-research-inline-card')).not.toBeInTheDocument();
    expect(screen.queryByTestId('legacy-research-subsection-reveal')).not.toBeInTheDocument();
  });

  it('renders generateResearch cards for canonical Journey sections', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="new-msg"
        parts={[
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-call',
            input: { sectionId: 'industryResearch' },
            output: {
              status: 'complete',
              sectionId: 'industryResearch',
              content: 'Research body',
              fileIds: [],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('industryResearch-card')).toBeInTheDocument();
  });

  it('renders an error card when generateResearch returns an error payload', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="error-msg"
        parts={[
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-call',
            input: { sectionId: 'industryResearch' },
            output: {
              status: 'error',
              sectionId: 'industryResearch',
              error: 'Revision chain rejected',
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('industryResearch-card')).toHaveTextContent(
      'error:Revision chain rejected',
    );
  });

  it('passes structured citations through when the section output does not use footnote markup', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="citation-msg"
        parts={[
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-call',
            input: { sectionId: 'industryResearch' },
            output: {
              status: 'complete',
              sectionId: 'industryResearch',
              content: 'Research body without inline footnotes',
              citations: [
                {
                  number: 1,
                  url: 'https://example.com/report',
                  title: 'Market report',
                },
              ],
              fileIds: [],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('industryResearch-card')).toHaveTextContent(
      'https://example.com/report',
    );
  });

  it('passes typed wave 1 data through to the offer analysis card', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="offer-typed-msg"
        parts={[
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-call',
            input: { sectionId: 'offerAnalysis' },
            output: {
              status: 'complete',
              sectionId: 'offerAnalysis',
              content: 'Offer fallback narrative',
              data: {
                recommendation: {
                  status: 'adjust_messaging',
                },
              },
              fileIds: [],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('offerAnalysis-card')).toHaveTextContent(
      'complete:adjust_messaging',
    );
  });

  it('passes typed wave 1 data through to the strategic synthesis card', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="strategy-typed-msg"
        parts={[
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-call',
            input: { sectionId: 'strategicSynthesis' },
            output: {
              status: 'complete',
              sectionId: 'strategicSynthesis',
              content: 'Strategy fallback narrative',
              data: {
                recommendedPositioning: 'Own the fastest path to pipeline visibility.',
              },
              fileIds: [],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('strategicSynthesis-card')).toHaveTextContent(
      'complete:Own the fastest path to pipeline visibility.',
    );
  });

  it('keeps the content fallback when typed wave 1 data is absent', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="offer-fallback-msg"
        parts={[
          {
            type: 'tool-generateResearch',
            state: 'output-available',
            toolCallId: 'research-call',
            input: { sectionId: 'offerAnalysis' },
            output: {
              status: 'complete',
              sectionId: 'offerAnalysis',
              content: 'Offer fallback narrative',
              fileIds: [],
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('offerAnalysis-card')).toHaveTextContent(
      'complete:Offer fallback narrative',
    );
  });
});
