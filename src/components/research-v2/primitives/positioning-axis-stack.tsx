import { cn } from '@/lib/utils';

export interface PositioningAxisPosition {
  label: string;
  position: string;
  isUs?: boolean;
}

export interface PositioningAxisItem {
  axisName: string;
  positions: ReadonlyArray<PositioningAxisPosition>;
  evidenceUrl?: string;
}

export interface PositioningAxisStackProps {
  axes: ReadonlyArray<PositioningAxisItem>;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function PositioningAxisStack({
  axes,
  className,
}: PositioningAxisStackProps): React.ReactElement {
  return (
    <div className={cn('flex flex-col gap-7', className)}>
      {axes.map((axis, axisIndex) => (
        <div key={`${axis.axisName}-${axisIndex}`} className="flex flex-col gap-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[14px] font-semibold leading-[1.4] tracking-[-0.005em] text-[color:var(--text-primary)]">
              {axis.axisName}
            </h4>
            {axis.evidenceUrl ? (
              <a
                href={axis.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--accent-blue)] no-underline hover:underline"
              >
                {hostnameOf(axis.evidenceUrl)} →
              </a>
            ) : null}
          </div>
          <div className="relative pt-1">
            <div
              aria-hidden="true"
              className="absolute left-0 right-0 top-1/2 h-px -translate-y-1/2 bg-[var(--border-subtle)]"
            />
            <ol className="relative grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {axis.positions.map((p, idx) => (
                <li
                  key={`${p.label}-${idx}`}
                  className={cn(
                    'relative flex flex-col gap-1 rounded-md border px-3 py-2 transition-colors',
                    p.isUs
                      ? 'border-[color:var(--accent-blue)] bg-[color:var(--accent-blue-subtle)]'
                      : 'border-[var(--border-subtle)] bg-[var(--bg-card)] hover:border-[var(--border-hover)]',
                  )}
                >
                  <div
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-[0.06em]',
                      p.isUs
                        ? 'text-[color:var(--accent-blue)]'
                        : 'text-[color:var(--text-tertiary)]',
                    )}
                  >
                    {p.isUs ? `you · ${p.label}` : p.label}
                  </div>
                  <div className="text-[13px] leading-[1.5] text-[color:var(--text-primary)]">
                    {p.position}
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      ))}
    </div>
  );
}
