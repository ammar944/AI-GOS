'use client';

import { BulletList } from './bullet-list';
import { StatGrid } from './stat-grid';

interface PhaseCardProps {
  name: string;
  duration?: string;
  objectives?: string[];
  activities?: string[];
  successCriteria?: string[];
  budgetAllocation?: number;
  goNoGo?: string;
}

export function PhaseCard({
  name,
  duration,
  objectives,
  activities,
  successCriteria,
  budgetAllocation,
  goNoGo,
}: PhaseCardProps) {
  const summaryStats = [
    ...(budgetAllocation !== undefined
      ? [{ label: 'Budget', value: `$${budgetAllocation.toLocaleString()}` }]
      : []),
    ...(goNoGo ? [{ label: 'Go / No-Go', value: goNoGo }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        {duration && (
          <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {duration}
          </span>
        )}
      </div>
      {objectives && objectives.length > 0 && (
        <BulletList
          title="Objectives"
          items={objectives}
          accent="var(--accent-green)"
        />
      )}
      {activities && activities.length > 0 && (
        <BulletList title="Activities" items={activities} />
      )}
      {successCriteria && successCriteria.length > 0 && (
        <BulletList
          title="Success Criteria"
          items={successCriteria}
          accent="var(--accent-blue)"
        />
      )}
      {summaryStats.length > 0 && <StatGrid stats={summaryStats} columns={2} />}
    </div>
  );
}
