'use client';

interface PricingCardProps {
  currentPricing?: string;
  pricingSource?: string | null;
  marketBenchmark?: string;
  pricingPosition?: string;
  coldTrafficViability?: string;
}

function positionColor(pos: string): string {
  const lower = pos.toLowerCase();
  if (lower.includes('premium') || lower.includes('high')) return 'var(--accent-amber)';
  if (lower.includes('budget') || lower.includes('low')) return 'var(--accent-green)';
  return 'var(--text-secondary)';
}

export function PricingCard({ pricingSource, pricingPosition, coldTrafficViability }: PricingCardProps) {
  if (!coldTrafficViability && !pricingPosition) return null;

  const paragraphs = coldTrafficViability
    ? coldTrafficViability.split(/\n\n+/).map((p) => p.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-3">
      {/* Position badge */}
      {pricingPosition?.trim() && (
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
            Position
          </span>
          <span
            className="text-[10px] font-mono font-medium uppercase tracking-[0.06em] rounded-full px-2 py-0.5"
            style={{
              color: positionColor(pricingPosition),
              background: `color-mix(in srgb, ${positionColor(pricingPosition)} 10%, transparent)`,
            }}
          >
            {pricingPosition.trim()}
          </span>
        </div>
      )}

      {/* Analysis prose */}
      {paragraphs.length > 0 && (
        <div className="space-y-2.5">
          {paragraphs.map((p, i) => (
            <p
              key={i}
              className={
                i === 0
                  ? 'text-sm leading-relaxed text-[var(--text-primary)]'
                  : 'text-sm leading-relaxed text-[var(--text-secondary)]'
              }
            >
              {p}
            </p>
          ))}
        </div>
      )}

      {/* Source link */}
      {pricingSource && (
        <p className="text-[11px] font-mono text-[var(--text-tertiary)]">
          Source:{' '}
          <a href={pricingSource} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--text-secondary)] transition-colors duration-150">
            {pricingSource}
          </a>
        </p>
      )}
    </div>
  );
}
