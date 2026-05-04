"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactElement } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import type {
  AgentInvocation,
  AgentInvocationStatus,
  AgentInvocationSkill,
} from "@/components/gtm/AgentInvocationBlock";
import { ArtifactCard } from "@/components/gtm/ArtifactCard";
import { ChatMessage } from "@/components/gtm/ChatMessage";
import {
  GtmRunVisibilityPanel,
  type GtmRunVisibilityBlocker,
  type GtmRunVisibilityPanelData,
  type GtmRunVisibilityStageStatus,
} from "@/components/gtm/GtmRunVisibilityPanel";
import {
  RunStatusBadge,
  type GtmRunStatus,
} from "@/components/gtm/RunStatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getGtmStageLabel,
  getInvocationSkillForStage,
  GTM_LIGHTHOUSE_STAGE_KEYS,
  normalizeGtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmStageStatus } from "@/lib/gtm/stage-state";
import type { IngestUrlOutput } from "@/lib/gtm/types";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

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
  stages: Record<string, GtmStageState> | null;
  created_at: string;
  updated_at?: string;
}

interface ChatShellProps {
  run: ChatShellRun;
  initialEvents?: GtmStageEvent[];
  initialArtifacts?: GtmArtifact[];
  visibility?: GtmRunVisibilityPanelData;
}

const EMPTY_EVENTS: GtmStageEvent[] = [];
const EMPTY_ARTIFACTS: GtmArtifact[] = [];

export function ChatShell({
  run,
  initialEvents = EMPTY_EVENTS,
  initialArtifacts = EMPTY_ARTIFACTS,
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
    onFinish: () => {
      void refreshArtifacts();
    },
  });

  const inputDisabled = status === "submitted" || status === "streaming";

  const artifactsBySkill = useMemo(() => groupArtifactsBySkill(artifacts), [
    artifacts,
  ]);

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
        {currentVisibility ? (
          <GtmRunVisibilityPanel
            visibility={currentVisibility}
            onRerunStage={handleRerunStage}
            rerunningStage={rerunningStage}
            rerunError={rerunError}
            rerunErrorStage={rerunErrorStage}
          />
        ) : null}

        <ChatMessage variant="user">{currentRun.input_url}</ChatMessage>

        <StageActivityTimeline events={events} />

        {stageEntries.length === 0 && messages.length === 0 ? (
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

        {artifactsBySkill.map(([skill, versions]) => (
          <ArtifactCard
            key={skill}
            versions={versions}
            runId={currentRun.run_id}
          />
        ))}

        {messages.map((m) => (
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

function extractText(message: { parts: Array<{ type: string; text?: string }> }): string {
  return message.parts
    .filter((p) => p.type === "text" && typeof p.text === "string")
    .map((p) => p.text!)
    .join("");
}

function groupArtifactsBySkill(
  artifacts: GtmArtifact[],
): [string, GtmArtifact[]][] {
  const groups = new Map<string, GtmArtifact[]>();
  for (const a of artifacts) {
    const list = groups.get(a.skill) ?? [];
    list.push(a);
    groups.set(a.skill, list);
  }
  // Stable order: LIGHTHOUSE_5 first, then anything else alphabetical.
  const ordered: [string, GtmArtifact[]][] = [];
  for (const skill of GTM_LIGHTHOUSE_STAGE_KEYS) {
    const list = groups.get(skill);
    if (list) {
      ordered.push([skill, list]);
      groups.delete(skill);
    }
  }
  for (const [skill, list] of [...groups].sort(([a], [b]) => a.localeCompare(b))) {
    ordered.push([skill, list]);
  }
  return ordered;
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

function StageActivityTimeline({
  events,
}: {
  events: GtmStageEvent[];
}): ReactElement | null {
  if (events.length === 0) {
    return null;
  }

  const recentEvents = events.slice(-10).reverse();

  return (
    <section className="rounded-lg border border-border bg-card/40 px-4 py-3">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-foreground">Agent activity</h2>
        <span className="font-mono text-xs text-muted-foreground">
          {events.length} events
        </span>
      </div>
      <ol className="flex flex-col gap-2">
        {recentEvents.map((event) => (
          <li
            key={event.id ?? `${event.stage}-${event.event_type}-${event.created_at}`}
            className="grid grid-cols-[7rem_1fr] gap-3 text-sm"
          >
            <span className="font-mono text-xs text-muted-foreground">
              {formatEventTime(event.created_at)}
            </span>
            <span className="min-w-0">
              <span className="font-mono text-xs text-muted-foreground">
                {getGtmStageLabel(event.stage)}
              </span>
              <span className="mx-1.5 text-muted-foreground">·</span>
              <span className="text-foreground">{event.message}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
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
