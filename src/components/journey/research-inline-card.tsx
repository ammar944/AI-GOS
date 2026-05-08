'use client';

import { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tool, ToolContent, ToolHeader } from '@/components/ai-elements/tool';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  collapseResearchJobUpdates,
  type ResearchJobActivity,
} from '@/lib/journey/research-job-activity';

export interface ResearchInlineCardProps {
  section: string;
  status: 'loading' | 'complete' | 'error';
  data?: Record<string, unknown>;
  activity?: ResearchJobActivity;
  error?: string;
  durationMs?: number;
  sourceCount?: number;
  onViewFull?: () => void;
  className?: string;
}

interface SectionMeta {
  label: string;
  moduleNumber: string;
}

const SECTION_META: Record<string, SectionMeta> = {
  industryMarket: { label: 'Market Overview', moduleNumber: '01' },
  competitors:    { label: 'Competitor Intel', moduleNumber: '02' },
  icpValidation:  { label: 'ICP Validation', moduleNumber: '03' },
  offerAnalysis:  { label: 'Offer Analysis', moduleNumber: '04' },
  crossAnalysis:  { label: 'Strategic Synthesis', moduleNumber: '05' },
  keywordIntel:   { label: 'Keywords', moduleNumber: '06' },
  mediaPlan:      { label: 'Media Plan', moduleNumber: '07' },
};
const DEFAULT_META: SectionMeta = { label: 'Research', moduleNumber: '00' };

function extractTopMetrics(section: string, data?: Record<string, unknown>): { key: string; value: string }[] {
  if (!data) return [];
  try {
    if (section === 'industryMarket') {
      const snap = data.categorySnapshot as Record<string, unknown> | undefined;
      return [
        snap?.marketSize ? { key: 'Market Size', value: String(snap.marketSize) } : null,
        snap?.marketMaturity ? { key: 'Maturity', value: String(snap.marketMaturity) } : null,
        snap?.category ? { key: 'Category', value: String(snap.category) } : null,
      ].filter(Boolean) as { key: string; value: string }[];
    }
    if (section === 'competitors') {
      const comps = Array.isArray(data.competitors) ? data.competitors : [];
      return [
        { key: 'Competitors', value: `${comps.length} identified` },
      ];
    }
    if (section === 'icpValidation') {
      const verdict = data.finalVerdict as Record<string, unknown> | undefined;
      return verdict?.status ? [{ key: 'Verdict', value: String(verdict.status) }] : [];
    }
    if (section === 'offerAnalysis') {
      const score = (data.offerStrength as Record<string, unknown>)?.overallScore ?? data.overallScore;
      return score !== undefined ? [{ key: 'Score', value: String(score) }] : [];
    }
    if (section === 'crossAnalysis') {
      const platforms = Array.isArray(data.platformRecommendations) ? data.platformRecommendations : [];
      const insights = Array.isArray(data.keyInsights) ? data.keyInsights : [];
      return [
        insights.length > 0 ? { key: 'Insights', value: `${insights.length}` } : null,
        platforms.length > 0 ? { key: 'Platforms', value: `${platforms.length}` } : null,
      ].filter(Boolean) as { key: string; value: string }[];
    }
    if (section === 'keywordIntel') {
      const total = typeof data.totalKeywordsFound === 'number' ? data.totalKeywordsFound : null;
      const gaps = typeof data.competitorGapCount === 'number' ? data.competitorGapCount : null;
      return [
        total !== null ? { key: 'Keywords', value: `${total}` } : null,
        gaps !== null ? { key: 'Gaps', value: `${gaps}` } : null,
      ].filter(Boolean) as { key: string; value: string }[];
    }
    if (section === 'mediaPlan') {
      const channels = Array.isArray(data.channelPlan) ? data.channelPlan : [];
      const budgetSummary = data.budgetSummary as Record<string, unknown> | undefined;
      return [
        channels.length > 0 ? { key: 'Channels', value: `${channels.length}` } : null,
        budgetSummary?.totalMonthly !== undefined
          ? { key: 'Budget', value: String(budgetSummary.totalMonthly) }
          : null,
      ].filter(Boolean) as { key: string; value: string }[];
    }
  } catch { /* data shapes vary */ }
  return [];
}

function extractDescription(section: string, data?: Record<string, unknown>): string | null {
  if (!data) return null;
  try {
    if (section === 'industryMarket') {
      const snap = data.categorySnapshot as Record<string, unknown> | undefined;
      if (snap?.category) {
        const size = snap.marketSize ? ` (${snap.marketSize})` : '';
        return `Market overview complete for the ${snap.category} vertical${size}.`;
      }
    }
    if (section === 'competitors') {
      const comps = Array.isArray(data.competitors) ? data.competitors : [];
      return comps.length > 0
        ? `${comps.length} competitor${comps.length !== 1 ? 's' : ''} analyzed across ad creatives, pricing, and positioning.`
        : null;
    }
    if (section === 'crossAnalysis') {
      if (typeof data.strategicNarrative === 'string' && data.strategicNarrative.trim().length > 0) {
        return data.strategicNarrative.trim();
      }
      const positioningStrategy = data.positioningStrategy as Record<string, unknown> | undefined;
      const angle = typeof positioningStrategy?.recommendedAngle === 'string'
        ? positioningStrategy.recommendedAngle
        : null;
      return angle ? `Strategic synthesis complete. Recommended angle: ${angle}.` : null;
    }
    if (section === 'keywordIntel') {
      const total = typeof data.totalKeywordsFound === 'number' ? data.totalKeywordsFound : null;
      return total !== null
        ? `${total} keyword opportunities analyzed for paid-search and competitor-gap coverage.`
        : null;
    }
    if (section === 'mediaPlan') {
      const budgetSummary = data.budgetSummary as Record<string, unknown> | undefined;
      const channels = Array.isArray(data.channelPlan) ? data.channelPlan : [];
      if (budgetSummary?.totalMonthly !== undefined) {
        return `Execution-ready media plan built across ${channels.length} channel${channels.length === 1 ? '' : 's'} with ${budgetSummary.totalMonthly} monthly budget.`;
      }
      return channels.length > 0
        ? `Execution-ready media plan built across ${channels.length} channel${channels.length === 1 ? '' : 's'}.`
        : null;
    }
  } catch { /* safe */ }
  return null;
}

function toolState(status: 'loading' | 'complete' | 'error'): "input-available" | "output-available" | "output-error" {
  if (status === 'loading') return 'input-available';
  if (status === 'error') return 'output-error';
  return 'output-available';
}

// --- Loading content (active research in progress) ---

function LoadingContent({
  activity,
  section,
}: {
  activity?: ResearchJobActivity;
  section: string;
}) {
  const updates = activity?.updates ? collapseResearchJobUpdates(activity.updates) : [];
  const latestUpdate = updates.at(-1);
  const statusLabel = activity?.startedAt ? 'Research running' : 'Queued';

  return (
    <div className="space-y-2 text-xs text-muted-foreground">
      <p>{statusLabel}</p>
      {latestUpdate ? (
        <p className="text-foreground/70">
          [{latestUpdate.phase.toUpperCase()}] {latestUpdate.message}
          {latestUpdate.count > 1 ? ` x${latestUpdate.count}` : ''}
        </p>
      ) : (
        <p>Waiting for research updates for {section}.</p>
      )}
    </div>
  );
}

// --- Complete content (research done with metrics) ---

function CompleteContent({
  data,
  section,
  onViewFull,
}: {
  data?: Record<string, unknown>;
  section: string;
  onViewFull?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const metrics = extractTopMetrics(section, data);
  const description = extractDescription(section, data);

  return (
    <div className="space-y-2">
      {description ? (
        <p className="text-xs text-muted-foreground leading-5">{description}</p>
      ) : null}
      {metrics.length > 0 ? (
        <div className="space-y-1 text-[11px] font-mono text-muted-foreground">
          {metrics.map((m) => (
            <div key={m.key} className="flex justify-between">
              <span>{m.key}:</span>
              <span>{m.value}</span>
            </div>
          ))}
        </div>
      ) : null}
      {onViewFull ? (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger
            className="mt-1 flex cursor-pointer items-center gap-1 text-[11px] text-muted-foreground transition-colors duration-150 hover:text-foreground"
          >
            {expanded ? 'Hide details' : 'View full analysis'}
            <ChevronDown className={cn('h-3 w-3 transition-transform duration-150', expanded && 'rotate-180')} />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 pt-2 border-t">
              <button
                type="button"
                onClick={onViewFull}
                className="w-full cursor-pointer rounded-md border py-2 text-[11px] text-muted-foreground transition-colors duration-150 hover:bg-muted/50 hover:text-foreground"
              >
                Open full analysis
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}
    </div>
  );
}

// --- Error content ---

function ErrorContent({ error }: { error?: string }) {
  return (
    <div className="text-xs">
      {error ? (
        <p className="text-destructive">{error}</p>
      ) : (
        <p className="text-destructive">This section failed to generate.</p>
      )}
    </div>
  );
}

// --- Main Export ---

export function ResearchInlineCard({
  activity,
  section,
  status,
  data,
  error,
  durationMs: _durationMs,
  sourceCount: _sourceCount,
  onViewFull,
  className,
}: ResearchInlineCardProps) {
  const meta = SECTION_META[section] ?? DEFAULT_META;

  return (
    <div className={cn('w-full', className)}>
      <Tool defaultOpen={status === 'loading'}>
        <ToolHeader
          type="dynamic-tool"
          toolName={`research-${section}`}
          title={meta.label}
          state={toolState(status)}
        />
        <ToolContent className="py-2 px-3">
          {status === 'loading'  && <LoadingContent activity={activity} section={section} />}
          {status === 'complete' && <CompleteContent data={data} section={section} onViewFull={onViewFull} />}
          {status === 'error'    && <ErrorContent error={error} />}
        </ToolContent>
      </Tool>
    </div>
  );
}
