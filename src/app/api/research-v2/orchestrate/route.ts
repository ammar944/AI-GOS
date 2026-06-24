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
//
// After seeding + freezing the brief, this route kicks off the chained GLM
// orchestrator (/run-orchestrator) and returns the seeded 200 immediately. The
// GLM orchestrator + the six-section fan-out now run in /run-orchestrator's
// after() (NOT inline here) so the ~161-340s orchestrator latency never blocks
// this response.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { jsonError, requireApiUser } from '@/lib/auth/app-access';
import { buildLabSectionProviderPreflightResponse } from '@/lib/research-v2/lab-section-preflight';
import {
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

// run-orchestrator ACKs 202 in milliseconds (it defers the long GLM
// orchestrator + section fan-out to after()), so this kickoff fetch only has to
// deliver the request + read the ACK. Keep a generous ceiling for serverless
// cold starts; the orchestrator work runs in the chained sub-invocation.
const ORCHESTRATOR_KICKOFF_TIMEOUT_MS = 30_000;

interface KickoffOrchestratorInput {
  request: Request;
  runId: string;
  seeded: SeedOrchestrationResult;
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

// Kick off the chained GLM orchestrator (run-orchestrator), which runs the
// research orchestrator, promotes its facts to the shared ledger, and THEN fans
// out the six positioning sections to /run-lab-section so they start AFTER the
// orchestrator facts are written. The long work happens in run-orchestrator's
// after() (maxDuration=800), NOT inline here — a 300s blocking /orchestrate
// response would be fragile against the ~161-340s orchestrator latency.
//
// Dispatch gating (layer 1): only kick the orchestrator when the seed still
// reports queued sections. A repeated orchestrate POST whose sections are
// already running or complete becomes a no-op kickoff, so two competing POSTs
// cannot double the GLM orchestrator run (and the downstream fan-out). The
// seeded result is still returned to the caller unchanged, so idempotency is
// preserved.
async function kickoffOrchestrator(
  input: KickoffOrchestratorInput,
): Promise<void> {
  const hasQueuedSections = input.seeded.section_run_ids.some(
    (row) =>
      row.status === 'queued' &&
      (POSITIONING_SECTION_IDS as readonly string[]).includes(row.section_id),
  );

  if (!hasQueuedSections) {
    console.info('[orchestrate] no queued sections — skipping orchestrator', {
      runId: input.runId,
    });
    return;
  }

  const url = new URL(
    '/api/research-v2/run-orchestrator',
    input.request.url,
  ).toString();
  const headers = buildForwardedLabSectionHeaders(input.request);

  console.info('[orchestrate] kicking off chained orchestrator', {
    runId: input.runId,
    parentAuditRunId: input.seeded.parent_audit_run_id,
  });

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    ORCHESTRATOR_KICKOFF_TIMEOUT_MS,
  );

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        run_id: input.runId,
        parent_audit_run_id: input.seeded.parent_audit_run_id,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch((): string => '');
      console.warn('[orchestrate] orchestrator kickoff returned non-2xx', {
        runId: input.runId,
        status: res.status,
        body: body.slice(0, 200),
      });
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn('[orchestrate] orchestrator kickoff failed', {
      runId: input.runId,
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

  const preflightResponse = buildLabSectionProviderPreflightResponse({
    runId: body.run_id,
    logTag: '[orchestrate]',
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

    await kickoffOrchestrator({
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
