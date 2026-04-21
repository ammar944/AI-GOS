'use client';

interface Benchmark {
  metric?: string;
  range?: string;
  source?: string;
  interpretation?: string;
  leversToMoveIt?: string[];
}

interface IndustryBenchmarksCardProps {
  benchmarks: Benchmark[];
}

export function IndustryBenchmarksCard({ benchmarks }: IndustryBenchmarksCardProps) {
  const filtered = benchmarks.filter((b) => b.metric && b.range);
  if (filtered.length === 0) return null;
  return (
    <div className="space-y-3">
      <p className="text-xs italic text-[var(--text-tertiary)]">
        Industry benchmark ranges — not client targets. Use as directional context.
      </p>
      <div className="space-y-2">
        {filtered.map((b, i) => (
          <div
            key={i}
            className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-semibold text-[var(--text-primary)]">{b.metric}</span>
              <span className="font-mono text-sm text-[var(--text-primary)]">{b.range}</span>
            </div>
            {b.source && (
              <p className="font-mono text-[11px] text-[var(--text-tertiary)]">Source: {b.source}</p>
            )}
            {b.interpretation && (
              <p className="text-xs leading-relaxed text-[var(--text-secondary)]">
                {b.interpretation}
              </p>
            )}
            {b.leversToMoveIt && b.leversToMoveIt.length > 0 && (
              <div className="space-y-1 pt-1">
                <span className="block text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
                  Levers to move it
                </span>
                <ul className="space-y-1">
                  {b.leversToMoveIt.map((lever, idx) => (
                    <li
                      key={idx}
                      className="relative pl-3 text-xs leading-relaxed text-[var(--text-secondary)] before:absolute before:left-0 before:top-[0.4em] before:h-1 before:w-1 before:rounded-full before:bg-[var(--text-tertiary)]"
                    >
                      {lever}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
