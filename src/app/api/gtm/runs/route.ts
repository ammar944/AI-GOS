import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { nanoid } from "nanoid";
import { createClient } from "@/lib/supabase/server";
import type { GtmRunStatus } from "@/components/gtm/RunStatusBadge";
import { dispatchGtmWorkerRun } from "@/lib/gtm/worker-dispatch";

interface CreateRunRequest {
  input_url: string;
}

interface GtmRunListRow {
  id: string;
  run_id: string;
  user_id: string;
  input_url: string;
  status: GtmRunStatus;
  created_at: string;
  updated_at: string;
}

export async function GET(): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "gtm_runs_unauthenticated" },
      { status: 401 }
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gtm_runs")
    .select("id, run_id, user_id, input_url, status, created_at, updated_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .returns<GtmRunListRow[]>();

  if (error) {
    return NextResponse.json(
      {
        error: "gtm_runs_list_failed",
        message: error.message,
        user_id: userId,
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ runs: data });
}

export async function POST(request: Request): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "gtm_runs_unauthenticated" },
      { status: 401 }
    );
  }

  const body = await readJson(request);

  if (!isCreateRunRequest(body)) {
    return NextResponse.json(
      {
        error: "gtm_runs_invalid_body",
        message: "Expected JSON body with string input_url.",
      },
      { status: 400 }
    );
  }

  const inputUrl = normalizeHttpUrl(body.input_url);

  if (!inputUrl) {
    return NextResponse.json(
      {
        error: "gtm_runs_invalid_url",
        message: `Invalid input_url: ${body.input_url}`,
      },
      { status: 400 }
    );
  }

  const runId = `run_${nanoid(10)}`;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gtm_runs")
    .insert({
      run_id: runId,
      user_id: userId,
      input_url: inputUrl,
      status: "queued",
      manifest: {},
      stages: {},
    })
    .select("run_id")
    .single<{ run_id: string }>();

  if (error) {
    return NextResponse.json(
      {
        error: "gtm_runs_create_failed",
        message: error.message,
        input_url: inputUrl,
        user_id: userId,
      },
      { status: 500 }
    );
  }

  try {
    await dispatchGtmWorkerRun({
      runId: data.run_id,
      userId,
      inputUrl,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "gtm_worker_dispatch_failed",
        message: getErrorMessage(error),
        run_id: data.run_id,
        user_id: userId,
      },
      { status: 502 }
    );
  }

  return NextResponse.json(
    {
      run_id: data.run_id,
      url: `/gtm/${data.run_id}`,
    },
    { status: 201 }
  );
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

function isCreateRunRequest(value: unknown): value is CreateRunRequest {
  return (
    isRecord(value) &&
    typeof value.input_url === "string" &&
    value.input_url.trim().length > 0
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeHttpUrl(inputUrl: string): string | null {
  try {
    const url = new URL(inputUrl);

    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
