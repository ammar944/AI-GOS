'use client';

import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/hover-card';

export interface CiteSource {
  n: number;
  title: string;
  url: string;
  whyItMatters?: string;
}

export function Cite({ source }: { source: CiteSource }): React.ReactElement {
  return (
    <HoverCard openDelay={80} closeDelay={40}>
      <HoverCardTrigger asChild>
        <sup className="ml-0.5 cursor-default rounded-[3px] bg-primary/10 px-1 py-0.5 align-super font-mono text-[10px] font-medium tabular-nums text-primary">
          {source.n}
        </sup>
      </HoverCardTrigger>
      <HoverCardContent className="w-72 rounded-md p-3 text-sm">
        <div className="font-medium leading-snug text-foreground">{source.title}</div>
        <div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
          {source.url}
        </div>
        {source.whyItMatters ? (
          <div className="mt-2 text-[13px] leading-snug text-muted-foreground">
            {source.whyItMatters}
          </div>
        ) : null}
      </HoverCardContent>
    </HoverCard>
  );
}
