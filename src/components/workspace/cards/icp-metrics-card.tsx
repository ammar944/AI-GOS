'use client';

export interface IcpMetricsCardProps {
  audienceSize?: string | null;
  /**0–100 from research; drives the bar */
  confidenceScore?: number | null;
}

export function IcpMetricsCard({ audienceSize, confidenceScore }: IcpMetricsCardProps) {
  const pct =
    confidenceScore != null && Number.isFinite(confidenceScore)
      ? Math.min(100, Math.max(0, Math.round(confidenceScore)))
      : null;

  if (!audienceSize?.trim() && pct === null) return null;

  const barColor =
    pct !== null
      ? pct >= 70
        ? 'var(--accent-green)'
        : pct >= 40
          ? 'var(--accent-amber)'
          : 'var(--accent-red)'
      : undefined;

  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
      {audienceSize?.trim() ? (
        <div className="space-y-1">
          <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em] block">
            Audience size
          </span>
          <p className="text-[20px] font-mono font-semibold text-[var(--text-primary)] tabular-nums leading-tight">{audienceSize.trim()}</p>
        </div>
      ) : null}
      {pct !== null ? (
        <div className="space-y-2.5 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[11px] font-mono text-[var(--text-tertiary)] uppercase tracking-[0.06em]">
              Confidence
            </span>
            <span
              className="text-[20px] font-mono font-semibold tabular-nums leading-tight"
              style={{ color: barColor }}
            >
              {pct}
            </span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full"
            style={{ background: 'var(--bg-hover)' }}
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="ICP confidence score"
          >
            <div
              className="h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none"
              style={{ width: `${pct}%`, background: barColor }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
