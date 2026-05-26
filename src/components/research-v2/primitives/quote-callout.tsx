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
        'rounded-lg border border-border bg-muted/40 p-4',
        className,
      )}
    >
      <p className="text-[15px] leading-[1.65] text-foreground">
        {quote}
      </p>
      {emphasis ? (
        <div className="mt-2 text-[13px] leading-[1.55] text-muted-foreground">
          {emphasis}
        </div>
      ) : null}
      {hasMetaLine ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] leading-tight tracking-[0.02em] text-muted-foreground">
          {source ? <span className="text-foreground/80">{source}</span> : null}
          {meta ? <span aria-hidden="true">·</span> : null}
          {meta ? <span>{meta}</span> : null}
          {sourceUrl ? <span aria-hidden="true">·</span> : null}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary no-underline hover:underline"
            >
              {hostnameOf(sourceUrl)} →
            </a>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
