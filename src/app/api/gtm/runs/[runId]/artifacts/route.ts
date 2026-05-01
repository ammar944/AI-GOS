/**
 * GET /api/gtm/runs/[runId]/artifacts
 *
 * PRD: gtm-conversational-canvas (T10)
 *
 * Returns all artifacts for a run, sorted by skill then version. Used by the
 * ChatShell to refetch after orchestrator tool calls land new versions.
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 0;

type Ctx = { params: Promise<{ runId: string }> };

export async function GET(_request: Request, { params }: Ctx): Promise<Response> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: "gtm_artifacts_unauthenticated" },
      { status: 401 },
    );
  }

  const { runId } = await params;
  const supabase = await createClient();

  // RLS scopes by user_id (gtm_artifacts policy mirrors gtm_runs).
  const { data, error } = await supabase
    .from("gtm_artifacts")
    .select(
      "id, run_id, user_id, skill, version, parent_id, content_md, source, created_by, metadata, created_at",
    )
    .eq("run_id", runId)
    .order("skill", { ascending: true })
    .order("version", { ascending: true });

  if (error) {
    return NextResponse.json(
      { error: "gtm_artifacts_load_failed", message: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json({ artifacts: data ?? [] });
}
