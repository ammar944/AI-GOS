'use client';

interface InsightCardProps {
  insight: string;
  source?: string;
  implication?: string;
}

export function InsightCard({ insight, source, implication }: InsightCardProps) {
  return (
    <div className="border-l-2 border-l-[var(--accent-blue)] py-3 pl-4 pr-2">
      {source && (
        <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-[var(--text-quaternary)]">
          Key Insight &mdash; {source}
        </p>
      )}
      <p className="text-[14px] leading-[1.55] text-[var(--text-primary)]">{insight}</p>
      {implication && (
        <p className="mt-1.5 font-mono text-[11px] text-[var(--text-tertiary)]">{implication}</p>
      )}
    </div>
  );
}
