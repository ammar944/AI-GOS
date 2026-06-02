'use client';

import type { ReactNode } from 'react';

import { ExternalLink } from 'lucide-react';

import type { PositioningArtifactSource } from '@/types/positioning-artifact';
import { cn } from '@/lib/utils';

import { Cite, type CiteSource } from './cite';
import { Eyebrow } from './type';

const CALLOUT_ACCENT: Record<'accent' | 'good' | 'warn' | 'bad', string> = {
  accent: 'border-primary',
  good: 'border-emerald-500',
  warn: 'border-amber-500',
  bad: 'border-red-500',
};

export function VerdictCallout({ verdict }: { verdict: string }): React.ReactElement {
  return (
    <div className="border-l-2 border-primary pl-4">
      <Eyebrow className="text-primary/80">Verdict</Eyebrow>
      <p className="mt-1.5 text-[17px] leading-[1.55] text-foreground">{verdict}</p>
    </div>
  );
}

export function Callout({
  label,
  tone = 'accent',
  children,
}: {
  label: string;
  tone?: 'accent' | 'good' | 'warn' | 'bad';
  children: ReactNode;
}): React.ReactElement {
  return (
    <div className={cn('border-l-2 pl-4', CALLOUT_ACCENT[tone])}>
      <Eyebrow>{label}</Eyebrow>
      <p className="mt-1 text-[15px] leading-[1.6] text-foreground">{children}</p>
    </div>
  );
}

export function QuoteCallout({
  text,
  source,
  meta,
  url,
  cite,
  sources,
}: {
  text: string;
  source: string;
  meta?: string;
  url?: string;
  cite?: number;
  sources?: PositioningArtifactSource[];
}): React.ReactElement {
  const citeSource: CiteSource | undefined =
    cite != null && sources
      ? (() => {
          const indexed = sources[cite - 1];
          if (!indexed) return undefined;
          return {
            n: cite,
            title: indexed.title,
            url: indexed.url,
            whyItMatters: indexed.whyItMatters,
          };
        })()
      : undefined;

  return (
    <figure className="border-l-2 border-primary/40 pl-5">
      <blockquote className="text-[17px] leading-[1.55] text-foreground">
        “{text}”
        {citeSource ? <Cite source={citeSource} /> : null}
      </blockquote>
      <figcaption className="mt-2 flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.04em] text-muted-foreground">
        <span className="text-foreground/70 normal-case">{source}</span>
        {meta ? <span className="text-muted-foreground/60">· {meta}</span> : null}
        {url ? (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground/60 transition-colors hover:text-primary"
          >
            <ExternalLink className="size-3" />
          </a>
        ) : null}
      </figcaption>
    </figure>
  );
}
