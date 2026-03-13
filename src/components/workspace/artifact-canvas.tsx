'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SECTION_PIPELINE } from '@/lib/workspace/pipeline';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';
import { CardGrid } from './card-grid';
import { ArtifactCard } from './artifact-card';
import { StatGrid } from './cards/stat-grid';
import { BulletList } from './cards/bullet-list';
import { CheckList } from './cards/check-list';
import { ProseCard } from './cards/prose-card';
import { TrendCard } from './cards/trend-card';
import type { CardState } from '@/lib/workspace/types';

function CardContent({ card }: { card: CardState }) {
  switch (card.cardType) {
    case 'stat-grid':
      return <StatGrid stats={card.content.stats as { label: string; value: string; badge?: string; badgeColor?: string }[]} />;
    case 'bullet-list':
      return <BulletList title={card.label} items={card.content.items as string[]} accent={card.content.accent as string | undefined} />;
    case 'check-list':
      return <CheckList title={card.label} items={card.content.items as string[]} accent={card.content.accent as string | undefined} />;
    case 'prose-card':
      return <ProseCard title={card.label} text={card.content.text as string} />;
    case 'trend-card':
      return <TrendCard trend={card.content.trend as string} direction={card.content.direction as string} evidence={card.content.evidence as string} />;
    default:
      return <p className="text-xs text-[var(--text-tertiary)]">Unknown card type: {card.cardType}</p>;
  }
}

export function ArtifactCanvas() {
  const { state, approveSection } = useWorkspace();
  const phase = state.sectionStates[state.currentSection];
  const isReviewable = phase === 'review';
  const isLoading = phase === 'researching' || phase === 'streaming';

  const sectionCards = useMemo(() => {
    return Object.values(state.cards)
      .filter((card) => card.sectionKey === state.currentSection);
  }, [state.cards, state.currentSection]);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 pt-6 custom-scrollbar">
        <SectionHeader section={state.currentSection} />

        {isLoading && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              Researching...
            </p>
          </div>
        )}

        {phase === 'error' && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <div className="text-center">
              <p className="text-sm text-[var(--accent-red)]">Research failed</p>
              <p className="mt-1 text-xs text-[var(--text-tertiary)]">
                {state.sectionErrors[state.currentSection] ?? 'Unknown error'}
              </p>
            </div>
          </div>
        )}

        {isReviewable && sectionCards.length > 0 && (
          <CardGrid>
            {sectionCards.map((card, i) => (
              <ArtifactCard key={card.id} card={card} index={i}>
                <CardContent card={card} />
              </ArtifactCard>
            ))}
          </CardGrid>
        )}

        {isReviewable && sectionCards.length === 0 && (
          <div className="flex flex-1 items-center justify-center min-h-[400px]">
            <p className="text-sm text-[var(--text-tertiary)] font-mono">
              No cards for this section yet
            </p>
          </div>
        )}
      </div>

      {isReviewable && <ArtifactFooter onApprove={approveSection} />}
    </div>
  );
}
