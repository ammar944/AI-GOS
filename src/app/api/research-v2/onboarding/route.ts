// Research-v2 onboarding persist route.
//
// Body: { runId: string, data: OnboardingV2Data, reviewMetadata: OnboardingReviewMetadata }
// Writes the reviewed form submission to journey_sessions.onboarding_data
// and stores field review state under journey_sessions.metadata.
//
// Called by page.tsx handleOnboardingComplete BEFORE the ONBOARDING_COMPLETE
// state transition so that buildJourneyResearchDispatchContext can read
// the answers and inject them into every section runner's context string.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OnboardingV2Schema } from '@/lib/research-v2/onboarding-v2-types';
import { createAdminClient } from '@/lib/supabase/server';

const FieldReviewStateSchema = z.enum([
  'AI-filled',
  'User-edited',
  'Missing',
  'Needs review',
]);

const FieldReviewSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  sectionId: z.string().min(1),
  sectionTitle: z.string().min(1),
  state: FieldReviewStateSchema,
  value: z.union([z.string(), z.array(z.string())]),
  aiValue: z.string().nullable().optional(),
  confidence: z.number().nullable().optional(),
  sourceUrl: z.string().nullable().optional(),
  reasoning: z.string().nullable().optional(),
});

const OnboardingReviewMetadataSchema = z.object({
  source: z.literal('onboarding_v2_review').optional(),
  fieldCount: z.number().int().positive(),
  lowConfidenceThreshold: z.number(),
  pinnedFieldKeys: z.array(z.string()),
  counts: z.record(FieldReviewStateSchema, z.number().int().nonnegative()),
  fields: z.record(z.string(), FieldReviewSchema),
});

const RequestSchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  data: OnboardingV2Schema,
  reviewMetadata: OnboardingReviewMetadataSchema,
});

function asMetadataRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

export async function POST(req: Request): Promise<NextResponse> {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { runId, data, reviewMetadata } = parsed.data;

  const supabase = createAdminClient();
  const { data: sessionRow, error: readError } = await supabase
    .from('journey_sessions')
    .select('metadata')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  if (readError) {
    console.error('[research-v2/onboarding] metadata read error', {
      runId,
      userId,
      message: readError.message,
    });
    return NextResponse.json(
      { error: 'Failed to read onboarding metadata' },
      { status: 500 },
    );
  }

  if (!sessionRow) {
    return NextResponse.json(
      { error: 'Session not found for onboarding save' },
      { status: 404 },
    );
  }

  const metadata = {
    ...asMetadataRecord((sessionRow as { metadata?: unknown }).metadata),
    researchV2OnboardingReview: {
      ...reviewMetadata,
      source: 'onboarding_v2_review',
      savedAt: new Date().toISOString(),
    },
  };

  const { error } = await supabase
    .from('journey_sessions')
    .update({ onboarding_data: data, metadata })
    .eq('user_id', userId)
    .eq('run_id', runId);

  if (error) {
    console.error('[research-v2/onboarding] Supabase write error', {
      runId,
      userId,
      message: error.message,
    });
    return NextResponse.json(
      { error: 'Failed to save onboarding data' },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: 'saved' });
}
