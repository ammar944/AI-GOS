'use client';

interface InsightCardProps {
  insight: string;
  source?: string;
  implication?: string;
}

export function InsightCard({ insight, source, implication }: InsightCardProps) {
  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-3 space-y-1">
      <div className="flex items-center gap-2">
        {source && (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {source}
          </span>
        )}
        <p className="text-sm font-medium text-[var(--text-primary)]">{insight}</p>
      </div>
      {implication && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{implication}</p>
      )}
    </div>
  );
}
