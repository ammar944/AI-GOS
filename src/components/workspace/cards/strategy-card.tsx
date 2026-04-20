'use client';

interface StrategyCardProps {
  recommendedAngle?: string;
  leadRecommendation?: string;
  keyDifferentiator?: string;
}

export function StrategyCard({ recommendedAngle, leadRecommendation, keyDifferentiator }: StrategyCardProps) {
  if (!recommendedAngle && !leadRecommendation && !keyDifferentiator) return null;

  return (
    <div className="border-l border-l-[var(--border-default)] py-3 pl-4 pr-2 space-y-2">
      <p className="font-mono text-[10px] font-medium uppercase tracking-wider text-[var(--text-quaternary)]">
        Positioning Strategy
      </p>
      {recommendedAngle && (
        <p className="text-sm font-medium text-[var(--text-primary)]">{recommendedAngle}</p>
      )}
      {leadRecommendation && (
        <p className="text-[13px] leading-relaxed text-[var(--text-secondary)]">{leadRecommendation}</p>
      )}
      {keyDifferentiator && (
        <p className="text-[13px] text-[var(--text-secondary)]">
          <span
            className="mr-1.5 rounded-[3px] px-1.5 py-px font-mono text-[10px] font-medium"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-hover)', border: '1px solid var(--border-subtle)' }}
          >
            Differentiator
          </span>
          {keyDifferentiator}
        </p>
      )}
    </div>
  );
}
