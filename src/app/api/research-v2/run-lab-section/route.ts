import { auth } from '@clerk/nextjs/server';
import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { POSITIONING_SECTION_IDS } from '@/lib/ai/prompts/positioning-skills';
import { runLabSectionJob } from '@/lib/research-v2/lab-section-job';
import {
  corpusReady,
  getDeepResearchProgramData,
  loadOwnedResearchSession,
} from '@/lib/research-v2/orchestration-session';
import {
  OrchestrateRpcError,
  seedOrchestration,
} from '@/lib/research-v2/orchestrate-db';
import { buildSectionRunIdByZone } from '@/lib/research-v2/section-run-id-map';
import { corpusToResearchInput } from '@/lib/research-v2/corpus-to-research-input';
import { createSupabaseRunStore } from '@/lib/research-v2/supabase-run-store';
import { createAdminClient } from '@/lib/supabase/server';

export const LAB_SECTION_ROUTE_TIMEOUT_MS = 270_000;

export const runtime = 'nodejs';
export const maxDuration = 300;

const RequestSchema = z.object({
  run_id: z.string().uuid(),
  section_id: z.enum(POSITIONING_SECTION_IDS),
});

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
    const seeded = await seedOrchestration({
      userId,
      runId: body.run_id,
      zones: POSITIONING_SECTION_IDS,
    });
    const researchInput = corpusToResearchInput({
      runId: body.run_id,
      deepResearchProgramData,
      onboardingData: session.onboarding_data ?? {},
    });
    const store = createSupabaseRunStore({
      supabase: createAdminClient(),
      parentAuditRunId: seeded.parent_audit_run_id,
      sectionRunIdByZone: buildSectionRunIdByZone(seeded),
      researchInput,
    });

    await store.createRun(researchInput);

    // Hand the long-running section work to after() so it survives the 202
    // ACK. On Vercel after() is backed by waitUntil, which keeps the function
    // alive until the promise settles, bounded by maxDuration (300s). The job
    // is deliberately decoupled from request.signal: the caller is a
    // fire-and-forget kickoff (orchestrate, or the manual console loop) whose
    // connection drops the moment it gets this ACK — wiring request.signal in
    // would abort the downstream work. A standalone timeout is the only bound.
    after(async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => {
        controller.abort(
          new Error(
            `lab section job timed out after ${LAB_SECTION_ROUTE_TIMEOUT_MS}ms`,
          ),
        );
      }, LAB_SECTION_ROUTE_TIMEOUT_MS);
      try {
        await runLabSectionJob({
          runId: body.run_id,
          sectionId: body.section_id,
          signal: controller.signal,
          store,
        });
      } finally {
        clearTimeout(timer);
      }
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
