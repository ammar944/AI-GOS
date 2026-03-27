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
  expectedOutcomes?: {
    leadsPerMonth?: number;
    estimatedCAC?: number;
    expectedROAS?: number;
  };
}

export function StrategySnapshotCard({
  headline,
  topPriorities,
  budgetOverview,
  expectedOutcomes,
}: StrategySnapshotCardProps) {
  const budgetStats = [
    ...(budgetOverview?.total !== undefined
      ? [{ label: 'Monthly Budget', value: `$${budgetOverview.total.toLocaleString()}` }]
      : []),
    ...(budgetOverview?.topPlatform ? [{ label: 'Top Platform', value: budgetOverview.topPlatform }] : []),
    ...(budgetOverview?.timeToFirstResults
      ? [{ label: 'Time to Results', value: budgetOverview.timeToFirstResults }]
      : []),
  ];

  const outcomeStats = [
    ...(expectedOutcomes?.leadsPerMonth !== undefined
      ? [{ label: 'Leads / Month', value: String(expectedOutcomes.leadsPerMonth) }]
      : []),
    ...(expectedOutcomes?.estimatedCAC !== undefined
      ? [{ label: 'Est. CAC', value: `$${expectedOutcomes.estimatedCAC.toLocaleString()}` }]
      : []),
    ...(expectedOutcomes?.expectedROAS !== undefined
      ? [{ label: 'Expected ROAS', value: `${expectedOutcomes.expectedROAS}x` }]
      : []),
  ];

  const priorityItems = (topPriorities ?? [])
    .map((p) => [p.label, p.description].filter(Boolean).join(' — '))
    .filter(Boolean) as string[];

  return (
    <div className="space-y-4">
      {headline && (
        <h3 className="text-base font-semibold text-[var(--text-primary)]">{headline}</h3>
      )}
      {budgetStats.length > 0 && <StatGrid stats={budgetStats} columns={3} />}
      {outcomeStats.length > 0 && <StatGrid stats={outcomeStats} columns={3} />}
      {priorityItems.length > 0 && (
        <BulletList title="Top Priorities" items={priorityItems} />
      )}
    </div>
  );
}
