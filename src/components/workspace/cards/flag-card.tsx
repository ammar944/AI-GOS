'use client';

import { StatGrid } from './stat-grid';

interface FlagCardProps {
  issue: string;
  severity?: string;
  priority?: number;
  evidence?: string;
  recommendedAction?: string;
}

export function FlagCard({ issue, severity, priority, evidence, recommendedAction }: FlagCardProps) {
  const stats = [
    ...(severity ? [{ label: 'Severity', value: severity }] : []),
    ...(priority !== undefined ? [{ label: 'Priority', value: String(priority) }] : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">{issue}</p>
        {stats.length > 0 && (
          <div className="shrink-0">
            <StatGrid stats={stats} columns={2} />
          </div>
        )}
      </div>
      {evidence && (
        <p className="text-sm text-[var(--text-secondary)]">{evidence}</p>
      )}
      {recommendedAction && (
        <p className="text-sm text-[var(--text-secondary)]">{recommendedAction}</p>
      )}
    </div>
  );
}
