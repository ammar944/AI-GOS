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
  neutral: 'text-[color:var(--text-tertiary)]',
  good: 'text-[color:var(--accent-green)]',
  warn: 'text-[color:var(--accent-amber)]',
  bad: 'text-[color:var(--accent-red)]',
};

export function InlineStats({
  items,
  className,
}: InlineStatsProps): React.ReactElement {
  return (
    <dl
      className={cn(
        'flex flex-wrap gap-x-10 gap-y-5',
        className,
      )}
    >
      {items.map((item, idx) => (
        <div key={`${item.label}-${idx}`} className="min-w-[7rem] flex flex-col gap-1">
          <dt className="font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--text-tertiary)]">
            {item.label}
          </dt>
          <dd className="flex items-baseline gap-1">
            <span className="font-mono text-[18px] font-semibold leading-none tabular-nums text-[color:var(--text-primary)]">
              {item.value}
            </span>
            {item.unit ? (
              <span className="font-mono text-[12px] leading-none text-[color:var(--text-tertiary)]">
                {item.unit}
              </span>
            ) : null}
          </dd>
          {item.delta ? (
            <span
              className={cn(
                'font-mono text-[11px] leading-tight',
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
