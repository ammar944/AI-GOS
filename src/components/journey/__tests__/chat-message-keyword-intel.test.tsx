import { render, screen } from '@testing-library/react';
import type { HTMLAttributes } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { ChatMessage } from '../chat-message';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
  },
}));

vi.mock('@/components/chat/thinking-block', () => ({
  ThinkingBlock: () => <div data-testid="thinking-block" />,
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

vi.mock('@/components/journey/research-inline-card', () => ({
  ResearchInlineCard: () => <div data-testid="legacy-research-inline-card" />,
}));

vi.mock('@/components/journey/research-subsection-reveal', () => ({
  ResearchSubsectionReveal: () => (
    <div data-testid="legacy-research-subsection-reveal" />
  ),
}));

vi.mock('@/components/journey/journey-keyword-intel-detail', () => ({
  JourneyKeywordIntelDetail: () => (
    <div data-testid="journey-keyword-intel-detail" />
  ),
  getJourneyKeywordIntelDetailData: (
    data: Record<string, unknown> | undefined,
  ) => data ?? null,
}));

vi.mock('@/components/journey/scrape-loading-card', () => ({
  ScrapeLoadingCard: () => <div data-testid="scrape-loading-card" />,
}));

describe('ChatMessage keyword intel rendering', () => {
  it('renders the dedicated keyword detail instead of the generic subsection reveal', () => {
    render(
      <ChatMessage
        role="assistant"
        messageId="keyword-msg"
        parts={[
          {
            type: 'tool-researchKeywords',
            state: 'output-available',
            toolCallId: 'keyword-tool-call',
            input: { context: 'ctx' },
            output: {
              status: 'complete',
              section: 'keywordIntel',
              data: {
                totalKeywordsFound: 42,
                competitorGapCount: 9,
                topOpportunities: [
                  {
                    keyword: 'b2b saas demand generation agency',
                    searchVolume: 1900,
                  },
                ],
                competitorGaps: [],
                quickWins: ['Launch competitor alternative campaigns immediately.'],
              },
            },
          },
        ]}
      />,
    );

    expect(screen.getByTestId('legacy-research-inline-card')).toBeInTheDocument();
    expect(screen.getByTestId('journey-keyword-intel-detail')).toBeInTheDocument();
    expect(
      screen.queryByTestId('legacy-research-subsection-reveal'),
    ).not.toBeInTheDocument();
  });
});
