import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import {
  buildGtmPrefillManifestFromDiscovery,
  confirmGtmPrefillManifest,
  getGtmPrefillManifestFromRunManifest,
  getGtmPrefillReviewFields,
  upsertGtmPrefillManifest,
  type GtmPrefillManifest,
} from "@/lib/gtm/onboarding/prefill";
import { createClient } from "@/lib/supabase/server";

type PrefillRouteContext = {
  params: Promise<{ runId: string }>;
};

interface GtmPrefillRunRow {
  run_id: string;
  user_id: string;
  input_url: string;
  status: string;
  manifest: Record<string, unknown> | null;
  stages: Record<string, unknown> | null;
}

type GtmPrefillAction =
  | {
      action: "build_from_discovery";
    }
  | {
      action: "confirm_review";
      fields?: Record<string, string>;
    };

export async function POST(
  request: Request,
  { params }: PrefillRouteContext,
): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "gtm_prefill_unauthenticated" },
      { status: 401 },
    );
  }

  const { runId } = await params;
  const body = await readJson(request);
  const action = getPrefillAction(body);

  if (!action) {
    return NextResponse.json(
      {
        error: "gtm_prefill_invalid_body",
        message: "Expected action build_from_discovery or confirm_review.",
        run_id: runId,
      },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data: run, error: loadError } = await supabase
    .from("gtm_runs")
    .select("run_id, user_id, input_url, status, manifest, stages")
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle<GtmPrefillRunRow>();

  if (loadError) {
    return NextResponse.json(
      {
        error: "gtm_prefill_load_failed",
        message: loadError.message,
        run_id: runId,
        user_id: userId,
      },
      { status: 500 },
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
      { status: 404 },
    );
  }

  let nextPrefill: GtmPrefillManifest;
  try {
    nextPrefill = buildNextPrefill({ run, action });
  } catch (error: unknown) {
    const routeError = getPrefillRouteError(error);
    return NextResponse.json(
      {
        error: routeError.error,
        message: routeError.message,
        run_id: run.run_id,
        user_id: userId,
      },
      { status: routeError.status },
    );
  }
  const nextManifest = upsertGtmPrefillManifest(run.manifest, nextPrefill);
  const { error: updateError } = await supabase
    .from("gtm_runs")
    .update({
      manifest: nextManifest,
    })
    .eq("run_id", run.run_id)
    .eq("user_id", userId);

  if (updateError) {
    return NextResponse.json(
      {
        error: "gtm_prefill_update_failed",
        message: updateError.message,
        run_id: run.run_id,
        user_id: userId,
      },
      { status: 500 },
    );
  }

  return NextResponse.json({
    run_id: run.run_id,
    prefill: nextPrefill,
  });
}

function buildNextPrefill(input: {
  run: GtmPrefillRunRow;
  action: GtmPrefillAction;
}): GtmPrefillManifest {
  if (input.action.action === "build_from_discovery") {
    return buildGtmPrefillManifestFromDiscovery({
      runId: input.run.run_id,
      inputUrl: input.run.input_url,
      output: getDiscoverUrlOutput(input.run),
      existingPrefill: input.run.manifest?.gtm_prefill,
    });
  }

  const current = getGtmPrefillManifestFromRunManifest(input.run.manifest);
  if (!current) {
    throw new PrefillRouteError({
      error: "gtm_prefill_review_required",
      message: `Cannot confirm GTM prefill for run_id=${input.run.run_id}: no valid gtm_prefill manifest is ready for review.`,
      status: 409,
    });
  }

  if (current.status !== "ready_for_review") {
    throw new PrefillRouteError({
      error: "gtm_prefill_review_required",
      message: `Cannot confirm GTM prefill for run_id=${input.run.run_id}: prefill status is ${current.status}, expected ready_for_review.`,
      status: 409,
    });
  }

  const reviewedFields = getSubmittedReviewFields({
    prefill: current,
    fields: input.action.fields,
    runId: input.run.run_id,
  });

  return confirmGtmPrefillManifest({
    prefill: current,
    fields: reviewedFields,
  });
}

function getSubmittedReviewFields(input: {
  prefill: GtmPrefillManifest;
  fields: Record<string, string> | undefined;
  runId: string;
}): Record<string, string> {
  const reviewableFields = getGtmPrefillReviewFields(input.prefill);
  if (reviewableFields.length === 0) {
    throw new PrefillRouteError({
      error: "gtm_prefill_review_required",
      message: `Cannot confirm GTM prefill for run_id=${input.runId}: no website-backed fields are available for review.`,
      status: 409,
    });
  }

  if (!input.fields || Object.keys(input.fields).length === 0) {
    throw new PrefillRouteError({
      error: "gtm_prefill_review_required",
      message: `Cannot confirm GTM prefill for run_id=${input.runId}: submitted fields are required.`,
      status: 409,
    });
  }

  const reviewableFieldKeys = new Set<string>(
    reviewableFields.map((field) => field.fieldKey),
  );
  const submittedFields = Object.fromEntries(
    Object.entries(input.fields).flatMap(([fieldKey, value]) => {
      if (!reviewableFieldKeys.has(fieldKey)) {
        return [];
      }

      const trimmedValue = value.trim();
      if (trimmedValue.length === 0) {
        return [];
      }

      return [[fieldKey, trimmedValue]];
    }),
  );

  if (Object.keys(submittedFields).length === 0) {
    throw new PrefillRouteError({
      error: "gtm_prefill_review_required",
      message: `Cannot confirm GTM prefill for run_id=${input.runId}: submitted fields do not include any reviewable website-backed fields.`,
      status: 409,
    });
  }

  return submittedFields;
}

function getDiscoverUrlOutput(run: GtmPrefillRunRow): unknown {
  const discoverUrl = getStageState(run.stages, "discover-url");
  const output = discoverUrl?.output ?? discoverUrl?.raw_output;

  if (output === undefined) {
    throw new Error(
      `Cannot build GTM prefill for run_id=${run.run_id}: discover-url output is missing.`,
    );
  }

  return output;
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

function getPrefillAction(value: unknown): GtmPrefillAction | null {
  if (!isRecord(value) || typeof value.action !== "string") {
    return null;
  }

  if (value.action === "build_from_discovery") {
    return {
      action: "build_from_discovery",
    };
  }

  if (value.action === "confirm_review") {
    if (value.fields !== undefined && !isStringRecord(value.fields)) {
      return null;
    }

    return {
      action: "confirm_review",
      ...(value.fields ? { fields: value.fields } : {}),
    };
  }

  return null;
}

function getStageState(
  stages: Record<string, unknown> | null,
  stage: string,
): Record<string, unknown> | null {
  if (!stages) {
    return null;
  }

  const state = stages[stage];
  return isRecord(state) ? state : null;
}

function isStringRecord(value: unknown): value is Record<string, string> {
  if (!isRecord(value)) {
    return false;
  }

  return Object.values(value).every((entry) => typeof entry === "string");
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

function getPrefillRouteError(error: unknown): PrefillRouteErrorPayload {
  if (error instanceof PrefillRouteError) {
    return error.payload;
  }

  return {
    error: "gtm_prefill_discovery_missing",
    message: getErrorMessage(error),
    status: 409,
  };
}

interface PrefillRouteErrorPayload {
  error: string;
  message: string;
  status: 409;
}

class PrefillRouteError extends Error {
  readonly payload: PrefillRouteErrorPayload;

  constructor(payload: PrefillRouteErrorPayload) {
    super(payload.message);
    this.name = "PrefillRouteError";
    this.payload = payload;
  }
}
