'use client';

interface Benchmark {
  metric?: string;
  range?: string;
  source?: string;
  note?: string;
}

interface IndustryBenchmarksCardProps {
  benchmarks: Benchmark[];
}

export function IndustryBenchmarksCard({ benchmarks }: IndustryBenchmarksCardProps) {
  const filtered = benchmarks.filter(b => b.metric && b.range);
  if (filtered.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--text-tertiary)] italic">
        Industry benchmark ranges — not client targets. Use as directional context.
      </p>
      <div className="space-y-2">
        {filtered.map((b, i) => (
          <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3 space-y-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{b.metric}</span>
              <span className="text-sm font-mono text-[var(--accent-blue)]">{b.range}</span>
            </div>
            {b.source && (
              <p className="text-[11px] font-mono text-[var(--text-tertiary)]">Source: {b.source}</p>
            )}
            {b.note && (
              <p className="text-xs text-[var(--text-secondary)]">{b.note}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
