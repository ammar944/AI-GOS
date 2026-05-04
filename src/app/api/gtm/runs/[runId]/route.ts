import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import type { ChatShellRun } from "@/components/gtm/ChatShell";
import {
  isMissingGtmMessagesTableError,
  type GtmAgentMessage,
} from "@/lib/gtm/agent-messages";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";
import { createClient } from "@/lib/supabase/server";

type RunRouteContext = {
  params: Promise<{ runId: string }>;
};

export async function GET(
  _request: Request,
  { params }: RunRouteContext
): Promise<NextResponse> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json(
      { error: "gtm_run_unauthenticated" },
      { status: 401 }
    );
  }

  const { runId } = await params;
  const supabase = await createClient();
  const { data: run, error: runError } = await supabase
    .from("gtm_runs")
    .select(
      "id, run_id, user_id, input_url, status, manifest, stages, created_at, updated_at"
    )
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle<ChatShellRun>();

  if (runError) {
    return NextResponse.json(
      {
        error: "gtm_run_load_failed",
        message: runError.message,
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
        run_id: runId,
        user_id: userId,
      },
      { status: 404 }
    );
  }

  const { data: events, error: eventsError } = await supabase
    .from("gtm_stage_events")
    .select(
      "id, run_id, user_id, stage, event_type, message, status, metadata, duration_ms, tool_name, artifact_path, source_url, error, created_at"
    )
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<GtmStageEvent[]>();

  if (eventsError) {
    return NextResponse.json(
      {
        error: "gtm_stage_events_load_failed",
        message: eventsError.message,
        run_id: runId,
        user_id: userId,
      },
      { status: 500 }
    );
  }

  const { data: artifacts, error: artifactsError } = await supabase
    .from("gtm_artifacts")
    .select(
      "id, run_id, user_id, skill, version, parent_id, content_md, source, created_by, metadata, created_at"
    )
    .eq("run_id", runId)
    .order("skill", { ascending: true })
    .order("version", { ascending: true })
    .returns<GtmArtifact[]>();

  if (artifactsError) {
    return NextResponse.json(
      {
        error: "gtm_artifacts_load_failed",
        message: artifactsError.message,
        run_id: runId,
        user_id: userId,
      },
      { status: 500 }
    );
  }

  const { data: messages, error: messagesError } = await supabase
    .from("gtm_messages")
    .select(
      "id, run_id, user_id, role, message_type, content, status, metadata, created_at"
    )
    .eq("run_id", runId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<GtmAgentMessage[]>();

  if (messagesError && !isMissingGtmMessagesTableError(messagesError)) {
    return NextResponse.json(
      {
        error: "gtm_messages_load_failed",
        message: messagesError.message,
        run_id: runId,
        user_id: userId,
      },
      { status: 500 }
    );
  }

  if (messagesError) {
    console.warn("[gtm-agent]", {
      component: "gtm-run-api",
      event: "gtm_messages_missing",
      run_id: runId,
      user_id: userId,
      message: messagesError.message,
    });
  }

  return NextResponse.json({
    run,
    events: events ?? [],
    artifacts: artifacts ?? [],
    messages: messagesError ? [] : messages ?? [],
  });
}
