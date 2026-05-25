'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning';
import { TaskItem } from '@/components/ai-elements/task';
import {
  Sources,
  Source,
  SourcesContent,
  SourcesTrigger,
} from '@/components/ai-elements/sources';
import type { AuditStateResponse } from '@/app/api/research-v2/audit-state/route';
import {
  POSITIONING_SECTION_IDS,
  POSITIONING_SECTION_LABELS,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

import { SECTION_ACCENT } from './section-card';

// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  live: AuditStateResponse;
}

export function ActivityFeed({ live }: ActivityFeedProps) {
  const workerByZone = Object.fromEntries(
    live.workerStates.map((w) => [w.section_id, w]),
  ) as Partial<Record<PositioningSectionId, AuditStateResponse['workerStates'][number]>>;

  const hasAnyActivity = POSITIONING_SECTION_IDS.some(
    (zoneId) => (live.eventsByZone[zoneId]?.length ?? 0) > 0,
  );

  return (
    <ScrollArea className="h-full w-full">
      <div className="flex flex-col gap-0 px-3 py-4">
        <p
          className="mb-4 text-[10px] font-semibold uppercase tracking-[0.1em]"
          style={{ color: 'var(--text-tertiary)' }}
        >
          Live Activity
        </p>

        {!hasAnyActivity && (
          <p
            className="text-xs"
            style={{ color: 'var(--text-quaternary)' }}
          >
            Waiting for sections to start…
          </p>
        )}

        {POSITIONING_SECTION_IDS.map((zoneId, index) => {
          const events = live.eventsByZone[zoneId] ?? [];
          const worker = workerByZone[zoneId];
          const isRunning = worker?.status === 'running';
          const isComplete = worker?.status === 'complete';
          const accentColor = SECTION_ACCENT[zoneId];

          if (events.length === 0 && !isRunning && !isComplete) return null;

          // Collect sources from latestSource when complete
          const sources = isComplete && worker?.latestSource
            ? [{ url: worker.latestSource, title: worker.latestSource }]
            : [];

          return (
            <div key={zoneId}>
              {index > 0 && <Separator className="my-3" />}

              {/* Section label row */}
              <div className="mb-2 flex items-center gap-2">
                <span
                  className="inline-block h-1.5 w-1.5 rounded-full flex-shrink-0"
                  style={{ background: accentColor }}
                />
                <span
                  className="text-[10px] font-semibold uppercase tracking-[0.06em] truncate"
                  style={{ color: accentColor }}
                >
                  {POSITIONING_SECTION_LABELS[zoneId]}
                </span>
              </div>

              {/* Activity reasoning block */}
              <Reasoning isStreaming={isRunning} defaultOpen={isRunning}>
                <ReasoningTrigger />
                <ReasoningContent>
                  <div className="space-y-1">
                    {events.length > 0 ? (
                      events.map((event) => (
                        <TaskItem key={event.id}>
                          <span className="font-mono text-[10px] text-muted-foreground mr-2">
                            {new Date(event.created_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          {event.message ?? event.event_type}
                        </TaskItem>
                      ))
                    ) : (
                      <TaskItem>
                        {worker?.latestActivity ?? 'Processing…'}
                      </TaskItem>
                    )}
                  </div>
                </ReasoningContent>
              </Reasoning>

              {/* Sources — shown once complete */}
              {isComplete && sources.length > 0 && (
                <Sources className="mt-2">
                  <SourcesTrigger count={sources.length} />
                  <SourcesContent>
                    {sources.map((src) => (
                      <Source key={src.url} href={src.url} title={src.title} />
                    ))}
                  </SourcesContent>
                </Sources>
              )}
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}
