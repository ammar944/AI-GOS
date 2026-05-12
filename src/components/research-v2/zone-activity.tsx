'use client';

import { useMemo } from 'react';

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai/reasoning';
import { Shimmer } from '@/components/ai/shimmer';
import {
  useResearchJobActivity,
  collapseResearchJobUpdates,
  type ResearchJobUpdate,
} from '@/lib/journey/research-job-activity';
import { cn } from '@/lib/utils';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';

interface ZoneActivityProps {
  userId: string;
  runId: string;
  sectionId: PositioningSectionId;
  isRunning: boolean;
  isComplete: boolean;
  className?: string;
}

const PHASE_ICON: Record<string, string> = {
  tool: '🔍',
  'tool-start': '🔍',
  'tool-finish': '✓',
  analysis: '🧠',
  thinking: '💭',
  artifact: '📄',
  output: '✓',
  heartbeat: '⏱',
  error: '✗',
};

function formatTimestamp(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '';
  }
}

function deriveDurationSeconds(updates: ResearchJobUpdate[]): number | undefined {
  if (updates.length === 0) return undefined;
  const first = updates[0]?.at;
  const last = updates[updates.length - 1]?.at;
  if (!first || !last) return undefined;
  try {
    const ms = new Date(last).getTime() - new Date(first).getTime();
    if (!Number.isFinite(ms) || ms < 0) return undefined;
    return Math.round(ms / 1000);
  } catch {
    return undefined;
  }
}

export function ZoneActivity({
  userId,
  runId,
  sectionId,
  isRunning,
  isComplete,
  className,
}: ZoneActivityProps) {
  const activity = useResearchJobActivity({ userId, activeRunId: runId });
  const job = activity[sectionId];
  const collapsed = useMemo(
    () => collapseResearchJobUpdates(job?.updates),
    [job?.updates],
  );
  const duration = useMemo(() => deriveDurationSeconds(collapsed), [collapsed]);

  if (collapsed.length === 0 && !isRunning) {
    return null;
  }

  return (
    <Reasoning
      isStreaming={isRunning}
      duration={duration}
      defaultOpen={isRunning}
      className={cn('w-full', className)}
    >
      <ReasoningTrigger />
      <ReasoningContent className="space-y-1.5">
        {collapsed.length === 0 && isRunning ? (
          <Shimmer className="text-xs">Preparing research…</Shimmer>
        ) : null}
        {collapsed.map((u, idx) => {
          const phase = String(u.phase ?? 'thinking');
          const icon = PHASE_ICON[phase] ?? '·';
          const isLast = idx === collapsed.length - 1;
          const isLive = isRunning && isLast;
          return (
            <div key={`${u.at}-${idx}`} className="flex items-start gap-2 text-xs">
              <span className="shrink-0 tabular-nums text-[10px] text-muted-foreground/70 mt-px w-16">
                {formatTimestamp(u.at)}
              </span>
              <span className="shrink-0">{icon}</span>
              <span className="flex-1 min-w-0">
                {isLive ? (
                  <Shimmer className="text-xs">{u.message}</Shimmer>
                ) : (
                  <span className={cn('break-words', isComplete && 'text-muted-foreground')}>
                    {u.message}
                  </span>
                )}
              </span>
            </div>
          );
        })}
      </ReasoningContent>
    </Reasoning>
  );
}
