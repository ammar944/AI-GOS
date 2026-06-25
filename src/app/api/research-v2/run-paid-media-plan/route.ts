import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import { PAID_MEDIA_PLAN_SECTION_ID } from '@/lib/ai/prompts/positioning-skills';
import { researchInputSchema } from '@/lib/lab-engine/artifacts/artifact-envelope';
import {
  PAID_MEDIA_PLAN_JOB_TIMEOUT_MS,
  scheduleLabSectionJob,
} from '@/lib/research-v2/lab-section-dispatch';
import { createAdminClient } from '@/lib/supabase/server';

// Dedicated composer route. The paid-media plan is a single ~385s GLM compose
// (owner-paid live clay run) + projector second pass. This route runs it on its
// OWN maxDuration=800 clock with a 760s job deadline
// (PAID_MEDIA_PLAN_JOB_TIMEOUT_MS), isolated from six-section fan-out. Internal
// x-internal-key auth (server-to-server kickoff from run-lab-section's 6/6
// rollup); registered in middleware.
export const runtime = 'nodejs';
export const maxDuration = 800;

const internalKeyHeader = 'x-internal-key';

const RequestSchema = z.object({
  user_id: z.string().min(1),
  run_id: z.string().uuid(),
  research_input: researchInputSchema,
});

export async function POST(request: Request): Promise<Response> {
  const internalKey = process.env.RAILWAY_API_KEY?.trim();

  if (internalKey === undefined || internalKey === '') {
    return NextResponse.json(
      { error: 'paid_media_dispatch_unconfigured' },
      { status: 503 },
    );
  }

  if (request.headers.get(internalKeyHeader)?.trim() !== internalKey) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: z.infer<typeof RequestSchema>;
  try {
    body = RequestSchema.parse(await request.json());
  } catch (error) {
    return NextResponse.json(
      {
        error: 'invalid_request',
        message:
          error instanceof ZodError
            ? error.issues
                .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
                .join('; ')
            : String(error),
      },
      { status: 400 },
    );
  }

  // Mirror the detached-review shape so the paid-media plan's own post-commit
  // review still runs (parity with the prior in-process dispatch), derived from
  // this route's URL.
  const reviewDispatch = {
    url: new URL('/api/research-v2/review-section', request.url).toString(),
    internalKey,
  };

  // seedOrchestration + claim + prepareContext run in-request (fast DB ops);
  // the ~385s composer itself runs in this route's after() under the 760s job
  // deadline + 800s platform cap. CAS in claimSectionRun de-dupes a double
  // trigger (the client poll path may also fire paid-media).
  try {
    await scheduleLabSectionJob({
      userId: body.user_id,
      runId: body.run_id,
      sectionId: PAID_MEDIA_PLAN_SECTION_ID,
      zones: [PAID_MEDIA_PLAN_SECTION_ID],
      supabase: createAdminClient(),
      researchInput: body.research_input,
      schedule: after,
      jobTimeoutMs: PAID_MEDIA_PLAN_JOB_TIMEOUT_MS,
      reviewDispatch,
    });
  } catch (error) {
    console.warn('[run-paid-media-plan] composer dispatch failed', {
      runId: body.run_id,
      message: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { error: 'dispatch_failed' },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { scheduled: true, run_id: body.run_id },
    { status: 202 },
  );
}
