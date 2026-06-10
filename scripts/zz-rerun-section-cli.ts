#!/usr/bin/env tsx
/**
 * zz-rerun-section-cli.ts — CLI sandbox rerun of lab sections on an EXISTING
 * run, mirroring /api/research-v2/rerun-section minus the Clerk layer (the
 * route requires a browser session; this is the operator CLI path for local
 * quality verification). Service-role, local dev only.
 *
 *   npx tsx scripts/zz-rerun-section-cli.ts <run_id> <zone> [zone...]
 *
 * Zones run IN PARALLEL (the normal fan-out runs six). The process waits for
 * every scheduled job to finish, then prints final section statuses. Each job
 * is bounded by LAB_SECTION_JOB_TIMEOUT_MS (285s) via the dispatch module —
 * no unbounded paid-API loops. When RAILWAY_API_KEY is present the detached
 * review kickoff posts to the local dev server's /api/research-v2/review-section.
 */
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

import { createClient } from "@supabase/supabase-js";

import {
  PAID_MEDIA_PLAN_SECTION_ID,
  isPositioningSectionId,
  type AllPositioningSectionId,
} from "@/lib/ai/prompts/positioning-skills";
import type { ResearchInput } from "@/lib/lab-engine/artifacts/artifact-envelope";
import { isSupportedSectionId } from "@/lib/lab-engine/sections/section-registry";
import { buildCommittedArtifactsResearchInput } from "@/lib/research-v2/committed-positioning-artifacts";
import { corpusToResearchInput } from "@/lib/research-v2/corpus-to-research-input";
import { scheduleLabSectionJob } from "@/lib/research-v2/lab-section-dispatch";
import { resetSectionRunForRerun } from "@/lib/research-v2/orchestrate-db";
import {
  corpusReady,
  getDeepResearchProgramData,
  loadOwnedResearchSession,
} from "@/lib/research-v2/orchestration-session";
import { loadUploadedDocumentContextsForSession } from "@/lib/research-v2/uploaded-document-context.server";

const DEV_BASE_URL = process.env.ZZ_DEV_BASE_URL ?? "http://localhost:3000";

const runId = process.argv[2];
const zoneArgs = process.argv.slice(3);

if (!runId || zoneArgs.length === 0) {
  console.error(
    "Usage: npx tsx scripts/zz-rerun-section-cli.ts <run_id> <zone> [zone...]",
  );
  process.exit(2);
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === "") {
    console.error(`Missing required env ${name}`);
    process.exit(2);
  }
  return value;
}

async function main(): Promise<void> {
  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const zones = zoneArgs.filter((zone): zone is AllPositioningSectionId => {
    const ok =
      isSupportedSectionId(zone) &&
      (isPositioningSectionId(zone) || zone === PAID_MEDIA_PLAN_SECTION_ID);
    if (!ok) {
      console.error(`Skipping unsupported zone: ${zone}`);
    }
    return ok;
  });

  const { data: artifactRow, error: artifactError } = await supabase
    .from("research_artifacts")
    .select("id, user_id")
    .eq("run_id", runId)
    .maybeSingle();

  if (artifactError || !artifactRow) {
    console.error(
      `No research_artifacts row for run ${runId}: ${artifactError?.message ?? "not found"}`,
    );
    process.exit(2);
  }

  const parentAuditRunId = String(artifactRow.id);
  const userId = String(artifactRow.user_id);

  const session = await loadOwnedResearchSession({ userId, runId: runId! });
  if (!session || !corpusReady(session)) {
    console.error("Session not found or corpus not ready — aborting.");
    process.exit(2);
  }
  const deepResearchProgramData = getDeepResearchProgramData(session);
  if (deepResearchProgramData === null) {
    console.error("Corpus data missing — aborting.");
    process.exit(2);
  }

  const uploadedDocuments = await loadUploadedDocumentContextsForSession({
    metadata: session.metadata,
    supabase,
    userId,
  });
  const baseResearchInput = corpusToResearchInput({
    runId: runId!,
    deepResearchProgramData,
    onboardingData: session.onboarding_data ?? {},
    ...(uploadedDocuments.length > 0 ? { uploadedDocuments } : {}),
  });

  const internalKey = process.env.RAILWAY_API_KEY?.trim();
  const reviewDispatch =
    internalKey === undefined || internalKey === ""
      ? undefined
      : {
          url: `${DEV_BASE_URL}/api/research-v2/review-section`,
          internalKey,
        };
  console.log(
    `Review path: ${reviewDispatch === undefined ? "inline (no RAILWAY_API_KEY)" : `detached -> ${reviewDispatch.url}`}`,
  );

  const tasks: Promise<void>[] = [];
  const schedule = (task: () => Promise<void>): void => {
    tasks.push(task());
  };

  for (const zone of zones) {
    let researchInput: ResearchInput = baseResearchInput;
    if (zone === PAID_MEDIA_PLAN_SECTION_ID) {
      const committed = await buildCommittedArtifactsResearchInput({
        baseResearchInput,
        parentAuditRunId,
        supabase,
      });
      if (!committed.ok) {
        console.error(
          `paid-media committed-artifacts input not ready (status ${committed.response.status}) — skipping ${zone}`,
        );
        continue;
      }
      researchInput = committed.researchInput;
    }

    console.log(`[${new Date().toISOString()}] resetting + dispatching ${zone}`);
    await resetSectionRunForRerun({ supabase, userId, runId: runId!, sectionId: zone });
    const seeded = await scheduleLabSectionJob({
      userId,
      runId: runId!,
      sectionId: zone,
      zones: [zone],
      supabase,
      researchInput,
      schedule,
      ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
    });
    console.log(
      `  claim=${seeded.claim.status} sectionRunId=${seeded.claim.sectionRunId ?? "n/a"}`,
    );
  }

  console.log(`Awaiting ${tasks.length} section job(s)...`);
  const startedAt = Date.now();
  await Promise.allSettled(tasks);
  console.log(
    `Jobs settled after ${Math.round((Date.now() - startedAt) / 1000)}s. Final statuses:`,
  );

  const { data: sections } = await supabase
    .from("research_artifact_sections")
    .select("zone, status, verification_tier")
    .eq("artifact_id", parentAuditRunId);
  for (const row of sections ?? []) {
    if (zones.includes(row.zone as AllPositioningSectionId)) {
      console.log(
        `  ${String(row.zone).padEnd(34)} status=${row.status} tier=${row.verification_tier ?? "n/a"}`,
      );
    }
  }
  // Give the detached review kickoffs a moment to land before the process
  // exits (the review itself runs in the dev server's invocation).
  await new Promise((resolve) => setTimeout(resolve, 3_000));
}

main().catch((error) => {
  console.error("FATAL", error);
  process.exit(2);
});
