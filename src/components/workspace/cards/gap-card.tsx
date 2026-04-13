'use client';

import { StatGrid } from './stat-grid';

export interface GapRow {
  gap: string;
  type?: string;
  evidence?: string;
  exploitability?: number;
  impact?: number;
  recommendedAction?: string;
}

export interface GapCardProps {
  gaps?: GapRow[];
  /** @deprecated single-item shape; use `gaps` */
  gap?: string;
  type?: string;
  evidence?: string;
  exploitability?: number;
  impact?: number;
  recommendedAction?: string;
}

function normalizeGaps(props: GapCardProps): GapRow[] {
  if (props.gaps && props.gaps.length > 0) {
    return props.gaps;
  }
  if (props.gap != null && props.gap !== '') {
    return [
      {
        gap: props.gap,
        type: props.type,
        evidence: props.evidence,
        exploitability: props.exploitability,
        impact: props.impact,
        recommendedAction: props.recommendedAction,
      },
    ];
  }
  return [];
}

function GapBlock({ row }: { row: GapRow }) {
  const stats = [
    ...(row.exploitability !== undefined ? [{ label: 'Exploitability', value: `${row.exploitability}/10` }] : []),
    ...(row.impact !== undefined ? [{ label: 'Impact', value: `${row.impact}/10` }] : []),
  ];

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <p className="text-sm font-medium text-[var(--text-primary)]">{row.gap}</p>
        {row.type ? (
          <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
            {row.type}
          </span>
        ) : null}
      </div>
      {row.evidence ? <p className="text-sm text-[var(--text-secondary)]">{row.evidence}</p> : null}
      {stats.length > 0 ? <StatGrid stats={stats} columns={2} /> : null}
      {row.recommendedAction ? (
        <p className="text-sm text-[var(--text-secondary)]">{row.recommendedAction}</p>
      ) : null}
    </div>
  );
}

export function GapCard(props: GapCardProps) {
  const rows = normalizeGaps(props);
  if (rows.length === 0) return null;

  if (rows.length === 1) {
    return <GapBlock row={rows[0]} />;
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)]">
      {rows.map((row, i) => (
        <div key={i} className="p-3">
          <GapBlock row={row} />
        </div>
      ))}
    </div>
  );
}
