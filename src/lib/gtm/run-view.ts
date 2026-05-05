import {
  isMissingGtmMessagesTableError,
  type GtmAgentMessage,
} from "@/lib/gtm/agent-messages";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import {
  determineGtmRunStatus,
  getStageStatus,
  normalizeStageRecord,
  type GtmStageStatus,
  type GtmStoredStageState,
} from "@/lib/gtm/stage-state";
import {
  getGtmStageLabel,
  GTM_LIGHTHOUSE_STAGE_KEYS,
  normalizeGtmLighthouseStage,
  type GtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";
import {
  buildGtmRunSourceLedger,
  type GtmRunSourceLedger,
  type GtmRunSourceLedgerGroup,
} from "@/lib/gtm/source-ledger";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";

export type { GtmRunSourceLedger, GtmRunSourceLedgerGroup };

const GTM_RUN_VIEW_STATUSES = [
  "queued",
  "running",
  "awaiting_user",
  "completed",
  "partial",
  "failed",
] as const;

const BLOCKING_STAGE_STATUSES = ["blocked", "timed_out", "errored"] as const;

export type GtmRunViewStatus = (typeof GTM_RUN_VIEW_STATUSES)[number];

export type GtmRunViewStageStatus = GtmStageStatus | "pending";

export type GtmRunViewBlockerSource =
  | "stage_status"
  | "source_gap"
  | "event"
  | "validation"
  | "worker";

export interface GtmRunViewRunRecord {
  id?: string;
  run_id: string;
  user_id: string;
  input_url: string;
  status: string;
  manifest: Record<string, unknown> | null;
  stages: Record<string, unknown> | null;
  created_at: string;
  updated_at?: string | null;
}

export interface GtmRunViewRunMetadata {
  id?: string;
  run_id: string;
  user_id: string;
  input_url: string;
  status: GtmRunViewStatus;
  derived_status: GtmRunViewStatus;
  manifest: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
}

export interface GtmRunViewBlocker {
  stage: GtmLighthouseStage;
  title: string;
  reason: string;
  remediation?: string;
  source: GtmRunViewBlockerSource;
  severity: "blocker";
  event_id?: string;
  created_at?: string;
}

export interface GtmRunViewStage {
  stage: GtmLighthouseStage;
  label: string;
  status: GtmRunViewStageStatus;
  persisted_status: GtmStageStatus | null;
  state: GtmStoredStageState;
  latest_event: GtmStageEvent | null;
  events: GtmStageEvent[];
  artifacts: GtmArtifact[];
  blocker: GtmRunViewBlocker | null;
  pending_dependency_reason: string | null;
  elapsed_ms: number | null;
}

export interface GtmRunViewArtifactGroup {
  skill: string;
  stage: GtmLighthouseStage | null;
  latest_artifact: GtmArtifact | null;
  artifacts: GtmArtifact[];
}

export interface GtmRunView {
  run: GtmRunViewRunMetadata;
  stages: GtmRunViewStage[];
  latest_event_by_stage: Record<string, GtmStageEvent>;
  events_by_stage: Record<string, GtmStageEvent[]>;
  artifacts_by_skill: GtmRunViewArtifactGroup[];
  artifacts_by_stage: Record<GtmLighthouseStage, GtmArtifact[]>;
  source_ledger: GtmRunSourceLedger;
  messages: GtmAgentMessage[];
  blockers: GtmRunViewBlocker[];
  pending_dependency_reasons: Partial<Record<GtmLighthouseStage, string>>;
}

export interface BuildGtmRunViewInput {
  run: GtmRunViewRunRecord;
  events?: readonly GtmStageEvent[] | null;
  artifacts?: readonly GtmArtifact[] | null;
  messages?: readonly GtmAgentMessage[] | null;
  now?: Date;
}

export type GtmRunViewTable =
  | "gtm_runs"
  | "gtm_stage_events"
  | "gtm_artifacts"
  | "gtm_messages";

export interface GtmRunViewQueryResult<T> {
  data: T | null;
  error: unknown;
}

export interface GtmRunViewTableBuilder {
  select(columns: string): GtmRunViewQueryBuilder;
}

export interface GtmRunViewQueryBuilder {
  eq(column: string, value: string): GtmRunViewQueryBuilder;
  order(
    column: string,
    options?: { ascending?: boolean },
  ): GtmRunViewQueryBuilder;
  maybeSingle<T>(): PromiseLike<GtmRunViewQueryResult<T | null>>;
  returns<T>(): PromiseLike<GtmRunViewQueryResult<T>>;
}

export interface GtmRunViewSupabaseClient {
  from(table: GtmRunViewTable): GtmRunViewTableBuilder;
}

export interface GetGtmRunViewForUserInput {
  runId: string;
  userId: string;
  supabase: GtmRunViewSupabaseClient;
}

export function buildGtmRunView(input: BuildGtmRunViewInput): GtmRunView {
  const persistedStatus = parseGtmRunViewStatus({
    status: input.run.status,
    runId: input.run.run_id,
  });
  const stageStates = normalizeVisibleStageStates(input.run.stages);
  const derivedStatus = determineGtmRunStatus(
    stageStates,
    GTM_LIGHTHOUSE_STAGE_KEYS,
  );
  const events = sortByCreatedAt(input.events ?? []);
  const eventsByStage = groupEventsByStage(events);
  const latestEventByStage = getLatestEventsByStage(eventsByStage);
  const artifacts = sortArtifacts(input.artifacts ?? []);
  const artifactsBySkill = groupArtifactsBySkill(artifacts);
  const artifactsByStage = groupArtifactsByStage(artifacts);
  const sourceLedger = buildGtmRunSourceLedger({
    values: [
      input.run.manifest,
      stageStates,
      artifacts.map((artifact) => artifact.metadata),
    ],
  });
  const messages = sortByCreatedAt(input.messages ?? []);
  const blockers = buildBlockers({
    stageStates,
    eventsByStage,
  });
  const blockerByStage = getFirstBlockerByStage(blockers);
  const pendingDependencyReasons = buildPendingDependencyReasons(stageStates);

  return {
    run: {
      id: input.run.id,
      run_id: input.run.run_id,
      user_id: input.run.user_id,
      input_url: input.run.input_url,
      status: persistedStatus,
      derived_status: derivedStatus,
      manifest: input.run.manifest,
      created_at: input.run.created_at,
      updated_at: input.run.updated_at ?? null,
    },
    stages: GTM_LIGHTHOUSE_STAGE_KEYS.map((stage) => {
      const state = stageStates[stage] ?? {};
      const persistedStageStatus = getStageStatus(state);
      const status = persistedStageStatus ?? "pending";

      return {
        stage,
        label: getGtmStageLabel(stage),
        status,
        persisted_status: persistedStageStatus,
        state,
        latest_event: latestEventByStage[stage] ?? null,
        events: eventsByStage[stage] ?? [],
        artifacts: artifactsByStage[stage],
        blocker: blockerByStage.get(stage) ?? null,
        pending_dependency_reason: pendingDependencyReasons[stage] ?? null,
        elapsed_ms: getElapsedMs(state, input.now),
      };
    }),
    latest_event_by_stage: latestEventByStage,
    events_by_stage: eventsByStage,
    artifacts_by_skill: artifactsBySkill,
    artifacts_by_stage: artifactsByStage,
    source_ledger: sourceLedger,
    messages,
    blockers,
    pending_dependency_reasons: pendingDependencyReasons,
  };
}

export async function getGtmRunView(
  runId: string,
): Promise<GtmRunView | null> {
  const [{ auth }, { createClient }] = await Promise.all([
    import("@clerk/nextjs/server"),
    import("@/lib/supabase/server"),
  ]);
  const { userId } = await auth();

  if (!userId) {
    throw new Error(
      `Cannot load GTM run view for run_id=${runId}: Clerk user is not authenticated.`,
    );
  }

  const supabase = (await createClient()) as unknown as GtmRunViewSupabaseClient;
  return getGtmRunViewForUser({
    runId,
    userId,
    supabase,
  });
}

export async function getGtmRunViewForUser(
  input: GetGtmRunViewForUserInput,
): Promise<GtmRunView | null> {
  const { data: run, error: runError } = await input.supabase
    .from("gtm_runs")
    .select(
      "id, run_id, user_id, input_url, status, manifest, stages, created_at, updated_at",
    )
    .eq("run_id", input.runId)
    .eq("user_id", input.userId)
    .maybeSingle<GtmRunViewRunRecord>();

  if (runError) {
    throw new Error(
      `Failed to load GTM run for run_id=${input.runId} user_id=${input.userId}: ${getErrorMessage(runError)}`,
    );
  }

  if (!run) {
    return null;
  }

  const { data: events, error: eventsError } = await input.supabase
    .from("gtm_stage_events")
    .select(
      "id, run_id, user_id, stage, event_type, message, status, metadata, duration_ms, tool_name, artifact_path, source_url, error, created_at",
    )
    .eq("run_id", input.runId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true })
    .returns<GtmStageEvent[]>();

  if (eventsError) {
    throw new Error(
      `Failed to load GTM stage events for run_id=${input.runId} user_id=${input.userId}: ${getErrorMessage(eventsError)}`,
    );
  }

  const { data: artifacts, error: artifactsError } = await input.supabase
    .from("gtm_artifacts")
    .select(
      "id, run_id, user_id, skill, version, parent_id, content_md, source, created_by, metadata, created_at",
    )
    .eq("run_id", input.runId)
    .eq("user_id", input.userId)
    .order("skill", { ascending: true })
    .order("version", { ascending: true })
    .returns<GtmArtifact[]>();

  if (artifactsError) {
    throw new Error(
      `Failed to load GTM artifacts for run_id=${input.runId} user_id=${input.userId}: ${getErrorMessage(artifactsError)}`,
    );
  }

  const { data: messages, error: messagesError } = await input.supabase
    .from("gtm_messages")
    .select(
      "id, run_id, user_id, role, message_type, content, status, metadata, created_at",
    )
    .eq("run_id", input.runId)
    .eq("user_id", input.userId)
    .order("created_at", { ascending: true })
    .returns<GtmAgentMessage[]>();

  if (messagesError && !isMissingGtmMessagesTableError(messagesError)) {
    throw new Error(
      `Failed to load GTM messages for run_id=${input.runId} user_id=${input.userId}: ${getErrorMessage(messagesError)}`,
    );
  }

  if (messagesError) {
    console.warn("[gtm-run-view]", {
      component: "gtm-run-view",
      event: "gtm_messages_missing",
      run_id: input.runId,
      user_id: input.userId,
      message: getErrorMessage(messagesError),
    });
  }

  return buildGtmRunView({
    run,
    events: events ?? [],
    artifacts: artifacts ?? [],
    messages: messagesError ? [] : messages ?? [],
  });
}

function parseGtmRunViewStatus(input: {
  status: string;
  runId: string;
}): GtmRunViewStatus {
  if (isGtmRunViewStatus(input.status)) {
    return input.status;
  }

  throw new Error(
    `Invalid GTM run status "${input.status}" for run_id=${input.runId}. Expected one of: ${GTM_RUN_VIEW_STATUSES.join(", ")}.`,
  );
}

function isGtmRunViewStatus(status: string): status is GtmRunViewStatus {
  return GTM_RUN_VIEW_STATUSES.some((candidate) => candidate === status);
}

function normalizeVisibleStageStates(
  stages: Record<string, unknown> | null,
): Record<GtmLighthouseStage, GtmStoredStageState> {
  const normalizedRecord = normalizeStageRecord(stages);
  const visibleStates: Partial<Record<GtmLighthouseStage, GtmStoredStageState>> =
    {};

  for (const [stage, state] of Object.entries(normalizedRecord)) {
    const normalizedStage = normalizeGtmLighthouseStage(stage);
    if (!normalizedStage) {
      continue;
    }

    if (!visibleStates[normalizedStage] || stage === normalizedStage) {
      visibleStates[normalizedStage] = state;
    }
  }

  return visibleStates as Record<GtmLighthouseStage, GtmStoredStageState>;
}

function groupEventsByStage(
  events: readonly GtmStageEvent[],
): Record<string, GtmStageEvent[]> {
  const groups: Record<string, GtmStageEvent[]> =
    createVisibleStageArrayRecord<GtmStageEvent>();

  for (const event of events) {
    const stage = normalizeGtmLighthouseStage(event.stage) ?? event.stage;
    groups[stage] = [...(groups[stage] ?? []), event];
  }

  return groups;
}

function getLatestEventsByStage(
  eventsByStage: Record<string, GtmStageEvent[]>,
): Record<string, GtmStageEvent> {
  const latestEvents: Record<string, GtmStageEvent> = {};

  for (const [stage, events] of Object.entries(eventsByStage)) {
    const latestEvent = events.at(-1);
    if (latestEvent) {
      latestEvents[stage] = latestEvent;
    }
  }

  return latestEvents;
}

function groupArtifactsBySkill(
  artifacts: readonly GtmArtifact[],
): GtmRunViewArtifactGroup[] {
  const groups = new Map<string, GtmArtifact[]>();

  for (const artifact of artifacts) {
    groups.set(artifact.skill, [...(groups.get(artifact.skill) ?? []), artifact]);
  }

  return [...groups.entries()]
    .map(([skill, skillArtifacts]) => {
      const sortedArtifacts = sortArtifacts(skillArtifacts);
      return {
        skill,
        stage: getArtifactStage(sortedArtifacts[0] ?? null),
        latest_artifact: sortedArtifacts.at(-1) ?? null,
        artifacts: sortedArtifacts,
      };
    })
    .sort(compareArtifactGroups);
}

function groupArtifactsByStage(
  artifacts: readonly GtmArtifact[],
): Record<GtmLighthouseStage, GtmArtifact[]> {
  const groups = createVisibleStageArrayRecord<GtmArtifact>();

  for (const artifact of artifacts) {
    const stage = getArtifactStage(artifact);
    if (!stage) {
      continue;
    }

    groups[stage] = [...groups[stage], artifact];
  }

  return groups;
}

function buildBlockers(input: {
  stageStates: Record<GtmLighthouseStage, GtmStoredStageState>;
  eventsByStage: Record<string, GtmStageEvent[]>;
}): GtmRunViewBlocker[] {
  const blockers: GtmRunViewBlocker[] = [];

  for (const stage of GTM_LIGHTHOUSE_STAGE_KEYS) {
    const state = input.stageStates[stage] ?? {};
    const events = input.eventsByStage[stage] ?? [];
    const terminalEvent = findLatestBlockingEvent(events);
    const statusBlocker = buildStageStatusBlocker({
      stage,
      state,
      terminalEvent,
    });

    if (statusBlocker) {
      blockers.push(statusBlocker);
    }

    blockers.push(...buildSourceGapBlockers(stage, state));

    if (!statusBlocker && terminalEvent) {
      blockers.push(buildEventBlocker(stage, terminalEvent));
    }

    const validationBlocker = buildValidationBlocker(stage, state);
    if (validationBlocker) {
      blockers.push(validationBlocker);
    }
  }

  return blockers;
}

function buildStageStatusBlocker(input: {
  stage: GtmLighthouseStage;
  state: GtmStoredStageState;
  terminalEvent: GtmStageEvent | null;
}): GtmRunViewBlocker | null {
  const status = getStageStatus(input.state);
  if (!status || !isBlockingStageStatus(status)) {
    return null;
  }

  const sourceGapReason = getSourceGapReason(input.state.source_gaps?.[0]);
  const reason =
    input.state.error ??
    input.terminalEvent?.error ??
    input.terminalEvent?.message ??
    sourceGapReason ??
    getDefaultStageStatusReason(status);

  return {
    stage: input.stage,
    title: `${getGtmStageLabel(input.stage)} ${getBlockerTitleSuffix(status)}`,
    reason,
    remediation: getSourceGapRemediation(input.state.source_gaps?.[0]),
    source: "stage_status",
    severity: "blocker",
    event_id: input.terminalEvent?.id,
    created_at: input.terminalEvent?.created_at,
  };
}

function buildSourceGapBlockers(
  stage: GtmLighthouseStage,
  state: GtmStoredStageState,
): GtmRunViewBlocker[] {
  return (state.source_gaps ?? []).flatMap((sourceGap) => {
    if (!isRecord(sourceGap) || sourceGap.severity !== "blocker") {
      return [];
    }

    return [
      {
        stage,
        title: `${getGtmStageLabel(stage)} has a source gap`,
        reason: getSourceGapReason(sourceGap) ?? "Required source coverage is missing.",
        remediation: getSourceGapRemediation(sourceGap),
        source: "source_gap" as const,
        severity: "blocker" as const,
        created_at: getStringField(sourceGap, "created_at") ?? undefined,
        event_id: getStringField(sourceGap, "event_id") ?? undefined,
      },
    ];
  });
}

function buildEventBlocker(
  stage: GtmLighthouseStage,
  event: GtmStageEvent,
): GtmRunViewBlocker {
  return {
    stage,
    title: `${getGtmStageLabel(stage)} needs attention`,
    reason: event.error ?? event.message,
    source: "event",
    severity: "blocker",
    event_id: event.id,
    created_at: event.created_at,
  };
}

function buildValidationBlocker(
  stage: GtmLighthouseStage,
  state: GtmStoredStageState,
): GtmRunViewBlocker | null {
  if (!isRecord(state.validation)) {
    return null;
  }

  const validationStatus = getStringField(state.validation, "status");
  const passed = state.validation.passed;
  const failed =
    validationStatus === "failed" ||
    validationStatus === "errored" ||
    passed === false;

  if (!failed) {
    return null;
  }

  return {
    stage,
    title: `${getGtmStageLabel(stage)} validation failed`,
    reason:
      getStringField(state.validation, "message") ??
      getStringField(state.validation, "error") ??
      "Validation failed before this output could be trusted.",
    remediation:
      getStringField(state.validation, "remediation") ??
      getStringField(state.validation, "suggested_action") ??
      undefined,
    source: "validation",
    severity: "blocker",
  };
}

function getFirstBlockerByStage(
  blockers: readonly GtmRunViewBlocker[],
): Map<GtmLighthouseStage, GtmRunViewBlocker> {
  const blockerByStage = new Map<GtmLighthouseStage, GtmRunViewBlocker>();

  for (const blocker of blockers) {
    if (!blockerByStage.has(blocker.stage)) {
      blockerByStage.set(blocker.stage, blocker);
    }
  }

  return blockerByStage;
}

function buildPendingDependencyReasons(
  stageStates: Record<GtmLighthouseStage, GtmStoredStageState>,
): Partial<Record<GtmLighthouseStage, string>> {
  const reasons: Partial<Record<GtmLighthouseStage, string>> = {};
  let firstIncompleteStage: GtmLighthouseStage | null = null;
  let firstIncompleteStatus: GtmRunViewStageStatus | null = null;

  for (const stage of GTM_LIGHTHOUSE_STAGE_KEYS) {
    const status = getStageStatus(stageStates[stage] ?? {}) ?? "pending";

    if (status === "pending") {
      reasons[stage] = getPendingDependencyReason({
        stage,
        firstIncompleteStage,
        firstIncompleteStatus,
      });
    }

    if (status !== "complete" && firstIncompleteStage === null) {
      firstIncompleteStage = stage;
      firstIncompleteStatus = status;
    }
  }

  return reasons;
}

function getPendingDependencyReason(input: {
  stage: GtmLighthouseStage;
  firstIncompleteStage: GtmLighthouseStage | null;
  firstIncompleteStatus: GtmRunViewStageStatus | null;
}): string {
  if (!input.firstIncompleteStage) {
    return `Waiting for ${getGtmStageLabel(input.stage)} to start.`;
  }

  const upstreamLabel = getGtmStageLabel(input.firstIncompleteStage);

  if (input.firstIncompleteStatus === "blocked") {
    return `Waiting because ${upstreamLabel} is blocked.`;
  }

  if (
    input.firstIncompleteStatus === "errored" ||
    input.firstIncompleteStatus === "timed_out"
  ) {
    return `Waiting because ${upstreamLabel} failed.`;
  }

  if (input.firstIncompleteStatus === "pending") {
    return `Waiting for ${upstreamLabel} to start.`;
  }

  return `Waiting for ${upstreamLabel} to complete.`;
}

function findLatestBlockingEvent(
  events: readonly GtmStageEvent[],
): GtmStageEvent | null {
  return (
    [...events]
      .reverse()
      .find((event) => {
        return (
          event.event_type === "blocked" ||
          event.event_type === "timed_out" ||
          event.event_type === "errored" ||
          event.event_type === "validation_failed"
        );
      }) ?? null
  );
}

function isBlockingStageStatus(status: GtmStageStatus): boolean {
  return BLOCKING_STAGE_STATUSES.some((candidate) => candidate === status);
}

function getBlockerTitleSuffix(status: GtmStageStatus): string {
  if (status === "timed_out") {
    return "timed out";
  }

  if (status === "errored") {
    return "failed";
  }

  return "is blocked";
}

function getDefaultStageStatusReason(status: GtmStageStatus): string {
  if (status === "timed_out") {
    return "The stage exceeded the worker timeout before producing a terminal update.";
  }

  if (status === "errored") {
    return "The stage failed during execution.";
  }

  return "The stage stopped before producing trustworthy output.";
}

function getSourceGapReason(sourceGap: unknown): string | null {
  if (!isRecord(sourceGap)) {
    return null;
  }

  const directReason =
    getStringField(sourceGap, "reason") ??
    getStringField(sourceGap, "message") ??
    getStringField(sourceGap, "description") ??
    getStringField(sourceGap, "gap");

  if (directReason) {
    return directReason;
  }

  const field = getStringField(sourceGap, "field");
  if (field) {
    return `Missing trustworthy source coverage for ${field}.`;
  }

  return null;
}

function getSourceGapRemediation(sourceGap: unknown): string | undefined {
  if (!isRecord(sourceGap)) {
    return undefined;
  }

  return (
    getStringField(sourceGap, "remediation") ??
    getStringField(sourceGap, "suggested_action") ??
    getStringField(sourceGap, "next_step") ??
    undefined
  );
}

function getArtifactStage(artifact: GtmArtifact | null): GtmLighthouseStage | null {
  if (!artifact) {
    return null;
  }

  const skillStage = normalizeGtmLighthouseStage(artifact.skill);
  if (skillStage) {
    return skillStage;
  }

  const metadataStage = getStringField(artifact.metadata, "stage");
  return metadataStage ? normalizeGtmLighthouseStage(metadataStage) : null;
}

function compareArtifactGroups(
  left: GtmRunViewArtifactGroup,
  right: GtmRunViewArtifactGroup,
): number {
  const leftStageIndex = getStageSortIndex(left.stage);
  const rightStageIndex = getStageSortIndex(right.stage);

  if (leftStageIndex !== rightStageIndex) {
    return leftStageIndex - rightStageIndex;
  }

  return left.skill.localeCompare(right.skill);
}

function sortArtifacts(artifacts: readonly GtmArtifact[]): GtmArtifact[] {
  return [...artifacts].sort((left, right) => {
    const skillCompare = left.skill.localeCompare(right.skill);
    if (skillCompare !== 0) {
      return skillCompare;
    }

    if (left.version !== right.version) {
      return left.version - right.version;
    }

    return compareCreatedAt(left.created_at, right.created_at);
  });
}

function sortByCreatedAt<T extends { created_at: string }>(
  values: readonly T[],
): T[] {
  return [...values].sort((left, right) => {
    return compareCreatedAt(left.created_at, right.created_at);
  });
}

function compareCreatedAt(left: string, right: string): number {
  const leftMs = Date.parse(left);
  const rightMs = Date.parse(right);

  if (Number.isFinite(leftMs) && Number.isFinite(rightMs)) {
    return leftMs - rightMs;
  }

  return left.localeCompare(right);
}

function getStageSortIndex(stage: GtmLighthouseStage | null): number {
  if (!stage) {
    return Number.MAX_SAFE_INTEGER;
  }

  const index = GTM_LIGHTHOUSE_STAGE_KEYS.findIndex((candidate) => {
    return candidate === stage;
  });
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function getElapsedMs(
  stage: GtmStoredStageState,
  now: Date | undefined,
): number | null {
  if (typeof stage.duration_ms === "number") {
    return stage.duration_ms;
  }

  if (!stage.started_at) {
    return null;
  }

  const startedAtMs = Date.parse(stage.started_at);
  if (!Number.isFinite(startedAtMs)) {
    return null;
  }

  const completedAtMs = stage.completed_at
    ? Date.parse(stage.completed_at)
    : now?.getTime();
  if (completedAtMs === undefined || !Number.isFinite(completedAtMs)) {
    return null;
  }

  return Math.max(0, completedAtMs - startedAtMs);
}

function createVisibleStageArrayRecord<T>(): Record<GtmLighthouseStage, T[]> {
  return Object.fromEntries(
    GTM_LIGHTHOUSE_STAGE_KEYS.map((stage) => [stage, [] as T[]]),
  ) as Record<GtmLighthouseStage, T[]>;
}

function getStringField(
  record: Record<string, unknown>,
  key: string,
): string | null {
  const value = record[key];
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    return (
      getStringField(error, "message") ??
      getStringField(error, "details") ??
      JSON.stringify(error)
    );
  }

  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
