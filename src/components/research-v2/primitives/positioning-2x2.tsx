import { cn } from '@/lib/utils';

export interface Positioning2x2Point {
  label: string;
  x: number;
  y: number;
  isUs?: boolean;
}

export interface Positioning2x2Props {
  xAxisLabel: string;
  yAxisLabel: string;
  points: readonly Positioning2x2Point[];
  className?: string;
}

function boundedPercent(value: number): string {
  return `${Math.min(95, Math.max(5, value))}%`;
}

export function Positioning2x2({
  xAxisLabel,
  yAxisLabel,
  points,
  className,
}: Positioning2x2Props): React.ReactElement | null {
  if (points.length === 0) return null;

  return (
    <div className={cn('grid gap-3', className)} data-testid="positioning-2x2">
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {yAxisLabel}
      </div>
      <div className="relative h-[280px] border border-border bg-muted/20">
        <div className="absolute left-1/2 top-0 h-full w-px bg-border" aria-hidden="true" />
        <div className="absolute left-0 top-1/2 h-px w-full bg-border" aria-hidden="true" />
        {points.map((point) => (
          <div
            key={point.label}
            className={cn(
              'absolute max-w-[130px] -translate-x-1/2 -translate-y-1/2 rounded-full border px-2 py-1 text-center font-mono text-[10px] font-medium uppercase tracking-[0.04em]',
              point.isUs
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border bg-background text-foreground',
            )}
            style={{
              left: boundedPercent(point.x),
              top: boundedPercent(100 - point.y),
            }}
          >
            {point.label}
          </div>
        ))}
      </div>
      <div className="text-right font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        {xAxisLabel}
      </div>
    </div>
  );
}
