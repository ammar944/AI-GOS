import { AlertCircle } from 'lucide-react';

import { cn } from '@/lib/utils';

import { clientGapSentence } from './reader-text';

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
      ? children
      : gap
        ? clientGapSentence(gap, subject)
        : `Not enough public evidence was found for ${subject}.`;

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
        {howToClose ? (
          <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.06em] text-muted-foreground/80">
            How to close: {howToClose}
          </p>
        ) : null}
      </div>
    </div>
  );
}
