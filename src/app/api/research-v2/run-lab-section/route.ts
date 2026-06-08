import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { jsonError, requireApiUser } from '@/lib/auth/app-access';
import {
  ALL_POSITIONING_SECTION_IDS,
  CROSS_SECTION_REASONING_SECTION_ID,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  POSITIONING_SYNTHESIS_SECTION_ID,
  isPositioningSectionId,
  type AllPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  researchInputSchema,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import { checkSectionModelDispatchPreflight } from '@/lib/lab-engine/ai/models';
import {
  LAB_SECTION_JOB_TIMEOUT_MS,
  scheduleLabSectionJob,
  type ScheduleLabSectionTask,
} from '@/lib/research-v2/lab-section-dispatch';
import {
  corpusReady,
  getDeepResearchProgramData,
  loadOwnedResearchSession,
} from '@/lib/research-v2/orchestration-session';
import {
  OrchestrateRpcError,
} from '@/lib/research-v2/orchestrate-db';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import {
  evaluateResearchEvidenceReadiness,
  type ResearchEvidenceReadinessRow,
} from '@/lib/research-v2/research-evidence-readiness';
import { loadUploadedDocumentContextsForSession } from '@/lib/research-v2/uploaded-document-context.server';
import { createAdminClient } from '@/lib/supabase/server';

export const LAB_SECTION_ROUTE_TIMEOUT_MS = LAB_SECTION_JOB_TIMEOUT_MS;

export const runtime = 'nodejs';
export const maxDuration = 300;

const RequestSchema = z.object({
  run_id: z.string().uuid(),
  section_id: z.enum(ALL_POSITIONING_SECTION_IDS),
});

type RequestBody = z.infer<typeof RequestSchema>;

interface ParentRollupStatusRow {
  status?: unknown;
  children_complete?: unknown;
  children_total?: unknown;
}

// The paid-media plan and the synthesis capstone both read the six committed
// positioning artifacts plus the cross-section reasoning artifact (and need the
// parent audit run id to load them). The thinker reads the six committed
// positioning artifacts only.
function requiresCommittedPositioningArtifacts(
  sectionId: AllPositioningSectionId,
): boolean {
  return (
    sectionId === CROSS_SECTION_REASONING_SECTION_ID ||
    sectionId === PAID_MEDIA_PLAN_SECTION_ID ||
    sectionId === POSITIONING_SYNTHESIS_SECTION_ID
  );
}

function getDispatchZones(
  sectionId: AllPositioningSectionId,
): readonly AllPositioningSectionId[] {
  if (sectionId === CROSS_SECTION_REASONING_SECTION_ID) {
    return [CROSS_SECTION_REASONING_SECTION_ID];
  }
  if (sectionId === PAID_MEDIA_PLAN_SECTION_ID) {
    return [PAID_MEDIA_PLAN_SECTION_ID];
  }
  if (sectionId === POSITIONING_SYNTHESIS_SECTION_ID) {
    return [POSITIONING_SYNTHESIS_SECTION_ID];
  }
  return POSITIONING_SECTION_IDS;
}

function buildLabSectionProviderPreflightResponse({
  runId,
  sectionId,
}: {
  runId: string;
  sectionId: AllPositioningSectionId;
}): NextResponse | null {
  const preflight = checkSectionModelDispatchPreflight();

  if (preflight.ok) {
    return null;
  }

  console.error('[run-lab-section] lab section provider preflight failed', {
    runId,
    sectionId,
    error: preflight.error,
    missingEnv: preflight.missingEnv,
    provider: preflight.provider,
  });

  return NextResponse.json(
    {
      error: 'lab_engine_provider_preflight_failed',
      message: preflight.message,
      missingEnv: preflight.missingEnv,
      provider: preflight.provider ?? null,
    },
    { status: 500 },
  );
}

function isCommittedPositioningArtifactRow(
  row: ResearchEvidenceReadinessRow,
): row is ResearchEvidenceReadinessRow & { zone: PositioningSectionId } {
  return (POSITIONING_SECTION_IDS as readonly string[]).includes(row.zone ?? '');
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
    .select('zone, data, verification_tier, verification_flag')
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

  const artifactRows = (data ?? []) as ResearchEvidenceReadinessRow[];
  const rows = artifactRows.filter(isCommittedPositioningArtifactRow);
  const crossSectionReasoningArtifact = includeCrossSectionReasoningArtifact
    ? artifactRows.find(
        (row) => row.zone === CROSS_SECTION_REASONING_SECTION_ID,
      )?.data
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

  // ARI: readiness is computed as a COVERAGE annotation, never a gate. Capstones
  // (thinker/synthesis/paid-media) dispatch on 6/6 regardless of section quality
  // and reason over thin sections, which are then badged needs_review at commit.
  const readiness = evaluateResearchEvidenceReadiness(artifactRows);

  return {
    ok: true,
    researchInput: researchInputSchema.parse({
      ...baseResearchInput,
      committedPositioningArtifacts,
      evidenceCoverage: {
        ready: readiness.ready,
        blockedSections: readiness.blockedSections,
        reasons: readiness.reasons,
      },
      ...(crossSectionReasoningArtifact === undefined
        ? {}
        : { crossSectionReasoningArtifact }),
    }),
  };
}

async function loadParentAuditRunId({
  runId,
  supabase,
  userId,
}: {
  runId: string;
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
}): Promise<
  | { ok: true; parentAuditRunId: string }
  | {
      ok: false;
      response: NextResponse;
    }
> {
  const { data, error } = await supabase
    .from('research_artifacts')
    .select('id')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'parent_audit_lookup_failed',
          message: error.message,
        },
        { status: 500 },
      ),
    };
  }

  const parentAuditRunId = typeof data?.id === 'string' ? data.id : null;
  if (!parentAuditRunId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'positioning_sections_not_ready',
          missing_parent: true,
        },
        { status: 409 },
      ),
    };
  }

  return { ok: true, parentAuditRunId };
}

function requireParentAuditRunId(
  result: Awaited<ReturnType<typeof loadParentAuditRunId>> | null,
): string {
  if (result?.ok !== true) {
    throw new Error('Capstone section dispatch requires a parent audit run id');
  }

  return result.parentAuditRunId;
}

function isSixSectionRollupComplete(row: ParentRollupStatusRow | null): boolean {
  if (row === null) {
    return false;
  }

  const childrenComplete =
    typeof row.children_complete === 'number' ? row.children_complete : 0;
  const childrenTotal =
    typeof row.children_total === 'number'
      ? row.children_total
      : POSITIONING_SECTION_IDS.length;

  return (
    row.status === 'complete' ||
    (childrenTotal >= POSITIONING_SECTION_IDS.length &&
      childrenComplete >= childrenTotal)
  );
}

async function hasCompleteSixSectionRollup({
  parentAuditRunId,
  runId,
  supabase,
}: {
  parentAuditRunId: string;
  runId: string;
  supabase: ReturnType<typeof createAdminClient>;
}): Promise<boolean> {
  const { data, error } = await supabase
    .from('research_artifacts')
    .select('status, children_complete, children_total')
    .eq('id', parentAuditRunId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `research_artifacts rollup lookup failed for run_id=${runId} parent_audit_run_id=${parentAuditRunId}: ${error.message}`,
    );
  }

  return isSixSectionRollupComplete(
    (data as ParentRollupStatusRow | null) ?? null,
  );
}

async function dispatchCrossSectionReasoningIfSixComplete({
  baseResearchInput,
  parentAuditRunId,
  runId,
  schedule,
  supabase,
  userId,
}: {
  baseResearchInput: ResearchInput;
  parentAuditRunId: string;
  runId: string;
  schedule: ScheduleLabSectionTask;
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
}): Promise<void> {
  const rollupComplete = await hasCompleteSixSectionRollup({
    parentAuditRunId,
    runId,
    supabase,
  });

  if (!rollupComplete) {
    return;
  }

  const capstoneResearchInput = await buildCommittedArtifactsResearchInput({
    baseResearchInput,
    includeCrossSectionReasoningArtifact: false,
    parentAuditRunId,
    supabase,
  });

  if (!capstoneResearchInput.ok) {
    if (capstoneResearchInput.response.status === 409) {
      return;
    }

    throw new Error(
      `cross-section reasoning dispatch failed while preparing committed artifacts for run_id=${runId} parent_audit_run_id=${parentAuditRunId}: response status ${capstoneResearchInput.response.status}`,
    );
  }

  await scheduleLabSectionJob({
    userId,
    runId,
    sectionId: CROSS_SECTION_REASONING_SECTION_ID,
    zones: [CROSS_SECTION_REASONING_SECTION_ID],
    supabase,
    researchInput: capstoneResearchInput.researchInput,
    schedule,
  });
}

export async function POST(request: Request): Promise<Response> {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const apiUser = await requireApiUser();
  if (apiUser instanceof Response) return apiUser;
  if (apiUser.actorUserId !== userId) {
    return jsonError('Unauthorized', 401);
  }

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'invalid_json', message: 'request body must be JSON' },
      { status: 400 },
    );
  }

  let body: RequestBody;
  try {
    body = RequestSchema.parse(rawBody);
  } catch (err) {
    if (err instanceof ZodError) {
      return NextResponse.json(
        { error: 'invalid_body', issues: err.issues },
        { status: 400 },
      );
    }
    throw err;
  }

  const session = await loadOwnedResearchSession({
    userId,
    runId: body.run_id,
  });
  if (!session) {
    return NextResponse.json({ error: 'session_not_found' }, { status: 404 });
  }

  if (!corpusReady(session)) {
    return NextResponse.json(
      {
        error: 'corpus_not_ready',
        message:
          'deepResearchProgram corpus must finish before running a section',
      },
      { status: 409 },
    );
  }

  const deepResearchProgramData = getDeepResearchProgramData(session);
  if (deepResearchProgramData === null) {
    return NextResponse.json(
      {
        error: 'corpus_data_missing',
        message: `deepResearchProgram status is complete for run ${body.run_id}, but data is missing`,
      },
      { status: 500 },
    );
  }

  const preflightResponse = buildLabSectionProviderPreflightResponse({
    runId: body.run_id,
    sectionId: body.section_id,
  });
  if (preflightResponse !== null) {
    return preflightResponse;
  }

  try {
    const zones = getDispatchZones(body.section_id);
    const supabase = createAdminClient();
    const uploadedDocuments = await loadUploadedDocumentContextsForSession({
      metadata: session.metadata,
      supabase,
      userId,
    });
    const baseResearchInput = corpusToResearchInput({
      runId: body.run_id,
      deepResearchProgramData,
      onboardingData: session.onboarding_data ?? {},
      ...(uploadedDocuments.length > 0 ? { uploadedDocuments } : {}),
    });
    const needsCommittedArtifacts = requiresCommittedPositioningArtifacts(
      body.section_id,
    );
    const capstoneParent = needsCommittedArtifacts
      ? await loadParentAuditRunId({
          runId: body.run_id,
          supabase,
          userId,
        })
      : null;

    if (capstoneParent?.ok === false) {
      return capstoneParent.response;
    }

    const capstoneResearchInput = needsCommittedArtifacts
      ? await buildCommittedArtifactsResearchInput({
          baseResearchInput,
          includeCrossSectionReasoningArtifact:
            body.section_id === PAID_MEDIA_PLAN_SECTION_ID ||
            body.section_id === POSITIONING_SYNTHESIS_SECTION_ID,
          parentAuditRunId: requireParentAuditRunId(capstoneParent),
          supabase,
        })
      : { ok: true as const, researchInput: baseResearchInput };

    if (!capstoneResearchInput.ok) {
      return capstoneResearchInput.response;
    }

    const researchInput = capstoneResearchInput.researchInput;
    const scheduled = await scheduleLabSectionJob({
      userId,
      runId: body.run_id,
      sectionId: body.section_id,
      zones,
      supabase,
      researchInput,
      schedule: after,
      ...(isPositioningSectionId(body.section_id)
        ? {
            onJobComplete: async ({ seeded }): Promise<void> => {
              try {
                await dispatchCrossSectionReasoningIfSixComplete({
                  baseResearchInput,
                  parentAuditRunId: seeded.parent_audit_run_id,
                  runId: body.run_id,
                  schedule: after,
                  supabase,
                  userId,
                });
              } catch (error) {
                console.error(
                  '[run-lab-section] cross-section reasoning auto-dispatch failed',
                  {
                    runId: body.run_id,
                    parentAuditRunId: seeded.parent_audit_run_id,
                    sectionId: body.section_id,
                    message:
                      error instanceof Error ? error.message : String(error),
                  },
                );
              }
            },
          }
        : {}),
    });

    return NextResponse.json(
      {
        ok: true,
        run_id: body.run_id,
        section_id: body.section_id,
        claim_status: scheduled.claim.status,
        ...(scheduled.claim.sectionRunId
          ? { section_run_id: scheduled.claim.sectionRunId }
          : {}),
      },
      { status: 202 },
    );
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error('[run-lab-section] seed_orchestration RPC failed', {
        runId: body.run_id,
        sectionId: body.section_id,
        message: err.message,
      });
      return NextResponse.json(
        { error: 'seed_failed', message: err.message },
        { status: 500 },
      );
    }

    throw err;
  }
}
