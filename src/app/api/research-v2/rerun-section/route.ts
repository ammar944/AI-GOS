// Phase 5 — retry a single positioning section through the lab engine.
//
// Body: { runId, zone, executionMode? }
//
// Flow:
//   1. Best-effort abort the section's current section_run_id (idempotent —
//      a 404 or "no active run" is fine).
//   2. Seed only this zone and schedule the lab-engine section job.

import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import type { PositioningSectionId } from '@/lib/ai/prompts/positioning-skills';
import { OrchestrateRpcError } from '@/lib/research-v2/orchestrate-db';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import { scheduleLabSectionJob } from '@/lib/research-v2/lab-section-dispatch';
import {
  corpusReady,
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

function isPositioningZone(value: string): boolean {
  return (POSITIONING_SECTION_IDS as readonly string[]).includes(value);
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
  if (!isPositioningZone(zone)) {
    return NextResponse.json(
      { error: `zone "${zone}" is not a positioning section` },
      { status: 400 },
    );
  }
  const positioningZone = zone as PositioningSectionId;

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

  if (usePartialContext || refinement) {
    return NextResponse.json(
      {
        error: 'lab_refinement_not_supported',
        message:
          'Lab reruns do not support refinement or partial-context replay yet',
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

  let activeSectionRunId: string | null = null;
  let sectionStatus: string | null = null;
  if (artifact) {
    const { data: section } = await supabase
      .from('research_artifact_sections')
      .select('section_run_id, status')
      .eq('artifact_id', artifact.id)
      .eq('zone', zone)
      .maybeSingle();

    if (section) {
      if (typeof section.section_run_id === 'string') {
        activeSectionRunId = section.section_run_id;
      }
      sectionStatus = typeof section.status === 'string' ? section.status : null;
    }
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

  try {
    const session = await loadOwnedResearchSession({ userId, runId });
    if (!session) {
      return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
    }
    if (!corpusReady(session)) {
      return NextResponse.json(
        {
          error: 'corpus_not_ready',
          message:
            'deepResearchProgram corpus must finish before rerunning a lab section',
        },
        { status: 409 },
      );
    }

    const deepResearchProgramData = getDeepResearchProgramData(session);
    if (deepResearchProgramData === null) {
      return NextResponse.json(
        {
          error: 'corpus_data_missing',
          message: `deepResearchProgram status is complete for run ${runId}, but data is missing`,
        },
        { status: 500 },
      );
    }

    const uploadedDocuments = await loadUploadedDocumentContextsForSession({
      metadata: session.metadata,
      supabase,
      userId,
    });
    const researchInput = corpusToResearchInput({
      runId,
      deepResearchProgramData,
      onboardingData: session.onboarding_data ?? {},
      ...(uploadedDocuments.length > 0 ? { uploadedDocuments } : {}),
    });
    const seeded = await scheduleLabSectionJob({
      userId,
      runId,
      sectionId: positioningZone,
      zones: [positioningZone],
      supabase,
      researchInput,
      schedule: after,
    });

    return NextResponse.json({
      ...seeded,
      executionMode,
    });
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error('[rerun-section] seed_orchestration RPC failed:', err.message);
      return NextResponse.json(
        { error: 'seed_failed', message: err.message },
        { status: 500 },
      );
    }
    throw err;
  }
}
