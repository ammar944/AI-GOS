"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement, ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type { UIMessage } from "ai";
import type {
  AgentInvocation,
  AgentInvocationStatus,
  AgentInvocationSkill,
} from "@/components/gtm/AgentInvocationBlock";
import { ChatMessage } from "@/components/gtm/ChatMessage";
import {
  GtmRunVisibilityPanel,
  type GtmRunVisibilityBlocker,
  type GtmRunVisibilityPanelData,
  type GtmRunVisibilityStageStatus,
} from "@/components/gtm/GtmRunVisibilityPanel";
import { GtmPrefillReviewPanel } from "@/components/gtm/GtmPrefillReviewPanel";
import {
  RunStatusBadge,
  type GtmRunStatus,
} from "@/components/gtm/RunStatusBadge";
import { RunArtifactsSection } from "@/components/gtm/RunArtifactsSection";
import { StageEventLog } from "@/components/gtm/StageEventLog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getGtmStageLabel,
  getInvocationSkillForStage,
  GTM_LIGHTHOUSE_STAGE_KEYS,
  normalizeGtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";
import {
  getGtmAgentMessageDisplayText,
  type GtmAgentMessage,
} from "@/lib/gtm/agent-messages";
import {
  buildGtmPrefillManifestFromDiscovery,
  getGtmPrefillManifestFromRunManifest,
  upsertGtmPrefillManifest,
  type GtmPrefillManifest,
} from "@/lib/gtm/onboarding/prefill";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmStageStatus } from "@/lib/gtm/stage-state";
import type { IngestUrlOutput } from "@/lib/gtm/types";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";
import { cn } from "@/lib/utils";

export interface GtmStageState {
  status?: GtmStageStatus;
  started_at?: string;
  completed_at?: string;
  accepted_at?: string;
  output?: unknown;
  raw_output?: unknown;
  summary?: string;
  source_gaps?: unknown[];
  tool_calls?: unknown[];
  artifacts?: Record<string, string>;
  validation?: unknown;
  duration_ms?: number;
  error?: string;
  worker_job_id?: string;
}

export interface ChatShellRun {
  run_id: string;
  input_url: string;
  status: GtmRunStatus;
  manifest?: Record<string, unknown> | null;
  stages: Record<string, GtmStageState> | null;
  created_at: string;
  updated_at?: string;
}

interface ChatShellProps {
  run: ChatShellRun;
  initialEvents?: GtmStageEvent[];
  initialArtifacts?: GtmArtifact[];
  initialMessages?: GtmAgentMessage[];
  visibility?: GtmRunVisibilityPanelData;
}

const EMPTY_EVENTS: GtmStageEvent[] = [];
const EMPTY_ARTIFACTS: GtmArtifact[] = [];
const EMPTY_MESSAGES: GtmAgentMessage[] = [];

export function ChatShell({
  run,
  initialEvents = EMPTY_EVENTS,
  initialArtifacts = EMPTY_ARTIFACTS,
  initialMessages = EMPTY_MESSAGES,
  visibility,
}: ChatShellProps): ReactElement {
  const [currentRun, setCurrentRun] = useState(run);
  const [events, setEvents] = useState(initialEvents);
  const [artifacts, setArtifacts] = useState(initialArtifacts);
  const [currentVisibility, setCurrentVisibility] = useState(visibility);
  const [rerunningStage, setRerunningStage] = useState<string | null>(null);
  const [rerunError, setRerunError] = useState<string | null>(null);
  const [rerunErrorStage, setRerunErrorStage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const stageEntries = getOrderedStageEntries(currentRun.stages);
  const companyName = getHostnameLabel(currentRun.input_url);
  const prefill = useMemo(() => {
    return getPrefillForRun(currentRun);
  }, [currentRun]);
  const initialChatMessages = useMemo(() => {
    return mapPersistedMessagesToUiMessages(initialMessages);
  }, [initialMessages]);

  const refreshArtifacts = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/gtm/runs/${encodeURIComponent(currentRun.run_id)}/artifacts`,
      );
      if (!res.ok) return;
      const payload = (await res.json()) as { artifacts?: GtmArtifact[] };
      if (Array.isArray(payload.artifacts)) {
        setArtifacts(payload.artifacts);
      }
    } catch (err) {
      console.error("Failed to refresh GTM artifacts:", err);
    }
  }, [currentRun.run_id]);

  const refreshRun = useCallback(
    async (options?: { shouldApply?: () => boolean }): Promise<void> => {
      try {
        const response = await fetch(
          `/api/gtm/runs/${encodeURIComponent(currentRun.run_id)}`,
          {
            method: "GET",
            credentials: "include",
          },
        );
        if (!response.ok) {
          console.warn("GTM run refresh failed", {
            run_id: currentRun.run_id,
            status: response.status,
          });
          return;
        }

        const payload = (await response.json()) as unknown;
        if (!isRunPayload(payload) || options?.shouldApply?.() === false) {
          return;
        }

        setCurrentRun(payload.run);
        setEvents(payload.events);
        setCurrentVisibility((previousVisibility) => {
          return previousVisibility
            ? mergeVisibilityFromRunPayload(
                previousVisibility,
                payload.run,
                payload.events,
              )
            : previousVisibility;
        });
      } catch (error: unknown) {
        console.warn("GTM run refresh failed", {
          run_id: currentRun.run_id,
          error: getErrorMessage(error),
        });
      }
    },
    [currentRun.run_id],
  );

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: `/api/gtm/runs/${encodeURIComponent(currentRun.run_id)}/chat`,
      }),
    [currentRun.run_id],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    messages: initialChatMessages,
    onFinish: () => {
      void refreshArtifacts();
    },
  });
  const visibleMessages = useMemo(() => {
    return getDisplayableMessages(messages);
  }, [messages]);

  const inputDisabled = status === "submitted" || status === "streaming";

  function handleSubmit(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault();
    const text = inputValue.trim();
    if (!text || inputDisabled) return;
    void sendMessage({ text });
    setInputValue("");
  }

  const handleRerunStage = useCallback(
    async (stage: string): Promise<void> => {
      const acceptedAt = new Date().toISOString();
      setRerunningStage(stage);
      setRerunError(null);
      setRerunErrorStage(stage);

      try {
        const response = await fetch(
          `/api/gtm/runs/${encodeURIComponent(currentRun.run_id)}/dispatch`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            credentials: "include",
            body: JSON.stringify({
              stage,
              rerun: true,
            }),
          },
        );
        const payload = await readResponseJson(response);

        if (!response.ok) {
          setRerunError(
            getRerunRequestErrorMessage({
              payload,
              response,
              runId: currentRun.run_id,
              stage,
            }),
          );
          setRerunErrorStage(stage);
          return;
        }

        setCurrentRun((previousRun) => {
          return queueRunStageLocally(previousRun, stage, acceptedAt);
        });
        setCurrentVisibility((previousVisibility) => {
          return previousVisibility
            ? queueVisibilityStageLocally(previousVisibility, stage, acceptedAt)
            : previousVisibility;
        });
        await refreshRun();
      } catch (error: unknown) {
        setRerunError(
          `Rerun request failed for run_id=${currentRun.run_id} stage=${stage}: ${getErrorMessage(error)}`,
        );
        setRerunErrorStage(stage);
      } finally {
        setRerunningStage(null);
      }
    },
    [currentRun.run_id, refreshRun],
  );

  const handlePrefillConfirmed = useCallback((nextPrefill: GtmPrefillManifest): void => {
    setCurrentRun((previousRun) => {
      return {
        ...previousRun,
        manifest: upsertGtmPrefillManifest(previousRun.manifest, nextPrefill),
      };
    });
  }, []);

  useEffect(() => {
    setCurrentRun(run);
  }, [run]);

  useEffect(() => {
    setEvents(initialEvents);
  }, [initialEvents]);

  useEffect(() => {
    setCurrentVisibility(visibility);
  }, [visibility]);

  useEffect(() => {
    if (!shouldPollRun(currentRun)) {
      return;
    }

    let cancelled = false;

    void refreshRun({
      shouldApply: () => !cancelled,
    });
    const interval = window.setInterval(() => {
      void refreshRun({
        shouldApply: () => !cancelled,
      });
    }, 2500);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [currentRun, refreshRun]);

  function copyLink(): void {
    void navigator.clipboard.writeText(window.location.href);
    setCopied(true);
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 py-4 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-xs uppercase tracking-[0.06em] text-muted-foreground">
                AIGOS · Pre-Pitch Audit
              </p>
              <h1 className="mt-1 truncate text-xl font-semibold tracking-normal text-foreground">
                {companyName}
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <RunStatusBadge status={currentRun.status} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copyLink}
              >
                {copied ? "Copied" : "Copy link"}
              </Button>
            </div>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
            <span className="truncate">{currentRun.input_url}</span>
            <span className="font-mono text-xs">{currentRun.run_id}</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 px-4 py-8 sm:px-6">
        <LiveAgentActivitySummary
          run={currentRun}
          events={events}
          artifacts={artifacts}
        />

        {currentVisibility ? (
          <GtmRunVisibilityPanel
            visibility={currentVisibility}
            onRerunStage={handleRerunStage}
            rerunningStage={rerunningStage}
            rerunError={rerunError}
            rerunErrorStage={rerunErrorStage}
          />
        ) : null}

        <GtmPrefillReviewPanel
          runId={currentRun.run_id}
          prefill={prefill}
          onConfirmed={handlePrefillConfirmed}
        />

        <ChatMessage variant="user">{currentRun.input_url}</ChatMessage>

        <StageEventLog events={events} />

        <RunArtifactsSection
          artifacts={artifacts}
          runId={currentRun.run_id}
          stageEvents={events}
        />

        {stageEntries.length === 0 && visibleMessages.length === 0 ? (
          <ChatMessage variant="agent-text">
            Run queued. Waiting for orchestrator to start...
          </ChatMessage>
        ) : (
          stageEntries.map(([stageName, stage]) => (
            <StageMessage
              key={stageName}
              stageName={stageName}
              stage={stage}
            />
          ))
        )}

        {visibleMessages.map((m) => (
          <ChatMessage
            key={m.id}
            variant={m.role === "user" ? "user" : "agent-text"}
          >
            {extractText(m)}
          </ChatMessage>
        ))}
      </main>

      <footer className="sticky bottom-0 border-t border-border bg-background/95 backdrop-blur">
        <div className="mx-auto w-full max-w-3xl px-4 py-4 sm:px-6">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              placeholder={
                stageEntries.length === 0
                  ? `Try: run the audit on ${currentRun.input_url}`
                  : "Refine an artifact, ask a question, or run another skill..."
              }
              aria-label="Chat input"
              className="h-10"
              autoFocus
            />
            <Button
              type="submit"
              disabled={inputDisabled || inputValue.trim().length === 0}
            >
              {inputDisabled ? "..." : "Send"}
            </Button>
          </form>
        </div>
      </footer>
    </div>
  );
}

interface LiveAgentActivitySnapshot {
  headline: string;
  latestAction: string;
  progressLabel: string;
  sourceCount: number;
  toolCallCount: number;
  artifactCount: number;
  sourceGapCount: number;
  blockerCount: number;
  sourceUrls: string[];
  tone: "blocked" | "complete" | "live" | "waiting";
}

function LiveAgentActivitySummary({
  run,
  events,
  artifacts,
}: {
  run: ChatShellRun;
  events: GtmStageEvent[];
  artifacts: GtmArtifact[];
}): ReactElement {
  const snapshot = useMemo(() => {
    return getLiveAgentActivitySnapshot(run, events, artifacts);
  }, [run, events, artifacts]);

  return (
    <section className="overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
      <div className="border-b border-border px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-mono text-xs font-medium uppercase tracking-[0.06em] text-muted-foreground">
              Live agent activity
            </h2>
            <p className="mt-1 text-base font-semibold tracking-normal text-foreground">
              {snapshot.headline}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {snapshot.latestAction}
            </p>
          </div>
          <span
            className={cn(
              "inline-flex h-8 shrink-0 items-center rounded-full border px-3 font-mono text-xs",
              getLiveActivityToneClassName(snapshot.tone),
            )}
          >
            {snapshot.progressLabel}
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <LiveActivityPill tone={snapshot.sourceCount > 0 ? "source" : "muted"}>
            {snapshot.sourceCount > 0
              ? formatLiveActivityCount(snapshot.sourceCount, "source")
              : "No sources yet"}
          </LiveActivityPill>
          <LiveActivityPill tone={snapshot.toolCallCount > 0 ? "tool" : "muted"}>
            {snapshot.toolCallCount > 0
              ? formatLiveActivityCount(snapshot.toolCallCount, "tool call")
              : "No tool calls yet"}
          </LiveActivityPill>
          <LiveActivityPill tone={snapshot.artifactCount > 0 ? "artifact" : "muted"}>
            {snapshot.artifactCount > 0
              ? formatLiveActivityCount(snapshot.artifactCount, "artifact")
              : "No artifacts yet"}
          </LiveActivityPill>
          {snapshot.blockerCount > 0 ? (
            <LiveActivityPill tone="blocked">
              {formatLiveActivityCount(snapshot.blockerCount, "blocker")}
            </LiveActivityPill>
          ) : snapshot.sourceGapCount > 0 ? (
            <LiveActivityPill tone="gap">
              {formatLiveActivityCount(snapshot.sourceGapCount, "source gap")}
            </LiveActivityPill>
          ) : (
            <LiveActivityPill tone="clear">No source gaps reported</LiveActivityPill>
          )}
        </div>

        {snapshot.sourceUrls.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {snapshot.sourceUrls.slice(0, 3).map((sourceUrl) => (
              <a
                key={sourceUrl}
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full rounded-full border border-border bg-background px-2.5 py-1 font-mono text-[11px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                <span className="truncate">{formatSourceHost(sourceUrl)}</span>
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}

function LiveActivityPill({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "artifact" | "blocked" | "clear" | "gap" | "muted" | "source" | "tool";
}): ReactElement {
  const toneClassName: Record<typeof tone, string> = {
    artifact: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300",
    blocked:
      "border-destructive/40 bg-destructive/10 text-destructive dark:text-red-300",
    clear:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    gap: "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
    muted: "border-border bg-muted/40 text-muted-foreground",
    source:
      "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    tool: "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300",
  };

  return (
    <span
      className={cn(
        "inline-flex h-6 items-center rounded-full border px-2 font-mono text-[11px]",
        toneClassName[tone],
      )}
    >
      {children}
    </span>
  );
}

function getLiveAgentActivitySnapshot(
  run: ChatShellRun,
  events: GtmStageEvent[],
  artifacts: GtmArtifact[],
): LiveAgentActivitySnapshot {
  const stageEntries = getOrderedStageEntries(run.stages);
  const activeStage = getActiveStageEntry(stageEntries);
  const latestEvent = activeStage
    ? getLatestEventForStage(events, activeStage[0])
    : getLatestEvent(events);
  const completedStageCount = stageEntries.filter(([, stage]) => {
    return stage.status === "complete";
  }).length;
  const totalStageCount =
    stageEntries.length > 0 ? stageEntries.length : GTM_LIGHTHOUSE_STAGE_KEYS.length;
  const sourceUrls = getEventSourceUrls(events);
  const blockerCount = countRunBlockers(stageEntries, events);
  const sourceGapCount = countRunSourceGaps(stageEntries);
  const headline = activeStage
    ? `${getGtmStageLabel(activeStage[0])} is ${getStageActivityVerb(activeStage[0], activeStage[1].status)}`
    : getRunActivityHeadline(run.status);

  return {
    headline,
    latestAction: latestEvent?.message ?? getRunActivityFallback(run.status),
    progressLabel: `${completedStageCount}/${totalStageCount} stages complete`,
    sourceCount: sourceUrls.length,
    toolCallCount: getEventToolNames(events).length,
    artifactCount: artifacts.length,
    sourceGapCount,
    blockerCount,
    sourceUrls,
    tone: getLiveActivityTone(run.status, activeStage?.[1].status),
  };
}

function getActiveStageEntry(
  stageEntries: [string, GtmStageState][],
): [string, GtmStageState] | null {
  return (
    stageEntries.find(([, stage]) => stage.status === "running") ??
    stageEntries.find(([, stage]) => stage.status === "queued") ??
    stageEntries.find(([, stage]) => stage.status === "blocked") ??
    stageEntries.find(([, stage]) => stage.status === "errored") ??
    stageEntries.find(([, stage]) => stage.status === "timed_out") ??
    null
  );
}

function getStageActivityVerb(
  stageName: string,
  status: GtmStageStatus | undefined,
): string {
  if (status === "running") {
    return stageName.startsWith("research-") ? "researching" : "working";
  }

  if (status === "queued") {
    return "waiting";
  }

  if (status === "blocked") {
    return "blocked";
  }

  if (status === "errored" || status === "timed_out") {
    return "needing attention";
  }

  return "ready";
}

function getRunActivityHeadline(status: GtmRunStatus): string {
  if (status === "completed") {
    return "Run complete";
  }

  if (status === "awaiting_user") {
    return "Run is waiting for user action";
  }

  if (status === "failed") {
    return "Run needs attention";
  }

  if (status === "running" || status === "partial") {
    return "Research workspace is active";
  }

  return "Run is waiting to start";
}

function getRunActivityFallback(status: GtmRunStatus): string {
  if (status === "completed") {
    return "All visible stages that reported state have completed.";
  }

  if (status === "queued") {
    return "Waiting for the orchestrator to record the first stage event.";
  }

  return "Latest worker activity will appear here as stage events are recorded.";
}

function getLiveActivityTone(
  runStatus: GtmRunStatus,
  stageStatus: GtmStageStatus | undefined,
): LiveAgentActivitySnapshot["tone"] {
  if (
    runStatus === "awaiting_user" ||
    runStatus === "failed" ||
    stageStatus === "blocked" ||
    stageStatus === "errored" ||
    stageStatus === "timed_out"
  ) {
    return "blocked";
  }

  if (runStatus === "completed" || stageStatus === "complete") {
    return "complete";
  }

  if (runStatus === "running" || stageStatus === "running" || stageStatus === "queued") {
    return "live";
  }

  return "waiting";
}

function getLiveActivityToneClassName(
  tone: LiveAgentActivitySnapshot["tone"],
): string {
  if (tone === "blocked") {
    return "border-yellow-500/40 bg-yellow-500/10 text-yellow-700 dark:text-yellow-300";
  }

  if (tone === "complete") {
    return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  }

  if (tone === "live") {
    return "border-primary/30 bg-primary/10 text-primary";
  }

  return "border-border bg-muted/40 text-muted-foreground";
}

function getLatestEventForStage(
  events: readonly GtmStageEvent[],
  stageName: string,
): GtmStageEvent | null {
  const normalizedStage = normalizeGtmLighthouseStage(stageName) ?? stageName;
  return (
    events
      .filter((event) => {
        return (normalizeGtmLighthouseStage(event.stage) ?? event.stage) === normalizedStage;
      })
      .sort(compareStageEventsDescending)[0] ?? null
  );
}

function getLatestEvent(events: readonly GtmStageEvent[]): GtmStageEvent | null {
  return [...events].sort(compareStageEventsDescending)[0] ?? null;
}

function compareStageEventsDescending(
  left: GtmStageEvent,
  right: GtmStageEvent,
): number {
  return getStageEventTimeMs(right) - getStageEventTimeMs(left);
}

function getStageEventTimeMs(event: GtmStageEvent): number {
  const timeMs = Date.parse(event.created_at);
  return Number.isFinite(timeMs) ? timeMs : 0;
}

function getEventSourceUrls(events: readonly GtmStageEvent[]): string[] {
  return [
    ...new Set(
      events.flatMap((event) => {
        return event.source_url ? [event.source_url] : [];
      }),
    ),
  ];
}

function getEventToolNames(events: readonly GtmStageEvent[]): string[] {
  return [
    ...new Set(
      events.flatMap((event) => {
        return event.tool_name ? [event.tool_name] : [];
      }),
    ),
  ];
}

function countRunBlockers(
  stageEntries: readonly [string, GtmStageState][],
  events: readonly GtmStageEvent[],
): number {
  const blockedStages = new Set<string>();

  for (const [stageName, stage] of stageEntries) {
    if (
      stage.status === "blocked" ||
      stage.status === "errored" ||
      stage.status === "timed_out"
    ) {
      blockedStages.add(normalizeGtmLighthouseStage(stageName) ?? stageName);
    }
  }

  for (const event of events) {
    if (
      event.status === "blocked" ||
      event.status === "errored" ||
      event.status === "timed_out" ||
      event.event_type === "blocked" ||
      event.event_type === "errored" ||
      event.event_type === "timed_out"
    ) {
      blockedStages.add(normalizeGtmLighthouseStage(event.stage) ?? event.stage);
    }
  }

  return blockedStages.size;
}

function countRunSourceGaps(
  stageEntries: readonly [string, GtmStageState][],
): number {
  return stageEntries.reduce((count, [, stage]) => {
    return (
      count +
      countSourceGaps(stage.source_gaps) +
      countSourceGaps(getNestedSourceGaps(stage.output)) +
      countSourceGaps(getNestedSourceGaps(stage.raw_output))
    );
  }, 0);
}

function getNestedSourceGaps(value: unknown): unknown[] {
  if (!isRecord(value) || !Array.isArray(value.source_gaps)) {
    return [];
  }

  return value.source_gaps;
}

function countSourceGaps(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatLiveActivityCount(count: number, singular: string): string {
  return `${count} ${count === 1 ? singular : `${singular}s`}`;
}

function formatSourceHost(sourceUrl: string): string {
  try {
    const url = new URL(sourceUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return sourceUrl;
  }
}

function getPrefillForRun(run: ChatShellRun): GtmPrefillManifest | null {
  const manifestPrefill = getGtmPrefillManifestFromRunManifest(run.manifest);
  const discoverUrlState = run.stages?.["discover-url"];
  const discoverOutput = discoverUrlState?.output ?? discoverUrlState?.raw_output;

  if (
    manifestPrefill?.status === "discovering" &&
    discoverUrlState?.status === "complete" &&
    discoverOutput !== undefined
  ) {
    return buildGtmPrefillManifestFromDiscovery({
      runId: run.run_id,
      inputUrl: run.input_url,
      output: discoverOutput,
      existingPrefill: manifestPrefill,
    });
  }

  return manifestPrefill;
}

function mapPersistedMessagesToUiMessages(
  messages: readonly GtmAgentMessage[],
): UIMessage[] {
  return [...messages]
    .sort(compareCreatedAt)
    .flatMap((message) => {
      const text = getGtmAgentMessageDisplayText(message);
      if (text.length === 0) {
        return [];
      }

      return [
        {
          id: message.id,
          role: mapPersistedMessageRole(message.role),
          metadata: {
            persistedRole: message.role,
            messageType: message.message_type,
            createdAt: message.created_at,
          },
          parts: [{ type: "text" as const, text }],
        },
      ];
    });
}

function mapPersistedMessageRole(
  role: GtmAgentMessage["role"],
): UIMessage["role"] {
  if (role === "user" || role === "assistant" || role === "system") {
    return role;
  }

  return "assistant";
}

function getDisplayableMessages(messages: readonly UIMessage[]): UIMessage[] {
  const seenIds = new Set<string>();
  const displayableMessages: UIMessage[] = [];

  for (const message of messages) {
    if (seenIds.has(message.id)) {
      continue;
    }

    const text = extractText(message);
    if (text.length === 0) {
      continue;
    }

    seenIds.add(message.id);
    displayableMessages.push(message);
  }

  return displayableMessages;
}

function compareCreatedAt(
  left: { created_at: string },
  right: { created_at: string },
): number {
  const leftMs = Date.parse(left.created_at);
  const rightMs = Date.parse(right.created_at);

  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs - rightMs;
  }

  return left.created_at.localeCompare(right.created_at);
}

function extractText(message: Pick<UIMessage, "parts">): string {
  return message.parts
    .flatMap((part) => {
      if (
        part.type === "text" &&
        "text" in part &&
        typeof part.text === "string"
      ) {
        return [part.text];
      }

      return [];
    })
    .join("");
}

function queueRunStageLocally(
  run: ChatShellRun,
  stage: string,
  acceptedAt: string,
): ChatShellRun {
  const stages = run.stages ?? {};
  const preservedStageState: GtmStageState = { ...(stages[stage] ?? {}) };
  delete preservedStageState.completed_at;
  delete preservedStageState.duration_ms;
  delete preservedStageState.error;
  delete preservedStageState.started_at;
  delete preservedStageState.worker_job_id;

  return {
    ...run,
    status: "running",
    stages: {
      ...stages,
      [stage]: {
        ...preservedStageState,
        status: "queued",
        accepted_at: acceptedAt,
      },
    },
  };
}

function queueVisibilityStageLocally(
  visibility: GtmRunVisibilityPanelData,
  stage: string,
  acceptedAt: string,
): GtmRunVisibilityPanelData {
  const stages = visibility.stages.map((visibilityStage) => {
    if (visibilityStage.stage !== stage) {
      return visibilityStage;
    }

    return {
      ...visibilityStage,
      status: "queued" as const,
      latestEvent: {
        message: `User requested rerun for ${stage}.`,
        createdAt: acceptedAt,
        eventType: "queued",
      },
      blocker: null,
      pendingDependencyReason: null,
      elapsedMs: null,
    };
  });

  return {
    ...visibility,
    runStatus: "running",
    eventCount: visibility.eventCount + 1,
    blockerCount: countVisibilityBlockers(stages),
    stages,
  };
}

function mergeVisibilityFromRunPayload(
  visibility: GtmRunVisibilityPanelData,
  run: ChatShellRun,
  events: GtmStageEvent[],
): GtmRunVisibilityPanelData {
  const latestEventsByStage = getLatestEventsByStage(events);
  const stages = visibility.stages.map((visibilityStage) => {
    const stageState = run.stages?.[visibilityStage.stage];
    const status = getVisibilityStageStatus(stageState) ?? visibilityStage.status;
    const latestEvent =
      latestEventsByStage.get(visibilityStage.stage) ??
      visibilityStage.latestEvent;
    const blocker = getVisibilityBlocker({
      stage: visibilityStage.label,
      status,
      stageState,
      latestEvent,
      previousBlocker: visibilityStage.blocker,
    });

    return {
      ...visibilityStage,
      status,
      latestEvent,
      blocker,
      pendingDependencyReason:
        status === "pending" ? visibilityStage.pendingDependencyReason : null,
    };
  });

  return {
    ...visibility,
    runStatus: run.status,
    eventCount: events.length,
    blockerCount: countVisibilityBlockers(stages),
    stages,
  };
}

function getLatestEventsByStage(
  events: GtmStageEvent[],
): Map<string, NonNullable<GtmRunVisibilityPanelData["stages"][number]["latestEvent"]>> {
  const latestEventsByStage = new Map<
    string,
    NonNullable<GtmRunVisibilityPanelData["stages"][number]["latestEvent"]>
  >();

  for (const event of events) {
    const stage = normalizeGtmLighthouseStage(event.stage) ?? event.stage;
    latestEventsByStage.set(stage, {
      message: event.message,
      createdAt: event.created_at,
      eventType: event.event_type,
    });
  }

  return latestEventsByStage;
}

function getVisibilityBlocker(input: {
  stage: string;
  status: GtmRunVisibilityStageStatus;
  stageState: GtmStageState | undefined;
  latestEvent: GtmRunVisibilityPanelData["stages"][number]["latestEvent"];
  previousBlocker: GtmRunVisibilityBlocker | null;
}): GtmRunVisibilityBlocker | null {
  if (!isRerunnableStageStatus(input.status)) {
    return null;
  }

  return {
    title:
      input.previousBlocker?.title ??
      `${input.stage} ${input.status === "blocked" ? "blocked" : "needs attention"}`,
    reason:
      input.stageState?.error ??
      input.latestEvent?.message ??
      input.previousBlocker?.reason ??
      "Stage needs attention before downstream work can continue.",
    ...(input.previousBlocker?.remediation
      ? { remediation: input.previousBlocker.remediation }
      : {}),
  };
}

function getVisibilityStageStatus(
  stageState: GtmStageState | undefined,
): GtmRunVisibilityStageStatus | null {
  if (!stageState?.status) {
    return null;
  }

  return isVisibilityStageStatus(stageState.status) ? stageState.status : null;
}

function isVisibilityStageStatus(
  status: string,
): status is GtmRunVisibilityStageStatus {
  return (
    status === "queued" ||
    status === "running" ||
    status === "complete" ||
    status === "blocked" ||
    status === "timed_out" ||
    status === "errored" ||
    status === "pending"
  );
}

function isRerunnableStageStatus(
  status: GtmRunVisibilityStageStatus,
): boolean {
  return status === "blocked" || status === "errored" || status === "timed_out";
}

function countVisibilityBlockers(
  stages: GtmRunVisibilityPanelData["stages"],
): number {
  return stages.filter((stage) => stage.blocker !== null).length;
}

async function readResponseJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function getRerunRequestErrorMessage(input: {
  payload: unknown;
  response: Response;
  runId: string;
  stage: string;
}): string {
  const context = `run_id=${input.runId} stage=${input.stage} status=${input.response.status}`;

  if (isRecord(input.payload) && typeof input.payload.message === "string") {
    return `Rerun request failed for ${context}: ${input.payload.message}`;
  }

  if (isRecord(input.payload) && typeof input.payload.error === "string") {
    return `Rerun request failed for ${context}: ${input.payload.error}`;
  }

  return `Rerun request failed for ${context}.`;
}

function getOrderedStageEntries(
  stages: Record<string, GtmStageState> | null
): [string, GtmStageState][] {
  const normalizedStages = stages ?? {};
  const lighthouseEntries = GTM_LIGHTHOUSE_STAGE_KEYS.flatMap((stage) => {
    const stageState = normalizedStages[stage];
    return stageState ? ([[stage, stageState]] as [string, GtmStageState][]) : [];
  });
  const remainingEntries = Object.entries(normalizedStages).filter(([stage]) => {
    return !GTM_LIGHTHOUSE_STAGE_KEYS.some((lighthouseStage) => lighthouseStage === stage);
  });

  return [...lighthouseEntries, ...remainingEntries];
}

function StageMessage({
  stageName,
  stage,
}: {
  stageName: string;
  stage: GtmStageState;
}): ReactElement {
  const skill = getAgentInvocationSkill(stageName);

  if (!skill) {
    return (
      <ChatMessage variant="agent-text">
        {stageName} output is available, but this renderer is not wired yet.
      </ChatMessage>
    );
  }

  return (
    <ChatMessage
      variant="agent-block"
      status={mapStageStatus(stage.status)}
      invocation={buildInvocation(skill, stage)}
    />
  );
}

function buildInvocation(
  skill: AgentInvocationSkill,
  stage: GtmStageState
): AgentInvocation {
  const metadata = {
    artifacts: stage.artifacts,
    validation: stage.validation,
    toolCalls: stage.tool_calls,
    error: stage.error,
    durationMs: stage.duration_ms,
  };

  if (skill === "discover-url") {
    return {
      skill,
      summary: stage.summary,
      output: stage.output as IngestUrlOutput | undefined,
      ...metadata,
    };
  }

  return {
    skill,
    summary: stage.summary,
    output: stage.output,
    ...metadata,
  };
}

function mapStageStatus(status: GtmStageStatus | undefined): AgentInvocationStatus {
  if (status === "complete") {
    return "complete";
  }

  if (status === "blocked") {
    return "blocked";
  }

  if (status === "timed_out" || status === "errored") {
    return "errored";
  }

  return "running";
}

function getAgentInvocationSkill(stageName: string): AgentInvocationSkill | null {
  return getInvocationSkillForStage(stageName);
}

function getHostnameLabel(inputUrl: string): string {
  try {
    const url = new URL(inputUrl);
    return url.hostname.replace(/^www\./, "");
  } catch {
    return inputUrl;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

function shouldPollRun(run: ChatShellRun): boolean {
  if (run.status === "queued" || run.status === "running" || run.status === "partial") {
    return true;
  }

  return Object.values(run.stages ?? {}).some((stage) => {
    return stage.status === "queued" || stage.status === "running";
  });
}

function isRunPayload(value: unknown): value is {
  run: ChatShellRun;
  events: GtmStageEvent[];
} {
  return (
    isRecord(value) &&
    isRecord(value.run) &&
    Array.isArray(value.events)
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
