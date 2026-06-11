import { cn } from '@/lib/utils';

import { BasisChip, type EvidenceBasis } from './basis-chip';

export interface BudgetBarSegment {
  label: string;
  value: number;
  displayValue?: string;
  basis?: EvidenceBasis | string;
}

export interface BudgetBarProps {
  segments: readonly BudgetBarSegment[];
  totalLabel?: string;
  className?: string;
}

export function BudgetBar({
  segments,
  totalLabel,
  className,
}: BudgetBarProps): React.ReactElement | null {
  const total = segments.reduce((sum, segment) => sum + Math.max(0, segment.value), 0);
  if (total <= 0) return null;

  return (
    <div className={cn('grid gap-3', className)} data-testid="budget-bar">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {segments.map((segment, index) => {
          const width = `${(Math.max(0, segment.value) / total) * 100}%`;
          return (
            <div
              key={`${segment.label}-${index}`}
              className={cn(
                'h-full',
                index % 3 === 0
                  ? 'bg-primary'
                  : index % 3 === 1
                    ? 'bg-emerald-500'
                    : 'bg-amber-500',
              )}
              style={{ width }}
              aria-label={`${segment.label} ${segment.displayValue ?? segment.value}`}
            />
          );
        })}
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2">
        {segments.map((segment) => (
          <div key={segment.label} className="flex items-center gap-2 text-[12px]">
            <span className="font-medium text-foreground">{segment.label}</span>
            <span className="font-mono tabular-nums text-muted-foreground">
              {segment.displayValue ?? segment.value}
            </span>
            <BasisChip basis={segment.basis ?? 'assumption'} />
          </div>
        ))}
      </div>
      {totalLabel ? (
        <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
          {totalLabel}
        </div>
      ) : null}
    </div>
  );
}
