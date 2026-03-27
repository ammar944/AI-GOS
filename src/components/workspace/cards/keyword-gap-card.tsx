'use client';

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
  const color = value === 'high' ? 'var(--accent-red, #ef4444)' : value === 'medium' ? 'var(--accent-blue, #3b82f6)' : 'var(--text-quaternary)';
  return (
    <span className="inline-block rounded px-1.5 py-0.5 text-[10px] font-mono font-medium uppercase tracking-wider"
      style={{ color, background: 'rgba(255,255,255,0.04)' }}
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
        <div key={i} className="rounded-[var(--radius-md)] border border-[var(--border-glass)] p-3">
          <div className="flex items-start justify-between gap-2">
            <div className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>{g.gapCluster}</div>
            <div className="flex items-center gap-1.5">
              <PriorityBadge value={g.priority} />
              <PriorityBadge value={g.competition} />
            </div>
          </div>
          {g.estimatedVolume > 0 && (
            <div className="mt-1 text-[11px] font-mono" style={{ color: 'var(--text-tertiary)' }}>
              ~{g.estimatedVolume.toLocaleString()} monthly volume
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-1">
            {g.suggestedKeywords.map((kw, j) => (
              <span key={j} className="rounded px-1.5 py-0.5 text-[11px]"
                style={{ background: 'rgba(255,255,255,0.04)', color: 'var(--text-secondary)' }}
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
