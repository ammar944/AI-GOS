export type GtmStageStatus =
  | "queued"
  | "running"
  | "complete"
  | "blocked"
  | "timed_out"
  | "errored";

export interface GtmStoredStageState {
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

export interface StaleStageRecovery {
  stage: string;
  started_at: string;
  timed_out_at: string;
}

export const DEFAULT_GTM_STAGE_TIMEOUT_MS = 10 * 60 * 1000;

export function normalizeStageRecord(
  stages: Record<string, unknown> | null | undefined
): Record<string, GtmStoredStageState> {
  if (!stages) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(stages).map(([stage, value]) => [
      stage,
      isRecord(value) ? (value as GtmStoredStageState) : {},
    ])
  );
}

export function getStageStatus(stageState: unknown): GtmStageStatus | null {
  if (!isRecord(stageState) || typeof stageState.status !== "string") {
    return null;
  }

  return isGtmStageStatus(stageState.status) ? stageState.status : null;
}

export function isTerminalGtmStageStatus(
  status: GtmStageStatus | null
): boolean {
  return (
    status === "complete" ||
    status === "blocked" ||
    status === "timed_out" ||
    status === "errored"
  );
}

export function isActiveGtmStageStatus(status: GtmStageStatus | null): boolean {
  return status === "queued" || status === "running";
}

export function recoverStaleRunningStages(input: {
  stages: Record<string, GtmStoredStageState>;
  now: Date;
  timeoutMs?: number;
}): { stages: Record<string, GtmStoredStageState>; recovered: StaleStageRecovery[] } {
  const timeoutMs = input.timeoutMs ?? DEFAULT_GTM_STAGE_TIMEOUT_MS;
  const timedOutAt = input.now.toISOString();
  const recovered: StaleStageRecovery[] = [];
  const stages = Object.fromEntries(
    Object.entries(input.stages).map(([stage, state]) => {
      if (state.status !== "running" || !state.started_at) {
        return [stage, state];
      }

      const startedAtMs = Date.parse(state.started_at);
      if (!Number.isFinite(startedAtMs)) {
        return [stage, state];
      }

      if (input.now.getTime() - startedAtMs < timeoutMs) {
        return [stage, state];
      }

      recovered.push({
        stage,
        started_at: state.started_at,
        timed_out_at: timedOutAt,
      });

      return [
        stage,
        {
          ...state,
          status: "timed_out" as const,
          completed_at: timedOutAt,
          duration_ms: input.now.getTime() - startedAtMs,
          error: `Stage ${stage} exceeded ${timeoutMs}ms without a terminal worker update.`,
        },
      ];
    })
  );

  return { stages, recovered };
}

export function determineGtmRunStatus(
  stages: Record<string, GtmStoredStageState>,
  orderedStages: readonly string[]
): "queued" | "running" | "awaiting_user" | "completed" | "partial" | "failed" {
  if (
    orderedStages.some((stage) => {
      const status = getStageStatus(stages[stage]);
      return status === "errored" || status === "timed_out";
    })
  ) {
    return "failed";
  }

  if (
    orderedStages.some((stage) => {
      const state = stages[stage];
      return state?.status === "blocked" || hasBlockerSourceGap(state?.source_gaps);
    })
  ) {
    return "awaiting_user";
  }

  if (
    orderedStages.some((stage) => {
      return isActiveGtmStageStatus(getStageStatus(stages[stage]));
    })
  ) {
    return "running";
  }

  const completedCount = orderedStages.filter((stage) => {
    return getStageStatus(stages[stage]) === "complete";
  }).length;

  if (completedCount === orderedStages.length) {
    return "completed";
  }

  if (completedCount > 0) {
    return "partial";
  }

  return "queued";
}

function hasBlockerSourceGap(sourceGaps: unknown[] | undefined): boolean {
  if (!sourceGaps) {
    return false;
  }

  return sourceGaps.some((sourceGap) => {
    return isRecord(sourceGap) && sourceGap.severity === "blocker";
  });
}

function isGtmStageStatus(status: string): status is GtmStageStatus {
  return (
    status === "queued" ||
    status === "running" ||
    status === "complete" ||
    status === "blocked" ||
    status === "timed_out" ||
    status === "errored"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
