'use client';

import { BookText } from 'lucide-react';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Source } from '@/components/ai/sources';
import { cn } from '@/lib/utils';

import type { ArtifactSource } from '@/lib/research-v2/audit-artifact-schema';

interface SourcesPanelProps {
  sources: ArtifactSource[];
  className?: string;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function SourcesPanel({ sources, className }: SourcesPanelProps) {
  return (
    <Card className={cn('flex flex-col h-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5">
            <BookText className="size-3.5" />
            Sources
          </span>
          <span className="text-xs font-normal text-muted-foreground">
            {sources.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full px-3 pb-3">
          {sources.length === 0 ? (
            <p className="text-xs text-muted-foreground py-2 px-1">
              Sources from research will appear here as sections complete.
            </p>
          ) : (
            <ul className="flex flex-col gap-1">
              {sources.map((source) => (
                <li key={source.id} className="min-w-0">
                  <Source
                    href={source.url}
                    title={source.title ?? hostnameOf(source.url)}
                    className="block px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                  >
                    <span className="flex flex-col gap-0.5 min-w-0">
                      <span className="truncate font-medium text-xs text-foreground">
                        {source.title ?? hostnameOf(source.url)}
                      </span>
                      <span className="truncate text-[10px] text-muted-foreground">
                        {hostnameOf(source.url)}
                      </span>
                      {source.snippet ? (
                        <span className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground/80">
                          {source.snippet}
                        </span>
                      ) : null}
                    </span>
                  </Source>
                </li>
              ))}
            </ul>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
