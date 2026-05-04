"use client";

import { useMemo, useState } from "react";
import type { ReactElement } from "react";
import { Badge } from "@/components/ui/badge";
import {
  getGtmStageLabel,
  GTM_LIGHTHOUSE_STAGE_KEYS,
  normalizeGtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import { cn } from "@/lib/utils";

interface StageEventLogProps {
  events: GtmStageEvent[];
}

interface StageEventGroup {
  stage: string;
  label: string;
  events: GtmStageEvent[];
  headlineEvent: GtmStageEvent;
  latestEvent: GtmStageEvent;
  marker: EventMarker;
  latestEventTimeMs: number;
  sortIndex: number | null;
}

type EventSeverity = "normal" | "recovery" | "blocked" | "error";

interface EventMarker {
  label: string;
  severity: EventSeverity;
  className: string;
}

const SECONDARY_EVENT_TYPES = new Set<GtmStageEvent["event_type"]>([
  "artifact_written",
  "tool_call",
  "validation_started",
  "validation_passed",
  "validation_failed",
]);

const SEVERITY_PRIORITY: Record<EventSeverity, number> = {
  normal: 0,
  recovery: 1,
  blocked: 2,
  error: 3,
};

const STAGE_SORT_INDEX = new Map<string, number>(
  GTM_LIGHTHOUSE_STAGE_KEYS.map((stage, index) => [stage, index]),
);

export function StageEventLog({ events }: StageEventLogProps): ReactElement {
  const groups = useMemo(() => sortStageGroups(groupEventsByStage(events)), [
    events,
  ]);
  const latestGroupStage = getLatestGroupStage(groups);
  const [expandedStages, setExpandedStages] = useState<Set<string>>(
    () => new Set(),
  );

  return (
    <section className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Stage event log</h2>
        {groups.length > 0 ? (
          <span className="font-mono text-xs text-muted-foreground">
            {formatStageCount(groups.length)}
          </span>
        ) : null}
      </div>

      {groups.length === 0 ? (
        <p className="text-sm text-muted-foreground">No stage events yet.</p>
      ) : (
        <ol className="flex flex-col gap-3">
          {groups.map((group) => {
            const isExpanded = expandedStages.has(group.stage);
            const detailsId = `stage-event-log-${group.stage}`;

            return (
              <li
                key={group.stage}
                className={cn(
                  "rounded-md border bg-background/50",
                  getGroupBorderClassName(group.marker.severity),
                )}
              >
                <div className="flex flex-col gap-3 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3
                          data-testid="stage-event-log-stage"
                          className="font-mono text-sm font-medium text-foreground"
                        >
                          {group.label}
                        </h3>
                        <Badge
                          variant="outline"
                          className={cn("text-xs", group.marker.className)}
                        >
                          {group.marker.label}
                        </Badge>
                        {latestGroupStage === group.stage ? (
                          <Badge variant="outline" className="text-xs">
                            Latest activity
                          </Badge>
                        ) : null}
                      </div>
                      <p className="mt-2 line-clamp-2 text-sm text-foreground">
                        {group.headlineEvent.message}
                      </p>
                      {group.headlineEvent !== group.latestEvent ? (
                        <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">
                          Latest activity: {group.latestEvent.message}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-start gap-1 sm:items-end">
                      <span className="font-mono text-xs text-muted-foreground">
                        {formatEventTime(group.latestEvent.created_at)}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {formatEventCount(group.events.length)}
                      </Badge>
                    </div>
                  </div>

                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={detailsId}
                    aria-label={`${isExpanded ? "Collapse" : "Expand"} ${group.label} event history`}
                    className="w-fit text-xs font-medium text-primary underline-offset-4 hover:underline"
                    onClick={() => toggleExpandedStage(group.stage, setExpandedStages)}
                  >
                    {isExpanded ? "Hide full history" : "Show full history"}
                  </button>
                </div>

                {isExpanded ? (
                  <ol
                    id={detailsId}
                    aria-label={`${group.label} full event history`}
                    className="divide-y divide-border border-t border-border"
                  >
                    {group.events.map((event) => (
                      <StageEventRow key={getEventKey(event)} event={event} />
                    ))}
                  </ol>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

function StageEventRow({ event }: { event: GtmStageEvent }): ReactElement {
  const marker = getEventMarker(event);

  return (
    <li className="grid gap-2 px-3 py-2 text-sm sm:grid-cols-[7rem_1fr] sm:gap-3">
      <span className="font-mono text-xs text-muted-foreground">
        {formatEventTime(event.created_at)}
      </span>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className={cn("text-xs", marker.className)}>
            {marker.label}
          </Badge>
          <span className="font-mono text-xs text-muted-foreground">
            {event.event_type}
          </span>
          {event.tool_name ? (
            <span className="font-mono text-xs text-muted-foreground">
              {event.tool_name}
            </span>
          ) : null}
        </div>
        <p className="mt-1 text-foreground">{event.message}</p>
        {event.error && event.error !== event.message ? (
          <p className="mt-1 text-xs text-destructive">{event.error}</p>
        ) : null}
        {event.artifact_path ? (
          <p className="mt-1 break-all font-mono text-xs text-muted-foreground">
            {event.artifact_path}
          </p>
        ) : null}
      </div>
    </li>
  );
}

function groupEventsByStage(events: GtmStageEvent[]): StageEventGroup[] {
  const groupedEvents = new Map<string, GtmStageEvent[]>();

  for (const event of events) {
    const stage = normalizeGtmLighthouseStage(event.stage) ?? event.stage;
    const stageEvents = groupedEvents.get(stage) ?? [];
    stageEvents.push(event);
    groupedEvents.set(stage, stageEvents);
  }

  return [...groupedEvents].map(([stage, stageEvents]) => {
    const orderedEvents = [...stageEvents].sort(compareEventsDescending);
    const latestEvent = orderedEvents[0];
    const headlineEvent = getHeadlineEvent(orderedEvents);

    return {
      stage,
      label: getGtmStageLabel(stage),
      events: orderedEvents,
      headlineEvent,
      latestEvent,
      marker: getGroupMarker(orderedEvents),
      latestEventTimeMs: getEventTimeMs(latestEvent),
      sortIndex: STAGE_SORT_INDEX.get(stage) ?? null,
    };
  });
}

function sortStageGroups(groups: StageEventGroup[]): StageEventGroup[] {
  return [...groups].sort((a, b) => {
    if (a.sortIndex !== null && b.sortIndex !== null) {
      return a.sortIndex - b.sortIndex;
    }

    if (a.sortIndex !== null) {
      return -1;
    }

    if (b.sortIndex !== null) {
      return 1;
    }

    return a.label.localeCompare(b.label);
  });
}

function getHeadlineEvent(events: GtmStageEvent[]): GtmStageEvent {
  return (
    events.find((event) => !SECONDARY_EVENT_TYPES.has(event.event_type)) ??
    events[0]
  );
}

function getGroupMarker(events: GtmStageEvent[]): EventMarker {
  const markerEvent = [...events].sort(compareEventsByMarkerPriority)[0];
  return getEventMarker(markerEvent);
}

function compareEventsByMarkerPriority(
  a: GtmStageEvent,
  b: GtmStageEvent,
): number {
  const aSeverity = getEventSeverity(a);
  const bSeverity = getEventSeverity(b);
  const priorityDifference =
    SEVERITY_PRIORITY[bSeverity] - SEVERITY_PRIORITY[aSeverity];

  if (priorityDifference !== 0) {
    return priorityDifference;
  }

  return compareEventsDescending(a, b);
}

function compareEventsDescending(
  a: GtmStageEvent,
  b: GtmStageEvent,
): number {
  return getEventTimeMs(b) - getEventTimeMs(a);
}

function getEventSeverity(event: GtmStageEvent): EventSeverity {
  if (
    event.event_type === "errored" ||
    event.event_type === "timed_out" ||
    event.status === "errored" ||
    event.status === "timed_out"
  ) {
    return "error";
  }

  if (event.event_type === "blocked" || event.status === "blocked") {
    return "blocked";
  }

  if (isRecoveryEvent(event)) {
    return "recovery";
  }

  return "normal";
}

function getEventMarker(event: GtmStageEvent): EventMarker {
  if (event.event_type === "timed_out" || event.status === "timed_out") {
    return {
      label: "Timed out",
      severity: "error",
      className:
        "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
    };
  }

  const severity = getEventSeverity(event);

  if (severity === "error") {
    return {
      label: "Error",
      severity,
      className:
        "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
    };
  }

  if (severity === "blocked") {
    return {
      label: "Blocked",
      severity,
      className:
        "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    };
  }

  if (severity === "recovery") {
    return {
      label: "Recovery",
      severity,
      className:
        "border-blue-500/40 bg-blue-500/10 text-blue-700 dark:text-blue-300",
    };
  }

  return {
    label: "Activity",
    severity: "normal",
    className: "border-border bg-muted/60 text-muted-foreground",
  };
}

function isRecoveryEvent(event: GtmStageEvent): boolean {
  if (event.event_type !== "queued") {
    return false;
  }

  if (event.metadata?.rerun === true) {
    return true;
  }

  return /user[-\s]?requested rerun|requested rerun|rerun requested/i.test(
    event.message,
  );
}

function getGroupBorderClassName(severity: EventSeverity): string {
  if (severity === "error") {
    return "border-destructive/35";
  }

  if (severity === "blocked") {
    return "border-yellow-500/35";
  }

  if (severity === "recovery") {
    return "border-blue-500/35";
  }

  return "border-border";
}

function getLatestGroupStage(groups: StageEventGroup[]): string | null {
  let latestGroup: StageEventGroup | null = null;

  for (const group of groups) {
    if (
      latestGroup === null ||
      group.latestEventTimeMs > latestGroup.latestEventTimeMs
    ) {
      latestGroup = group;
    }
  }

  return latestGroup?.stage ?? null;
}

function toggleExpandedStage(
  stage: string,
  setExpandedStages: React.Dispatch<React.SetStateAction<Set<string>>>,
): void {
  setExpandedStages((previousStages) => {
    const nextStages = new Set(previousStages);

    if (nextStages.has(stage)) {
      nextStages.delete(stage);
    } else {
      nextStages.add(stage);
    }

    return nextStages;
  });
}

function getEventKey(event: GtmStageEvent): string {
  return event.id ?? `${event.stage}-${event.event_type}-${event.created_at}`;
}

function getEventTimeMs(event: GtmStageEvent): number {
  const timeMs = Date.parse(event.created_at);
  return Number.isNaN(timeMs) ? 0 : timeMs;
}

function formatStageCount(count: number): string {
  return count === 1 ? "1 stage" : `${count} stages`;
}

function formatEventCount(count: number): string {
  return count === 1 ? "1 event" : `${count} events`;
}

function formatEventTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
