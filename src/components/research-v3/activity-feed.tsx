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
  ALL_POSITIONING_SECTION_IDS,
  ALL_POSITIONING_SECTION_LABELS,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';

import { SECTION_ACCENT } from './section-card';

// ---------------------------------------------------------------------------

interface ActivityFeedProps {
  live: AuditStateResponse;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getEventMetadata(
  event: AuditStateResponse['eventsByZone'][string][number],
): Record<string, unknown> {
  const payload = asRecord(event.payload);
  return asRecord(payload?.metadata) ?? payload ?? {};
}

function formatToolName(value: unknown): string {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : 'tool';
}

function formatActivityEvent(
  event: AuditStateResponse['eventsByZone'][string][number],
): string {
  const metadata = getEventMetadata(event);
  const toolName = formatToolName(metadata.toolName);

  if (event.event_type === 'tool-started') {
    return `Query -> ${toolName}`;
  }

  if (event.event_type === 'tool-finished') {
    const gap = asRecord(metadata.gap);
    const gapMessage =
      typeof gap?.message === 'string' ? gap.message : undefined;
    const outputSummary =
      typeof metadata.outputSummary === 'string'
        ? metadata.outputSummary
        : undefined;
    return `Search -> ${toolName}${gapMessage || outputSummary ? `: ${gapMessage ?? outputSummary}` : ''}`;
  }

  if (event.event_type === 'structured-output-started') {
    const schemaName =
      typeof metadata.schemaName === 'string' ? metadata.schemaName : 'schema';
    return `Synthesis -> ${schemaName}`;
  }

  if (event.event_type === 'validation-failed') {
    const issues = Array.isArray(metadata.issues)
      ? metadata.issues.filter((issue): issue is string => typeof issue === 'string')
      : [];
    return `Validation -> ${issues[0] ?? 'failed'}`;
  }

  if (event.event_type === 'sub-section-committed') {
    const subSectionKey =
      typeof metadata.subSectionKey === 'string'
        ? metadata.subSectionKey
        : 'sub-section';
    return `Committed -> ${subSectionKey}`;
  }

  return event.message ?? event.event_type;
}

export function ActivityFeed({ live }: ActivityFeedProps) {
  const workerByZone = Object.fromEntries(
    live.workerStates.map((w) => [w.section_id, w]),
  ) as Partial<Record<AllPositioningSectionId, AuditStateResponse['workerStates'][number]>>;

  const hasAnyActivity = ALL_POSITIONING_SECTION_IDS.some(
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

        {ALL_POSITIONING_SECTION_IDS.map((zoneId, index) => {
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
                  {ALL_POSITIONING_SECTION_LABELS[zoneId]}
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
                          {formatActivityEvent(event)}
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
