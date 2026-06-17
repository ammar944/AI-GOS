import { cn } from '@/lib/utils';

import { scrubReaderText } from './reader-text';

export interface VerdictHeroProps {
  verdict: string;
  whyItMatters?: string;
  className?: string;
}

export function VerdictHero({
  verdict,
  whyItMatters,
  className,
}: VerdictHeroProps): React.ReactElement {
  return (
    <section
      className={cn('border-l-2 border-primary pl-5', className)}
      data-testid="verdict-hero"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-primary/80">
          Verdict
        </span>
      </div>
      <h2 className="mt-2 max-w-[60ch] font-sans text-[20px] font-semibold leading-[1.4] tracking-[-0.01em] text-foreground">
        {scrubReaderText(verdict)}
      </h2>
      {whyItMatters ? (
        <p className="mt-2 max-w-[68ch] text-[14px] leading-[1.6] text-muted-foreground">
          {scrubReaderText(whyItMatters)}
        </p>
      ) : null}
    </section>
  );
}
