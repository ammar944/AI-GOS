'use client';

import { useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useResearchJobActivity,
  collapseResearchJobUpdates,
  type ResearchJobUpdate,
} from '@/lib/journey/research-job-activity';
import { cn } from '@/lib/utils';

interface CorpusStreamProps {
  userId: string;
  runId: string;
  onComplete: () => void;
}

function phaseIcon(phase: ResearchJobUpdate['phase']): string {
  switch (phase) {
    case 'tool':
      return '🔍';
    case 'analysis':
      return '🧠';
    case 'artifact':
      return '📄';
    case 'output':
      return '✓';
    case 'error':
      return '✗';
    default:
      return '→';
  }
}

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

export function CorpusStream({ userId, runId, onComplete }: CorpusStreamProps) {
  const activity = useResearchJobActivity({
    userId,
    activeRunId: runId,
  });

  const bottomRef = useRef<HTMLDivElement>(null);
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Collect all updates from all jobs (corpus run typically has one job: deepResearchProgram)
  const allUpdates = Object.values(activity).flatMap((job) =>
    collapseResearchJobUpdates(job.updates),
  );

  // Detect completion
  const corpusJob = Object.values(activity).find(
    (job) => job.tool === 'runDeepResearchProgram',
  );
  const isComplete = corpusJob?.status === 'complete';
  const isError = corpusJob?.status === 'error';

  useEffect(() => {
    if (isComplete) {
      onCompleteRef.current();
    }
  }, [isComplete]);

  // Auto-scroll to bottom on new updates
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [allUpdates.length]);

  return (
    <div className="flex flex-col items-center justify-center min-h-svh px-4">
      <div className="w-full max-w-2xl space-y-4">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">Researching company…</h2>
          <p className="text-sm text-muted-foreground">
            Building the source-backed corpus for your positioning audit. Takes 30–90 seconds.
          </p>
        </div>

        <Card className="rounded-lg">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Activity log
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <ScrollArea className="h-80">
              <div className="space-y-1.5 pr-2">
                {allUpdates.length === 0 && (
                  <>
                    <Skeleton className="h-4 w-3/4 rounded-md" />
                    <Skeleton className="h-4 w-1/2 rounded-md" />
                    <Skeleton className="h-4 w-2/3 rounded-md" />
                  </>
                )}

                {allUpdates.map((update) => (
                  <div
                    key={update.id}
                    className={cn(
                      'flex items-start gap-2 text-xs',
                      update.phase === 'error' && 'text-destructive',
                    )}
                  >
                    <span className="shrink-0 w-4 text-center">
                      {phaseIcon(update.phase)}
                    </span>
                    <span className="flex-1 leading-relaxed">{update.message}</span>
                    <span className="shrink-0 text-muted-foreground tabular-nums">
                      {formatTimestamp(update.at)}
                    </span>
                  </div>
                ))}

                {isError && !isComplete && (
                  <p className="text-xs text-destructive mt-2">
                    {corpusJob?.error ?? 'Research failed unexpectedly.'}
                  </p>
                )}

                <div ref={bottomRef} />
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
