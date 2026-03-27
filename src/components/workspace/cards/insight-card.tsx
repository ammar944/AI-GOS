'use client';

interface InsightCardProps {
  insight: string;
  source?: string;
  implication?: string;
}

export function InsightCard({ insight, source, implication }: InsightCardProps) {
  return (
    <div className="border-l-2 border-l-[var(--accent-blue)] py-2.5 pl-4 pr-2">
      {source && (
        <p className="mb-1 font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
          Key Insight — {source}
        </p>
      )}
      <p className="text-sm leading-relaxed text-[var(--text-primary)]">{insight}</p>
      {implication && (
        <p className="mt-1.5 text-[13px] leading-relaxed text-[var(--text-secondary)]">{implication}</p>
      )}
    </div>
  );
}
