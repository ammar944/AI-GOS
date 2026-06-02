import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

import { Eyebrow } from '@/components/research-v2/ui-kit';

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
        className="absolute bottom-2 left-[5px] top-2 w-px bg-border"
      />
      {steps.map((step, idx) => (
        <li
          key={`${step.title}-${idx}`}
          className={cn('relative pb-6 last:pb-0')}
        >
          <span
            aria-hidden="true"
            className={cn(
              'absolute left-[-23px] top-1.5 h-[11px] w-[11px] rounded-full ring-[3px] ring-background',
              step.accent ? 'bg-primary' : 'bg-border',
            )}
          />
          {step.label ? (
            <Eyebrow className="mb-1 block">{step.label}</Eyebrow>
          ) : null}
          <h4 className="text-[15px] font-semibold leading-[1.35] text-foreground">
            {step.title}
          </h4>
          {step.body ? (
            <div className="mt-1 max-w-[60ch] text-[15px] leading-[1.6] text-foreground">
              {step.body}
            </div>
          ) : null}
        </li>
      ))}
    </ol>
  );
}
