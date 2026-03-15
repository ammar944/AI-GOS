// Direct research dispatch — no lead agent.
// Frontend calls this when a section needs to start researching.
//
// IMPORTANT: This route stamps the activeJourneyRunId into Supabase metadata
// BEFORE dispatching to the worker. The worker's isActiveJourneyRun() guard
// reads this value to decide whether to write results — if the run ID hasn't
// been committed yet, the worker silently drops the write.

import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';
import { dispatchResearchForUser } from '@/lib/ai/tools/research/dispatch';
import { createAdminClient } from '@/lib/supabase/server';

const SECTION_TO_TOOL: Record<string, string> = {
  industryMarket: 'researchIndustry',
  competitors: 'researchCompetitors',
  icpValidation: 'researchICP',
  offerAnalysis: 'researchOffer',
  crossAnalysis: 'synthesizeResearch',
  keywordIntel: 'researchKeywords',
  mediaPlan: 'researchMediaPlan',
};

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await req.json();
  const { section, runId, context } = body as {
    section: string;
    runId: string;
    context: string;
  };

  if (!section || !context) {
    return NextResponse.json(
      { error: 'Missing required fields: section, context' },
      { status: 400 },
    );
  }

  const tool = SECTION_TO_TOOL[section];
  if (!tool) {
    return NextResponse.json(
      { error: `Unknown section: ${section}` },
      { status: 400 },
    );
  }

  // Ensure the activeJourneyRunId is committed to Supabase BEFORE the worker
  // checks isActiveJourneyRun(). Without this, the fire-and-forget PATCH from
  // resetResearchState may not have landed yet, causing the worker to silently
  // drop the write.
  if (runId) {
    const supabase = createAdminClient();
    await supabase.rpc('merge_journey_session_metadata_keys', {
      p_user_id: userId,
      p_keys: {
        activeJourneyRunId: runId,
        lastUpdated: new Date().toISOString(),
      },
    });
  }

  const result = await dispatchResearchForUser(tool, section, context, userId, {
    activeRunId: runId,
  });

  return NextResponse.json(result);
}
