import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { jsonError, requireApiUser } from '@/lib/auth/app-access';
import {
  ALL_POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  type AllPositioningSectionId,
  type PositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import {
  researchInputSchema,
  type ResearchInput,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  LAB_SECTION_JOB_TIMEOUT_MS,
  scheduleLabSectionJob,
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

function getDispatchZones(
  sectionId: AllPositioningSectionId,
): readonly AllPositioningSectionId[] {
  return sectionId === PAID_MEDIA_PLAN_SECTION_ID
    ? [PAID_MEDIA_PLAN_SECTION_ID]
    : POSITIONING_SECTION_IDS;
}

function isCommittedPositioningArtifactRow(
  row: { zone: string | null; data: unknown },
): row is { zone: PositioningSectionId; data: unknown } {
  return (POSITIONING_SECTION_IDS as readonly string[]).includes(row.zone ?? '');
}

async function buildPaidMediaResearchInput({
  baseResearchInput,
  parentAuditRunId,
  supabase,
}: {
  baseResearchInput: ResearchInput;
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
    .in('zone', [...POSITIONING_SECTION_IDS]);

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

  const rows = ((data ?? []) as Array<{ zone: string | null; data: unknown }>)
    .filter(isCommittedPositioningArtifactRow);
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

  return {
    ok: true,
    researchInput: researchInputSchema.parse({
      ...baseResearchInput,
      committedPositioningArtifacts,
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

function requirePaidMediaParentAuditRunId(
  result: Awaited<ReturnType<typeof loadParentAuditRunId>> | null,
): string {
  if (result?.ok !== true) {
    throw new Error('Paid media plan dispatch requires a parent audit run id');
  }

  return result.parentAuditRunId;
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
    const paidMediaParent =
      body.section_id === PAID_MEDIA_PLAN_SECTION_ID
        ? await loadParentAuditRunId({
            runId: body.run_id,
            supabase,
            userId,
          })
        : null;

    if (paidMediaParent?.ok === false) {
      return paidMediaParent.response;
    }

    const paidMediaResearchInput =
      body.section_id === PAID_MEDIA_PLAN_SECTION_ID
        ? await buildPaidMediaResearchInput({
            baseResearchInput,
            parentAuditRunId: requirePaidMediaParentAuditRunId(paidMediaParent),
            supabase,
          })
        : { ok: true as const, researchInput: baseResearchInput };

    if (!paidMediaResearchInput.ok) {
      return paidMediaResearchInput.response;
    }

    const researchInput = paidMediaResearchInput.researchInput;
    await scheduleLabSectionJob({
      userId,
      runId: body.run_id,
      sectionId: body.section_id,
      zones,
      supabase,
      researchInput,
      schedule: after,
    });

    return NextResponse.json(
      {
        ok: true,
        run_id: body.run_id,
        section_id: body.section_id,
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
