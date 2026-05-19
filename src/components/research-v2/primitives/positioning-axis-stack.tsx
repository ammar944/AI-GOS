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

function axisGridTemplate(count: number): string {
  return `repeat(${Math.max(count, 1)}, minmax(9rem, 1fr))`;
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
    <div className={cn('flex flex-col gap-10', className)}>
      {axes.map((axis, axisIndex) => (
        <div key={`${axis.axisName}-${axisIndex}`} className="flex flex-col gap-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h4 className="text-[15px] font-semibold leading-[1.45] tracking-[0] text-[color:var(--text-primary)]">
              {axis.axisName}
            </h4>
            {axis.evidenceUrl ? (
              <a
                href={axis.evidenceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)] no-underline hover:text-[color:var(--accent-blue)] hover:underline"
              >
                {hostnameOf(axis.evidenceUrl)} →
              </a>
            ) : null}
          </div>
          <div className="overflow-x-auto pb-1">
            <ol
              className="relative grid min-w-[640px] pt-5"
              style={{ gridTemplateColumns: axisGridTemplate(axis.positions.length) }}
            >
              <span
                aria-hidden="true"
                className="absolute left-2 right-2 top-[24px] h-px bg-[var(--border-subtle)]"
              />
              {axis.positions.map((p, idx) => (
                <li
                  key={`${p.label}-${idx}`}
                  className={cn(
                    'relative flex min-w-0 flex-col gap-2 px-2',
                    idx === 0 && 'pl-0',
                    idx === axis.positions.length - 1 && 'pr-0',
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn(
                      'relative z-10 h-[9px] w-[9px] rounded-full border ring-4 ring-[var(--bg-base)]',
                      p.isUs
                        ? 'border-[color:var(--accent-blue)] bg-[color:var(--accent-blue)]'
                        : 'border-[var(--border-subtle)] bg-[var(--bg-base)]',
                    )}
                  />
                  <div
                    className={cn(
                      'font-mono text-[10px] uppercase tracking-[0.08em]',
                      p.isUs
                        ? 'text-[color:var(--accent-blue)]'
                        : 'text-[color:var(--text-tertiary)]',
                    )}
                  >
                    {p.isUs ? `you / ${p.label}` : p.label}
                  </div>
                  <div className="max-w-[20ch] text-[13px] leading-[1.55] text-[color:var(--text-primary)]">
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
