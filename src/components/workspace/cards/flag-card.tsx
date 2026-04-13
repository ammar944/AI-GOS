'use client';

import { StatGrid } from './stat-grid';

export interface FlagRow {
  issue: string;
  severity?: string;
  priority?: number;
  evidence?: string;
  recommendedAction?: string;
}

export interface FlagCardProps {
  flags?: FlagRow[];
  /** @deprecated single-item shape; use `flags` */
  issue?: string;
  severity?: string;
  priority?: number;
  evidence?: string;
  recommendedAction?: string;
}

function normalizeFlags(props: FlagCardProps): FlagRow[] {
  if (props.flags && props.flags.length > 0) {
    return props.flags;
  }
  if (props.issue != null && props.issue !== '') {
    return [
      {
        issue: props.issue,
        severity: props.severity,
        priority: props.priority,
        evidence: props.evidence,
        recommendedAction: props.recommendedAction,
      },
    ];
  }
  return [];
}

function FlagBlock({ row }: { row: FlagRow }) {
  const stats = [
    ...(row.severity ? [{ label: 'Severity', value: row.severity }] : []),
    ...(row.priority !== undefined ? [{ label: 'Priority', value: String(row.priority) }] : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-[var(--text-primary)]">{row.issue}</p>
        {stats.length > 0 ? (
          <div className="shrink-0">
            <StatGrid stats={stats} columns={2} />
          </div>
        ) : null}
      </div>
      {row.evidence ? <p className="text-sm text-[var(--text-secondary)]">{row.evidence}</p> : null}
      {row.recommendedAction ? (
        <p className="text-sm text-[var(--text-secondary)]">{row.recommendedAction}</p>
      ) : null}
    </div>
  );
}

export function FlagCard(props: FlagCardProps) {
  const rows = normalizeFlags(props);
  if (rows.length === 0) return null;

  if (rows.length === 1) {
    return <FlagBlock row={rows[0]} />;
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
      {rows.map((row, i) => (
        <div key={i} className="p-3">
          <FlagBlock row={row} />
        </div>
      ))}
    </div>
  );
}
