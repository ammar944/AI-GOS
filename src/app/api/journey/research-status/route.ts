// Lightweight status check for a specific research section.
// Used by the identity resolution polling loop to know when the resolver is done.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';

export async function GET(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(req.url);
  const runId = url.searchParams.get('runId');
  const section = url.searchParams.get('section');

  if (!runId || !section) {
    return NextResponse.json({ error: 'runId and section required' }, { status: 400 });
  }

  const supabase = createAdminClient();
  const { data } = await supabase
    .from('journey_sessions')
    .select('research_results')
    .eq('user_id', userId)
    .eq('run_id', runId)
    .maybeSingle();

  const research = data?.research_results as Record<string, unknown> | null;
  const sectionData = research?.[section] as Record<string, unknown> | null;
  const status =
    typeof sectionData?.status === 'string' ? sectionData.status : null;
  const error =
    typeof sectionData?.error === 'string' ? sectionData.error : null;
  const complete = status === 'complete';

  return NextResponse.json({ complete, status, error });
}
