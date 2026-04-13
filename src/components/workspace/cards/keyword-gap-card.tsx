'use client';

import { cn } from '@/lib/utils';

interface KeywordGap {
  gapCluster: string;
  estimatedVolume: number;
  competition: string;
  suggestedKeywords: string[];
  priority: string;
}

interface KeywordGapCardProps {
  gaps: KeywordGap[];
}

function PriorityBadge({ value }: { value: string }) {
  const normalized = value?.toLowerCase() ?? '';
  const tone =
    normalized === 'high'
      ? 'bg-[rgba(239,68,68,0.10)] text-[var(--accent-red)]'
      : normalized === 'medium'
        ? 'bg-[rgba(245,158,11,0.10)] text-[var(--accent-amber)]'
        : normalized === 'low'
          ? 'bg-[rgba(34,197,94,0.10)] text-[var(--accent-green)]'
          : 'bg-[var(--bg-hover)] text-[var(--text-secondary)]';

  return (
    <span
      className={cn(
        'inline-flex text-[10px] font-mono font-medium rounded-full px-2 py-0.5',
        tone,
      )}
    >
      {value}
    </span>
  );
}

export function KeywordGapCard({ gaps }: KeywordGapCardProps) {
  if (!gaps.length) return null;

  return (
    <div className="space-y-3">
      {gaps.map((g, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-lg)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="text-sm font-medium text-[var(--text-primary)]">
              {g.gapCluster}
            </div>
            <div className="flex items-center gap-1.5">
              <PriorityBadge value={g.priority} />
              <PriorityBadge value={g.competition} />
            </div>
          </div>
          {g.estimatedVolume > 0 && (
            <div className="mt-1 text-[11px] font-mono tabular-nums text-[var(--text-tertiary)] tracking-[0.06em]">
              ~{g.estimatedVolume.toLocaleString()} monthly volume
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {g.suggestedKeywords.map((kw, j) => (
              <span
                key={j}
                className="text-[10px] font-mono font-medium rounded-full px-2 py-0.5 bg-[var(--bg-hover)] text-[var(--text-secondary)]"
              >
                {kw}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
