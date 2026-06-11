import { cn } from '@/lib/utils';

import { BasisChip, type EvidenceBasis } from './basis-chip';

export interface FunnelMathStep {
  label: string;
  value?: string | number | null;
  basis?: EvidenceBasis | string;
}

export interface FunnelMathProps {
  steps: readonly FunnelMathStep[];
  className?: string;
}

export function FunnelMath({
  steps,
  className,
}: FunnelMathProps): React.ReactElement | null {
  const visible = steps.filter(
    (step) => step.value !== undefined && step.value !== null && String(step.value).trim().length > 0,
  );

  if (visible.length === 0) return null;

  return (
    <div
      className={cn('grid gap-2 md:grid-cols-[repeat(auto-fit,minmax(120px,1fr))]', className)}
      data-testid="funnel-math"
    >
      {visible.map((step, index) => (
        <div key={`${step.label}-${index}`} className="border-l border-border pl-3">
          <div className="font-mono text-[18px] font-semibold tabular-nums text-foreground">
            {step.value}
          </div>
          <div className="mt-1 text-[12px] leading-[1.35] text-muted-foreground">
            {step.label}
          </div>
          <div className="mt-2">
            <BasisChip basis={step.basis ?? 'assumption'} />
          </div>
        </div>
      ))}
    </div>
  );
}
