import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import {
  ChatShell,
  type ChatShellRun,
} from "@/components/gtm/ChatShell";
import type { GtmStageEvent } from "@/lib/gtm/stage-events";
import type { GtmArtifact } from "@/lib/types/gtm-artifact";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 10;

interface PageProps {
  params: Promise<{ runId: string }>;
}

export default async function GtmRunPage({
  params,
}: PageProps): Promise<ReactElement> {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const { runId } = await params;
  const supabase = await createClient();
  const { data: run, error } = await supabase
    .from("gtm_runs")
    .select(
      "id, run_id, user_id, input_url, status, manifest, stages, created_at, updated_at"
    )
    .eq("run_id", runId)
    .eq("user_id", userId)
    .maybeSingle<ChatShellRun>();

  if (error) {
    throw new Error(
      `Failed to load GTM run ${runId} for Clerk user ${userId}: ${error.message}`
    );
  }

  if (!run) {
    notFound();
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
    throw new Error(
      `Failed to load GTM stage events for run ${runId}: ${eventsError.message}`
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
    throw new Error(
      `Failed to load GTM artifacts for run ${runId}: ${artifactsError.message}`
    );
  }

  return (
    <ChatShell
      run={run}
      initialEvents={events ?? []}
      initialArtifacts={artifacts ?? []}
    />
  );
}
