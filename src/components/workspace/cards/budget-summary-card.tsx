'use client';

import { StatGrid } from './stat-grid';

interface BudgetSummaryCardProps {
  totalMonthly?: number;
  funnelSplit?: {
    awareness?: number;
    consideration?: number;
    conversion?: number;
  };
  rampUpWeeks?: number;
}

export function BudgetSummaryCard({ totalMonthly, funnelSplit, rampUpWeeks }: BudgetSummaryCardProps) {
  const topStats = [
    ...(totalMonthly !== undefined
      ? [{ label: 'Monthly Total', value: `$${totalMonthly.toLocaleString()}` }]
      : []),
    ...(rampUpWeeks !== undefined
      ? [{ label: 'Ramp-Up', value: `${rampUpWeeks} wks` }]
      : []),
  ];

  const hasFunnelSplit =
    funnelSplit &&
    (funnelSplit.awareness !== undefined ||
      funnelSplit.consideration !== undefined ||
      funnelSplit.conversion !== undefined);

  return (
    <div className="space-y-3">
      {topStats.length > 0 && <StatGrid stats={topStats} columns={2} />}
      {hasFunnelSplit && (
        <div>
          <h4 className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] mb-1.5">
            Funnel Split
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {funnelSplit?.awareness !== undefined && (
              <div className="py-1 text-center">
                <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] block mb-1">
                  Awareness
                </span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {funnelSplit.awareness}%
                </span>
              </div>
            )}
            {funnelSplit?.consideration !== undefined && (
              <div className="py-1 text-center">
                <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] block mb-1">
                  Consider.
                </span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {funnelSplit.consideration}%
                </span>
              </div>
            )}
            {funnelSplit?.conversion !== undefined && (
              <div className="py-1 text-center">
                <span className="text-[10px] font-mono text-[var(--text-quaternary)] uppercase tracking-[0.06em] block mb-1">
                  Conversion
                </span>
                <span className="font-mono tabular-nums text-[var(--text-primary)]">
                  {funnelSplit.conversion}%
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
