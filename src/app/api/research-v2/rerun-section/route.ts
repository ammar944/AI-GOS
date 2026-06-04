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
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
} from '@/lib/ai/prompts/positioning-skills';
import type {
  AllPositioningSectionId,
  PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  OrchestrateRpcError,
  resetSectionRunForRerun,
} from '@/lib/research-v2/orchestrate-db';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import {
  researchInputSchema,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import { isSupportedSectionId } from '@/lib/lab-engine/sections/section-registry';
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

function isRerunnableZone(value: string): boolean {
  return (ALL_POSITIONING_SECTION_IDS as readonly string[]).includes(value);
}

function requiresCommittedPositioningArtifacts(
  sectionId: AllPositioningSectionId,
): boolean {
  return (
    sectionId === CROSS_SECTION_REASONING_SECTION_ID ||
    sectionId === PAID_MEDIA_PLAN_SECTION_ID ||
    sectionId === POSITIONING_SYNTHESIS_SECTION_ID
  );
}

function shouldIncludeCrossSectionReasoningArtifact(
  sectionId: AllPositioningSectionId,
): boolean {
  return (
    sectionId === PAID_MEDIA_PLAN_SECTION_ID ||
    sectionId === POSITIONING_SYNTHESIS_SECTION_ID
  );
}

function isCommittedPositioningArtifactRow(
  row: { zone: string | null; data: unknown },
): row is { zone: PositioningSectionId; data: unknown } {
  return (POSITIONING_SECTION_IDS as readonly string[]).includes(row.zone ?? '');
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

async function buildCommittedArtifactsResearchInput({
  baseResearchInput,
  includeCrossSectionReasoningArtifact,
  parentAuditRunId,
  supabase,
}: {
  baseResearchInput: ResearchInput;
  includeCrossSectionReasoningArtifact: boolean;
  parentAuditRunId: string;
  supabase: ReturnType<typeof createAdminClient>;
}): Promise<
  | { ok: true; researchInput: ResearchInput }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const { data, error } = await supabase
    .from('research_artifact_sections')
    .select('zone, data')
    .eq('artifact_id', parentAuditRunId)
    .eq('status', 'complete')
    .in('zone', [
      ...POSITIONING_SECTION_IDS,
      ...(includeCrossSectionReasoningArtifact
        ? [CROSS_SECTION_REASONING_SECTION_ID]
        : []),
    ]);

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'committed_artifacts_lookup_failed',
          message: error.message,
        },
        { status: 500 },
      ),
    };
  }

  const rawRows = (data ?? []) as Array<{ zone: string | null; data: unknown }>;
  const rows = rawRows.filter(isCommittedPositioningArtifactRow);
  const crossSectionReasoningArtifact = includeCrossSectionReasoningArtifact
    ? rawRows.find((row) => row.zone === CROSS_SECTION_REASONING_SECTION_ID)
        ?.data
    : undefined;
  const committedPositioningArtifacts = Object.fromEntries(
    rows.map((row) => [row.zone, row.data]),
  ) as Partial<Record<PositioningSectionId, unknown>>;
  const missingSections = POSITIONING_SECTION_IDS.filter(
    (sectionId) => committedPositioningArtifacts[sectionId] === undefined,
  );

  if (missingSections.length > 0) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'positioning_sections_not_ready',
          missing_sections: missingSections,
        },
        { status: 409 },
      ),
    };
  }

  if (
    includeCrossSectionReasoningArtifact &&
    crossSectionReasoningArtifact === undefined
  ) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'cross_section_reasoning_not_ready',
          missing_sections: [CROSS_SECTION_REASONING_SECTION_ID],
        },
        { status: 409 },
      ),
    };
  }

  return {
    ok: true,
    researchInput: researchInputSchema.parse({
      ...baseResearchInput,
      committedPositioningArtifacts,
      ...(crossSectionReasoningArtifact === undefined
        ? {}
        : { crossSectionReasoningArtifact }),
    }),
  };
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
          includeCrossSectionReasoningArtifact:
            shouldIncludeCrossSectionReasoningArtifact(positioningZone),
          parentAuditRunId,
          supabase,
        });
    } else {
      committedResearchInput = { ok: true, researchInput: baseResearchInput };
    }

    if (!committedResearchInput.ok) {
      return committedResearchInput.response;
    }

    await resetSectionRunForRerun({
      supabase,
      userId,
      runId,
      sectionId: positioningZone,
    });
    const seeded = await scheduleLabSectionJob({
      userId,
      runId,
      sectionId: positioningZone,
      zones: [positioningZone],
      supabase,
      researchInput: committedResearchInput.researchInput,
      schedule: after,
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
