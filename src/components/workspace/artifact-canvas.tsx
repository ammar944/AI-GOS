'use client';

import { useMemo } from 'react';
import { useWorkspace } from '@/lib/workspace/use-workspace';
import { SectionHeader } from './section-header';
import { ArtifactFooter } from './artifact-footer';
import { CardGrid } from './card-grid';
import { ArtifactCard } from './artifact-card';
import { StatGrid } from './cards/stat-grid';
import { BulletList } from './cards/bullet-list';
import { CheckList } from './cards/check-list';
import { ProseCard } from './cards/prose-card';
import { TrendCard } from './cards/trend-card';
import { CompetitorCard } from './cards/competitor-card';
import { GapCard } from './cards/gap-card';
import { VerdictCard } from './cards/verdict-card';
import { PricingCard } from './cards/pricing-card';
import { FlagCard } from './cards/flag-card';
import { StrategyCard } from './cards/strategy-card';
import { InsightCard } from './cards/insight-card';
import { PlatformCard } from './cards/platform-card';
import { AngleCard } from './cards/angle-card';
import { ChartCard } from './cards/chart-card';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
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
    case 'competitor-card': {
      const c = card.content;
      return (
        <CompetitorCard
          name={c.name as string}
          website={c.website as string | undefined}
          positioning={c.positioning as string | undefined}
          price={c.price as string | undefined}
          pricingConfidence={c.pricingConfidence as string | undefined}
          strengths={(c.strengths ?? []) as string[]}
          weaknesses={(c.weaknesses ?? []) as string[]}
          opportunities={(c.opportunities ?? []) as string[]}
          ourAdvantage={c.ourAdvantage as string | undefined}
          adActivity={c.adActivity as { activeAdCount: number; platforms: string[]; themes: string[]; evidence: string; sourceConfidence: 'high' | 'medium' | 'low' } | undefined}
          adCreatives={c.adCreatives as Array<{ platform: 'linkedin' | 'meta' | 'google'; id: string; advertiser: string; headline?: string; body?: string; imageUrl?: string; videoUrl?: string; format: 'video' | 'image' | 'carousel' | 'text' | 'message' | 'unknown'; isActive: boolean; detailsUrl?: string; firstSeen?: string; lastSeen?: string }> | undefined}
          libraryLinks={c.libraryLinks as { metaLibraryUrl?: string; linkedInLibraryUrl?: string; googleAdvertiserUrl?: string } | undefined}
          topAdHooks={(c.topAdHooks ?? []) as string[]}
          counterPositioning={c.counterPositioning as string | undefined}
        />
      );
    }
    case 'gap-card':
      return (
        <GapCard
          gap={card.content.gap as string}
          type={card.content.type as string | undefined}
          evidence={card.content.evidence as string | undefined}
          exploitability={card.content.exploitability as number | undefined}
          impact={card.content.impact as number | undefined}
          recommendedAction={card.content.recommendedAction as string | undefined}
        />
      );
    case 'verdict-card':
      return <VerdictCard status={card.content.status as string} reasoning={card.content.reasoning as string | undefined} />;
    case 'pricing-card':
      return (
        <PricingCard
          currentPricing={card.content.currentPricing as string | undefined}
          marketBenchmark={card.content.marketBenchmark as string | undefined}
          pricingPosition={card.content.pricingPosition as string | undefined}
          coldTrafficViability={card.content.coldTrafficViability as string | undefined}
        />
      );
    case 'flag-card':
      return (
        <FlagCard
          issue={card.content.issue as string}
          severity={card.content.severity as string | undefined}
          priority={card.content.priority as number | undefined}
          evidence={card.content.evidence as string | undefined}
          recommendedAction={card.content.recommendedAction as string | undefined}
        />
      );
    case 'strategy-card':
      return (
        <StrategyCard
          recommendedAngle={card.content.recommendedAngle as string | undefined}
          leadRecommendation={card.content.leadRecommendation as string | undefined}
          keyDifferentiator={card.content.keyDifferentiator as string | undefined}
        />
      );
    case 'insight-card':
      return (
        <InsightCard
          insight={card.content.insight as string}
          source={card.content.source as string | undefined}
          implication={card.content.implication as string | undefined}
        />
      );
    case 'platform-card':
      return (
        <PlatformCard
          platform={card.content.platform as string}
          role={card.content.role as string | undefined}
          budgetAllocation={card.content.budgetAllocation as string | undefined}
          rationale={card.content.rationale as string | undefined}
        />
      );
    case 'angle-card':
      return (
        <AngleCard
          angle={card.content.angle as string}
          exampleHook={card.content.exampleHook as string | undefined}
          evidence={card.content.evidence as string | undefined}
        />
      );
    case 'chart-card':
      return (
        <ChartCard
          title={card.content.title as string}
          description={card.content.description as string | undefined}
          imageUrl={card.content.imageUrl as string | undefined}
        />
      );
    case 'keyword-grid': {
      const rawData = card.content.rawData as Record<string, unknown>;
      const normalized = getJourneyKeywordIntelDetailData(rawData);
      if (!normalized) return <p className="text-sm text-[var(--text-secondary)]">Keyword intelligence could not be rendered.</p>;
      return <JourneyKeywordIntelDetail data={normalized} />;
    }
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
