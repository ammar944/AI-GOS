import { cn } from '@/lib/utils';

import type { ValueReadinessBadge } from '../trust-tier';
import { scrubReaderText } from './reader-text';

export interface VerdictHeroProps {
  verdict: string;
  whyItMatters?: string;
  /**
   * Phase-1 keystone: the per-block value-readiness rollup (orthogonal to the
   * section confidence headline). When at least one block self-reports "rich",
   * a muted count line surfaces the strongest-evidence split; absent or legacy
   * artifacts render exactly as before.
   */
  valueReadiness?: ValueReadinessBadge | null;
  className?: string;
}

function buildRichCountLine(
  valueReadiness: ValueReadinessBadge | null | undefined,
): string | null {
  if (!valueReadiness || !valueReadiness.anyRich) {
    return null;
  }
  const { rich, adequate, thin, gap } = valueReadiness.blocksByReadiness;
  const total = rich + adequate + thin + gap;
  if (total <= 0) {
    return null;
  }
  return `${rich} of ${total} ${total === 1 ? 'block' : 'blocks'} fully evidenced`;
}

export function VerdictHero({
  verdict,
  whyItMatters,
  valueReadiness,
  className,
}: VerdictHeroProps): React.ReactElement {
  const richCountLine = buildRichCountLine(valueReadiness);

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
      {richCountLine ? (
        <p
          className="mt-2 font-mono text-[11px] uppercase tracking-[0.05em] text-muted-foreground/70"
          data-testid="verdict-hero-readiness"
        >
          {richCountLine}
        </p>
      ) : null}
    </section>
  );
}
