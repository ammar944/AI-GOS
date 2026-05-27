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
import { startManagedAudit } from '@/lib/managed-agents/start-audit';
import {
  corpusReady,
  getOnboardingReviewMetadata,
  loadOwnedResearchSession,
} from '@/lib/research-v2/orchestration-session';
import {
  freezeReviewedBriefSnapshot,
  OrchestrateRpcError,
  seedOrchestration,
} from '@/lib/research-v2/orchestrate-db';

export const runtime = 'nodejs';
export const maxDuration = 300;

const RequestSchema = z
  .object({
    run_id: z.string().uuid(),
    journey_session_id: z.string().uuid().optional(),
    // 'managed' is gated behind MANAGED_AGENTS_POSITIONING_ENABLED; Phase 3
    // will flip the default away from 'deep'.
    executionMode: z.enum(['draft', 'deep', 'managed', 'lab']).optional(),
  })
  .passthrough();

function managedAgentsPositioningEnabled(): boolean {
  return process.env.MANAGED_AGENTS_POSITIONING_ENABLED === 'true';
}

// run-lab-section now ACKs 202 in milliseconds (it defers the long job to
// after()), so a kickoff fetch only has to deliver the request + read the ACK.
// Keep a generous ceiling for serverless cold starts; the work itself runs in
// the sub-invocation, not here.
const LAB_SECTION_KICKOFF_TIMEOUT_MS = 30_000;

interface DispatchLabSectionJobsInput {
  request: Request;
  runId: string;
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

async function dispatchLabSectionJobs(
  input: DispatchLabSectionJobsInput,
): Promise<void> {
  const url = getLabSectionUrl(input.request);
  const headers = buildForwardedLabSectionHeaders(input.request);

  // Await every kickoff. Awaiting is what keeps THIS invocation alive long
  // enough to actually send all six requests — returning before they're sent
  // lets Vercel freeze the function and drop the un-sent fetches, leaving every
  // section stuck at queued. kickoffLabSectionJob never rejects (it logs and
  // resolves), so allSettled simply guarantees all six are delivered.
  await Promise.allSettled(
    POSITIONING_SECTION_IDS.map((sectionId) =>
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
  let userId: string | null;
  try {
    const result = await auth();
    userId = result.userId ?? null;
  } catch {
    userId = null;
  }
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

  try {
    // Managed Agents is the fallback path when the feature flag is on.
    // Explicit body.executionMode ('draft' | 'deep' | 'managed' | 'lab')
    // still wins — used by frontend kickoffs, tests, and rerun-section.
    const effectiveExecutionMode =
      body.executionMode ??
      (managedAgentsPositioningEnabled() ? 'managed' : 'draft');

    if (effectiveExecutionMode === 'managed') {
      if (!managedAgentsPositioningEnabled()) {
        return NextResponse.json(
          {
            error: 'managed_agents_disabled',
            message:
              'executionMode=managed requires MANAGED_AGENTS_POSITIONING_ENABLED=true',
          },
          { status: 403 },
        );
      }
      const managed = await startManagedAudit({
        userId,
        runId: body.run_id,
        gtmBrief: session.onboarding_data ?? {},
        corpusExcerpt:
          (session.research_results?.['deepResearchProgram'] as Record<
            string,
            unknown
          > | null) ?? null,
      });
      await freezeReviewedBriefSnapshot({
        parentAuditRunId: managed.parentAuditRunId,
        gtmBriefSnapshot: session.onboarding_data ?? {},
        gtmBriefReview: getOnboardingReviewMetadata(session.metadata),
      });
      return NextResponse.json(
        {
          parent_audit_run_id: managed.parentAuditRunId,
          section_run_ids: managed.sectionRunIds.map((row) => ({
            section_id: row.sectionId,
            section_run_id: row.sectionRunId,
            ordinal: row.ordinal,
            reused: row.reused,
          })),
          managed_agents: {
            session_id: managed.sessionId,
            coordinator_agent_id: managed.coordinatorAgentId,
            environment_id: managed.environmentId,
            specialist_agent_ids: managed.specialistAgentIds,
          },
        },
        { status: 200 },
      );
    }

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

    if (effectiveExecutionMode === 'lab') {
      await dispatchLabSectionJobs({
        request,
        runId: body.run_id,
      });
      return NextResponse.json(seeded, { status: 200 });
    }

    const workerExecutionMode: 'draft' | 'deep' =
      effectiveExecutionMode === 'draft' || effectiveExecutionMode === 'deep'
        ? effectiveExecutionMode
        : 'deep';
    void kickoffWorker({
      parentAuditRunId: seeded.parent_audit_run_id,
      runId: body.run_id,
      executionMode: workerExecutionMode,
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

const WORKER_KICKOFF_TIMEOUT_MS = 5000;

async function kickoffWorker(input: {
  parentAuditRunId: string;
  runId: string;
  executionMode: 'draft' | 'deep';
}): Promise<void> {
  const workerUrl = process.env.RAILWAY_WORKER_URL?.trim();
  const workerKey = process.env.RAILWAY_API_KEY?.trim();
  if (!workerUrl || !workerKey) {
    console.warn(
      '[orchestrate] worker kickoff skipped — RAILWAY_WORKER_URL/RAILWAY_API_KEY missing',
    );
    return;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), WORKER_KICKOFF_TIMEOUT_MS);
  try {
    const res = await fetch(`${workerUrl}/orchestrate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${workerKey}`,
      },
      body: JSON.stringify({
        parent_audit_run_id: input.parentAuditRunId,
        executionMode: input.executionMode,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      console.warn(
        `[orchestrate] worker kickoff returned ${res.status} for run ${input.runId}: ${body.slice(0, 200)}`,
      );
    }
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    console.warn(
      `[orchestrate] worker kickoff ${isAbort ? 'timed out' : 'failed'} for run ${input.runId}:`,
      err instanceof Error ? err.message : String(err),
    );
  } finally {
    clearTimeout(timer);
  }
}
