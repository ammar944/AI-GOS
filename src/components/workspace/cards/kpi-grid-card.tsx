'use client';

import { BulletList } from './bullet-list';

/**
 * Qualitative KPI shape (2026-04-19) — matches the new
 * measurementGuardrailsSchema in research-worker/src/contracts.ts.
 *
 * Numeric client-specific fields (target, industryBenchmark) were removed
 * per Mahdy feedback. We now render drivers + improvement levers + an
 * optional industry benchmark range (labeled).
 */
interface KPI {
  metric?: string;
  drivers?: string[];
  improvementLevers?: string[];
  benchmarkRange?: {
    low?: number;
    high?: number;
    source?: string;
  };
  measurementMethod?: string;
}

interface KpiGridCardProps {
  kpis: Array<Record<string, unknown>>;
}

export function KpiGridCard({ kpis }: KpiGridCardProps) {
  const typed = kpis as KPI[];

  if (typed.length === 0) return null;

  return (
    <div className="space-y-4">
      {typed.map((kpi, i) => {
        const drivers = (kpi.drivers ?? []).filter(Boolean);
        const levers = (kpi.improvementLevers ?? []).filter(Boolean);
        const range = kpi.benchmarkRange;
        const showRange =
          range?.low != null &&
          range?.high != null &&
          Number.isFinite(range.low) &&
          Number.isFinite(range.high);

        return (
          <div
            key={i}
            className="space-y-2 rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--bg-card)] p-3"
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-[var(--text-primary)]">
                {kpi.metric ?? '—'}
              </span>
              {kpi.measurementMethod && (
                <span className="text-[11px] font-mono text-[var(--text-tertiary)]">
                  {kpi.measurementMethod}
                </span>
              )}
            </div>
            {drivers.length > 0 && <BulletList title="Drivers" items={drivers} />}
            {levers.length > 0 && (
              <BulletList title="Improvement levers" items={levers} />
            )}
            {showRange && (
              <div className="rounded-md border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2 py-1 text-xs text-[var(--text-secondary)]">
                Industry benchmark range:{' '}
                <span className="font-semibold text-[var(--text-primary)]">
                  {range!.low}–{range!.high}
                </span>
                {range?.source && (
                  <span className="ml-1 text-[var(--text-tertiary)]">
                    ({range.source})
                  </span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
