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

  return (
    <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
      {audienceSize?.trim() ? (
        <div className="space-y-1">
          <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider block">
            Audience size
          </span>
          <p className="text-sm font-medium text-[var(--text-primary)] tabular-nums">{audienceSize.trim()}</p>
        </div>
      ) : null}
      {pct !== null ? (
        <div className="space-y-2 min-w-0">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] font-mono text-[var(--text-tertiary)] uppercase tracking-wider">
              Confidence
            </span>
            <span className="text-sm font-semibold text-[var(--text-primary)] tabular-nums">{pct}/100</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--border-subtle)]"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="ICP confidence score"
          >
            <div
              className="h-full rounded-full bg-[var(--accent-blue)] transition-[width] duration-200"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
