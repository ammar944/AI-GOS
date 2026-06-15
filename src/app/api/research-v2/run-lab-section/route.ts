import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { jsonError, requireApiUser } from '@/lib/auth/app-access';
import {
  ALL_POSITIONING_SECTION_IDS,
  PAID_MEDIA_PLAN_SECTION_ID,
  POSITIONING_SECTION_IDS,
  isPositioningSectionId,
  type AllPositioningSectionId,
} from '@/lib/ai/prompts/positioning-skills';
import type { ResearchInput } from '@/lib/lab-engine/artifacts/artifact-envelope';
import { buildCommittedArtifactsResearchInput } from '@/lib/research-v2/committed-positioning-artifacts';
import { buildLabSectionProviderPreflightResponse } from '@/lib/research-v2/lab-section-preflight';
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
  resetSectionRunForRerun,
} from '@/lib/research-v2/orchestrate-db';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import { realBuyerQuoteCountFromArtifactData } from '@/lib/research-v2/research-evidence-readiness';
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

// True W3 detach: the post-commit agentic review ships to its own route
// invocation so it never competes with the 285s section job for this route's
// 300s clock. Disabled (inline fallback) when the internal key is absent.
function buildReviewDispatch(
  request: Request,
): { url: string; internalKey: string } | undefined {
  const internalKey = process.env.RAILWAY_API_KEY?.trim();
  if (internalKey === undefined || internalKey === '') {
    return undefined;
  }
  return {
    url: new URL('/api/research-v2/review-section', request.url).toString(),
    internalKey,
  };
}

// W3-A pure-lean: the paid-media plan reads the six committed positioning
// artifacts directly off the 6/6 rollup (and needs the parent audit run id to
// load them). The thinker + synthesis capstones no longer auto-dispatch through
// this route, so paid-media is the only section here that requires committed
// artifacts.
function requiresCommittedPositioningArtifacts(
  sectionId: AllPositioningSectionId,
): boolean {
  return sectionId === PAID_MEDIA_PLAN_SECTION_ID;
}

function getDispatchZones(
  sectionId: AllPositioningSectionId,
): readonly AllPositioningSectionId[] {
  if (sectionId === PAID_MEDIA_PLAN_SECTION_ID) {
    return [PAID_MEDIA_PLAN_SECTION_ID];
  }
  return POSITIONING_SECTION_IDS;
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

// ADR-0012 auto-rerun: when the fan-out wave has fully drained (every core
// section terminal), dispatch exactly one fresh attempt per rescue-eligible
// section — deliberately reproducing the free-lane condition that made manual
// reruns succeed. Rescue-eligible: core sections in `error`, plus a
// positioningVoiceOfCustomer row that committed `complete` but STARVED (zero
// real buyer quotes — the known fan-out-contention failure), so paid-media
// never reads a starved VoC. Server-side (survives closed tabs, unlike the
// bounded client retry in use-audit-state). Once-guard is structural: the
// rerun dispatch's onJobComplete carries only the paid-media check, never this
// pass, so a rerun that fails — or commits starved again — cannot re-trigger
// itself. Returns the number of rescues dispatched: the first-pass hook skips
// its paid-media check in the same invocation when this is non-zero, because
// resetSectionRunForRerun flips the rollup below 6/6 only if it lands before
// the paid-media rollup read.
export async function dispatchAutoRerunForErroredSections({
  baseResearchInput,
  parentAuditRunId,
  reviewDispatch,
  runId,
  schedule,
  supabase,
  userId,
}: {
  baseResearchInput: ResearchInput;
  parentAuditRunId: string;
  reviewDispatch?: { url: string; internalKey: string };
  runId: string;
  schedule: ScheduleLabSectionTask;
  supabase: ReturnType<typeof createAdminClient>;
  userId: string;
}): Promise<number> {
  const { data, error } = await supabase
    .from('research_artifact_sections')
    .select('zone, status, data')
    .eq('artifact_id', parentAuditRunId);

  if (error) {
    throw new Error(
      `auto-rerun section status lookup failed for run_id=${runId}: ${error.message}`,
    );
  }

  // Per-zone attempt cap (at most one auto-rescue per zone per run): each
  // rescue calls resetSectionRunForRerun, which INSERTs a fresh
  // research_section_runs row, so a zone's run-row count is its attempt count.
  // A never-rescued zone has exactly the one seeded run row; a zone already
  // rescued once has >= 2. Retrying a deterministic shape/editorial failure
  // (VoC/OfferDiagnostic floors) never converges, so cap it here instead of
  // re-dispatching on every drained wave for the full run-deadline window.
  const { data: runRowsData, error: runRowsError } = await supabase
    .from('research_section_runs')
    .select('zone')
    .eq('artifact_id', parentAuditRunId);

  if (runRowsError) {
    throw new Error(
      `auto-rerun attempt-count lookup failed for run_id=${runId}: ${runRowsError.message}`,
    );
  }

  const attemptCountByZone = new Map<string, number>();
  for (const row of (runRowsData ?? []) as { zone?: unknown }[]) {
    if (typeof row.zone === 'string') {
      attemptCountByZone.set(
        row.zone,
        (attemptCountByZone.get(row.zone) ?? 0) + 1,
      );
    }
  }

  const coreZones = POSITIONING_SECTION_IDS as readonly string[];
  const coreRows = (
    (data ?? []) as { zone?: unknown; status?: unknown; data?: unknown }[]
  ).filter(
    (row): row is { zone: string; status: string; data: unknown } =>
      typeof row.zone === 'string' &&
      typeof row.status === 'string' &&
      coreZones.includes(row.zone),
  );

  if (coreRows.length < coreZones.length) {
    return 0;
  }

  const waveDrained = coreRows.every(
    (row) => row.status === 'complete' || row.status === 'error',
  );
  const erroredZones = coreRows
    .filter((row) => row.status === 'error')
    .map((row) => row.zone)
    .filter(isPositioningSectionId);
  // Starved-complete VoC: committed clean but with zero real buyer quotes (the
  // quote-count rule and the `data.body` envelope shape are shared with
  // research-evidence-readiness). Rescued exactly like an errored section.
  const starvedVoiceOfCustomerZones = coreRows
    .filter(
      (row) =>
        row.zone === 'positioningVoiceOfCustomer' &&
        row.status === 'complete' &&
        realBuyerQuoteCountFromArtifactData(row.data) === 0,
    )
    .map((row) => row.zone)
    .filter(isPositioningSectionId);
  const rescueZones = [
    ...erroredZones,
    ...starvedVoiceOfCustomerZones,
  ].filter((zone) => (attemptCountByZone.get(zone) ?? 0) < 2);

  if (!waveDrained || rescueZones.length === 0) {
    return 0;
  }

  let rescuesDispatched = 0;
  for (const sectionId of rescueZones) {
    console.info(
      erroredZones.includes(sectionId)
        ? '[run-lab-section] ADR-0012 auto-rerun dispatching'
        : '[run-lab-section] starved-VoC auto-rescue dispatching',
      {
        runId,
        sectionId,
      },
    );
    await resetSectionRunForRerun({ supabase, userId, runId, sectionId });
    await scheduleLabSectionJob({
      userId,
      runId,
      sectionId,
      zones: [sectionId],
      supabase,
      researchInput: baseResearchInput,
      schedule,
      ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
      // Paid-media still fans out off a successful rerun's 6/6, but the
      // auto-rerun pass itself never re-attaches (once per section per run).
      onJobComplete: async ({ seeded }): Promise<void> => {
        try {
          await dispatchPaidMediaIfSixComplete({
            baseResearchInput,
            parentAuditRunId: seeded.parent_audit_run_id,
            ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
            runId,
            schedule,
            supabase,
            userId,
          });
        } catch (hookError) {
          console.error(
            '[run-lab-section] paid-media dispatch after auto-rerun failed',
            {
              runId,
              sectionId,
              message:
                hookError instanceof Error
                  ? hookError.message
                  : String(hookError),
            },
          );
        }
      },
    });
    rescuesDispatched += 1;
  }

  return rescuesDispatched;
}

// W3-A pure-lean: once the six positioning sections roll up complete, dispatch
// the paid-media plan directly off the 6/6 rollup. Paid-media is now the only
// post-six section in the dispatch chain. This fires from the SERVER-side
// onJobComplete hook of the sixth core-section commit, so it survives the browser
// tab closing (autonomy invariant — Jun-8 fix carried forward). The client may
// also trigger paid-media; claimSectionRun CAS de-dupes the double-trigger.
// Paid-media is terminal, so its own onJobComplete fans out nothing further.
async function dispatchPaidMediaIfSixComplete({
  baseResearchInput,
  parentAuditRunId,
  reviewDispatch,
  runId,
  schedule,
  supabase,
  userId,
}: {
  baseResearchInput: ResearchInput;
  parentAuditRunId: string;
  reviewDispatch?: { url: string; internalKey: string };
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

  const paidMediaResearchInput = await buildCommittedArtifactsResearchInput({
    baseResearchInput,
    parentAuditRunId,
    supabase,
  });

  if (!paidMediaResearchInput.ok) {
    // 409 = positioning_sections_not_ready: a read-after-write race against the
    // sixth commit. The client poll is the CAS-guarded fallback if a tab is open.
    if (paidMediaResearchInput.response.status === 409) {
      return;
    }

    throw new Error(
      `paid-media dispatch failed while preparing committed artifacts for run_id=${runId} parent_audit_run_id=${parentAuditRunId}: response status ${paidMediaResearchInput.response.status}`,
    );
  }

  await scheduleLabSectionJob({
    userId,
    runId,
    sectionId: PAID_MEDIA_PLAN_SECTION_ID,
    zones: getDispatchZones(PAID_MEDIA_PLAN_SECTION_ID),
    supabase,
    researchInput: paidMediaResearchInput.researchInput,
    schedule,
    ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
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
    logTag: '[run-lab-section]',
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
          parentAuditRunId: requireParentAuditRunId(capstoneParent),
          supabase,
        })
      : { ok: true as const, researchInput: baseResearchInput };

    if (!capstoneResearchInput.ok) {
      return capstoneResearchInput.response;
    }

    const researchInput = capstoneResearchInput.researchInput;
    const reviewDispatch = buildReviewDispatch(request);
    const scheduled = await scheduleLabSectionJob({
      userId,
      runId: body.run_id,
      sectionId: body.section_id,
      zones,
      supabase,
      researchInput,
      schedule: after,
      ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
      ...(isPositioningSectionId(body.section_id)
        ? {
            // W3-A autonomy invariant: when the sixth positioning section commits
            // server-side, fan out the paid-media plan from the SERVER so it
            // survives the browser tab closing. The client poll may also trigger
            // paid-media; claimSectionRun CAS de-dupes the double-trigger.
            // Wrapped in try/catch so a dispatch error never fails the core
            // section's own commit.
            onJobComplete: async ({ seeded }): Promise<void> => {
              // ADR-0012: one server-side rerun per rescue-eligible section
              // once the wave drains (errored sections + starved-complete
              // VoC) — survives closed tabs (the client retry cannot). MUST
              // be awaited BEFORE the paid-media check: resetSectionRunForRerun
              // flips the rollup back below 6/6 only if it lands before the
              // paid-media rollup read.
              let rescuesDispatched = 0;
              try {
                rescuesDispatched = await dispatchAutoRerunForErroredSections({
                  baseResearchInput,
                  parentAuditRunId: seeded.parent_audit_run_id,
                  ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
                  runId: body.run_id,
                  schedule: after,
                  supabase,
                  userId,
                });
              } catch (error) {
                console.error(
                  '[run-lab-section] ADR-0012 auto-rerun pass failed',
                  {
                    runId: body.run_id,
                    parentAuditRunId: seeded.parent_audit_run_id,
                    sectionId: body.section_id,
                    message:
                      error instanceof Error ? error.message : String(error),
                  },
                );
              }

              if (rescuesDispatched > 0) {
                // A rescue is in flight, so this invocation must not race the
                // rollup reset. The rescue's own onJobComplete carries the
                // paid-media check, so the chain still completes.
                return;
              }

              try {
                await dispatchPaidMediaIfSixComplete({
                  baseResearchInput,
                  parentAuditRunId: seeded.parent_audit_run_id,
                  ...(reviewDispatch === undefined ? {} : { reviewDispatch }),
                  runId: body.run_id,
                  schedule: after,
                  supabase,
                  userId,
                });
              } catch (error) {
                console.error(
                  '[run-lab-section] paid-media auto-dispatch failed',
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
