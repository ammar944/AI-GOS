import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import {
  clientGapSentence,
  containsReaderForbiddenChrome,
  scrubReaderText,
} from './reader-text';

export interface GapNoteProps {
  children?: React.ReactNode;
  gap?: string;
  subject?: string;
  howToClose?: string;
  className?: string;
}

export function GapNote({
  children,
  gap,
  subject = 'this point',
  howToClose,
  className,
}: GapNoteProps): React.ReactElement {
  const sentence =
    typeof children === 'string'
      ? // String children are buyer-facing prose (e.g. an engine blockGap
        // summary). Honest summaries pass through scrubbed; only true pipeline
        // chrome (web_search, keyword_volume, evidence gap:, …) collapses to a
        // clean gap sentence. A bare vendor-brand mention (e.g. a caveat naming
        // "live SpyFu output") is NOT chrome and stays, scrubbed.
        containsReaderForbiddenChrome(children)
        ? clientGapSentence(children, subject)
        : scrubReaderText(children)
      : gap
        ? clientGapSentence(gap, subject)
        : `Not enough public evidence was found for ${subject}.`;
  // howToClose is a sourcing-plan hint; drop it if it carries operator chrome.
  const safeHowToClose =
    typeof howToClose === 'string' && !containsReaderForbiddenChrome(howToClose)
      ? scrubReaderText(howToClose)
      : undefined;

  return (
    <div
      className={cn(
        'flex gap-3 border-l-2 border-amber-500/60 pl-4 text-[13px] leading-[1.6] text-muted-foreground',
        className,
      )}
      data-testid="gap-note"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden="true" />
      <div>
        <p>{sentence}</p>
        {safeHowToClose ? (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground/80">
            How to close: {safeHowToClose}
          </p>
        ) : null}
      </div>
    </div>
  );
}
