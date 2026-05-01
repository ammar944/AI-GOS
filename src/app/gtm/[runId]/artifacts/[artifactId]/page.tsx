/**
 * /gtm/[runId]/artifacts/[artifactId] — focused canvas view for one artifact.
 *
 * PRD: gtm-conversational-canvas (T9)
 *
 * Auth + ownership are enforced via Supabase RLS (run_id row check) plus
 * Clerk redirect for unauthenticated users. We avoid duplicating the user_id
 * filter here — the gtm_artifacts RLS policy handles it server-side.
 */

import type { ReactElement } from "react";
import { notFound, redirect } from "next/navigation";
import { auth } from "@clerk/nextjs/server";
import { ArtifactCanvas } from "@/components/gtm/ArtifactCanvas";
import { gtmArtifactSchema, type GtmArtifact } from "@/lib/types/gtm-artifact";
import { createClient } from "@/lib/supabase/server";

export const revalidate = 10;

interface ArtifactPageProps {
  params: Promise<{ runId: string; artifactId: string }>;
}

export default async function GtmArtifactPage({
  params,
}: ArtifactPageProps): Promise<ReactElement> {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const { runId, artifactId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("gtm_artifacts")
    .select(
      "id, run_id, user_id, skill, version, parent_id, content_md, source, created_by, metadata, created_at",
    )
    .eq("id", artifactId)
    .eq("run_id", runId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to load gtm_artifact ${artifactId} for run ${runId}: ${error.message}`,
    );
  }
  if (!data) {
    notFound();
  }

  const parsed = gtmArtifactSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(
      `Invalid gtm_artifact row ${artifactId}: ${parsed.error.message}`,
    );
  }

  const artifact: GtmArtifact = parsed.data;
  return <ArtifactCanvas artifact={artifact} runId={runId} />;
}
