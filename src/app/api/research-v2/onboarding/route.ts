// Research-v2 onboarding persist route.
//
// Body: { runId: string, data: OnboardingV2Data }
// Writes the 47-field form submission to journey_sessions.onboarding_data
// for the authenticated user + matching runId.
//
// Called by page.tsx handleOnboardingComplete BEFORE the ONBOARDING_COMPLETE
// state transition so that buildJourneyResearchDispatchContext can read
// the answers and inject them into every section runner's context string.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { OnboardingV2Schema } from '@/lib/research-v2/onboarding-v2-types';
import { createAdminClient } from '@/lib/supabase/server';

const RequestSchema = z.object({
  runId: z.string().min(1, 'runId is required'),
  data: OnboardingV2Schema,
});

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

  const { runId, data } = parsed.data;

  const supabase = createAdminClient();
  const { error } = await supabase
    .from('journey_sessions')
    .update({ onboarding_data: data })
    .eq('user_id', userId)
    .eq('run_id', runId);

  if (error) {
    console.error('[research-v2/onboarding] Supabase write error:', error);
    return NextResponse.json(
      { error: 'Failed to save onboarding data' },
      { status: 500 },
    );
  }

  return NextResponse.json({ status: 'saved' });
}
