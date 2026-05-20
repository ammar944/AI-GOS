import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface MilestoneItem {
  label?: string;
  title: string;
  body?: ReactNode;
  accent?: boolean;
}

export interface MilestoneTimelineProps {
  steps: ReadonlyArray<MilestoneItem>;
  className?: string;
}

export function MilestoneTimeline({
  steps,
  className,
}: MilestoneTimelineProps): React.ReactElement {
  return (
    <ol className={cn('relative pl-6', className)}>
      <span
        aria-hidden="true"
        className="absolute bottom-2 left-[5px] top-2 w-px bg-[var(--border-subtle)]"
      />
      {steps.map((step, idx) => (
        <li
          key={`${step.title}-${idx}`}
          className={cn('relative pb-6 last:pb-0')}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-[-23px] top-1.5 h-[11px] w-[11px] rounded-full ring-[3px] ring-[var(--bg-base)]',
              step.accent
                ? 'bg-[color:var(--accent-blue)]'
                : 'bg-[color:var(--accent-blue)]',
            )}
          />
          {step.label ? (
            <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.06em] text-[color:var(--text-tertiary)]">
              {step.label}
            </div>
          ) : null}
          <h4 className="text-[15px] font-semibold leading-[1.35] text-[color:var(--text-primary)]">
            {step.title}
          </h4>
          {step.body ? (
            <div className="mt-1 max-w-[60ch] text-[13px] leading-[1.6] text-[color:var(--text-secondary)]">
              {step.body}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
