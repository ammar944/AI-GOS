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
  decisionGate?: string;
}

export function PhaseCard({
  name,
  duration,
  objectives,
  activities,
  successCriteria,
  budgetAllocation,
  goNoGo,
  decisionGate,
}: PhaseCardProps) {
  const summaryStats = [
    ...(budgetAllocation !== undefined && budgetAllocation > 0
      ? [{ label: 'Budget', value: `$${budgetAllocation.toLocaleString()}` }]
      : []),
    ...(goNoGo ? [{ label: 'Go / No-Go', value: goNoGo }] : []),
  ];

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-[var(--text-primary)]">{name}</p>
        {duration && (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {duration}
          </span>
        )}
      </div>
      {decisionGate && (
        <div className="rounded-[var(--radius-md)] border border-[var(--accent-green)]/25 bg-[var(--accent-green)]/[0.06] px-3 py-2">
          <span className="block mb-1 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--accent-green)]/80">
            Decision Gate
          </span>
          <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{decisionGate}</p>
        </div>
      )}
      {objectives && objectives.length > 0 && (
        <BulletList title="Objectives" items={objectives} accent="var(--accent-green)" />
      )}
      {activities && activities.length > 0 && (
        <BulletList title="Activities" items={activities} />
      )}
      {successCriteria && successCriteria.length > 0 && (
        <BulletList
          title="Success Criteria"
          items={successCriteria}
          accent="var(--text-primary)"
        />
      )}
      {summaryStats.length > 0 && <StatGrid stats={summaryStats} columns={2} />}
    </div>
  );
}
