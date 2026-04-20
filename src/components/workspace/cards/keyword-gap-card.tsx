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
  const color =
    normalized === 'high'
      ? 'var(--accent-red)'
      : normalized === 'medium'
        ? 'var(--accent-amber)'
        : normalized === 'low'
          ? 'var(--accent-green)'
          : 'var(--text-secondary)';

  return (
    <span
      className={cn(
        'inline-flex text-[10px] font-mono font-medium uppercase tracking-[0.12em]',
        'rounded-[3px] px-1.5 py-0.5',
      )}
      style={{
        color,
        background: 'var(--bg-hover)',
        border: '1px solid var(--border-subtle)',
      }}
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
          className="rounded-[6px] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-4"
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
            <div className="mt-1 text-[10px] font-mono tabular-nums text-[var(--text-tertiary)] uppercase tracking-[0.12em]">
              ~{g.estimatedVolume.toLocaleString()} monthly volume
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {g.suggestedKeywords.map((kw, j) => (
              <span
                key={j}
                className="text-[11px] font-mono rounded-[3px] px-1.5 py-0.5 bg-[var(--bg-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)]"
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
