'use client';

import { StatGrid } from './stat-grid';

interface PricingCardProps {
  currentPricing?: string;
  marketBenchmark?: string;
  pricingPosition?: string;
  coldTrafficViability?: string;
}

export function PricingCard({ currentPricing, marketBenchmark, pricingPosition, coldTrafficViability }: PricingCardProps) {
  const stats = [
    ...(currentPricing ? [{ label: 'Current Pricing', value: currentPricing }] : []),
    ...(marketBenchmark ? [{ label: 'Benchmark', value: marketBenchmark }] : []),
    ...(pricingPosition ? [{ label: 'Position', value: pricingPosition }] : []),
  ];

  if (stats.length === 0 && !coldTrafficViability) return null;

  return (
    <div className="py-1 space-y-2">
      <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em]">
        Pricing Analysis
      </h4>
      {stats.length > 0 && <StatGrid stats={stats} columns={3} />}
      {coldTrafficViability && (
        <p className="text-[13px] leading-snug text-[var(--text-secondary)]">{coldTrafficViability}</p>
      )}
    </div>
  );
}
