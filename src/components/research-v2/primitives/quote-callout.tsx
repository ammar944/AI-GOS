import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export interface QuoteCalloutProps {
  quote: string;
  source?: string;
  sourceUrl?: string;
  meta?: string;
  emphasis?: ReactNode;
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function QuoteCallout({
  quote,
  source,
  sourceUrl,
  meta,
  emphasis,
  className,
}: QuoteCalloutProps): React.ReactElement {
  const hasMetaLine = Boolean(source || sourceUrl || meta);
  return (
    <div
      className={cn(
        'border-l-2 border-[color:var(--accent-blue)] py-1 pl-4',
        className,
      )}
    >
      <p className="text-[15px] leading-[1.65] text-[color:var(--text-primary)]">
        {quote}
      </p>
      {emphasis ? (
        <div className="mt-2 text-[13px] leading-[1.55] text-[color:var(--text-secondary)]">
          {emphasis}
        </div>
      ) : null}
      {hasMetaLine ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] leading-tight tracking-[0.02em] text-[color:var(--text-tertiary)]">
          {source ? <span className="text-[color:var(--text-secondary)]">{source}</span> : null}
          {meta ? <span aria-hidden="true">·</span> : null}
          {meta ? <span>{meta}</span> : null}
          {sourceUrl ? <span aria-hidden="true">·</span> : null}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[color:var(--accent-blue)] no-underline hover:underline"
            >
              {hostnameOf(sourceUrl)} →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
