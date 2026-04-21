'use client';

import { motion } from 'framer-motion';
import { CardEditingContext, useCardEditing } from '@/lib/workspace/card-editing-context';
import { ArtifactCard } from '@/components/workspace/artifact-card';
import { StatGrid } from '@/components/workspace/cards/stat-grid';
import { OfferScoreBarPanel } from '@/components/workspace/cards/offer-refinement-card';
import { parseOfferScoreFromStats } from '@/lib/workspace/parse-offer-score-stats';
import { BulletList } from '@/components/workspace/cards/bullet-list';
import { CheckList } from '@/components/workspace/cards/check-list';
import { ProseCard } from '@/components/workspace/cards/prose-card';
import { TrendCard } from '@/components/workspace/cards/trend-card';
import { CompetitorCard } from '@/components/workspace/cards/competitor-card';
import { CategoryAdSweepCard } from '@/components/workspace/cards/category-ad-sweep-card';
import { GapCard } from '@/components/workspace/cards/gap-card';
import { VerdictCard } from '@/components/workspace/cards/verdict-card';
import { PricingCard } from '@/components/workspace/cards/pricing-card';
import { PricingIntelligence, type PricingIntelligenceProps } from '@/components/workspace/cards/pricing-intelligence';
import { FlagCard } from '@/components/workspace/cards/flag-card';
import { StrategyCard } from '@/components/workspace/cards/strategy-card';
import { InsightCard } from '@/components/workspace/cards/insight-card';
import { PlatformCard } from '@/components/workspace/cards/platform-card';
import { AngleCard } from '@/components/workspace/cards/angle-card';
import { ReviewCard } from '@/components/workspace/cards/review-card';
import { ChartCard } from '@/components/workspace/cards/chart-card';
import { StrategySnapshotCard } from '@/components/workspace/cards/strategy-snapshot-card';
import { BudgetSummaryCard } from '@/components/workspace/cards/budget-summary-card';
import { SegmentCard } from '@/components/workspace/cards/segment-card';
import { CampaignCard } from '@/components/workspace/cards/campaign-card';
import { CreativeAngleCard } from '@/components/workspace/cards/creative-angle-card';
import { IcpMetricsCard } from '@/components/workspace/cards/icp-metrics-card';
import { RiskCard } from '@/components/workspace/cards/risk-card';
import { TestingPlanCard } from '@/components/workspace/cards/testing-plan-card';
import { IndustryBenchmarksCard } from '@/components/workspace/cards/industry-benchmarks-card';
import { SalesProcessCard } from '@/components/workspace/cards/sales-process-card';
import { PhaseCard } from '@/components/workspace/cards/phase-card';
import {
  PlatformBudgetPieChart,
  FunnelSplitBarChart,
  PhaseBudgetChart,
} from '@/components/workspace/cards/media-plan-charts';
import {
  JourneyKeywordIntelDetail,
  getJourneyKeywordIntelDetailData,
} from '@/components/journey/journey-keyword-intel-detail';
import { OfferStatementList } from '@/components/workspace/cards/offer-statement-list';
import { IceTable } from '@/components/workspace/cards/ice-table';
import { OpportunityCard } from '@/components/workspace/cards/opportunity-card';
import { RefinementCard } from '@/components/workspace/cards/refinement-card';
import { PositioningMoveCard } from '@/components/workspace/cards/positioning-move-card';
import { KeywordGapCard } from '@/components/workspace/cards/keyword-gap-card';
import { ReadinessScorecard } from '@/components/workspace/cards/readiness-scorecard';
import { PriorityActions } from '@/components/workspace/cards/priority-actions';
import { ReviewCrossAnalysisCard } from '@/components/workspace/cards/review-cross-analysis-card';
import { cn } from '@/lib/utils';
import type { CardState } from '@/lib/workspace/types';

/** Card types that get "hero" visual treatment in document mode */
const HERO_CARD_TYPES = new Set(['stat-grid', 'strategy-card', 'competitor-card', 'pricing-card', 'readiness-scorecard']);

/**
 * Pure switch statement mapping card.cardType to component.
 * Consumes CardEditingContext for editable cards (stat-grid, bullet-list, check-list, prose-card).
 * Stateless -- all editing state comes from context.
 */
export function CardContentSwitch({ card }: { card: CardState }) {
  const { isEditing, draftContent, updateDraft } = useCardEditing();
  const content = isEditing ? { ...card.content, ...draftContent } : card.content;

  switch (card.cardType) {
    case 'stat-grid': {
      const stats = content.stats as { label: string; value: string; badge?: string; badgeColor?: string }[];
      if (
        card.sectionKey === 'offerAnalysis' &&
        card.label === 'Offer Score' &&
        !isEditing
      ) {
        const parsed = parseOfferScoreFromStats(stats);
        if (parsed) {
          return (
            <OfferScoreBarPanel
              overallScore={parsed.overall}
              dimensions={parsed.dimensions}
              showHeading={false}
            />
          );
        }
      }
      return (
        <StatGrid
          stats={stats}
          layout={(content.layout as 'grid' | 'definition' | undefined) ?? 'grid'}
          isEditing={isEditing}
          onStatsChange={(stats) => updateDraft({ stats })}
        />
      );
    }
    case 'icp-metrics':
      return (
        <IcpMetricsCard
          audienceSize={content.audienceSize as string | undefined}
          confidenceScore={content.confidenceScore as number | null | undefined}
        />
      );
    case 'bullet-list':
      return (
        <BulletList
          title={card.label}
          items={(content.items as string[]) ?? []}
          groups={content.groups as Array<{ group: string; items: string[] }> | undefined}
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
      return (
        <TrendCard
          trends={content.trends as Array<{ trend: string; direction: string; evidence: string }> | undefined}
          trend={content.trend as string | undefined}
          direction={content.direction as string | undefined}
          evidence={content.evidence as string | undefined}
        />
      );
    case 'competitor-card': {
      const c = card.content;
      return (
        <CompetitorCard
          name={c.name as string}
          website={c.website as string | undefined}
          positioning={c.positioning as string | undefined}
          price={c.price as string | undefined}
          pricingConfidence={c.pricingConfidence as string | undefined}
          pricingSourceUrl={c.pricingSourceUrl as string | undefined}
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
          gaps={
            content.gaps as
              | Array<{
                  gap: string;
                  type?: string;
                  evidence?: string;
                  exploitability?: number;
                  impact?: number;
                  recommendedAction?: string;
                }>
              | undefined
          }
          gap={content.gap as string | undefined}
          type={content.type as string | undefined}
          evidence={content.evidence as string | undefined}
          exploitability={content.exploitability as number | undefined}
          impact={content.impact as number | undefined}
          recommendedAction={content.recommendedAction as string | undefined}
        />
      );
    case 'review-card': {
      const rc = card.content;
      return (
        <ReviewCard
          competitorName={rc.competitorName as string}
          trustpilot={rc.trustpilot as { rating?: number | null; reviewCount?: number | null; themes?: string[]; url?: string | null } | null | undefined}
          g2={rc.g2 as { rating?: number | null; reviewCount?: number | null; themes?: string[]; url?: string | null } | null | undefined}
          capterra={rc.capterra as { rating?: number | null; reviewCount?: number | null; themes?: string[]; url?: string | null } | null | undefined}
          negativeReviews={rc.negativeReviews as Array<{ text: string; rating: number; date?: string; source: 'g2' | 'capterra' | 'trustpilot' }> | null | undefined}
          gapIntelligence={rc.gapIntelligence as { recurringComplaints: string[]; exploitAngles: Array<{ gap: string; whyItMatters: string; positioningAngle: string; adHook: string; confidence: 'high' | 'medium' | 'low'; evidenceQuotes: string[] }> } | null | undefined}
        />
      );
    }
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
    case 'pricing-intelligence':
      return (
        <PricingIntelligence
          elasticityAssessment={card.content.elasticityAssessment as PricingIntelligenceProps['elasticityAssessment']}
        />
      );
    case 'flag-card':
      return (
        <FlagCard
          flags={
            content.flags as
              | Array<{
                  issue: string;
                  severity?: string;
                  priority?: number;
                  evidence?: string;
                  recommendedAction?: string;
                }>
              | undefined
          }
          issue={content.issue as string | undefined}
          severity={content.severity as string | undefined}
          priority={content.priority as number | undefined}
          evidence={content.evidence as string | undefined}
          recommendedAction={content.recommendedAction as string | undefined}
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
          insights={
            content.insights as Array<{ insight: string; source?: string; implication?: string }> | undefined
          }
          insight={content.insight as string | undefined}
          source={content.source as string | undefined}
          implication={content.implication as string | undefined}
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
          angles={
            content.angles as Array<{ angle: string; exampleHook?: string; evidence?: string }> | undefined
          }
          angle={content.angle as string | undefined}
          exampleHook={content.exampleHook as string | undefined}
          evidence={content.evidence as string | undefined}
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
    // cac-funnel-chart and kpi-benchmark-chart removed 2026-04-19 per Mahdy
    // feedback — they visualized numeric forecast fields that no longer exist.
    case 'phase-budget-chart':
      return (
        <PhaseBudgetChart
          phases={card.content.phases as Array<{name: string; budgetAllocation: number}>}
        />
      );
    case 'keyword-grid': {
      const rawData = card.content.rawData as Record<string, unknown> | undefined;
      if (rawData) {
        const normalized = getJourneyKeywordIntelDetailData(rawData);
        if (normalized) return <JourneyKeywordIntelDetail data={normalized} />;
      }
      const keywords = card.content.keywords as
        | Array<{
            keyword: string;
            volume: number;
            difficulty: string;
            cpc: number;
            priority: number;
          }>
        | undefined;
      if (keywords && keywords.length > 0) {
        return (
          <div className="space-y-2">
            <div className="grid grid-cols-5 gap-2 text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-wider pb-1 border-b border-[var(--border-subtle)]">
              <span className="col-span-2">Keyword</span>
              <span>Volume</span>
              <span>Difficulty</span>
              <span>Priority</span>
            </div>
            {keywords.map((kw, i) => (
              <div
                key={i}
                className="grid grid-cols-5 gap-2 text-sm py-1.5 border-b border-[var(--border-subtle)] last:border-0"
              >
                <span className="col-span-2 text-[var(--text-primary)] font-medium truncate">{kw.keyword}</span>
                <span className="text-[var(--text-secondary)]">{kw.volume?.toLocaleString() ?? '—'}</span>
                <span className="text-[var(--text-secondary)]">{kw.difficulty ?? '—'}</span>
                <span className="text-[var(--text-secondary)] font-semibold">{kw.priority ?? '—'}</span>
              </div>
            ))}
          </div>
        );
      }
      return (
        <p className="text-sm text-[var(--text-secondary)]">Keyword intelligence could not be rendered.</p>
      );
    }
    case 'strategy-snapshot':
      return (
        <StrategySnapshotCard
          headline={card.content.headline as string | undefined}
          topPriorities={card.content.topPriorities as Array<{label?: string; description?: string}> | undefined}
          budgetOverview={card.content.budgetOverview as {total?: number; topPlatform?: string; timeToFirstResults?: string} | undefined}
          expectedSignals={card.content.expectedSignals as {timeToFirstResults?: string; qualitativeOutcomes?: string[]} | undefined}
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
          singleCampaignRationale={card.content.singleCampaignRationale as string | undefined}
        />
      );
    case 'creative-angle':
      return (
        <CreativeAngleCard
          hook={card.content.hook as string | undefined}
          messagingApproach={card.content.messagingApproach as string | undefined}
          targetSegment={card.content.targetSegment as string | undefined}
        />
      );
    case 'testing-plan':
      return (
        <TestingPlanCard
          firstTests={card.content.firstTests as string[] | undefined}
          methodology={card.content.methodology as string | undefined}
          minBudgetPerTest={card.content.minBudgetPerTest as number | undefined}
        />
      );
    case 'industry-benchmarks':
      return <IndustryBenchmarksCard benchmarks={card.content.benchmarks as Array<{metric?: string; range?: string; source?: string; interpretation?: string; leversToMoveIt?: string[]}>} />;
    case 'sales-process':
      return (
        <SalesProcessCard
          diagnosticNote={card.content.diagnosticNote as string | undefined}
          improvementLevers={card.content.improvementLevers as string[] | undefined}
          sopReference={card.content.sopReference as string | undefined}
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
          launchBlocker={card.content.launchBlocker as boolean | undefined}
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
          decisionGate={card.content.decisionGate as string | undefined}
        />
      );
    case 'offer-statement-list':
      return <OfferStatementList statements={(card.content as Record<string, unknown>).statements as Array<{ type: string; statement: string; rationale: string; targetEmotion: string }>} />;
    case 'ice-table':
      return <IceTable fixes={(card.content as Record<string, unknown>).fixes as Array<{ issue: string; fix: string; impact: number; confidence: number; ease: number; iceScore: number }>} />;
    case 'opportunity-card':
      return <OpportunityCard opportunities={card.content.opportunities as Array<{opportunity: string; size: string; timing: string; difficulty: string; evidence: string}>} />;
    case 'refinement-card':
      return <RefinementCard refinements={card.content.refinements as Array<{refinement: string; segment: string; expectedLift: string; testMethod: string; risk: string}>} />;
    case 'positioning-move-card':
      return <PositioningMoveCard moves={card.content.moves as Array<{move: string; targetCompetitor: string; risk: string; reward: string; playbook: string}>} />;
    case 'keyword-gap-card':
      return <KeywordGapCard gaps={card.content.gaps as Array<{gapCluster: string; estimatedVolume: number; competition: string; suggestedKeywords: string[]; priority: string}>} />;
    case 'readiness-scorecard':
      return <ReadinessScorecard overallScore={card.content.overallScore as number} verdict={card.content.verdict as string} verdictLabel={card.content.verdictLabel as string} dimensions={card.content.dimensions as Array<{name: string; score: number; summary: string}>} />;
    case 'priority-actions':
      return <PriorityActions actions={card.content.actions as Array<{action: string; source: string; priority: string}>} />;
    case 'review-cross-analysis-card':
      return (
        <ReviewCrossAnalysisCard
          commonWeaknesses={card.content.commonWeaknesses as Array<{ theme: string; affectedCompetitors: string[]; frequency: number; exampleQuote: string; leverageAngle: string }>}
        />
      );
    case 'category-ad-sweep-card': {
      const c = card.content as Record<string, unknown>;
      return (
        <CategoryAdSweepCard
          ads={(c.ads as Array<{ source: 'meta' | 'google'; keyword: string; advertiser: string; headline: string; body: string; landingPage?: string | null; imageUrl?: string | null; detailsUrl?: string | null }>) ?? []}
          keywordsProbed={(c.keywordsProbed as string[]) ?? []}
          sources={(c.sources as { meta: number; google: number }) ?? { meta: 0, google: 0 }}
        />
      );
    }
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
          ? 'border border-[var(--border-subtle)] border-l border-l-[var(--border-default)] p-6 print-card-hero'
          : 'border border-[var(--border-glass)] p-5',
      )}
    >
      <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <span className="w-1 h-1 rounded-full bg-[var(--text-tertiary)] shrink-0" />
        {card.label}
      </span>
      <CardEditingContext value={readOnlyContext}>
        <CardContentSwitch card={card} />
      </CardEditingContext>
    </motion.div>
  );
}
