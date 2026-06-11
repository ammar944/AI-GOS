import { cn } from '@/lib/utils';

export type EvidenceBasis =
  | 'measured'
  | 'sourced'
  | 'benchmark'
  | 'assumption'
  | 'gap';

export interface BasisChipProps {
  basis: EvidenceBasis | string;
  children?: React.ReactNode;
  className?: string;
}

const BASIS_CLASS: Record<EvidenceBasis, string> = {
  measured: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600',
  sourced: 'border-primary/20 bg-primary/10 text-primary',
  benchmark: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
  assumption: 'border-amber-500/20 bg-amber-500/10 text-amber-600',
  gap: 'border-red-500/20 bg-red-500/10 text-red-600',
};

function normalizeBasis(value: EvidenceBasis | string): EvidenceBasis {
  if (value === 'measured') return 'measured';
  if (value === 'sourced') return 'sourced';
  if (value === 'benchmark') return 'benchmark';
  if (value === 'assumption') return 'assumption';
  if (value === 'gap') return 'gap';
  if (/gap|missing|unknown|not enough/i.test(value)) return 'gap';
  if (/bench/i.test(value)) return 'benchmark';
  if (/measure|observ/i.test(value)) return 'measured';
  if (/source|cite|url/i.test(value)) return 'sourced';
  return 'assumption';
}

export function BasisChip({
  basis,
  children,
  className,
}: BasisChipProps): React.ReactElement {
  const normalized = normalizeBasis(basis);
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-[0.06em]',
        BASIS_CLASS[normalized],
        className,
      )}
    >
      {children ?? normalized}
    </span>
  );
}
