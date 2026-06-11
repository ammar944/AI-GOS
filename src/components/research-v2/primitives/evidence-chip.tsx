'use client';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';
import { Cite } from '@/components/research-v2/reader-sources';
import { cn } from '@/lib/utils';

export interface EvidenceChipSource {
  n?: number;
  title: string;
  url?: string;
  date?: string;
  excerpt?: string;
  whyItMatters?: string;
}

export interface EvidenceDrawerProps {
  source: EvidenceChipSource;
  children: React.ReactNode;
}

export interface EvidenceChipProps {
  source?: EvidenceChipSource;
  label?: string;
  className?: string;
}

function sourceUrl(source: EvidenceChipSource): string {
  return source.url ?? '';
}

export function EvidenceDrawer({
  source,
  children,
}: EvidenceDrawerProps): React.ReactElement {
  return (
    <HoverCard openDelay={80} closeDelay={40}>
      <HoverCardTrigger asChild>{children}</HoverCardTrigger>
      <HoverCardContent className="w-80 rounded-md p-3 text-sm">
        <div className="font-medium leading-snug text-foreground">{source.title}</div>
        {source.url ? (
          <a
            href={source.url}
            target="_blank"
            rel="noreferrer"
            className="mt-1 block truncate font-mono text-[11px] text-muted-foreground underline-offset-2 hover:text-primary hover:underline"
          >
            {source.url}
          </a>
        ) : null}
        {source.date ? (
          <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.06em] text-muted-foreground">
            {source.date}
          </div>
        ) : null}
        {source.excerpt ?? source.whyItMatters ? (
          <p className="mt-2 text-[13px] leading-snug text-muted-foreground">
            {source.excerpt ?? source.whyItMatters}
          </p>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}

export function EvidenceChip({
  source,
  label = 'evidence',
  className,
}: EvidenceChipProps): React.ReactElement {
  if (source?.n && source.url) {
    return (
      <span className={cn('inline-flex items-center gap-1', className)}>
        <Cite
          source={{
            n: source.n,
            title: source.title,
            url: sourceUrl(source),
            whyItMatters: source.excerpt ?? source.whyItMatters,
          }}
        />
      </span>
    );
  }

  const chip = (
    <span
      className={cn(
        'inline-flex cursor-default items-center rounded-full border border-border bg-background px-2 py-0.5 align-baseline font-mono text-[10px] font-medium uppercase tracking-[0.06em] text-muted-foreground',
        className,
      )}
    >
      {label}
    </span>
  );

  return source ? <EvidenceDrawer source={source}>{chip}</EvidenceDrawer> : chip;
}
