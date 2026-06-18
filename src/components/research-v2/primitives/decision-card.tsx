import { cn } from '@/lib/utils';

import { EvidenceChip, type EvidenceChipSource } from './evidence-chip';
import { isReaderPipelineChrome, scrubReaderText } from './reader-text';

export interface DecisionCardProps {
  number: number;
  move: string;
  evidence?: EvidenceChipSource[];
  meta?: string;
  className?: string;
}

export function DecisionCard({
  number,
  move,
  evidence,
  meta,
  className,
}: DecisionCardProps): React.ReactElement {
  // meta is a rationale line; drop it when it carries operator chrome
  // (e.g. "evidence gap: … blockGap …") so no forbidden term reaches the DOM.
  const safeMeta =
    typeof meta === 'string' && !isReaderPipelineChrome(meta)
      ? scrubReaderText(meta)
      : undefined;
  return (
    <article className={cn('grid grid-cols-[34px_1fr] gap-3 border-b border-border pb-4', className)}>
      <span className="font-mono text-[16px] font-semibold tabular-nums text-foreground">
        {number}
      </span>
      <div>
        <p className="text-[16px] font-medium leading-[1.45] text-foreground">
          {scrubReaderText(move)}
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {evidence?.map((source, index) => (
            <EvidenceChip
              key={`${source.title}-${index}`}
              source={source}
              label="proven by"
            />
          ))}
          {safeMeta ? (
            <span className="font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
              {safeMeta}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
