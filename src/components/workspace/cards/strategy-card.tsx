'use client';

interface StrategyCardProps {
  recommendedAngle?: string;
  leadRecommendation?: string;
  keyDifferentiator?: string;
}

export function StrategyCard({ recommendedAngle, leadRecommendation, keyDifferentiator }: StrategyCardProps) {
  if (!recommendedAngle && !leadRecommendation && !keyDifferentiator) return null;

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4 space-y-3">
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest">
        Positioning Strategy
      </h4>
      {recommendedAngle && (
        <p className="text-base font-semibold text-[var(--text-primary)]">{recommendedAngle}</p>
      )}
      {leadRecommendation && (
        <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{leadRecommendation}</p>
      )}
      {keyDifferentiator && (
        <div className="rounded-[var(--radius-md)] bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-secondary)]">
          <span className="font-medium text-[var(--text-primary)]">Differentiator:</span> {keyDifferentiator}
        </div>
      )}
    </div>
  );
}
