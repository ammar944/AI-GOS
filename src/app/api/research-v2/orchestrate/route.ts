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
import {
  freezeReviewedBriefSnapshot,
  OrchestrateRpcError,
  seedOrchestration,
} from '@/lib/research-v2/orchestrate-db';
import { createAdminClient } from '@/lib/supabase/server';

const RequestSchema = z
  .object({
    run_id: z.string().uuid(),
    journey_session_id: z.string().uuid().optional(),
  })
  .passthrough();

interface JourneySessionRow {
  id: string;
  user_id: string;
  run_id: string | null;
  research_results: Record<string, { status?: string } | null> | null;
  onboarding_data: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
}

async function loadOwnedSession(
  userId: string,
  runId: string,
): Promise<JourneySessionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id,user_id,run_id,research_results,onboarding_data,metadata')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (error) {
    console.warn('[orchestrate] journey_sessions read failed:', error.message);
    return null;
  }
  return (data as JourneySessionRow | null) ?? null;
}

function corpusReady(session: JourneySessionRow): boolean {
  const results = session.research_results ?? {};
  const corpus = results['deepResearchProgram'];
  return corpus?.status === 'complete';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return null;
}

function getOnboardingReviewMetadata(
  metadata: Record<string, unknown> | null,
): Record<string, unknown> | null {
  return asRecord(metadata?.researchV2OnboardingReview);
}

export async function POST(request: Request): Promise<NextResponse> {
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

  const session = await loadOwnedSession(userId, body.run_id);
  if (!session) {
    return NextResponse.json(
      { error: 'session_not_found' },
      { status: 404 },
    );
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

    void kickoffWorker({
      parentAuditRunId: seeded.parent_audit_run_id,
      runId: body.run_id,
    });

    return NextResponse.json(seeded, { status: 200 });
  } catch (err) {
    if (err instanceof OrchestrateRpcError) {
      console.error('[orchestrate] seed_orchestration RPC failed:', err.message);
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
