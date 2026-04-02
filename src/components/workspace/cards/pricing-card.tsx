'use client';

import { StatGrid } from './stat-grid';

interface PricingCardProps {
  currentPricing?: string;
  pricingSource?: string | null;
  marketBenchmark?: string;
  pricingPosition?: string;
  coldTrafficViability?: string;
}

export function PricingCard({ currentPricing, pricingSource, marketBenchmark, pricingPosition, coldTrafficViability }: PricingCardProps) {
  const stats = [
    ...(currentPricing ? [{ label: 'Current Pricing', value: currentPricing }] : []),
    ...(marketBenchmark ? [{ label: 'Benchmark', value: marketBenchmark }] : []),
    ...(pricingPosition ? [{ label: 'Position', value: pricingPosition }] : []),
  ];

  if (stats.length === 0 && !coldTrafficViability) return null;

  return (
    <div className="glass-surface rounded-[var(--radius-md)] p-4 space-y-3">
      <h4 className="text-xs font-mono text-[var(--text-tertiary)] uppercase tracking-widest">
        Pricing Analysis
      </h4>
      {stats.length > 0 && <StatGrid stats={stats} columns={3} />}
      {pricingSource && (
        <p className="text-xs text-[var(--text-tertiary)]">
          Source:{' '}
          <a href={pricingSource} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--text-secondary)]">
            {pricingSource}
          </a>
        </p>
      )}
      {coldTrafficViability && (
        <p className="text-sm text-[var(--text-secondary)]">{coldTrafficViability}</p>
      )}
    </div>
  );
}
