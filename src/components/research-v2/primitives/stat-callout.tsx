import { cn } from '@/lib/utils';

import { BasisChip, type EvidenceBasis } from './basis-chip';

export interface StatCalloutProps {
  value: string;
  label: string;
  basis?: EvidenceBasis | string;
  className?: string;
}

export function StatCallout({
  value,
  label,
  basis = 'sourced',
  className,
}: StatCalloutProps): React.ReactElement {
  return (
    <div className={cn('border-l-2 border-border pl-4', className)}>
      <div className="font-mono text-[24px] font-semibold leading-none tabular-nums text-foreground">
        {value}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <span className="text-[13px] leading-[1.4] text-muted-foreground">{label}</span>
        <BasisChip basis={basis} />
      </div>
    </div>
  );
}
