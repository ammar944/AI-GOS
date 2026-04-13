'use client';

interface CommonWeakness {
  theme: string;
  affectedCompetitors: string[];
  frequency: number;
  exampleQuote: string;
  leverageAngle: string;
}

interface ReviewCrossAnalysisCardProps {
  commonWeaknesses: CommonWeakness[];
}

export function ReviewCrossAnalysisCard({ commonWeaknesses }: ReviewCrossAnalysisCardProps) {
  if (!commonWeaknesses || commonWeaknesses.length === 0) return null;

  return (
    <div className="space-y-4">
      {commonWeaknesses.map((weakness, i) => (
        <div
          key={i}
          className="rounded-[var(--radius-md)] p-4 space-y-3"
          style={{ background: 'var(--bg-secondary, rgba(255,255,255,0.03))', border: '1px solid var(--border-subtle)' }}
        >
          {/* Theme + affected count */}
          <div className="flex items-start justify-between gap-3">
            <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {weakness.theme}
            </h4>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-mono font-medium"
              style={{ background: 'var(--accent-red, #e53e3e)20', color: 'var(--accent-red, #e53e3e)' }}
            >
              {weakness.frequency} competitors
            </span>
          </div>

          {/* Affected competitors */}
          <div className="flex flex-wrap gap-1.5">
            {weakness.affectedCompetitors.map((name) => (
              <span
                key={name}
                className="rounded-[3px] px-2 py-0.5 text-[11px] font-mono"
                style={{ background: 'var(--bg-surface, rgba(255,255,255,0.05))', color: 'var(--text-tertiary)' }}
              >
                {name}
              </span>
            ))}
          </div>

          {/* Example quote */}
          {weakness.exampleQuote && (
            <blockquote
              className="border-l-2 pl-3 text-xs leading-relaxed italic"
              style={{ borderColor: 'var(--accent-red, #e53e3e)40', color: 'var(--text-secondary)' }}
            >
              &ldquo;{weakness.exampleQuote}&rdquo;
            </blockquote>
          )}

          {/* Leverage angle */}
          {weakness.leverageAngle && (
            <div className="space-y-1">
              <span className="text-[11px] font-mono uppercase tracking-[0.06em]" style={{ color: 'var(--text-tertiary)' }}>
                Your Leverage
              </span>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--accent-green, #48bb78)' }}>
                {weakness.leverageAngle}
              </p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
