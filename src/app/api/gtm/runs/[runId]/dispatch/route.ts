import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { GtmRunStatus } from "@/components/gtm/RunStatusBadge";
import {
  GTM_LIGHTHOUSE_STAGE_KEYS,
  normalizeGtmLighthouseStage,
  type GtmLighthouseStage,
} from "@/lib/gtm/stage-mapping";
import {
  determineGtmRunStatus,
  getStageStatus,
  isActiveGtmStageStatus,
  isTerminalGtmStageStatus,
  normalizeStageRecord,
  recoverStaleRunningStages,
  type GtmStoredStageState,
} from "@/lib/gtm/stage-state";
import {
  validateGtmStageEventInsert,
  type GtmStageEventInsert,
} from "@/lib/gtm/stage-events";
import { dispatchGtmWorkerStage } from "@/lib/gtm/worker-dispatch";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 30;

interface GtmRunDispatchRow {
  run_id: string;
  user_id: string;
  input_url: string;
  status: GtmRunStatus;
  stages: Record<string, unknown> | null;
}

type DispatchRouteContext = {
  params: Promise<{ runId: string }>;
};

interface GtmRunDispatchRequest {
  stage: GtmLighthouseStage;
  rerun: boolean;
}

const DISPATCHABLE_STATUSES = new Set<GtmRunStatus>([
  "queued",
  "partial",
  "running",
]);

export async function POST(
  request: Request,
  { params }: DispatchRouteContext
): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "gtm_run_dispatch_unauthenticated" },
      { status: 401 }
    );
  }

  const { runId } = await params;
  const supabase = await createClient();
  const { data: run, error: loadError } = await supabase
    .from("gtm_runs")
    .select("run_id, user_id, input_url, status, stages")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle<GtmRunDispatchRow>();

  if (loadError) {
    return NextResponse.json(
      {
        error: "gtm_run_dispatch_load_failed",
        message: loadError.message,
        run_id: runId,
        user_id: userId,
      },
      { status: 500 }
    );
  }

  if (!run) {
    return NextResponse.json(
      {
        error: "gtm_run_not_found",
        message: `No GTM run found for run_id=${runId} and user_id=${userId}.`,
        run_id: runId,
        user_id: userId,
      },
      { status: 404 }
    );
  }

  const body = await readJson(request);
  const dispatchRequest = getDispatchRequest(body);
  if (!dispatchRequest) {
    return NextResponse.json(
      {
        error: "gtm_run_dispatch_invalid_body",
        message: `Expected JSON body with stage in ${GTM_LIGHTHOUSE_STAGE_KEYS.join(", ")} and optional boolean rerun.`,
        run_id: run.run_id,
      },
      { status: 400 }
    );
  }

  const { stage, rerun } = dispatchRequest;
  const acceptedAt = new Date();
  const currentStages = normalizeStageRecord(run.stages);
  const recovered = recoverStaleRunningStages({
    stages: currentStages,
    now: acceptedAt,
  });
  const stages = recovered.stages;

  if (recovered.recovered.length > 0) {
    await persistRunState({
      supabase,
      run,
      stages,
      status: determineGtmRunStatus(stages, GTM_LIGHTHOUSE_STAGE_KEYS),
    });

    for (const staleStage of recovered.recovered) {
      await writeStageEvent(supabase, {
        run_id: run.run_id,
        user_id: userId,
        stage: staleStage.stage,
        event_type: "timed_out",
        message: `Stage ${staleStage.stage} timed out after starting at ${staleStage.started_at}.`,
        status: "timed_out",
        metadata: {
          started_at: staleStage.started_at,
          timed_out_at: staleStage.timed_out_at,
        },
        created_at: staleStage.timed_out_at,
      });
    }
  }

  const existingStatus = getStageStatus(stages[stage]);
  if (rerun) {
    if (!isRerunnableGtmStageStatus(existingStatus)) {
      return NextResponse.json(
        {
          error: "gtm_run_stage_rerun_conflict",
          message: `Cannot rerun stage=${stage} for run_id=${run.run_id} because stage status is ${existingStatus ?? "pending"}.`,
          run_id: run.run_id,
          user_id: userId,
          stage,
          stage_status: existingStatus ?? "pending",
          rerun: true,
        },
        { status: 409 }
      );
    }
  } else {
    if (!DISPATCHABLE_STATUSES.has(run.status)) {
      return NextResponse.json(
        {
          error: "gtm_run_dispatch_conflict",
          message: `Cannot dispatch a lighthouse skill for run ${run.run_id} while status=${run.status}.`,
          run_id: run.run_id,
          status: run.status,
        },
        { status: 409 }
      );
    }

    if (
      isTerminalGtmStageStatus(existingStatus) ||
      isActiveGtmStageStatus(existingStatus)
    ) {
      return NextResponse.json(
        {
          run_id: run.run_id,
          stage,
          status: "accepted",
        },
        { status: 202 }
      );
    }
  }

  const queuedStages: Record<string, GtmStoredStageState> = {
    ...stages,
    [stage]: buildQueuedStageState(stages[stage], acceptedAt),
  };

  const { error: queuedUpdateError } = await supabase
    .from("gtm_runs")
    .update({
      status: "running",
      stages: queuedStages,
    })
    .eq("run_id", run.run_id)
    .eq("user_id", userId);

  if (queuedUpdateError) {
    return NextResponse.json(
      {
        error: "gtm_run_dispatch_queue_failed",
        message: queuedUpdateError.message,
        run_id: run.run_id,
        user_id: userId,
        stage,
      },
      { status: 500 }
    );
  }

  await writeStageEvent(supabase, {
    run_id: run.run_id,
    user_id: userId,
    stage,
    event_type: "queued",
    message: rerun
      ? `User requested rerun for ${stage} after ${existingStatus} state.`
      : `Queued ${stage} for worker-backed GTM skill execution.`,
    status: "queued",
    metadata: {
      input_url: run.input_url,
      ...(rerun
        ? {
            rerun: true,
            previous_status: existingStatus,
          }
        : {}),
    },
    created_at: acceptedAt.toISOString(),
  });

  try {
    await dispatchGtmWorkerStage({
      runId: run.run_id,
      userId,
      inputUrl: run.input_url,
      stage,
    });
  } catch (error: unknown) {
    const errorMessage = getErrorMessage(error);
    const erroredAt = new Date().toISOString();
    const erroredStages: Record<string, GtmStoredStageState> = {
      ...queuedStages,
      [stage]: {
        ...queuedStages[stage],
        status: "errored",
        completed_at: erroredAt,
        error: errorMessage,
      },
    };

    await persistRunState({
      supabase,
      run,
      stages: erroredStages,
      status: "failed",
    });
    await writeStageEvent(supabase, {
      run_id: run.run_id,
      user_id: userId,
      stage,
      event_type: "errored",
      message: `Worker failed to accept ${stage}.`,
      status: "errored",
      error: errorMessage,
      created_at: erroredAt,
    });

    return NextResponse.json(
      {
        error: "gtm_worker_dispatch_failed",
        message: errorMessage,
        run_id: run.run_id,
        user_id: userId,
        stage,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      run_id: run.run_id,
      stage,
      status: "accepted",
      ...(rerun ? { rerun: true } : {}),
    },
    { status: 202 }
  );
}

async function persistRunState(input: {
  supabase: Awaited<ReturnType<typeof createClient>>;
  run: GtmRunDispatchRow;
  stages: Record<string, GtmStoredStageState>;
  status: GtmRunStatus;
}): Promise<void> {
  const { error } = await input.supabase
    .from("gtm_runs")
    .update({
      status: input.status,
      stages: input.stages,
    })
    .eq("run_id", input.run.run_id)
    .eq("user_id", input.run.user_id);

  if (error) {
    throw new Error(
      `Failed to persist GTM run ${input.run.run_id}: ${error.message}`
    );
  }
}

async function writeStageEvent(
  supabase: Awaited<ReturnType<typeof createClient>>,
  event: GtmStageEventInsert
): Promise<void> {
  const parsedEvent = validateGtmStageEventInsert(event);
  const { error } = await supabase.from("gtm_stage_events").insert(parsedEvent);

  if (error) {
    throw new Error(
      `Failed to write GTM stage event for run ${event.run_id}: ${error.message}`
    );
  }
}

async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch (error) {
    return {
      invalid_json: getErrorMessage(error),
    };
  }
}

function getDispatchRequest(value: unknown): GtmRunDispatchRequest | null {
  if (!isRecord(value) || typeof value.stage !== "string") {
    return null;
  }

  if (value.rerun !== undefined && typeof value.rerun !== "boolean") {
    return null;
  }

  const stage = normalizeGtmLighthouseStage(value.stage);
  if (!stage) {
    return null;
  }

  return {
    stage,
    rerun: value.rerun === true,
  };
}

function isRerunnableGtmStageStatus(
  status: ReturnType<typeof getStageStatus>
): boolean {
  return status === "blocked" || status === "errored" || status === "timed_out";
}

function buildQueuedStageState(
  stageState: GtmStoredStageState | undefined,
  acceptedAt: Date
): GtmStoredStageState {
  const preservedStageState: GtmStoredStageState = { ...(stageState ?? {}) };
  delete preservedStageState.completed_at;
  delete preservedStageState.duration_ms;
  delete preservedStageState.error;
  delete preservedStageState.started_at;
  delete preservedStageState.worker_job_id;

  return {
    ...preservedStageState,
    status: "queued",
    accepted_at: acceptedAt.toISOString(),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
