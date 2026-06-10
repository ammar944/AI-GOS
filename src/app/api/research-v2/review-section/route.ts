import { after, NextResponse } from 'next/server';
import { z, ZodError } from 'zod';

import {
  artifactEnvelopeSchema,
  researchInputSchema,
} from '@/lib/lab-engine/artifacts/artifact-envelope';
import { runPostCommitAgenticReview } from '@/lib/research-v2/supabase-run-store';
import { createSupabaseWebhookAdapter } from '@/lib/research-v2/supabase-webhook-adapter';
import { createAdminClient } from '@/lib/supabase/server';

// True W3 detach (ADR-0012): the post-commit agentic review runs in THIS
// dedicated invocation with its own clock, instead of inside the section
// route's residual seconds (285s job + 45s review > 300s maxDuration meant a
// long section's review was guaranteed-killed — the Anura run committed three
// sections with `review unavailable` for exactly this reason). The section
// route's commit path POSTs the full review payload here and only awaits the
// 202 ACK; the review itself runs in after().
export const runtime = 'nodejs';
export const maxDuration = 120;

const internalKeyHeader = 'x-internal-key';

const RequestSchema = z.object({
  userId: z.string().min(1),
  parentAuditRunId: z.string().min(1),
  sectionRunId: z.string().min(1),
  committedRevision: z.number().int().nonnegative(),
  completedAt: z.string().min(1),
  degradeToNeedsReview: z.boolean(),
  reviewTimeoutMs: z.number().int().positive(),
  artifact: artifactEnvelopeSchema,
  researchInput: researchInputSchema,
});

export async function POST(request: Request): Promise<Response> {
  const internalKey = process.env.RAILWAY_API_KEY?.trim();

  if (internalKey === undefined || internalKey === '') {
    return NextResponse.json(
      { error: 'review_dispatch_unconfigured' },
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

  after(async (): Promise<void> => {
    try {
      const supabase = createAdminClient();
      await runPostCommitAgenticReview({
        adapter: createSupabaseWebhookAdapter(supabase),
        artifact: body.artifact,
        committedRevision: body.committedRevision,
        completedAt: body.completedAt,
        degradeToNeedsReview: body.degradeToNeedsReview,
        parentAuditRunId: body.parentAuditRunId,
        researchInput: body.researchInput,
        reviewTimeoutMs: body.reviewTimeoutMs,
        sectionRunId: body.sectionRunId,
        supabase,
        userId: body.userId,
      });
    } catch (error) {
      console.warn('[review-section] detached agentic review failed', {
        sectionRunId: body.sectionRunId,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  });

  return NextResponse.json(
    { scheduled: true, sectionRunId: body.sectionRunId },
    { status: 202 },
  );
}
