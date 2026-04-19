'use client';

import { StatGrid } from './stat-grid';
import { BulletList } from './bullet-list';

interface StrategySnapshotCardProps {
  headline?: string;
  topPriorities?: Array<{ label?: string; description?: string }>;
  budgetOverview?: {
    total?: number;
    topPlatform?: string;
    timeToFirstResults?: string;
  };
  /**
   * Replaces the old numeric `expectedOutcomes` (leadsPerMonth / estimatedCAC /
   * expectedROAS) — those were removed 2026-04-19 per Mahdy feedback. We now
   * render qualitative signals describing what the client will SEE, not
   * numbers paid media cannot guarantee.
   */
  expectedSignals?: {
    timeToFirstResults?: string;
    qualitativeOutcomes?: string[];
  };
}

export function StrategySnapshotCard({
  headline,
  topPriorities,
  budgetOverview,
  expectedSignals,
}: StrategySnapshotCardProps) {
  const budgetStats = [
    ...(budgetOverview?.total !== undefined
      ? [{ label: 'Monthly Budget', value: `$${budgetOverview.total.toLocaleString()}` }]
      : []),
    ...(budgetOverview?.topPlatform ? [{ label: 'Top Platform', value: budgetOverview.topPlatform }] : []),
    ...(budgetOverview?.timeToFirstResults || expectedSignals?.timeToFirstResults
      ? [{
          label: 'Time to Results',
          value: budgetOverview?.timeToFirstResults ?? expectedSignals?.timeToFirstResults ?? '',
        }]
      : []),
  ];

  const priorityItems = (topPriorities ?? [])
    .map((p) => [p.label, p.description].filter(Boolean).join(' — '))
    .filter(Boolean) as string[];

  const qualitativeOutcomes = (expectedSignals?.qualitativeOutcomes ?? []).filter(Boolean);

  return (
    <div className="space-y-4">
      {headline && (
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{headline}</h3>
      )}
      {budgetStats.length > 0 && <StatGrid stats={budgetStats} columns={3} />}
      {priorityItems.length > 0 && (
        <BulletList title="Top Priorities" items={priorityItems} />
      )}
      {qualitativeOutcomes.length > 0 && (
        <BulletList title="What you'll see" items={qualitativeOutcomes} />
      )}
    </div>
  );
}
