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
  OrchestrateRpcError,
  seedOrchestration,
} from '@/lib/research-v2/orchestrate-db';
import { createAdminClient } from '@/lib/supabase/server';

const RequestSchema = z.object({
  journey_session_id: z.string().uuid(),
  run_id: z.string().uuid(),
});

interface JourneySessionRow {
  id: string;
  user_id: string;
  run_id: string | null;
  research_results: Record<string, { status?: string } | null> | null;
}

async function loadOwnedSession(
  userId: string,
  sessionId: string,
): Promise<JourneySessionRow | null> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from('journey_sessions')
    .select('id,user_id,run_id,research_results')
    .eq('id', sessionId)
    .eq('user_id', userId)
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

  const session = await loadOwnedSession(userId, body.journey_session_id);
  if (!session) {
    return NextResponse.json(
      { error: 'session_not_found' },
      { status: 404 },
    );
  }

  if (session.run_id && session.run_id !== body.run_id) {
    return NextResponse.json(
      {
        error: 'run_id_mismatch',
        message: 'run_id does not match the active journey session run',
      },
      { status: 409 },
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
