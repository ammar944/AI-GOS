'use client';

import { useState } from 'react';

import { ChevronRight, ExternalLink } from 'lucide-react';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

import { Eyebrow } from './type';

export interface NumberedSource {
  n: number;
  title: string;
  url: string;
  whyItMatters?: string;
}

/** Strip protocol/www from a URL; returns '' on undefined; passthrough on parse failure. */
export function hostname(url?: string): string {
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function formatSourceIndex(n: number): string {
  return String(n).padStart(2, '0');
}

export function SourceLink({
  url,
  className,
}: {
  url?: string;
  className?: string;
}): React.ReactElement | null {
  const host = hostname(url);
  if (!host || !url) return null;

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className={cn(
        'inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground transition-colors hover:text-primary',
        className,
      )}
    >
      {host}
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export function SourcesFooter({
  sources,
}: {
  sources: NumberedSource[];
}): React.ReactElement | null {
  const [open, setOpen] = useState(false);
  if (!sources.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-10 border-t border-border pt-5">
      <CollapsibleTrigger className="group flex items-center gap-2">
        <ChevronRight className="size-3.5 text-muted-foreground transition-transform group-data-[state=open]:rotate-90" />
        <Eyebrow>{sources.length} sources</Eyebrow>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-4">
        <ol className="grid gap-x-10 gap-y-3 sm:grid-cols-2">
          {sources.map((s) => (
            <li key={s.n} className="flex gap-2.5 text-[13px] leading-[1.5]">
              <span className="shrink-0 font-mono tabular-nums text-muted-foreground/70">
                {formatSourceIndex(s.n)}
              </span>
              <span className="min-w-0">
                <a
                  href={s.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-foreground underline-offset-2 transition-colors hover:text-primary hover:underline"
                >
                  {s.title}
                </a>
                {s.whyItMatters ? (
                  <span className="mt-0.5 block text-[12px] leading-[1.5] text-muted-foreground">
                    {s.whyItMatters}
                  </span>
                ) : null}
              </span>
            </li>
          ))}
        </ol>
      </CollapsibleContent>
    </Collapsible>
  );
}
