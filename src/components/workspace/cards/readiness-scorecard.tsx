'use client';

interface Dimension {
  name: string;
  score: number;
  summary: string;
}

interface ReadinessScorecardProps {
  overallScore: number;
  verdict: string;
  verdictLabel: string;
  dimensions: Dimension[];
}

function scoreColor(score: number): string {
  if (score >= 8) return 'var(--accent-green, #22c55e)';
  if (score >= 5) return 'var(--accent-blue, #3b82f6)';
  return 'var(--accent-red, #ef4444)';
}

export function ReadinessScorecard({ overallScore, verdictLabel, dimensions }: ReadinessScorecardProps) {
  const color = scoreColor(overallScore);

  return (
    <div>
      {/* Hero score */}
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-mono font-bold tabular-nums" style={{ color }}>
          {overallScore.toFixed(1)}
        </span>
        <span className="text-[13px] font-medium" style={{ color: 'var(--text-secondary)' }}>
          / 10 — {verdictLabel}
        </span>
      </div>

      {/* Dimension bars */}
      <div className="space-y-2.5">
        {dimensions.map((dim) => {
          const barColor = scoreColor(dim.score);
          const pct = Math.max(0, Math.min(100, (dim.score / 10) * 100));
          return (
            <div key={dim.name}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[12px] font-medium" style={{ color: 'var(--text-secondary)' }}>{dim.name}</span>
                <span className="text-[12px] font-mono tabular-nums" style={{ color: barColor }}>{dim.score}/10</span>
              </div>
              <div className="h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, background: barColor }} />
              </div>
              <div className="mt-0.5 text-[11px]" style={{ color: 'var(--text-tertiary)' }}>{dim.summary}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
