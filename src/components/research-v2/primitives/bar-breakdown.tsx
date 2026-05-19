import { cn } from '@/lib/utils';

export interface BarBreakdownSegment {
  label: string;
  value: number;
  hint?: string;
  isAccent?: boolean;
}

export interface BarBreakdownProps {
  segments: ReadonlyArray<BarBreakdownSegment>;
  caption?: string;
  total?: string;
  className?: string;
  formatPercent?: (n: number) => string;
}

const OPACITY_LADDER = [0.32, 0.22, 0.14, 0.09, 0.06];

function defaultPercent(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

export function BarBreakdown({
  segments,
  caption,
  total,
  className,
  formatPercent = defaultPercent,
}: BarBreakdownProps): React.ReactElement {
  const sum =
    segments.reduce((acc, seg) => acc + (Number.isFinite(seg.value) ? seg.value : 0), 0) || 1;
  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {(caption || total) && (
        <div className="flex items-baseline justify-between gap-3">
          {caption ? (
            <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
              {caption}
            </span>
          ) : (
            <span />
          )}
          {total ? (
            <span className="font-mono text-[11px] tabular-nums text-[color:var(--text-quaternary)]">
              {total}
            </span>
          ) : null}
        </div>
      )}
      <div className="flex h-1 w-full overflow-hidden rounded-[3px] bg-[var(--bg-hover)]">
        {segments.map((seg, idx) => {
          const pct = (seg.value / sum) * 100;
          const isAccent = seg.isAccent ?? idx === 0;
          const background = isAccent
            ? 'var(--accent-blue)'
            : `rgba(255,255,255,${OPACITY_LADDER[Math.min(idx, OPACITY_LADDER.length - 1)]})`;
          return (
            <div
              key={`${seg.label}-${idx}`}
              className="h-full transition-opacity hover:opacity-85"
              style={{ width: `${pct}%`, background }}
              aria-label={`${seg.label} ${formatPercent(pct)}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-5 gap-y-2">
        {segments.map((seg, idx) => {
          const pct = (seg.value / sum) * 100;
          const isAccent = seg.isAccent ?? idx === 0;
          const swatch = isAccent
            ? 'var(--accent-blue)'
            : `rgba(255,255,255,${OPACITY_LADDER[Math.min(idx, OPACITY_LADDER.length - 1)]})`;
          return (
            <li
              key={`${seg.label}-${idx}`}
              className="flex items-baseline gap-2 text-[13px] leading-[1.5] text-[color:var(--text-secondary)]"
            >
              <span
                aria-hidden="true"
                className="inline-block h-1.5 w-1.5 rounded-sm"
                style={{ background: swatch }}
              />
              <span>{seg.label}</span>
              <span className="font-mono tabular-nums text-[color:var(--text-primary)]">
                {formatPercent(pct)}
              </span>
              {seg.hint ? (
                <span className="text-[11px] text-[color:var(--text-tertiary)]">{seg.hint}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
