// Phase 1 of the orchestrator + artifact UI cycle.
//
// POST /api/research-v2/orchestrate
//
// Body: { journey_session_id: uuid, run_id: uuid }
// Returns 200: { parent_audit_run_id, section_run_ids[6] }
// Returns 400: malformed body (Zod failure).
// Returns 401: no Clerk user.
// Returns 404: session_id is not owned by the Clerk user.
// Returns 409: deepResearchProgram corpus has not finished yet.
//
// Idempotent: a second call with the same (journey_session_id, run_id) returns
// the same parent_audit_run_id and the same six section_run_ids — guaranteed
// by the seed_orchestration Postgres RPC.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { jsonError, requireApiUser } from '@/lib/auth/app-access';
import { checkSectionModelDispatchPreflight } from '@/lib/lab-engine/ai/models';
import {
  corpusReady,
  getOnboardingReviewMetadata,
  loadOwnedResearchSession,
} from '@/lib/research-v2/orchestration-session';
import {
  freezeReviewedBriefSnapshot,
  OrchestrateRpcError,
  seedOrchestration,
  type SeedOrchestrationResult,
} from '@/lib/research-v2/orchestrate-db';

export const runtime = 'nodejs';
export const maxDuration = 300;

const RequestSchema = z
  .object({
    run_id: z.string().uuid(),
    journey_session_id: z.string().uuid().optional(),
    executionMode: z.literal('lab').optional(),
  })
  .passthrough();

// run-lab-section now ACKs 202 in milliseconds (it defers the long job to
// after()), so a kickoff fetch only has to deliver the request + read the ACK.
// Keep a generous ceiling for serverless cold starts; the work itself runs in
// the sub-invocation, not here.
const LAB_SECTION_KICKOFF_TIMEOUT_MS = 30_000;

interface DispatchLabSectionJobsInput {
  request: Request;
  runId: string;
  seeded: SeedOrchestrationResult;
}

interface KickoffLabSectionJobInput {
  headers: Record<string, string>;
  runId: string;
  sectionId: (typeof POSITIONING_SECTION_IDS)[number];
  url: string;
}

function buildForwardedLabSectionHeaders(
  request: Request,
): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  const cookie = request.headers.get('cookie');
  const authorization = request.headers.get('authorization');

  if (cookie) {
    headers.Cookie = cookie;
  }

  if (authorization) {
    headers.Authorization = authorization;
  }

  return headers;
}

function getLabSectionUrl(request: Request): string {
  return new URL('/api/research-v2/run-lab-section', request.url).toString();
}

function buildLabSectionProviderPreflightResponse({
  runId,
}: {
  runId: string;
}): NextResponse | null {
  const preflight = checkSectionModelDispatchPreflight();

  if (preflight.ok) {
    return null;
  }

  console.error('[orchestrate] lab section provider preflight failed', {
    runId,
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

async function dispatchLabSectionJobs(
  input: DispatchLabSectionJobsInput,
): Promise<void> {
  const url = getLabSectionUrl(input.request);
  const headers = buildForwardedLabSectionHeaders(input.request);

  // Dispatch gating (layer 1): only kick off zones the seed reports as still
  // 'queued'. A repeated orchestrate POST whose sections are already running or
  // complete becomes a no-op kickoff, so two competing POSTs cannot double the
  // run-lab-section invocations per zone (the dispatch race that produced false
  // section-failed via lost CAS). The seeded result is still returned to the
  // caller unchanged, so idempotency is preserved.
  const queuedSectionIds = input.seeded.section_run_ids
    .filter((row) => row.status === 'queued')
    .map((row) => row.section_id)
    .filter((sectionId): sectionId is (typeof POSITIONING_SECTION_IDS)[number] =>
      (POSITIONING_SECTION_IDS as readonly string[]).includes(sectionId),
    );

  // Await every kickoff. Awaiting is what keeps THIS invocation alive long
  // enough to actually send all the requests — returning before they're sent
  // lets Vercel freeze the function and drop the un-sent fetches, leaving every
  // section stuck at queued. kickoffLabSectionJob never rejects (it logs and
  // resolves), so allSettled simply guarantees they're all delivered.
  await Promise.allSettled(
    queuedSectionIds.map((sectionId) =>
      kickoffLabSectionJob({
        headers,
        runId: input.runId,
        sectionId,
        url,
      }),
    ),
  );
}

async function kickoffLabSectionJob(
  input: KickoffLabSectionJobInput,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    LAB_SECTION_KICKOFF_TIMEOUT_MS,
  );

  try {
    const res = await fetch(input.url, {
      method: 'POST',
      headers: input.headers,
      body: JSON.stringify({
        run_id: input.runId,
        section_id: input.sectionId,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch((): string => '');
      console.warn('[orchestrate:lab] section kickoff returned non-2xx', {
        runId: input.runId,
        sectionId: input.sectionId,
        status: res.status,
        body: body.slice(0, 200),
      });
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn('[orchestrate:lab] section kickoff failed', {
      runId: input.runId,
      sectionId: input.sectionId,
      reason: isAbort ? 'timeout' : 'error',
      message: err instanceof Error ? err.message : String(err),
    });
  } finally {
    clearTimeout(timer);
  }
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

  let body: z.infer<typeof RequestSchema>;
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
        message: 'deepResearchProgram corpus must finish before orchestrating',
      },
      { status: 409 },
    );
  }

  const preflightResponse = buildLabSectionProviderPreflightResponse({
    runId: body.run_id,
  });
  if (preflightResponse !== null) {
    return preflightResponse;
  }

  try {
    const seeded = await seedOrchestration({
      userId,
      runId: body.run_id,
      zones: POSITIONING_SECTION_IDS,
    });

    await freezeReviewedBriefSnapshot({
      parentAuditRunId: seeded.parent_audit_run_id,
      gtmBriefSnapshot: session.onboarding_data ?? {},
      gtmBriefReview: getOnboardingReviewMetadata(session.metadata),
    });

    await dispatchLabSectionJobs({
      request,
      runId: body.run_id,
      seeded,
    });

    return NextResponse.json(seeded, { status: 200 });
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error(
        '[orchestrate] seed_orchestration RPC failed:',
        err.message,
      );
      return NextResponse.json(
        { error: 'seed_failed', message: err.message },
        { status: 500 },
      );
    }
    throw err;
  }
}
