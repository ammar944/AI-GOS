import { render, screen, act } from '@testing-library/react';
import type { HTMLAttributes, ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { KeyedResearchSubsectionReveal } from '../keyed-research-subsection-reveal';

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    li: ({ children, ...props }: HTMLAttributes<HTMLLIElement>) => (
      <li {...props}>{children}</li>
    ),
  },
  AnimatePresence: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('KeyedResearchSubsectionReveal', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('remounts reveal cards when switching between completed sections', () => {
    const { rerender } = render(
      <KeyedResearchSubsectionReveal
        sectionKey="crossAnalysis"
        status="complete"
        delayMs={0}
        data={{
          positioningStrategy: {
            recommendedAngle: 'Own revenue accountability, not vanity metrics.',
          },
          platformRecommendations: [
            { platform: 'LinkedIn', budgetAllocation: '45% ($9,000)' },
          ],
          nextSteps: ['Validate founder-led outbound messaging'],
        }}
      />,
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByText('Positioning')).toBeInTheDocument();

    rerender(
      <KeyedResearchSubsectionReveal
        sectionKey="keywordIntel"
        status="complete"
        delayMs={0}
        data={{
          totalKeywordsFound: 42,
          competitorGapCount: 9,
          topOpportunities: [
            {
              keyword: 'b2b attribution software',
              searchVolume: 1300,
            },
          ],
          competitorGaps: [
            {
              keyword: 'dreamdata alternative',
              competitorName: 'Dreamdata',
            },
          ],
        }}
      />,
    );

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByText('Keyword Intel')).toBeInTheDocument();
    expect(screen.getByText('Top Opportunities')).toBeInTheDocument();
    expect(screen.getByText('Competitor Gaps')).toBeInTheDocument();
  });
});
