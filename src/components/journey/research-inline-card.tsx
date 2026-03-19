'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
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

function useTicker(enabled: boolean) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!enabled) return;

    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [enabled]);

  return now;
}

function formatElapsed(iso: string | undefined, now: number): string | null {
  if (!iso) return null;

  const deltaSeconds = Math.max(0, Math.floor((now - Date.parse(iso)) / 1000));
  if (deltaSeconds < 60) return `${deltaSeconds}s`;

  const deltaMinutes = Math.floor(deltaSeconds / 60);
  if (deltaMinutes < 60) return `${deltaMinutes}m`;

  const deltaHours = Math.floor(deltaMinutes / 60);
  return `${deltaHours}h`;
}

function getLoadingExpectation(section: string): string {
  if (section === 'competitors' || section === 'icpValidation') {
    return '[NOTE] Usually 2-3 minutes end-to-end. The card is showing live worker activity while the final artifact is still being assembled.';
  }

  if (section === 'offerAnalysis') {
    return '[NOTE] Usually 1-2 minutes end-to-end. Final analysis appears after the worker finishes its write.';
  }

  return '[NOTE] Live worker activity is streaming. Final analysis appears when the completed result is written.';
}

// ─── Loading Card (Active research in progress) ─────────────────────────────

function LoadingCard({
  activity,
  meta,
  section,
}: {
  activity?: ResearchJobActivity;
  meta: SectionMeta;
  section: string;
}) {
  const now = useTicker(Boolean(activity?.startedAt || activity?.lastHeartbeat));
  const startedAgo = formatElapsed(activity?.startedAt, now);
  const heartbeatAgo = formatElapsed(activity?.lastHeartbeat, now);
  const statusLabel = activity?.startedAt ? 'Worker Running' : 'Queued';
  const latestUpdate = collapseResearchJobUpdates(activity?.updates).at(-1);
  const latestUpdateAge = formatElapsed(latestUpdate?.at, now);

  return (
    <div className="glass-surface p-6 rounded-[24px] border-brand-accent/30 bg-brand-accent/[0.01]">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-brand-accent uppercase tracking-tighter">
          Module {meta.moduleNumber}
        </span>
        {/* Animated dots */}
        <div className="flex gap-1">
          <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" />
          <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" style={{ animationDelay: '75ms' }} />
          <div className="w-1 h-1 rounded-full bg-brand-accent animate-subtle-pulse" style={{ animationDelay: '150ms' }} />
        </div>
      </div>
      <h3 className="text-lg font-medium mb-2 text-brand-accent">{meta.label}</h3>
      <div className="space-y-2 text-xs font-mono text-[var(--text-secondary)] leading-relaxed">
        <p>[LIVE] Research dispatched from Journey.</p>
        <p>{activity?.startedAt ? `[RUN] Started ${startedAgo ?? 'just now'} ago.` : '[WAIT] Waiting for worker pickup.'}</p>
        {latestUpdate && (
          <p>[{latestUpdate.phase.toUpperCase()}] {latestUpdate.message}{latestUpdate.count > 1 ? ` x${latestUpdate.count}` : ''}{latestUpdateAge ? ` · ${latestUpdateAge} ago` : ''}</p>
        )}
        {heartbeatAgo && <p>[PING] Last heartbeat {heartbeatAgo} ago.</p>}
        <p>{getLoadingExpectation(section)}</p>
      </div>
      <div className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-brand-accent/10 px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-brand-accent">
        <span className="h-1.5 w-1.5 rounded-full bg-brand-accent" />
        {statusLabel}
      </div>
    </div>
  );
}

// ─── Complete Card (Research done with metrics) ─────────────────────────────

function CompleteCard({
  meta,
  data,
  section,
  onViewFull,
}: {
  meta: SectionMeta;
  data?: Record<string, unknown>;
  section: string;
  onViewFull?: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const metrics = extractTopMetrics(section, data);
  const description = extractDescription(section, data);

  return (
    <div className="glass-surface p-6 rounded-[24px] relative overflow-hidden">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-tighter">
          Module {meta.moduleNumber}
        </span>
        {/* Green completed dot */}
        <div className="w-2 h-2 rounded-full bg-brand-success shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
      </div>
      <h3 className="text-lg font-medium mb-2">{meta.label}</h3>
      {description && (
        <p className="text-sm text-[var(--text-secondary)] leading-relaxed mb-4">{description}</p>
      )}
      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="space-y-1 text-[11px] font-mono text-[var(--text-quaternary)]">
          {metrics.map((m) => (
            <div key={m.key} className="flex justify-between">
              <span>{m.key}:</span>
              <span>{m.value}</span>
            </div>
          ))}
        </div>
      )}

      {/* Expandable full data */}
      {onViewFull && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="mt-3 text-[11px] text-brand-accent/70 hover:text-brand-accent transition-colors flex items-center gap-1"
        >
          {expanded ? 'Hide details' : 'View full analysis'}
          <ChevronDown className={cn('w-3 h-3 transition-transform', expanded && 'rotate-180')} />
        </button>
      )}

      <AnimatePresence>
        {expanded && onViewFull && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-3 pt-3 border-t border-[var(--border-glass)]">
              <button
                onClick={onViewFull}
                className="w-full py-2 text-[11px] text-brand-accent border border-brand-accent/20 rounded-lg hover:bg-brand-accent/5 transition-colors"
              >
                Open full analysis →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Error Card ─────────────────────────────────────────────────────────────

function ErrorCard({ meta, error }: { meta: SectionMeta; error?: string }) {
  return (
    <div className="glass-surface p-6 rounded-[24px] border-red-500/20">
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-red-400/60 uppercase tracking-tighter">
          Module {meta.moduleNumber}
        </span>
        <div className="w-2 h-2 rounded-full bg-red-500" />
      </div>
      <h3 className="text-lg font-medium mb-2 text-red-400">{meta.label} — Failed</h3>
      {error && (
        <p className="text-sm text-[var(--text-tertiary)] leading-relaxed">{error}</p>
      )}
    </div>
  );
}

// ─── Main Export ─────────────────────────────────────────────────────────────

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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -5 }}
      transition={{ duration: 0.25 }}
      className={cn('w-full', className)}
    >
      {status === 'loading'  && <LoadingCard activity={activity} meta={meta} section={section} />}
      {status === 'complete' && <CompleteCard meta={meta} data={data} section={section} onViewFull={onViewFull} />}
      {status === 'error'    && <ErrorCard meta={meta} error={error} />}
    </motion.div>
  );
}
