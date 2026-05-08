// Research-v2 refine endpoint.
//
// Body: { runId, sectionId?, instruction }
// Response: { status: 'queued' | 'already_running' | 'not_implemented' }
//
// TODO(Phase 5): implement worker-side refine path.
//   - Write instruction into journey_sessions.research_results.<sectionId>.refinementHistory
//   - Proxy to the worker with instruction prepended to the section runner prompt
//   - Output replaces the section in the artifact + appends a chat message
// For now: stub returns { status: 'not_implemented' } so the UI can display a
// helpful message without blocking Phase 4 QA.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

interface RefineRequest {
  runId?: unknown;
  sectionId?: unknown;
  instruction?: unknown;
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await req.json()) as RefineRequest;

  const runId =
    typeof body.runId === 'string' && body.runId.trim().length > 0
      ? body.runId.trim()
      : null;
  const instruction =
    typeof body.instruction === 'string' && body.instruction.trim().length > 0
      ? body.instruction.trim()
      : null;

  if (!runId || !instruction) {
    return NextResponse.json(
      { error: 'Missing required fields: runId, instruction' },
      { status: 400 },
    );
  }

  // TODO(Phase 5): implement worker proxy + refinementHistory write
  return NextResponse.json({ status: 'not_implemented' });
}
