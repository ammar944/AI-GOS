import type { ReactElement } from "react";
import { RunStatusBadge, type GtmRunStatus } from "@/components/gtm/RunStatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type GtmRunVisibilityStageStatus =
  | "queued"
  | "running"
  | "complete"
  | "blocked"
  | "timed_out"
  | "errored"
  | "pending";

export interface GtmRunVisibilityEvent {
  message: string;
  createdAt: string;
  eventType: string;
}

export interface GtmRunVisibilityBlocker {
  title: string;
  reason: string;
  remediation?: string;
}

export interface GtmRunVisibilityStage {
  stage: string;
  label: string;
  status: GtmRunVisibilityStageStatus;
  latestEvent: GtmRunVisibilityEvent | null;
  blocker: GtmRunVisibilityBlocker | null;
  pendingDependencyReason: string | null;
  elapsedMs: number | null;
}

export interface GtmRunVisibilityPanelData {
  runStatus: GtmRunStatus;
  eventCount: number;
  blockerCount: number;
  stages: GtmRunVisibilityStage[];
}

interface GtmRunVisibilityPanelProps {
  visibility: GtmRunVisibilityPanelData;
  onRerunStage?: (stage: string) => void | Promise<void>;
  rerunningStage?: string | null;
  rerunError?: string | null;
  rerunErrorStage?: string | null;
}

const STAGE_STATUS_STYLES: Record<
  GtmRunVisibilityStageStatus,
  {
    label: string;
    className: string;
  }
> = {
  queued: {
    label: "Queued",
    className: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  },
  running: {
    label: "Running",
    className:
      "border-primary/30 bg-primary/10 text-primary dark:text-primary-foreground",
  },
  complete: {
    label: "Complete",
    className:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  },
  blocked: {
    label: "Blocked",
    className:
      "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  },
  timed_out: {
    label: "Timed out",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
  },
  errored: {
    label: "Errored",
    className:
      "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
  },
  pending: {
    label: "Waiting",
    className: "border-border bg-muted/60 text-muted-foreground",
  },
};

export function GtmRunVisibilityPanel({
  visibility,
  onRerunStage,
  rerunningStage = null,
  rerunError = null,
  rerunErrorStage = null,
}: GtmRunVisibilityPanelProps): ReactElement {
  const activeStage = getActiveStage(visibility.stages);
  const summary = getHeaderSummary(visibility.runStatus, activeStage);

  return (
    <section
      aria-label="GTM run visibility"
      className="overflow-hidden rounded-lg border border-border bg-card/60"
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <p className="font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
            Run visibility
          </p>
          <h2 className="mt-1 text-base font-semibold tracking-normal text-foreground">
            {summary}
          </h2>
          {activeStage?.latestEvent ? (
            <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
              {activeStage.latestEvent.message}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RunStatusBadge status={visibility.runStatus} />
          <Badge variant="outline" className="font-mono text-xs">
            {visibility.eventCount} events
          </Badge>
          {visibility.blockerCount > 0 ? (
            <Badge
              variant="outline"
              className="border-yellow-500/40 text-yellow-700 dark:text-yellow-300"
            >
              {visibility.blockerCount} blockers
            </Badge>
          ) : null}
        </div>
      </div>

      <ol className="divide-y divide-border">
        {visibility.stages.map((stage) => (
          <StageVisibilityRow
            key={stage.stage}
            stage={stage}
            onRerunStage={onRerunStage}
            rerunningStage={rerunningStage}
            rerunError={rerunError}
            rerunErrorStage={rerunErrorStage}
          />
        ))}
      </ol>
    </section>
  );
}

function StageVisibilityRow({
  stage,
  onRerunStage,
  rerunningStage,
  rerunError,
  rerunErrorStage,
}: {
  stage: GtmRunVisibilityStage;
  onRerunStage?: (stage: string) => void | Promise<void>;
  rerunningStage: string | null;
  rerunError: string | null;
  rerunErrorStage: string | null;
}): ReactElement {
  const canRerun = isRerunnableStageStatus(stage.status);
  const isRerunning = rerunningStage === stage.stage;
  const shouldShowError =
    rerunError !== null &&
    (rerunErrorStage === stage.stage ||
      (rerunErrorStage === null && isRerunning));

  return (
    <li className="grid gap-2 px-4 py-3 sm:grid-cols-[12rem_1fr] sm:gap-4">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate font-mono text-sm font-medium text-foreground">
            {stage.label}
          </span>
          <StageStatusBadge status={stage.status} />
        </div>
        {stage.elapsedMs !== null ? (
          <p className="mt-1 font-mono text-xs text-muted-foreground">
            {formatElapsed(stage.elapsedMs)}
          </p>
        ) : null}
      </div>

      <div className="min-w-0 text-sm">
        {stage.latestEvent ? (
          <div className="min-w-0">
            <p className="line-clamp-2 text-foreground">
              {stage.latestEvent.message}
            </p>
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              {formatEventTime(stage.latestEvent.createdAt)}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">No stage events yet.</p>
        )}

        {stage.pendingDependencyReason ? (
          <p className="mt-2 rounded-md border border-border bg-muted/40 px-2 py-1.5 text-xs text-muted-foreground">
            {stage.pendingDependencyReason}
          </p>
        ) : null}

        {stage.blocker ? (
          <div className="mt-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 px-2 py-1.5 text-xs text-yellow-800 dark:text-yellow-200">
            <p className="font-medium">{stage.blocker.title}</p>
            <p className="mt-1">{stage.blocker.reason}</p>
            {stage.blocker.remediation ? (
              <p className="mt-1 text-yellow-700 dark:text-yellow-300">
                {stage.blocker.remediation}
              </p>
            ) : null}
          </div>
        ) : null}

        {canRerun ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 px-2 text-xs"
              disabled={isRerunning || !onRerunStage}
              onClick={() => {
                if (!onRerunStage) {
                  return;
                }

                void onRerunStage(stage.stage);
              }}
            >
              {isRerunning ? "Rerunning..." : "Rerun stage"}
            </Button>
            {shouldShowError ? (
              <p className="text-xs text-destructive">{rerunError}</p>
            ) : null}
          </div>
        ) : null}
      </div>
    </li>
  );
}

function StageStatusBadge({
  status,
}: {
  status: GtmRunVisibilityStageStatus;
}): ReactElement {
  const style = STAGE_STATUS_STYLES[status];

  return (
    <Badge variant="outline" className={cn("text-xs", style.className)}>
      {style.label}
    </Badge>
  );
}

function getActiveStage(
  stages: readonly GtmRunVisibilityStage[],
): GtmRunVisibilityStage | null {
  return (
    stages.find((stage) => stage.status === "running") ??
    stages.find((stage) => stage.status === "queued") ??
    stages.find((stage) => stage.status === "blocked") ??
    stages.find((stage) => stage.status === "errored") ??
    stages.find((stage) => stage.status === "timed_out") ??
    null
  );
}

function isRerunnableStageStatus(
  status: GtmRunVisibilityStageStatus,
): boolean {
  return status === "blocked" || status === "errored" || status === "timed_out";
}

function getHeaderSummary(
  runStatus: GtmRunStatus,
  activeStage: GtmRunVisibilityStage | null,
): string {
  if (activeStage?.status === "running") {
    return `${activeStage.label} is running`;
  }

  if (activeStage?.status === "queued") {
    return `${activeStage.label} is queued`;
  }

  if (activeStage?.status === "blocked") {
    return `${activeStage.label} is blocked`;
  }

  if (activeStage?.status === "errored" || activeStage?.status === "timed_out") {
    return `${activeStage.label} needs attention`;
  }

  if (runStatus === "completed") {
    return "All visible stages are complete";
  }

  if (runStatus === "queued") {
    return "Run is waiting to start";
  }

  return "Visible stage map is ready";
}

function formatElapsed(elapsedMs: number): string {
  const totalSeconds = Math.max(0, Math.round(elapsedMs / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes < 1) {
    return `${seconds}s elapsed`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 1) {
    return `${minutes}m ${seconds}s elapsed`;
  }

  return `${hours}h ${remainingMinutes}m elapsed`;
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
