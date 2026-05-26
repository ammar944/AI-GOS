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

const OPACITY_LADDER = [0.55, 0.4, 0.28, 0.18, 0.1];

function defaultPercent(n: number): string {
  if (!Number.isFinite(n)) return '—';
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

// Theme-aware fill: accent uses the primary token; the ladder mixes the
// foreground token toward transparent so segments read on both light and
// dark backgrounds (dark bars on white, light bars on dark).
function segmentBackground(isAccent: boolean, idx: number): string {
  if (isAccent) return 'var(--primary)';
  const opacity = OPACITY_LADDER[Math.min(idx, OPACITY_LADDER.length - 1)];
  return `color-mix(in oklch, var(--foreground) ${Math.round(opacity * 100)}%, transparent)`;
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
    <div className={cn('flex flex-col gap-3', className)}>
      {(caption || total) && (
        <div className="flex items-baseline justify-between gap-3">
          {caption ? (
            <span className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
              {caption}
            </span>
          ) : (
            <span />
          )}
          {total ? (
            <span className="text-[11px] tabular-nums text-muted-foreground/70">
              {total}
            </span>
          ) : null}
        </div>
      )}
      <div className="flex h-2 w-full overflow-hidden rounded-[3px] bg-muted">
        {segments.map((seg, idx) => {
          const pct = (seg.value / sum) * 100;
          const isAccent = seg.isAccent ?? idx === 0;
          return (
            <div
              key={`${seg.label}-${idx}`}
              className="h-full transition-opacity hover:opacity-85"
              style={{ width: `${pct}%`, background: segmentBackground(isAccent, idx) }}
              aria-label={`${seg.label} ${formatPercent(pct)}`}
            />
          );
        })}
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-2">
        {segments.map((seg, idx) => {
          const pct = (seg.value / sum) * 100;
          const isAccent = seg.isAccent ?? idx === 0;
          return (
            <li
              key={`${seg.label}-${idx}`}
              className="flex items-baseline gap-2 text-[13px] leading-[1.4] text-muted-foreground"
            >
              <span
                aria-hidden="true"
                className="inline-block h-2 w-2 rounded-sm"
                style={{ background: segmentBackground(isAccent, idx) }}
              />
              <span>{seg.label}</span>
              <span className="tabular-nums font-medium text-foreground">
                {formatPercent(pct)}
              </span>
              {seg.hint ? (
                <span className="text-[11px] text-muted-foreground/70">{seg.hint}</span>
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
