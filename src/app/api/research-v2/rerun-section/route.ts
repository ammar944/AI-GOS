// Phase 5 — retry a single positioning or post-six section through the lab engine.
//
// Body: { runId, zone, executionMode? }
//
// Flow:
//   1. Best-effort abort the section's current section_run_id (idempotent —
//      a 404 or "no active run" is fine).
//   2. Seed only this zone and schedule the lab-engine section job.

import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';

import {
  ALL_POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import type { AllPositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import {
  OrchestrateRpcError,
  resetSectionRunForRerun,
} from '@/lib/research-v2/orchestrate-db';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import { buildCommittedArtifactsResearchInput } from '@/lib/research-v2/committed-positioning-artifacts';
import { buildLabSectionProviderPreflightResponse } from '@/lib/research-v2/lab-section-preflight';
import { isSupportedSectionId } from '@/lib/lab-engine/sections/section-registry';
import { scheduleLabSectionJob } from '@/lib/research-v2/lab-section-dispatch';
import {
  getDeepResearchProgramData,
  loadOwnedResearchSession,
} from '@/lib/research-v2/orchestration-session';
import { loadUploadedDocumentContextsForSession } from '@/lib/research-v2/uploaded-document-context.server';
import { createAdminClient } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const maxDuration = 300;

const ABORT_TIMEOUT_MS = 3_000;

interface RerunSectionRequest {
  runId?: unknown;
  zone?: unknown;
  executionMode?: unknown;
  usePartialContext?: unknown;
  refinement?: unknown;
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function isRerunnableZone(value: string): boolean {
  return (ALL_POSITIONING_SECTION_IDS as readonly string[]).includes(value);
}

function requiresCommittedPositioningArtifacts(
  sectionId: AllPositioningSectionId,
): boolean {
  return sectionId === PAID_MEDIA_PLAN_SECTION_ID;
}

async function abortIfRunning(opts: {
  workerUrl: string;
  workerKey: string;
  sectionRunId: string;
}): Promise<void> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ABORT_TIMEOUT_MS);
  try {
    await fetch(`${opts.workerUrl}/abort`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.workerKey}`,
      },
      body: JSON.stringify({ sectionRunId: opts.sectionRunId }),
      signal: controller.signal,
    });
  } catch (err) {
    // Best-effort — a worker that's already dropped the controller is fine.
    console.warn('[rerun-section] /abort threw (best-effort):', err);
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as RerunSectionRequest;
  const runId = readString(body.runId);
  const zone = readString(body.zone);
  const executionMode = 'lab';
  const usePartialContext = body.usePartialContext === true;
  const refinement = readString(body.refinement);

  if (!runId || !zone) {
    return NextResponse.json(
      { error: 'Missing required fields: runId, zone' },
      { status: 400 },
    );
  }
  if (!isRerunnableZone(zone)) {
    return NextResponse.json(
      { error: `zone "${zone}" is not a rerunnable positioning section` },
      { status: 400 },
    );
  }
  if (!isSupportedSectionId(zone)) {
    return NextResponse.json(
      { error: `zone "${zone}" is not supported by the lab engine` },
      { status: 400 },
    );
  }
  const positioningZone = zone as AllPositioningSectionId;

  if (
    body.executionMode !== undefined &&
    body.executionMode !== null &&
    body.executionMode !== 'lab'
  ) {
    return NextResponse.json(
      {
        error: 'unsupported_execution_mode',
        message: 'Lab is the only supported section execution mode',
      },
      { status: 400 },
    );
  }

  if (usePartialContext) {
    return NextResponse.json(
      {
        error: 'lab_partial_context_not_supported',
        message: 'Lab reruns do not support partial-context replay yet',
      },
      { status: 400 },
    );
  }

  const supabase = createAdminClient();
  const { data: artifact } = await supabase
    .from('research_artifacts')
    .select('id')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();
  const parentAuditRunId = typeof artifact?.id === 'string' ? artifact.id : null;

  let activeSectionRunId: string | null = null;
  let sectionStatus: string | null = null;
  if (parentAuditRunId) {
    const { data: section } = await supabase
      .from('research_artifact_sections')
      .select('section_run_id, status')
      .eq('artifact_id', parentAuditRunId)
      .eq('zone', zone)
      .maybeSingle();

    if (section) {
      if (typeof section.section_run_id === 'string') {
        activeSectionRunId = section.section_run_id;
      }
      sectionStatus = typeof section.status === 'string' ? section.status : null;
    }
  }

  try {
    const session = await loadOwnedResearchSession({ userId, runId });
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    }

    const deepResearchProgramData = getDeepResearchProgramData(session);

    const preflightResponse = buildLabSectionProviderPreflightResponse({
      runId,
      sectionId: positioningZone,
      logTag: '[rerun-section]',
    });
    if (preflightResponse !== null) {
      return preflightResponse;
    }

    // Best-effort abort the prior run, but only if it's still active.
    // Calling /abort on a terminal run would stamp aborted_at onto a
    // historical row and confuse the canvas projector.
    const workerUrl = process.env.RAILWAY_WORKER_URL;
    const workerKey = process.env.RAILWAY_API_KEY;
    if (
      workerUrl &&
      workerKey &&
      activeSectionRunId &&
      sectionStatus === 'running'
    ) {
      await abortIfRunning({
        workerUrl,
        workerKey,
        sectionRunId: activeSectionRunId,
      });
    }

    const uploadedDocuments = await loadUploadedDocumentContextsForSession({
      metadata: session.metadata,
      supabase,
      userId,
    });
    const baseResearchInput = corpusToResearchInput({
      runId,
      deepResearchProgramData,
      onboardingData: session.onboarding_data ?? {},
      ...(uploadedDocuments.length > 0 ? { uploadedDocuments } : {}),
    });
    const needsCommittedArtifacts = requiresCommittedPositioningArtifacts(
      positioningZone,
    );
    let committedResearchInput: Awaited<
      ReturnType<typeof buildCommittedArtifactsResearchInput>
    > | { ok: true; researchInput: ResearchInput };

    if (needsCommittedArtifacts) {
      if (!parentAuditRunId) {
        return NextResponse.json(
          {
            error: 'positioning_sections_not_ready',
            missing_parent: true,
          },
          { status: 409 },
        );
      }
      committedResearchInput = await buildCommittedArtifactsResearchInput({
        baseResearchInput,
        parentAuditRunId,
        supabase,
      });
    } else {
      committedResearchInput = { ok: true, researchInput: baseResearchInput };
    }

    if (!committedResearchInput.ok) {
      return committedResearchInput.response;
    }

    const researchInputForJob: ResearchInput =
      refinement === null
        ? committedResearchInput.researchInput
        : { ...committedResearchInput.researchInput, chatRefinement: refinement };

    await resetSectionRunForRerun({
      supabase,
      userId,
      runId,
      sectionId: positioningZone,
    });
    // True W3 detach: rerun commits get the same dedicated-route review as
    // first-pass commits (a rerun is exactly when the badge matters most).
    const rerunInternalKey = process.env.RAILWAY_API_KEY?.trim();
    const seeded = await scheduleLabSectionJob({
      userId,
      runId,
      sectionId: positioningZone,
      zones: [positioningZone],
      supabase,
      researchInput: researchInputForJob,
      schedule: after,
      ...(rerunInternalKey === undefined || rerunInternalKey === ''
        ? {}
        : {
            reviewDispatch: {
              url: new URL(
                '/api/research-v2/review-section',
                req.url,
              ).toString(),
              internalKey: rerunInternalKey,
            },
          }),
    });

    return NextResponse.json({
      ...seeded,
      executionMode,
    });
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error('[rerun-section] orchestration RPC failed:', err.message);
      return NextResponse.json(
        { error: 'seed_failed', message: err.message },
        { status: 500 },
      );
    }
    throw err;
  }
}
