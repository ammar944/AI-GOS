'use client';

import { motion } from 'framer-motion';
import { CardEditingContext, useCardEditing } from '@/lib/workspace/card-editing-context';
import { ArtifactCard } from '@/components/workspace/artifact-card';
import { StatGrid } from '@/components/workspace/cards/stat-grid';
import { BulletList } from '@/components/workspace/cards/bullet-list';
import { CheckList } from '@/components/workspace/cards/check-list';
import { ProseCard } from '@/components/workspace/cards/prose-card';
import { TrendCard } from '@/components/workspace/cards/trend-card';
import { CompetitorCard } from '@/components/workspace/cards/competitor-card';
import { GapCard } from '@/components/workspace/cards/gap-card';
import { VerdictCard } from '@/components/workspace/cards/verdict-card';
import { PricingCard } from '@/components/workspace/cards/pricing-card';
import { FlagCard } from '@/components/workspace/cards/flag-card';
import { StrategyCard } from '@/components/workspace/cards/strategy-card';
import { InsightCard } from '@/components/workspace/cards/insight-card';
import { PlatformCard } from '@/components/workspace/cards/platform-card';
import { AngleCard } from '@/components/workspace/cards/angle-card';
import { ChartCard } from '@/components/workspace/cards/chart-card';
import { StrategySnapshotCard } from '@/components/workspace/cards/strategy-snapshot-card';
import { BudgetSummaryCard } from '@/components/workspace/cards/budget-summary-card';
import { SegmentCard } from '@/components/workspace/cards/segment-card';
import { CampaignCard } from '@/components/workspace/cards/campaign-card';
import { CreativeAngleCard } from '@/components/workspace/cards/creative-angle-card';
import { RiskCard } from '@/components/workspace/cards/risk-card';
import { FormatSpecCard } from '@/components/workspace/cards/format-spec-card';
import { TestingPlanCard } from '@/components/workspace/cards/testing-plan-card';
import { KpiGridCard } from '@/components/workspace/cards/kpi-grid-card';
import { CacModelCard } from '@/components/workspace/cards/cac-model-card';
import { PhaseCard } from '@/components/workspace/cards/phase-card';
import {
  PlatformBudgetPieChart,
  FunnelSplitBarChart,
  CACFunnelChart,
  KPIBenchmarkChart,
  PhaseBudgetChart,
} from '@/components/workspace/cards/media-plan-charts';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
import { cn } from '@/lib/utils';
import type { CardState } from '@/lib/workspace/types';

/** Card types that get "hero" visual treatment in document mode */
const HERO_CARD_TYPES = new Set(['stat-grid', 'strategy-card', 'competitor-card', 'pricing-card']);

/**
 * Pure switch statement mapping card.cardType to component.
 * Consumes CardEditingContext for editable cards (stat-grid, bullet-list, check-list, prose-card).
 * Stateless -- all editing state comes from context.
 */
export function CardContentSwitch({ card }: { card: CardState }) {
  const { isEditing, draftContent, updateDraft } = useCardEditing();
  const content = isEditing ? draftContent : card.content;

  switch (card.cardType) {
    case 'stat-grid':
      return (
        <StatGrid
          stats={content.stats as { label: string; value: string; badge?: string; badgeColor?: string }[]}
          isEditing={isEditing}
          onStatsChange={(stats) => updateDraft({ stats })}
        />
      );
    case 'bullet-list':
      return (
        <BulletList
          title={card.label}
          items={content.items as string[]}
          accent={content.accent as string | undefined}
          isEditing={isEditing}
          onItemsChange={(items) => updateDraft({ items })}
        />
      );
    case 'check-list':
      return (
        <CheckList
          title={card.label}
          items={content.items as string[]}
          accent={content.accent as string | undefined}
          isEditing={isEditing}
          onItemsChange={(items) => updateDraft({ items })}
        />
      );
    case 'prose-card':
      return (
        <ProseCard
          title={card.label}
          text={content.text as string}
          isEditing={isEditing}
          onTextChange={(text) => updateDraft({ text })}
        />
      );
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
    case 'pie-chart':
      return (
        <PlatformBudgetPieChart
          platforms={card.content.platforms as Array<{name: string; percentage: number}>}
        />
      );
    case 'funnel-split-chart':
      return (
        <FunnelSplitBarChart
          funnelSplit={card.content.funnelSplit as {awareness: number; consideration: number; conversion: number}}
        />
      );
    case 'cac-funnel-chart':
      return (
        <CACFunnelChart
          cacModel={card.content.cacModel as {expectedLeadsPerMonth: number; expectedSQLsPerMonth: number; expectedCustomersPerMonth: number}}
        />
      );
    case 'kpi-benchmark-chart':
      return (
        <KPIBenchmarkChart
          kpis={card.content.kpis as Array<{metric: string; target: number; industryBenchmark: number}>}
        />
      );
    case 'phase-budget-chart':
      return (
        <PhaseBudgetChart
          phases={card.content.phases as Array<{name: string; budgetAllocation: number}>}
        />
      );
    case 'keyword-grid': {
      const rawData = card.content.rawData as Record<string, unknown>;
      const normalized = getJourneyKeywordIntelDetailData(rawData);
      if (!normalized) return <p className="text-sm text-[var(--text-secondary)]">Keyword intelligence could not be rendered.</p>;
      return <JourneyKeywordIntelDetail data={normalized} />;
    }
    case 'strategy-snapshot':
      return (
        <StrategySnapshotCard
          headline={card.content.headline as string | undefined}
          topPriorities={card.content.topPriorities as Array<{label?: string; description?: string}> | undefined}
          budgetOverview={card.content.budgetOverview as {total?: number; topPlatform?: string; timeToFirstResults?: string} | undefined}
          expectedOutcomes={card.content.expectedOutcomes as {leadsPerMonth?: number; estimatedCAC?: number; expectedROAS?: number} | undefined}
        />
      );
    case 'budget-summary':
      return (
        <BudgetSummaryCard
          totalMonthly={card.content.totalMonthly as number | undefined}
          funnelSplit={card.content.funnelSplit as {awareness?: number; consideration?: number; conversion?: number} | undefined}
          rampUpWeeks={card.content.rampUpWeeks as number | undefined}
        />
      );
    case 'segment-card':
      return (
        <SegmentCard
          name={card.content.name as string}
          description={card.content.description as string | undefined}
          estimatedReach={card.content.estimatedReach as string | undefined}
          funnelPosition={card.content.funnelPosition as string | undefined}
          priority={card.content.priority as number | undefined}
        />
      );
    case 'campaign-card':
      return (
        <CampaignCard
          platform={card.content.platform as string | undefined}
          name={card.content.name as string}
          objective={card.content.objective as string | undefined}
          adSets={card.content.adSets as Array<Record<string, unknown>> | undefined}
          namingConvention={card.content.namingConvention as string | undefined}
        />
      );
    case 'creative-angle':
      return (
        <CreativeAngleCard
          theme={card.content.theme as string}
          hook={card.content.hook as string | undefined}
          messagingApproach={card.content.messagingApproach as string | undefined}
          targetSegment={card.content.targetSegment as string | undefined}
        />
      );
    case 'format-spec':
      return <FormatSpecCard specs={card.content.specs as Array<Record<string, unknown>>} />;
    case 'testing-plan':
      return (
        <TestingPlanCard
          firstTests={card.content.firstTests as string[] | undefined}
          methodology={card.content.methodology as string | undefined}
          minBudgetPerTest={card.content.minBudgetPerTest as number | undefined}
        />
      );
    case 'kpi-grid':
      return <KpiGridCard kpis={card.content.kpis as Array<Record<string, unknown>>} />;
    case 'cac-model':
      return (
        <CacModelCard
          targetCAC={card.content.targetCAC as number | undefined}
          expectedCPL={card.content.expectedCPL as number | undefined}
          leadToSqlRate={card.content.leadToSqlRate as number | undefined}
          sqlToCustomerRate={card.content.sqlToCustomerRate as number | undefined}
          expectedLeadsPerMonth={card.content.expectedLeadsPerMonth as number | undefined}
          expectedSQLsPerMonth={card.content.expectedSQLsPerMonth as number | undefined}
          expectedCustomersPerMonth={card.content.expectedCustomersPerMonth as number | undefined}
          ltv={card.content.ltv as number | undefined}
          ltvCacRatio={card.content.ltvCacRatio as number | undefined}
        />
      );
    case 'risk-card':
      return (
        <RiskCard
          risk={card.content.risk as string}
          category={card.content.category as string | undefined}
          severity={card.content.severity as string | undefined}
          likelihood={card.content.likelihood as string | undefined}
          mitigation={card.content.mitigation as string | undefined}
          earlyWarning={card.content.earlyWarning as string | undefined}
        />
      );
    case 'phase-card':
      return (
        <PhaseCard
          name={card.content.name as string}
          duration={card.content.duration as string | undefined}
          objectives={card.content.objectives as string[] | undefined}
          activities={card.content.activities as string[] | undefined}
          successCriteria={card.content.successCriteria as string[] | undefined}
          budgetAllocation={card.content.budgetAllocation as number | undefined}
          goNoGo={card.content.goNoGo as string | undefined}
        />
      );
    default:
      return <p className="text-xs text-[var(--text-tertiary)]">Unknown card type: {card.cardType}</p>;
  }
}

// Read-only context value -- no editing, just provides card.content to useCardEditing consumers
const READ_ONLY_CONTEXT = {
  isEditing: false,
  draftContent: {},
  updateDraft: () => {},
};

interface CardRendererProps {
  card: CardState;
  mode: 'workspace' | 'document';
  index?: number;
}

/**
 * Renders a card in workspace (editable via ArtifactCard) or document (read-only) mode.
 */
export function CardRenderer({ card, mode, index = 0 }: CardRendererProps) {
  if (mode === 'workspace') {
    return (
      <ArtifactCard card={card} index={index}>
        <CardContentSwitch card={card} />
      </ArtifactCard>
    );
  }

  // Document mode: read-only container with static CardEditingContext
  const readOnlyContext = {
    ...READ_ONLY_CONTEXT,
    draftContent: card.content,
  };

  const isHero = HERO_CARD_TYPES.has(card.cardType);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, delay: index * 0.05 }}
      className={cn(
        'rounded-[var(--radius-lg)] bg-[var(--bg-card)]',
        isHero
          ? 'border border-[var(--border-subtle)] border-l-2 border-l-[var(--accent-blue)]/40 p-6 print-card-hero'
          : 'border border-[var(--border-glass)] p-5',
      )}
    >
      <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full bg-[var(--accent-blue)] shrink-0" />
        {card.label}
      </span>
      <CardEditingContext value={readOnlyContext}>
        <CardContentSwitch card={card} />
      </CardEditingContext>
    </motion.div>
  );
}
