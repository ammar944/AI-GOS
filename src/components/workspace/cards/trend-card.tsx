'use client';

import { cn } from '@/lib/utils';

export interface TrendRow {
  trend: string;
  direction: string;
  evidence: string;
}

export interface TrendCardProps {
  trends?: TrendRow[];
  /** @deprecated single-item shape; use `trends` */
  trend?: string;
  direction?: string;
  evidence?: string;
}

function normalizeTrends(props: TrendCardProps): TrendRow[] {
  if (props.trends && props.trends.length > 0) {
    return props.trends;
  }
  if (props.trend != null && props.trend !== '') {
    return [
      {
        trend: props.trend,
        direction: props.direction ?? 'stable',
        evidence: props.evidence ?? '',
      },
    ];
  }
  return [];
}

function directionBadgeClass(direction: string) {
  const d = direction.toLowerCase();
  if (d === 'rising') {
    return cn(
      'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
      'bg-[var(--accent-green)]/10 text-[var(--accent-green)]',
    );
  }
  if (d === 'declining') {
    return cn(
      'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
      'bg-[var(--accent-red)]/10 text-[var(--accent-red)]',
    );
  }
  return cn(
    'text-[10px] font-mono uppercase px-1.5 py-0.5 rounded',
    'bg-[var(--bg-hover)] text-[var(--text-tertiary)]',
  );
}

function TrendRowContent({ row }: { row: TrendRow }) {
  return (
    <>
      <div className="flex items-center gap-2 mb-1">
        <span className={directionBadgeClass(row.direction)}>{row.direction}</span>
        <span className="text-sm font-medium text-[var(--text-primary)]">{row.trend}</span>
      </div>
      {row.evidence ? <p className="text-xs text-[var(--text-tertiary)]">{row.evidence}</p> : null}
    </>
  );
}

export function TrendCard(props: TrendCardProps) {
  const rows = normalizeTrends(props);
  if (rows.length === 0) return null;

  if (rows.length === 1) {
    return (
      <div className="rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3">
        <TrendRowContent row={rows[0]} />
      </div>
    );
  }

  return (
    <div className="divide-y divide-[var(--border-subtle)] rounded-[var(--radius-md)] border border-[var(--border-subtle)] overflow-hidden">
      {rows.map((row, i) => (
        <div key={i} className="p-3">
          <TrendRowContent row={row} />
        </div>
      ))}
    </div>
  );
}
