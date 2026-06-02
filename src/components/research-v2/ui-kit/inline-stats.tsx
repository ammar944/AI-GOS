import { cn } from '@/lib/utils';

import { Eyebrow } from './type';

export type InlineStatTone = 'good' | 'warn' | 'bad' | 'neutral';

export interface InlineStatItem {
  label: string;
  value: string | number;
  unit?: string;
  tone?: InlineStatTone;
}

export const STAT_TONE: Record<InlineStatTone, string> = {
  good: 'text-emerald-600',
  warn: 'text-amber-600',
  bad: 'text-red-600',
  neutral: 'text-foreground',
};

export function InlineStats({
  items,
  className,
}: {
  items: ReadonlyArray<InlineStatItem>;
  className?: string;
}): React.ReactElement {
  return (
    <dl className={cn('flex flex-wrap gap-x-10 gap-y-4', className)}>
      {items.map((s, i) => (
        <div key={`${s.label}-${i}`}>
          <dt>
            <Eyebrow>{s.label}</Eyebrow>
          </dt>
          <dd
            className={cn(
              'mt-1 font-mono text-[22px] font-semibold tabular-nums',
              STAT_TONE[s.tone ?? 'neutral'],
            )}
          >
            {s.value}
            {s.unit ? (
              <span className="ml-0.5 text-[13px] font-normal text-muted-foreground">
                {s.unit}
              </span>
            ) : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}
