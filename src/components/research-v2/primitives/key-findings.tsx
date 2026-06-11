import { cn } from '@/lib/utils';

import { BasisChip, type EvidenceBasis } from './basis-chip';
import { EvidenceChip, type EvidenceChipSource } from './evidence-chip';
import { scrubReaderText } from './reader-text';

export interface KeyFinding {
  sentence: string;
  basis?: EvidenceBasis | string;
  evidence?: EvidenceChipSource[];
}

export interface KeyFindingsProps {
  findings: readonly KeyFinding[];
  className?: string;
}

export function KeyFindings({
  findings,
  className,
}: KeyFindingsProps): React.ReactElement | null {
  const visible = findings
    .filter((finding) => finding.sentence.trim().length > 0)
    .slice(0, 5);

  if (visible.length === 0) return null;

  return (
    <section className={cn('grid gap-3', className)} data-testid="key-findings">
      <div className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
        Key findings
      </div>
      <ol className="grid gap-3">
        {visible.map((finding, index) => (
          <li
            key={`${index}-${finding.sentence}`}
            className="grid grid-cols-[28px_1fr] gap-3 border-b border-border/60 pb-3 last:border-b-0 last:pb-0"
          >
            <span className="font-mono text-[13px] font-semibold tabular-nums text-foreground">
              {index + 1}
            </span>
            <div className="min-w-0">
              <p className="text-[15px] leading-[1.55] text-foreground">
                {scrubReaderText(finding.sentence)}
              </p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <BasisChip basis={finding.basis ?? 'sourced'} />
                {finding.evidence?.map((source, evidenceIndex) => (
                  <EvidenceChip
                    key={`${source.title}-${evidenceIndex}`}
                    source={source}
                    label="source"
                  />
                ))}
              </div>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
