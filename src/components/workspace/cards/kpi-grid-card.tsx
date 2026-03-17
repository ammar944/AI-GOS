'use client';

interface KPI {
  metric?: string;
  target?: number | string;
  platform?: string;
  frequency?: string;
}

interface KpiGridCardProps {
  kpis: Array<Record<string, unknown>>;
}

export function KpiGridCard({ kpis }: KpiGridCardProps) {
  const typed = kpis as KPI[];

  if (typed.length === 0) return null;

  return (
    <div className="space-y-2">
      {typed.map((kpi, i) => (
        <div
          key={i}
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 glass-surface rounded-[var(--radius-md)] px-3 py-2"
        >
          <span className="text-sm text-[var(--text-primary)] truncate">
            {kpi.metric ?? '—'}
          </span>
          {kpi.target !== undefined ? (
            <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">
              {kpi.target}
            </span>
          ) : (
            <span className="text-sm text-[var(--text-tertiary)]">—</span>
          )}
          {kpi.platform ? (
            <span className="rounded bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-tertiary)]">
              {kpi.platform}
            </span>
          ) : (
            <span />
          )}
          {kpi.frequency ? (
            <span className="text-[11px] text-[var(--text-tertiary)] font-mono">
              {kpi.frequency}
            </span>
          ) : (
            <span />
          )}
        </div>
      ))}
    </div>
  );
}
