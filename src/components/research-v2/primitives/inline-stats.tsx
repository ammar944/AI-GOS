import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type InlineStatTone = 'neutral' | 'good' | 'warn' | 'bad';

export interface InlineStatItem {
  label: string;
  value: ReactNode;
  unit?: string;
  delta?: string;
  tone?: InlineStatTone;
}

export interface InlineStatsProps {
  items: ReadonlyArray<InlineStatItem>;
  className?: string;
}

const TONE_CLASS: Record<InlineStatTone, string> = {
  neutral: 'text-muted-foreground',
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-rose-600',
};

export function InlineStats({
  items,
  className,
}: InlineStatsProps): React.ReactElement {
  return (
    <dl
      className={cn(
        'grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-3 lg:grid-cols-4',
        className,
      )}
    >
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className="flex flex-col gap-1">
          <dt className="text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground">
            {item.label}
          </dt>
          <dd className="flex items-baseline gap-1">
            <span className="text-[22px] font-semibold leading-none tabular-nums text-foreground">
              {item.value}
            </span>
            {item.unit ? (
              <span className="text-[12px] leading-none text-muted-foreground">
                {item.unit}
              </span>
            ) : null}
          </dd>
          {item.delta ? (
            <span
              className={cn(
                'text-[11px] leading-tight',
                TONE_CLASS[item.tone ?? 'neutral'],
              )}
            >
              {item.delta}
            </span>
          ) : null}
        </div>
      ))}
    </dl>
  );
}
