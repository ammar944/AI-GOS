import type { GtmLighthouseStage } from "@/lib/gtm/stage-mapping";

export interface GtmWorkerDispatchInput {
  runId: string;
  userId: string;
  inputUrl: string;
}

export interface GtmWorkerStageDispatchInput extends GtmWorkerDispatchInput {
  stage: GtmLighthouseStage;
}

export interface GtmWorkerDispatchResult {
  run_id: string;
  stage?: GtmLighthouseStage;
  status: "accepted";
}

export function getGtmWorkerUrl(
  env: NodeJS.ProcessEnv = process.env
): string | null {
  const explicitUrl = env.AIGOS_GTM_WORKER_URL?.trim();
  if (explicitUrl) {
    return explicitUrl.replace(/\/$/, "");
  }

  const railwayUrl = env.RAILWAY_WORKER_URL?.trim();
  if (railwayUrl) {
    return railwayUrl.replace(/\/$/, "");
  }

  if (env.NODE_ENV !== "production") {
    return "http://localhost:3001";
  }

  return null;
}

export async function dispatchGtmWorkerStage(
  input: GtmWorkerStageDispatchInput
): Promise<GtmWorkerDispatchResult> {
  return dispatchGtmWorker(input, input.stage);
}

export async function dispatchGtmWorkerRun(
  input: GtmWorkerDispatchInput
): Promise<GtmWorkerDispatchResult> {
  return dispatchGtmWorker(input, null);
}

async function dispatchGtmWorker(
  input: GtmWorkerDispatchInput,
  stage: GtmLighthouseStage | null
): Promise<GtmWorkerDispatchResult> {
  const workerUrl = getGtmWorkerUrl();
  if (!workerUrl) {
    throw new Error(
      "GTM worker URL is not configured. Set AIGOS_GTM_WORKER_URL or RAILWAY_WORKER_URL."
    );
  }

  logGtmWorkerDispatch("dispatch_request", {
    run_id: input.runId,
    user_id: input.userId,
    input_url: input.inputUrl,
    worker_url: workerUrl,
    ...(stage ? { stage } : {}),
  });

  let response: Response;
  try {
    response = await fetch(
      `${workerUrl}/gtm/runs/${encodeURIComponent(input.runId)}/dispatch`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.RAILWAY_API_KEY
            ? { authorization: `Bearer ${process.env.RAILWAY_API_KEY}` }
            : {}),
        },
        body: JSON.stringify({
          run_id: input.runId,
          user_id: input.userId,
          input_url: input.inputUrl,
          ...(stage ? { stage } : {}),
        }),
      }
    );
  } catch (error: unknown) {
    logGtmWorkerDispatch("dispatch_unreachable", {
      run_id: input.runId,
      user_id: input.userId,
      worker_url: workerUrl,
      ...(stage ? { stage } : {}),
      error: getErrorMessage(error),
    });
    throw new Error(
      `GTM worker is unreachable at ${workerUrl} while dispatching ${stage ? `stage=${stage}` : "full GTM run"} run_id=${input.runId}. Start the local worker with "cd research-worker && npm run dev" or set AIGOS_GTM_WORKER_URL/RAILWAY_WORKER_URL to a reachable worker. Last error: ${getErrorMessage(error)}`
    );
  }

  const responseText = await response.text();
  if (!response.ok) {
    logGtmWorkerDispatch("dispatch_rejected", {
      run_id: input.runId,
      user_id: input.userId,
      worker_url: workerUrl,
      status: response.status,
      body: responseText,
      ...(stage ? { stage } : {}),
    });
    throw new Error(
      `GTM worker rejected ${stage ?? "full GTM run"} for run ${input.runId}: status=${response.status} body=${responseText}`
    );
  }

  const parsed = parseWorkerDispatchResponse(responseText, input, stage);
  logGtmWorkerDispatch("dispatch_accepted", {
    run_id: parsed.run_id,
    user_id: input.userId,
    worker_url: workerUrl,
    status: parsed.status,
    ...(parsed.stage ? { stage: parsed.stage } : {}),
  });
  return parsed;
}

function parseWorkerDispatchResponse(
  responseText: string,
  input: GtmWorkerDispatchInput,
  stage: GtmLighthouseStage | null
): GtmWorkerDispatchResult {
  if (!responseText) {
    return {
      run_id: input.runId,
      ...(stage ? { stage } : {}),
      status: "accepted",
    };
  }

  const parsed = JSON.parse(responseText) as unknown;
  if (!isRecord(parsed) || parsed.status !== "accepted") {
    throw new Error(
      `GTM worker returned an invalid acceptance payload for run ${input.runId}.`
    );
  }

  return {
    run_id: typeof parsed.run_id === "string" ? parsed.run_id : input.runId,
    ...(stage ? { stage } : {}),
    status: "accepted",
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

function logGtmWorkerDispatch(
  event: string,
  fields: Record<string, unknown>
): void {
  const payload = JSON.stringify({
    component: "next-gtm-worker-dispatch",
    event,
    ...fields,
    created_at: new Date().toISOString(),
  });
  const log = event === "dispatch_accepted" || event === "dispatch_request"
    ? console.info
    : console.error;
  log(
    "[gtm-agent]",
    payload
  );
}
