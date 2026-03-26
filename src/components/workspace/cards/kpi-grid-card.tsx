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
          className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 py-2"
        >
          <span className="text-[13px] leading-snug text-[var(--text-primary)] truncate">
            {kpi.metric ?? '—'}
          </span>
          {kpi.target !== undefined ? (
            <span className="font-mono tabular-nums text-[var(--text-primary)]">
              {kpi.target}
            </span>
          ) : (
            <span className="text-[13px] text-[var(--text-quaternary)]">—</span>
          )}
          {kpi.platform ? (
            <span className="rounded bg-[var(--bg-hover)] px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-[0.06em] text-[var(--text-quaternary)]">
              {kpi.platform}
            </span>
          ) : (
            <span />
          )}
          {kpi.frequency ? (
            <span className="text-[11px] font-mono text-[var(--text-quaternary)]">
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
