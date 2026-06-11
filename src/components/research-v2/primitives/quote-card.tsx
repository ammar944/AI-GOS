import { ExternalLink } from 'lucide-react';

import { cn } from '@/lib/utils';

import { GapNote } from './gap-note';
import {
  clampReaderText,
  isInvalidReaderUrl,
  looksLikeNavMenuGarbage,
} from './reader-text';

export interface QuoteCardProps {
  quote: string;
  author?: string;
  role?: string;
  venue?: string;
  url?: string;
  date?: string;
  className?: string;
}

export function QuoteCard({
  quote,
  author,
  role,
  venue,
  url,
  date,
  className,
}: QuoteCardProps): React.ReactElement {
  if (looksLikeNavMenuGarbage(quote)) {
    return (
      <GapNote
        subject="a usable customer quote"
        howToClose="Rerun VoC with permalinked review, forum, or support-thread sources."
      />
    );
  }

  const meta = [author, role, venue, date].filter(Boolean).join(' · ');

  return (
    <figure
      className={cn('border-l-2 border-primary/50 pl-5', className)}
      data-testid="quote-card"
    >
      <blockquote className="font-serif text-[18px] leading-[1.5] text-foreground">
        “{clampReaderText(quote, 280)}”
      </blockquote>
      <figcaption className="mt-3 flex flex-wrap items-center gap-2 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground">
        {meta ? <span>{meta}</span> : <span>Customer language</span>}
        {!isInvalidReaderUrl(url) ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-muted-foreground transition-colors hover:text-primary"
          >
            Permalink
            <ExternalLink className="size-3" aria-hidden="true" />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
