'use client';

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState } from 'react';
import {
  useResearchJobActivity,
  collapseResearchJobUpdates,
  type ResearchJobUpdate,
} from '@/lib/journey/research-job-activity';
import { cn } from '@/lib/utils';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

interface ThinkingBlockProps {
  userId: string;
  runId: string;
  sectionId: PositioningSectionId;
  sectionLabel: string;
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

export function ThinkingBlock({
  userId,
  runId,
  sectionId,
  sectionLabel,
}: ThinkingBlockProps) {
  const [isOpen, setIsOpen] = useState(true);

  const activity = useResearchJobActivity({
    userId,
    activeRunId: runId,
  });

  const job = activity[sectionId];
  const updates = collapseResearchJobUpdates(job?.updates);
  const isRunning = job?.status === 'running';
  const isError = job?.status === 'error';

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left">
        {isOpen ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        )}
        <span className={cn(isRunning && 'animate-pulse')}>
          Researching {sectionLabel}…
        </span>
        {updates.length > 0 && (
          <span className="ml-auto text-xs text-muted-foreground">
            {updates.length} event{updates.length !== 1 ? 's' : ''}
          </span>
        )}
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mt-2 ml-5 space-y-1 border-l border-border pl-3">
          {updates.length === 0 && isRunning && (
            <p className="text-xs text-muted-foreground animate-pulse">
              Starting…
            </p>
          )}
          {updates.map((update) => (
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
          {isError && job?.error && (
            <p className="text-xs text-destructive mt-1">{job.error}</p>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
