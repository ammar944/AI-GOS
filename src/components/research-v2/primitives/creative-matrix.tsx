import { cn } from '@/lib/utils';

import { BasisChip } from './basis-chip';
import { EvidenceChip, type EvidenceChipSource } from './evidence-chip';
import { clampReaderText, textOrGap } from './reader-text';

export type CreativeStatus = 'runnable' | 'needs-proof' | 'blocked';

export interface CreativeMatrixItem {
  audience: string;
  angle: string;
  hook: string;
  format: string;
  status: CreativeStatus | string;
  evidence?: EvidenceChipSource;
}

export interface CreativeMatrixProps {
  items: readonly CreativeMatrixItem[];
  className?: string;
}

function statusBasis(status: string): 'measured' | 'assumption' | 'gap' {
  if (status === 'runnable') return 'measured';
  if (status === 'blocked') return 'gap';
  return 'assumption';
}

function statusLabel(status: string): string {
  if (status === 'needs-proof') return 'needs proof';
  return status;
}

function HookText({ hook }: { hook: string }): React.ReactElement {
  const guarded = textOrGap(hook, 'a runnable creative hook');
  if (guarded.kind === 'gap') {
    return (
      <p className="text-[13px] leading-[1.5] text-muted-foreground">{guarded.value}</p>
    );
  }
  return (
    <p className="text-[17px] font-semibold leading-[1.35] text-foreground">
      {clampReaderText(hook, 180)}
    </p>
  );
}

export function CreativeMatrix({
  items,
  className,
}: CreativeMatrixProps): React.ReactElement | null {
  if (items.length === 0) return null;

  return (
    <div className={cn('grid gap-3 md:grid-cols-2', className)} data-testid="creative-matrix">
      {items.map((item, index) => (
        <article
          key={`${item.audience}-${item.angle}-${index}`}
          className="grid gap-3 border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <BasisChip basis={statusBasis(item.status)} />
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {statusLabel(item.status)}
            </span>
            <span className="font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
              {item.format}
            </span>
          </div>
          <HookText hook={item.hook} />
          <div className="flex flex-wrap gap-2 text-[12px] text-muted-foreground">
            <span>{item.audience}</span>
            <span>·</span>
            <span>{item.angle}</span>
            {item.evidence ? <EvidenceChip source={item.evidence} label="source" /> : null}
          </div>
        </article>
      ))}
    </div>
  );
}
