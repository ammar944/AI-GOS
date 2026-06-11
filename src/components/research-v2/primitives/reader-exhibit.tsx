'use client';

import { ChevronRight } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

export interface ReaderExhibitProps {
  title: string;
  count?: number;
  children: React.ReactNode;
  className?: string;
}

export function ReaderExhibit({
  title,
  count,
  children,
  className,
}: ReaderExhibitProps): React.ReactElement {
  return (
    <Collapsible className={cn('border-t border-border pt-4', className)}>
      <CollapsibleTrigger className="group flex w-full items-center gap-2 text-left font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground transition-colors hover:text-foreground">
        <ChevronRight
          className="size-3.5 transition-transform group-data-[state=open]:rotate-90"
          aria-hidden="true"
        />
        Exhibits: {title}
        {count !== undefined ? (
          <span className="text-muted-foreground/70">({count})</span>
        ) : null}
      </CollapsibleTrigger>
      <CollapsibleContent forceMount className="pt-4">
        {children}
      </CollapsibleContent>
    </Collapsible>
  );
}
